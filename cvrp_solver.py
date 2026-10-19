#!/usr/bin/env python3
"""
Waste Wise Routing Engine (Production Release) - Unified Solver
----------------------------------------------------------------
Algorithm: OR-Tools (if available) -> LNS Heuristic (fallback)
Map Provider: Mappls (MapmyIndia) with Haversine Fallback
Output: JSON to stdout { routes: [{vehicle_id, nodes:[{index,lat,lng}], distance, load}], total_distance, algorithm, data_source }
Input : JSON via stdin { locations: [{lat,lng}|[lat,lng]], demands, vehicle_capacities|vehicle_capacity, num_vehicles, depot, mappls_api_key }
"""

import sys
import json
import math
import random
import os
import time
import logging
from typing import List, Dict, Tuple, Optional, Any

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger("WasteWiseRouter")

try:
    import requests
except ImportError:
    requests = None
    logger.warning("requests not available - Mappls disabled, Haversine only")

Coord = Tuple[float, float]
Matrix = List[List[int]]
Route = List[int]
Solution = List[Route]

# Try OR-Tools import - optional
try:
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2
    ORTOOLS_AVAILABLE = True
    logger.info("OR-Tools available")
except Exception as e:
    ORTOOLS_AVAILABLE = False
    logger.info(f"OR-Tools not available: {e} - using LNS fallback")


