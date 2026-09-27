import type { AircraftResponse } from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const nullableNumber = (value: unknown): boolean => value === null || typeof value === "number" && Number.isFinite(value);
const nullableString = (value: unknown): boolean => value === null || typeof value === "string";
const nullableBoolean = (value: unknown): boolean => value === null || typeof value === "boolean";

async function request(path: string): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    let detail = `Backend returned HTTP ${response.status}`;
    try {
      const body = await response.json() as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
      else if (body.detail && typeof body.detail === "object" && "message" in body.detail) {
        detail = String((body.detail as { message: unknown }).message);
      }
    } catch { /* Keep the HTTP status message when no JSON error is available. */ }
    throw new Error(detail);
  }
  return response.json();
}

export async function getHealth(): Promise<boolean> {
  const body = await request("/health");
  if (!body || typeof body !== "object" || (body as { status?: unknown }).status !== "ok") {
    throw new Error("Backend health response was invalid");
  }
  return true;
}

export async function getAircraft(): Promise<AircraftResponse> {
  const body = await request("/api/aircraft");
  if (!body || typeof body !== "object") throw new Error("Aircraft response was not an object");
  const data = body as Partial<AircraftResponse>;
  if (!Array.isArray(data.aircraft)) throw new Error("Aircraft response did not match the DeskPlane API format");
  const aircraftValid = data.aircraft.every((item) => {
    if (!item || typeof item !== "object") return false;
    const plane = item as unknown as Record<string, unknown>;
    return typeof plane.icao24 === "string" &&
      typeof plane.latitude === "number" && Number.isFinite(plane.latitude) &&
      typeof plane.longitude === "number" && Number.isFinite(plane.longitude) &&
      ["GROUND", "CLIMB", "CRUISE", "DESCENT", "UNKNOWN"].includes(String(plane.status)) &&
      ["callsign", "origin_country", "squawk", "aircraft_model", "airline", "registration"].every((key) => nullableString(plane[key])) &&
      ["altitude_ft", "geo_altitude_m", "speed_kmh", "heading", "vertical_rate_ms", "distance_km", "bearing"].every((key) => nullableNumber(plane[key])) &&
      ["on_ground", "spi"].every((key) => nullableBoolean(plane[key])) &&
      ["position_source", "time_position", "last_contact"].every((key) => plane[key] === null || Number.isInteger(plane[key]));
  });
  const validRadius = typeof data.radius_km === "number" && Number.isFinite(data.radius_km) && data.radius_km > 0;
  if (
    !Number.isInteger(data.timestamp) && data.timestamp !== null ||
    !data.center || !Number.isFinite(data.center.latitude) || !Number.isFinite(data.center.longitude) ||
    !validRadius || !Number.isInteger(data.count) ||
    data.count !== data.aircraft.length || !aircraftValid
  ) throw new Error("Aircraft response did not match the DeskPlane API format");
  return data as AircraftResponse;
}
