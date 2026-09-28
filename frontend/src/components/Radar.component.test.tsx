import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Aircraft, AircraftResponse } from "../types";
import { Radar } from "./Radar";

const aircraft: Aircraft = {
  icao24: "abc123", callsign: "TEST01", origin_country: "India", latitude: 1, longitude: 1,
  altitude_ft: null, geo_altitude_m: null, speed_kmh: null, heading: null, vertical_rate_ms: null,
  on_ground: false, status: "UNKNOWN", distance_km: 50, bearing: 45, registration: null,
  aircraft_model: null, airline: null, squawk: null, position_source: null, spi: null,
  time_position: null, last_contact: null,
};
const data: AircraftResponse = {
  timestamp: 1, center: { latitude: 0, longitude: 0 }, radius_km: 100, count: 1, aircraft: [aircraft],
};

describe("radar controls", () => {
  it("uses a real accessible button to select an aircraft marker", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<Radar data={data} selectedRadius={50} selectedId={null} onSelect={onSelect} loading={false} online={true} />);
    const marker = screen.getByRole("button", { name: /Select TEST01/ });
    fireEvent.click(marker);
    expect(onSelect).toHaveBeenCalledWith(aircraft);
    rerender(<Radar data={data} selectedRadius={50} selectedId="abc123" onSelect={onSelect} loading={false} online={true} />);
    expect(screen.getByRole("button", { name: /Select TEST01/ })).toHaveAttribute("aria-pressed", "true");
  });
});
