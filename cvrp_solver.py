#!/usr/bin/env python3
"""
Waste Wise Routing Engine (Production Release)
------------------------------------------------
Algorithm: Constructive Heuristic (Cheapest Insertion) + Large Neighborhood Search (LNS)
Map Provider: Mappls (MapmyIndia) with Haversine Fallback
Author: Waste Wise Team
License: Proprietary
"""

import sys
import json
import math
import random
import os
import requests
import logging
import time
from typing import List, Dict, Tuple, Optional, Any

# --- Configuration & Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr)  # Log to stderr so stdout stays clean for JSON
    ]
)
logger = logging.getLogger("WasteWiseRouter")

# Type Aliases for clarity
Coord = Tuple[float, float]
Matrix = List[List[int]]
Route = List[int]
Solution = List[Route]


class WasteWiseOptimizer:
    """
    Production-grade solver class for the CVRP problem using Mappls data.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the optimizer.
        :param api_key: Mappls API Key. If None, checks os.environ['MAPPLS_API_KEY'].
        """
        self.api_key = api_key or os.environ.get("MAPPLS_API_KEY")
        if not self.api_key:
            logger.warning("No API key provided. Engine will default to Haversine distance.")

    # ==========================================
    # Core Logic: Distance Calculation
    # ==========================================

    def _get_mappls_matrix(self, coords: List[Coord]) -> Optional[Matrix]:
        """
        Fetches driving distance matrix from Mappls API.
        """
        if not self.api_key:
            return None

        # Mappls expects "lng,lat" format
        locations = ";".join([f"{lng},{lat}" for lat, lng in coords])
        
        # NOTE: Verify specific endpoint version based on your API Key type (REST vs Legacy)
        url = f"https://apis.mappls.com/advancedmaps/v1/{self.api_key}/distance_matrix/driving/{locations}"
        
        params = {"sources": "all", "destinations": "all"}
        
        try:
            start_t = time.time()
            response = requests.get(url, params=params, timeout=5)
            response.raise_for_status()
            data = response.json()
            
            # Validate response structure
            if "results" not in data or "distances" not in data["results"]:
                logger.error(f"Mappls API invalid response: {data}")
                return None
                
            matrix = []
            for row in data["results"]["distances"]:
                matrix.append([int(d) for d in row])
                
            logger.info(f"Mappls API success in {time.time() - start_t:.2f}s")
            return matrix

        except requests.exceptions.RequestException as e:
            logger.error(f"Mappls API Connection Error: {str(e)}")
            return None
        except Exception as e:
            logger.exception(f"Unexpected error in Mappls fetch: {e}")
            return None

    def _haversine_matrix(self, coords: List[Coord]) -> Matrix:
        """Fallback mathematical distance calculation (Crow flies)."""
        n = len(coords)
        matrix = [[0] * n for _ in range(n)]
        R = 6371000.0  # Earth radius in meters

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
        """
        Orchestrates matrix retrieval: Tries Mappls -> Falls back to Haversine.
        Returns (Matrix, SourceName).
        """
        matrix = self._get_mappls_matrix(coords)
        if matrix:
            return matrix, "Mappls (Roads)"
        
        logger.warning("Falling back to Haversine distance.")
        return self._haversine_matrix(coords), "Haversine (Fallback)"

    # ==========================================
    # Algorithm: LNS (Large Neighborhood Search)
    # ==========================================

    def _calculate_cost(self, solution: Solution, matrix: Matrix, depot: int) -> int:
        total_dist = 0
        for route in solution:
            if not route: continue
            prev = depot
            for node in route:
                total_dist += matrix[prev][node]
                prev = node
            total_dist += matrix[prev][depot]
        return total_dist

    def _can_fit(self, route: Route, node: int, demands: List[int], capacity: int) -> bool:
        current_load = sum(demands[n] for n in route)
        return (current_load + demands[node]) <= capacity

    def _greedy_repair(self, routes: Solution, unassigned: List[int], 
                      matrix: Matrix, demands: List[int], 
                      capacity: int, depot: int) -> Solution:
        """
        Inserts unassigned nodes into the best available position (Cheapest Insertion).
        """
        while unassigned:
            best_metrics = (float('inf'), None, -1, -1) # (cost_increase, node, route_idx, pos)
            
            for node in unassigned:
                for r_idx, route in enumerate(routes):
                    if not self._can_fit(route, node, demands, capacity):
                        continue
                    
                    for i in range(len(route) + 1):
                        prev = depot if i == 0 else route[i-1]
                        nxt = depot if i == len(route) else route[i]
                        
                        cost_added = matrix[prev][node] + matrix[node][nxt]
                        cost_removed = matrix[prev][nxt]
                        increase = cost_added - cost_removed
                        
                        if increase < best_metrics[0]:
                            best_metrics = (increase, node, r_idx, i)
            
            cost, best_node, r_idx, pos = best_metrics
            
            if best_node is None:
                # Critical Fail: Bin fits nowhere. Force logic or create new route?
                # For this implementation, we force add to first route (Safety Valve)
                if unassigned:
                    panic_node = unassigned.pop(0)
                    routes[0].append(panic_node)
                    logger.warning(f"Capacity overflow: Forced bin {panic_node} into vehicle 0")
                continue

            routes[r_idx].insert(pos, best_node)
            unassigned.remove(best_node)
            
        return routes

    def _random_destroy(self, routes: Solution, num_remove: int) -> Tuple[Solution, List[int]]:
        """Randomly removes 'num_remove' nodes from the solution."""
        new_routes = [r[:] for r in routes]
        
        # Flatten structure to pick nodes
        node_map = []
        for r_idx, route in enumerate(new_routes):
            for node in route:
                node_map.append((r_idx, node))
        
        if num_remove > len(node_map):
            num_remove = len(node_map)
            
        targets = random.sample(node_map, num_remove)
        target_nodes = set(t[1] for t in targets)
        
        # Rebuild routes without targets
        cleaned_routes = []
        for route in new_routes:
            cleaned_routes.append([n for n in route if n not in target_nodes])
            
        return cleaned_routes, list(target_nodes)

    def solve(self, coords: List[Coord], demands: List[int], 
             vehicle_cap: int, num_vehicles: int, depot: int = 0) -> Dict[str, Any]:
        """
        Main entry point for solving the VRP.
        """
        # 1. Get Data
        matrix, source = self.get_distance_matrix(coords)
        all_nodes = [i for i in range(len(coords)) if i != depot]
        
        # 2. Initial Solution (Constructive)
        logger.info(f"Starting solver with {len(coords)} nodes, Source: {source}")
        routes = [[] for _ in range(num_vehicles)]
        routes = self._greedy_repair(routes, all_nodes[:], matrix, demands, vehicle_cap, depot)
        
        best_solution = [r[:] for r in routes]
        best_cost = self._calculate_cost(best_solution, matrix, depot)
        
        # 3. Optimization Loop (LNS)
        iterations = 200 if len(coords) < 50 else 500
        destroy_amt = max(1, int(len(all_nodes) * 0.25))
        
        for _ in range(iterations):
            temp_routes, removed = self._random_destroy(routes, destroy_amt)
            temp_routes = self._greedy_repair(temp_routes, removed, matrix, demands, vehicle_cap, depot)
            temp_cost = self._calculate_cost(temp_routes, matrix, depot)
            
            # Hill Climbing Acceptance
            if temp_cost < best_cost:
                best_solution = [r[:] for r in temp_routes]
                best_cost = temp_cost
                routes = temp_routes # Accept improvement
            else:
                routes = [r[:] for r in best_solution] # Revert
                
        # 4. Format Output
        output_routes = []
        for idx, r in enumerate(best_solution):
            full_path = [depot] + r + [depot]
            
            # Calculate precise road distance for final display
            route_dist = 0
            enriched_nodes = []
            
            for i in range(len(full_path)-1):
                route_dist += matrix[full_path[i]][full_path[i+1]]
                
            for node_idx in full_path:
                enriched_nodes.append({
                    "index": node_idx,
                    "lat": coords[node_idx][0],
                    "lng": coords[node_idx][1]
                })
                
            output_routes.append({
                "vehicle_id": idx,
                "nodes": enriched_nodes,
                "distance": route_dist,
                "load": sum(demands[n] for n in r)
            })

        return {
            "routes": output_routes,
            "total_distance": best_cost,
            "algorithm": "LNS + Constructive Heuristic",
            "data_source": source
        }