class WasteWiseOptimizer:
    """LNS heuristic solver - pure python, no ortools required"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("MAPPLS_API_KEY")
        if not self.api_key:
            logger.warning("No Mappls API key - using Haversine distance.")

    def _get_mappls_matrix(self, coords: List[Coord]) -> Optional[Matrix]:
        if not self.api_key or requests is None:
            return None
        locations = ";".join([f"{lng},{lat}" for lat, lng in coords])
        url = f"https://apis.mappls.com/advancedmaps/v1/{self.api_key}/distance_matrix/driving/{locations}"
        params = {"sources": "all", "destinations": "all"}
        try:
            start_t = time.time()
            response = requests.get(url, params=params, timeout=5)
            response.raise_for_status()
            data = response.json()
            if "results" not in data or "distances" not in data["results"]:
                logger.error(f"Mappls invalid response: {data}")
                return None
            matrix = []
            for row in data["results"]["distances"]:
                matrix.append([int(d) for d in row])
            logger.info(f"Mappls API success in {time.time() - start_t:.2f}s")
            return matrix
        except Exception as e:
            logger.error(f"Mappls error: {e}")
            return None

    def _get_osrm_matrix(self, coords: List[Coord]) -> Optional[Matrix]:
        """OSRM public table API — no key, road distance. Free fallback between Mappls and Haversine."""
        if requests is None:
            return None
        try:
            # OSRM expects lng,lat
            coord_str = ";".join([f"{lng},{lat}" for lat, lng in coords])
            url = f"https://router.project-osrm.org/table/v1/driving/{coord_str}"
            params = {"annotations": "distance"}
            start_t = time.time()
            resp = requests.get(url, params=params, timeout=8)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != "Ok" or "distances" not in data:
                logger.warning(f"OSRM table invalid: {data}")
                return None
            # OSRM distances are float meters, can be null for unreachable
            matrix = []
            for row in data["distances"]:
                matrix.append([int(round(v)) if v is not None else 999999 for v in row])
            logger.info(f"OSRM table success {len(coords)}x{len(coords)} in {time.time()-start_t:.2f}s")
            return matrix
        except Exception as e:
            logger.warning(f"OSRM table failed: {e}")
            return None

    def _haversine_matrix(self, coords: List[Coord]) -> Matrix:
        n = len(coords)
        matrix = [[0] * n for _ in range(n)]
        R = 6371000.0
        for i in range(n):
            for j in range(i + 1, n):
                lat1, lon1 = math.radians(coords[i][0]), math.radians(coords[i][1])
                lat2, lon2 = math.radians(coords[j][0]), math.radians(coords[j][1])
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
                c = 2 * math.asin(math.sqrt(a))
                dist = int(R * c)
                matrix[i][j] = dist
                matrix[j][i] = dist
        return matrix

    def get_distance_matrix(self, coords: List[Coord]) -> Tuple[Matrix, str]:
        # 1. Mappls (paid, most accurate)
        matrix = self._get_mappls_matrix(coords)
        if matrix:
            return matrix, "Mappls (Roads)"
        # 2. OSRM (free road distance) — true road KM
        matrix = self._get_osrm_matrix(coords)
        if matrix:
            return matrix, "OSRM (Roads)"
        logger.warning("Falling back to Haversine distance.")
        return self._haversine_matrix(coords), "Haversine (Fallback)"

    def _calculate_cost(self, solution: Solution, matrix: Matrix, depot: int) -> int:
        total = 0
        for route in solution:
            if not route:
                continue
            prev = depot
            for node in route:
                total += matrix[prev][node]
                prev = node
            total += matrix[prev][depot]
        return total

    def _can_fit(self, route: Route, node: int, demands: List[int], capacity: int) -> bool:
        return sum(demands[n] for n in route) + demands[node] <= capacity

    def _greedy_repair(self, routes: Solution, unassigned: List[int], matrix: Matrix, demands: List[int], capacity: int, depot: int) -> Solution:
        while unassigned:
            best = (float('inf'), None, -1, -1)
            for node in unassigned:
                for r_idx, route in enumerate(routes):
                    if not self._can_fit(route, node, demands, capacity):
                        continue
                    for i in range(len(route) + 1):
                        prev = depot if i == 0 else route[i-1]
                        nxt = depot if i == len(route) else route[i]
                        increase = matrix[prev][node] + matrix[node][nxt] - matrix[prev][nxt]
                        if increase < best[0]:
                            best = (increase, node, r_idx, i)
            cost, best_node, r_idx, pos = best
            if best_node is None:
                if unassigned:
                    panic = unassigned.pop(0)
                    # try to place in route with most remaining capacity
                    best_r = min(range(len(routes)), key=lambda x: sum(demands[n] for n in routes[x]))
                    routes[best_r].append(panic)
                    logger.warning(f"Capacity overflow: forced bin {panic} into vehicle {best_r}")
                continue
            routes[r_idx].insert(pos, best_node)
            unassigned.remove(best_node)
        return routes

    def _random_destroy(self, routes: Solution, num_remove: int) -> Tuple[Solution, List[int]]:
        new_routes = [r[:] for r in routes]
        node_map = [(r_idx, node) for r_idx, route in enumerate(new_routes) for node in route]
        if num_remove > len(node_map):
            num_remove = len(node_map)
        if num_remove == 0:
            return new_routes, []
        targets = random.sample(node_map, num_remove)
        target_nodes = set(t[1] for t in targets)
        cleaned = [[n for n in route if n not in target_nodes] for route in new_routes]
        return cleaned, list(target_nodes)

    def solve(self, coords: List[Coord], demands: List[int], vehicle_cap: int, num_vehicles: int, depot: int = 0, matrix: Optional[Matrix] = None, source: Optional[str] = None) -> Dict[str, Any]:
        if matrix is None or source is None:
            matrix, source = self.get_distance_matrix(coords)
        all_nodes = [i for i in range(len(coords)) if i != depot]
        logger.info(f"Solving with {len(coords)} nodes, {num_vehicles} vehicles, cap {vehicle_cap}, source: {source}")
        routes = [[] for _ in range(num_vehicles)]
        routes = self._greedy_repair(routes, all_nodes[:], matrix, demands, vehicle_cap, depot)
        best = [r[:] for r in routes]
        best_cost = self._calculate_cost(best, matrix, depot)
        iterations = 200 if len(coords) < 50 else 500
        destroy_amt = max(1, int(len(all_nodes) * 0.25))
        curr = [r[:] for r in routes]
        for _ in range(iterations):
            temp, removed = self._random_destroy(curr, destroy_amt)
            temp = self._greedy_repair(temp, removed, matrix, demands, vehicle_cap, depot)
            temp_cost = self._calculate_cost(temp, matrix, depot)
            if temp_cost < best_cost:
                best = [r[:] for r in temp]
                best_cost = temp_cost
                curr = temp
            else:
                curr = [r[:] for r in best]
        output_routes = []
        for idx, r in enumerate(best):
            full_path = [depot] + r + [depot]
            route_dist = sum(matrix[full_path[i]][full_path[i+1]] for i in range(len(full_path)-1))
            enriched = [{"index": n, "lat": coords[n][0], "lng": coords[n][1]} for n in full_path]
            output_routes.append({"vehicle_id": idx, "nodes": enriched, "distance": route_dist, "load": sum(demands[n] for n in r)})
        return {"routes": output_routes, "total_distance": best_cost, "algorithm": "LNS + Constructive Heuristic", "data_source": source}


def build_distance_matrix_haversine(coords: List[Coord]) -> Matrix:
    n = len(coords)
    matrix = [[0]*n for _ in range(n)]
    R = 6371000.0
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            lat1, lon1 = math.radians(coords[i][0]), math.radians(coords[i][1])
            lat2, lon2 = math.radians(coords[j][0]), math.radians(coords[j][1])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
            matrix[i][j] = int(R * 2 * math.asin(math.sqrt(h)))
    return matrix


def try_ortools_solve(coords: List[Coord], demands: List[int], vehicle_capacities: List[int], num_vehicles: int, depot: int, distance_matrix: Matrix) -> Optional[Dict[str, Any]]:
    if not ORTOOLS_AVAILABLE:
        return None
    try:
        manager = pywrapcp.RoutingIndexManager(len(distance_matrix), num_vehicles, depot)
        routing = pywrapcp.RoutingModel(manager)

        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return distance_matrix[from_node][to_node]

        transit_idx = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_idx)

        def demand_callback(from_index):
            from_node = manager.IndexToNode(from_index)
            return demands[from_node]

        demand_idx = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(demand_idx, 0, vehicle_capacities, True, 'Capacity')

        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        search_parameters.time_limit.seconds = 5

        solution = routing.SolveWithParameters(search_parameters)
        if not solution:
            logger.warning("OR-Tools failed to find solution")
            return None

        routes = []
        total_distance = 0
        for vehicle_id in range(num_vehicles):
            index = routing.Start(vehicle_id)
            route_nodes = []
            route_distance = 0
            while not routing.IsEnd(index):
                node = manager.IndexToNode(index)
                route_nodes.append(int(node))
                previous_index = index
                index = solution.Value(routing.NextVar(index))
                route_distance += routing.GetArcCostForVehicle(previous_index, index, vehicle_id)
            route_nodes.append(int(manager.IndexToNode(index)))
            # enrich
            enriched = [{"index": idx, "lat": coords[idx][0], "lng": coords[idx][1]} for idx in route_nodes]
            routes.append({"vehicle_id": vehicle_id, "nodes": enriched, "distance": int(route_distance), "load": sum(demands[n] for n in route_nodes if n != depot)})
            total_distance += route_distance

        return {"routes": routes, "total_distance": int(total_distance), "algorithm": "OR-Tools", "data_source": "Haversine + OR-Tools"}
    except Exception as e:
        logger.exception(f"OR-Tools solve failed: {e}")
        return None


def main():
    try:
        raw = sys.stdin.read().strip()
        if not raw:
            # demo mode - provide sample
            coords = [(12.9716, 77.5946), (12.9720, 77.5950), (12.9750, 77.5900), (12.9800, 77.5930)]
            demands = [0, 1, 1, 2]
            vehicle_capacities = [3, 3]
            num_vehicles = 2
            depot = 0
            mappls_api_key = os.environ.get("MAPPLS_API_KEY")
            optimizer = WasteWiseOptimizer(api_key=mappls_api_key)
            result = optimizer.solve(coords, demands, vehicle_capacities[0], num_vehicles, depot, matrix=None, source=None)
            print(json.dumps(result))
            return

        payload = json.loads(raw)

        # parse locations
        locs_raw = payload.get('locations') or payload.get('coords') or []
        coords: List[Coord] = []
        for l in locs_raw:
            if isinstance(l, dict):
                coords.append((float(l.get('lat')), float(l.get('lng'))))
            elif isinstance(l, (list, tuple)) and len(l) >= 2:
                coords.append((float(l[0]), float(l[1])))
            else:
                logger.warning(f"Skipping invalid location: {l}")

        if not coords:
            print(json.dumps({"error": "No coordinates provided"}))
            return

        n = len(coords)
        # demands
        if payload.get('demands') and len(payload['demands']) == n:
            demands = [int(d) for d in payload['demands']]
        else:
            demands = [0]*n
            # if fullness present in locations, derive? fallback 1 per node except depot
            depot_idx = int(payload.get('depot', 0))
            for i in range(n):
                if i != depot_idx:
                    demands[i] = 1

        # vehicle capacities
        if payload.get('vehicle_capacities'):
            vehicle_capacities = [int(c) for c in payload['vehicle_capacities']]
        elif payload.get('vehicle_capacity'):
            vehicle_capacities = [int(payload['vehicle_capacity'])] * int(payload.get('num_vehicles', 1))
        else:
            vehicle_capacities = [10] * int(payload.get('num_vehicles', 1) or 1)

        num_vehicles = int(payload.get('num_vehicles', len(vehicle_capacities)))
        # ensure capacities length matches num_vehicles
        if len(vehicle_capacities) < num_vehicles:
            # pad with last capacity
            last = vehicle_capacities[-1] if vehicle_capacities else 10
            vehicle_capacities += [last] * (num_vehicles - len(vehicle_capacities))
        elif len(vehicle_capacities) > num_vehicles:
            vehicle_capacities = vehicle_capacities[:num_vehicles]

        depot = int(payload.get('depot', 0))
        if depot < 0 or depot >= n:
            depot = 0

        api_key = payload.get("mappls_api_key") or os.environ.get("MAPPLS_API_KEY")

        # Build distance matrix once
        optimizer = WasteWiseOptimizer(api_key=api_key)
        matrix, source = optimizer.get_distance_matrix(coords)

        # Try OR-Tools first
        ortools_result = try_ortools_solve(coords, demands, vehicle_capacities, num_vehicles, depot, matrix)
        if ortools_result:
            # enrich source
            ortools_result["data_source"] = source + " + OR-Tools"
            print(json.dumps(ortools_result))
            return

        # Fallback to LNS - use the most restrictive capacity as single cap; LNS handles heterogeneous via per-route? For now use min capacity and then after solve, split if needed
        # For true heterogeneous, we use LNS iteratively per vehicle capacity - simplified: use average cap
        # Use first capacity for LNS (it assumes uniform). For better, we run LNS with max capacity then validate.
        # Instead we pass max capacity and let LNS run, then if overflow due to heterogeneous, it's okay - JS fallback also uniform.
        # To respect heterogeneous, use min capacity as safe uniform
        uniform_cap = min(vehicle_capacities) if vehicle_capacities else 10
        # If capacities differ, log warning
        if len(set(vehicle_capacities)) > 1:
            logger.info(f"Heterogeneous capacities {vehicle_capacities} - LNS using uniform {uniform_cap}")

        result = optimizer.solve(coords, demands, uniform_cap, num_vehicles, depot, matrix=matrix, source=source)
        print(json.dumps(result))

    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON input"}))
        sys.exit(1)
    except Exception as e:
        logger.exception("Critical Failure")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
