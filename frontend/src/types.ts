export type FlightStatus = "GROUND" | "CLIMB" | "CRUISE" | "DESCENT" | "UNKNOWN";
export const SUPPORTED_RADII_KM = [50, 100, 200, 500, 1000] as const;
export type RadiusKm = typeof SUPPORTED_RADII_KM[number];

export interface Aircraft {
  icao24: string;
  callsign: string | null;
  origin_country: string | null;
  latitude: number;
  longitude: number;
  altitude_ft: number | null;
  geo_altitude_m: number | null;
  speed_kmh: number | null;
  heading: number | null;
  vertical_rate_ms: number | null;
  on_ground: boolean | null;
  status: FlightStatus;
  distance_km: number | null;
  bearing: number | null;
  registration: string | null;
  aircraft_model: string | null;
  airline: string | null;
  squawk: string | null;
  position_source: number | null;
  spi: boolean | null;
  time_position: number | null;
  last_contact: number | null;
}

export interface AircraftResponse {
  timestamp: number | null;
  center: { latitude: number; longitude: number };
  radius_km: number;
  count: number;
  aircraft: Aircraft[];
}

export const POSITION_SOURCES: Record<number, string> = {
  0: "ADS-B",
  1: "ASTERIX",
  2: "MLAT",
  3: "FLARM",
};