# ==========================================
# Main Execution Handler
# ==========================================

def main():
    try:
        # Read from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            # Silent exit or default demo for testing
            return 

        payload = json.loads(input_data)
        
        # Parse Inputs with Safe Defaults
        locs_raw = payload.get('locations') or payload.get('coords') or []
        coords = []
        for l in locs_raw:
            if isinstance(l, dict):
                coords.append((float(l.get('lat')), float(l.get('lng'))))
            else:
                coords.append((float(l[0]), float(l[1])))

        if not coords:
            print(json.dumps({"error": "No coordinates provided"}))
            return

        demands = payload.get('demands') or [0] * len(coords)
        capacity = int(payload.get('vehicle_capacity', 100))
        num_vehicles = int(payload.get('num_vehicles', 1))
        depot_idx = int(payload.get('depot', 0))
        
        # Prioritize key from payload, else env, else None
        api_key = payload.get("mappls_api_key")

        # --- EXECUTE ---
        optimizer = WasteWiseOptimizer(api_key=api_key)
        result = optimizer.solve(coords, demands, capacity, num_vehicles, depot_idx)
        
        # Output JSON to stdout
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
#!/usr/bin/env python3
"""CVRP solver script for Waste Wise app.

Accepts JSON on stdin with the following shape:
{
  "locations": [{"lat": number, "lng": number}, ...],
  "demands": [int,...],
  "vehicle_capacities": [int,...],
  "num_vehicles": int,
  "depot": int (index of depot in locations)
}

If stdin is empty the script runs a small built-in example.

Outputs JSON to stdout:
{ "routes": [ { vehicle_id, nodes:[{index,lat,lng},...], distance }, ... ], "total_distance": int }
"""
import sys
import json
import math
import os
import requests
try:
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2
except Exception as e:
    print(json.dumps({"error": "ortools not available: %s" % str(e)}))
    sys.exit(1)


