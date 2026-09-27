import type { Aircraft, AircraftResponse } from "../types";

export interface RadarPoint {
  x: number;
  y: number;
  distanceRatio: number;
  bearing: number;
}

function bearingBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = Math.PI / 180;
  const phi1 = lat1 * radians;
  const phi2 = lat2 * radians;
  const deltaLambda = (lon2 - lon1) * radians;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return (Math.atan2(y, x) / radians + 360) % 360;
}

export function radarPoint(aircraft: Aircraft, response: AircraftResponse, size = 500): RadarPoint {
  const center = size / 2;
  const radius = size * 0.42;
  const bearing = aircraft.bearing ?? bearingBetween(
    response.center.latitude, response.center.longitude, aircraft.latitude, aircraft.longitude,
  );
  const distance = aircraft.distance_km ?? 0;
  const distanceRatio = response.radius_km > 0 ? Math.max(0, Math.min(1, distance / response.radius_km)) : 0;
  const angle = bearing * Math.PI / 180;
  const pointRadius = radius * distanceRatio;
  return {
    x: center + Math.sin(angle) * pointRadius,
    y: center - Math.cos(angle) * pointRadius,
    distanceRatio,
    bearing,
  };
}
