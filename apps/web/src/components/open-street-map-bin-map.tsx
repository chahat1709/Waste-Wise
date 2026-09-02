"use client";

import type { LatLngBoundsExpression } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

import {
  isLocatedBin,
  isLocatedDepot,
  orderedShowcaseBins,
  type ShowcaseConfiguration,
} from "@/lib/showcase/bins";

interface OpenStreetMapBinMapProps {
  configuration: ShowcaseConfiguration;
  compact?: boolean;
  className?: string;
}

type Point = [number, number];

function MapViewport({ points }: { points: Point[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: false });
      return;
    }
    map.fitBounds(points as LatLngBoundsExpression, {
      padding: [34, 34],
      maxZoom: 15,
      animate: false,
    });
  }, [map, points]);

  return null;
}

function binColor(fillPercent: number) {
  if (fillPercent >= 90) return "#c2444d";
  if (fillPercent >= 80) return "#d78826";
  return "#168568";
}

export function OpenStreetMapBinMap({ configuration, compact = false, className = "" }: OpenStreetMapBinMapProps) {
  const locatedBins = useMemo(() => configuration.bins.filter(isLocatedBin), [configuration.bins]);
  const orderedBins = useMemo(
    () => orderedShowcaseBins(configuration).filter(isLocatedBin),
    [configuration],
  );

  const depotPoint: Point | null = isLocatedDepot(configuration.depot)
    ? [configuration.depot.latitude, configuration.depot.longitude]
    : null;
  const binPoints = locatedBins.map((bin) => [bin.latitude, bin.longitude] as Point);
  const routePoints = orderedBins.map((bin) => [bin.latitude, bin.longitude] as Point);
  const allPoints = depotPoint ? [depotPoint, ...binPoints] : binPoints;
  const routeLine = depotPoint && routePoints.length > 0
    ? [depotPoint, ...routePoints, depotPoint]
    : routePoints;
  const center: Point = depotPoint ?? binPoints[0] ?? [23.0225, 72.5714];
  const [tilesUnavailable, setTilesUnavailable] = useState(false);

  return (
    <div className={`real-bin-map ${compact ? "real-bin-map--compact" : ""} ${className}`}>
      <MapContainer center={center} zoom={12} scrollWheelZoom={!compact} zoomControl={!compact} className="real-bin-map__canvas">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: () => setTilesUnavailable(true),
            load: () => setTilesUnavailable(false),
          }}
        />
        <MapViewport points={allPoints.length > 0 ? allPoints : [center]} />

        {routeLine.length > 1 && (
          <Polyline
            positions={routeLine}
            pathOptions={{ color: "#127959", weight: compact ? 3 : 4, opacity: 0.86, dashArray: "8 7" }}
          />
        )}

        {depotPoint && (
          <CircleMarker
            center={depotPoint}
            radius={compact ? 7 : 9}
            pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#126fae", fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <strong>{configuration.depot.name}</strong><br />
              {configuration.depot.address}
            </Tooltip>
          </CircleMarker>
        )}

        {locatedBins.map((bin) => {
          const routeIndex = orderedBins.findIndex((orderedBin) => orderedBin.id === bin.id);
          return (
            <CircleMarker
              center={[bin.latitude, bin.longitude]}
              key={bin.id}
              radius={compact ? 8 : 11}
              pathOptions={{ color: "#ffffff", weight: 3, fillColor: binColor(bin.fillPercent), fillOpacity: 1 }}
            >
              <Tooltip direction="top" offset={[0, -9]}>
                <strong>{routeIndex >= 0 ? `${routeIndex + 1}. ` : ""}{bin.name || bin.id}</strong><br />
                {bin.address}<br />
                {bin.fillPercent}% full · {bin.capacityKg ? `${bin.capacityKg} kg` : "capacity not set"}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      {tilesUnavailable && (
        <p className="map-tile-fallback" role="status">
          Map tiles could not load. Your saved coordinates and local visit order remain available; reconnect to view the OpenStreetMap background.
        </p>
      )}
      <div className="real-bin-map__caption">
        <span><i className="real-bin-map__depot-dot" /> Depot</span>
        <span><i className="real-bin-map__bin-dot" /> Your configured bins</span>
        {routeLine.length > 1 && <span><i className="real-bin-map__route-line" /> Local visit order</span>}
      </div>
    </div>
  );
}
