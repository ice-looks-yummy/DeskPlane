import { describe, expect, it } from "vitest";
import type { Aircraft, AircraftResponse } from "../types";
import { radarPoint } from "../utils/radar";

const base: Aircraft = {
  icao24: "abc123", callsign: "TEST01", origin_country: "India", latitude: 1, longitude: 1,
  altitude_ft: null, geo_altitude_m: null, speed_kmh: null, heading: null, vertical_rate_ms: null,
  on_ground: false, status: "UNKNOWN", distance_km: 50, bearing: null, registration: null,
  aircraft_model: null, airline: null, squawk: null, position_source: null, spi: null,
  time_position: null, last_contact: null,
};
const response: AircraftResponse = {
  timestamp: 1, center: { latitude: 0, longitude: 0 }, radius_km: 100, count: 1, aircraft: [base],
};

describe("radarPoint", () => {
  it("uses the real aircraft coordinates to derive cardinal direction and scales distance to radius", () => {
    const north = radarPoint({ ...base, latitude: 1, longitude: 0, distance_km: 50 }, response);
    const east = radarPoint({ ...base, latitude: 0, longitude: 1, distance_km: 100 }, response);
    expect(north.y).toBeLessThan(250);
    expect(north.x).toBeCloseTo(250);
    expect(east.x).toBeCloseTo(460);
    expect(east.y).toBeCloseTo(250);
    expect(east.distanceRatio).toBe(1);
  });

  it("uses backend bearing when present and clamps plotted distance within the range", () => {
    const west = radarPoint({ ...base, bearing: 270, distance_km: 200 }, response);
    expect(west.x).toBeCloseTo(40);
    expect(west.y).toBeCloseTo(250);
    expect(west.distanceRatio).toBe(1);
  });
});