def get_mappls_distance_matrix(coords, api_key):
    """Gets a distance matrix from the Mappls API."""
    url = "https://apis.mappls.com/advancedmaps/v1/{}/distance_matrix".format(api_key)
    locations = "|".join(["{},{}".format(lat, lng) for lat, lng in coords])
    params = {
        "coordinates": locations,
        "profile": "driving",
    }
    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()

    # Fallback to haversine if Mappls returns no results
    if not data.get("results"):
        return build_distance_matrix(coords)
    
    matrix = [[0] * len(coords) for _ in range(len(coords))]
    for i, row in enumerate(data["results"]["distances"]):
        for j, dist in enumerate(row):
            matrix[i][j] = int(dist)
    return matrix
    

def haversine_meters(a, b):
    R = 6371000.0
    lat1 = math.radians(a[0])
    lon1 = math.radians(a[1])
    lat2 = math.radians(b[0])
    lon2 = math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return int(R * 2 * math.asin(math.sqrt(h)))


def build_distance_matrix(coords):
    n = len(coords)
    matrix = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                matrix[i][j] = 0
            else:
                try:
                    matrix[i][j] = haversine_meters(coords[i], coords[j])
                except Exception:
                    matrix[i][j] = int(math.hypot(coords[i][0] - coords[j][0], coords[i][1] - coords[j][1]))
    return matrix


def solve_cvrp(distance_matrix, demands, vehicle_capacities, num_vehicles, depot=0):
    manager = pywrapcp.RoutingIndexManager(len(distance_matrix), num_vehicles, depot)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
 
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return demands[from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(demand_callback_index, 0, vehicle_capacities, True, 'Capacity')

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC

    solution = routing.SolveWithParameters(search_parameters)
    if not solution:
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
        # append end node
        route_nodes.append(int(manager.IndexToNode(index)))
        routes.append({
            'vehicle_id': vehicle_id,
            'nodes': route_nodes,
            'distance': int(route_distance)
        })
        total_distance += route_distance

    return {'routes': routes, 'total_distance': int(total_distance)}


def main():
    raw = sys.stdin.read()
    if raw.strip() == '':
        # example data: small cluster
        coords = [(12.9716, 77.5946), (12.9720, 77.5950), (12.9750, 77.5900), (12.9800, 77.5930)]
        demands = [0, 1, 1, 2]
        vehicle_capacities = [3, 3]
        num_vehicles = 2
        depot = 0
        mappls_api_key = os.environ.get("MAPPLS_API_KEY")
    else:
        payload = json.loads(raw)
        locations = payload.get('locations') or payload.get('coords') or []
        if not locations:
            print(json.dumps({'error': 'No locations provided'}))
            return
        coords = []
        for loc in locations:
            if isinstance(loc, dict):
                coords.append((float(loc.get('lat')), float(loc.get('lng'))))
            elif isinstance(loc, (list, tuple)):
                coords.append((float(loc[0]), float(loc[1])))
        demands = payload.get('demands') or [0] * len(coords)
        vehicle_capacities = payload.get('vehicle_capacities') or [int(payload.get('vehicle_capacity', 100))]
        num_vehicles = int(payload.get('num_vehicles', len(vehicle_capacities)))
        depot = int(payload.get('depot', 0))
        mappls_api_key = payload.get("mappls_api_key")

    if mappls_api_key:
        distance_matrix = get_mappls_distance_matrix(coords, mappls_api_key)
    else:
        print(json.dumps({'warning': 'Mappls API key not provided, falling back to haversine distance.'}))
        distance_matrix = build_distance_matrix(coords)

    result = solve_cvrp(distance_matrix, demands, vehicle_capacities, num_vehicles, depot)
    if result is None:
        print(json.dumps({'error': 'No solution found'}))
        return

    # enrich node indices with coordinates
    for r in result['routes']:
        enriched = []
        for idx in r['nodes']:
            if 0 <= int(idx) < len(coords):
                enriched.append({'index': int(idx), 'lat': coords[int(idx)][0], 'lng': coords[int(idx)][1]})
            else:
                enriched.append({'index': int(idx)})
        r['nodes'] = enriched

    print(json.dumps(result))


if __name__ == '__main__':
    main()