import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { getAircraft, getHealth } from "./services/api";
import type { Aircraft, AircraftResponse } from "./types";

vi.mock("./services/api", () => ({ getAircraft: vi.fn(), getHealth: vi.fn() }));

const aircraft: Aircraft = {
  icao24: "abc123", callsign: "IGO927", origin_country: "India", latitude: 20.31, longitude: 85.82,
  altitude_ft: 35200, geo_altitude_m: 10700, speed_kmh: 842, heading: 61, vertical_rate_ms: 0,
  on_ground: false, status: "CRUISE", distance_km: 18.2, bearing: 61, registration: null,
  aircraft_model: null, airline: null, squawk: null, position_source: 0, spi: false,
  time_position: 1234567890, last_contact: 1234567890,
};
const sample: AircraftResponse = {
  timestamp: 1750000000, center: { latitude: 20.2961, longitude: 85.8245 }, radius_km: 50,
  count: 1, aircraft: [aircraft],
};

const mockedHealth = vi.mocked(getHealth);
const mockedAircraft = vi.mocked(getAircraft);

beforeEach(() => {
  mockedHealth.mockResolvedValue(true);
  mockedAircraft.mockResolvedValue(sample);
});
afterEach(() => vi.useRealTimers());

describe("DeskPlane dashboard", () => {
  it("renders its loading state before the backend responds", async () => {
    mockedAircraft.mockReturnValue(new Promise(() => undefined));
    render(<App />);
    expect(screen.getByText("ACQUIRING TELEMETRY")).toBeInTheDocument();
    expect(await screen.findByText("BACKEND ONLINE")).toBeInTheDocument();
  });

  it("shows the online backend, live aircraft data, and summary from the API", async () => {
    render(<App />);
    expect(await screen.findByText("BACKEND ONLINE")).toBeInTheDocument();
    expect((await screen.findAllByText("IGO927")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("18.2 km")).toBeInTheDocument();
    expect(screen.getByText("20.2961°, 85.8245°")).toBeInTheDocument();
    expect(screen.getByText("OPENSKY NETWORK")).toBeInTheDocument();
  });

  it("selects an aircraft and displays its details without inventing nullable fields", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Select IGO927 abc123" }));
    expect(screen.getByRole("heading", { name: "Track details" })).toBeInTheDocument();
    expect(screen.getByText("ICAO24 / abc123")).toBeInTheDocument();
    expect(screen.getByText("ADS-B")).toBeInTheDocument();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("061°").length).toBeGreaterThanOrEqual(1);
  });

  it("shows zero-aircraft state without adding targets", async () => {
    mockedAircraft.mockResolvedValue({ ...sample, count: 0, aircraft: [] });
    render(<App />);
    expect(await screen.findByText("NO AIRCRAFT DETECTED")).toBeInTheDocument();
    expect(screen.getByText("No aircraft inside the detection radius.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Select/ })).not.toBeInTheDocument();
  });

  it("shows an explicit offline state when the backend cannot be reached", async () => {
    mockedHealth.mockRejectedValue(new Error("offline"));
    mockedAircraft.mockRejectedValue(new Error("offline"));
    render(<App />);
    expect((await screen.findAllByText("DESKPLANE BACKEND OFFLINE")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Unable to connect to the local backend/)).toBeInTheDocument();
  });

  it("reports an aircraft API error while backend health remains online", async () => {
    mockedAircraft.mockRejectedValue(new Error("OpenSky timed out"));
    render(<App />);
    expect(await screen.findByText("AIRCRAFT DATA UNAVAILABLE")).toBeInTheDocument();
    expect(screen.getByText("OpenSky timed out")).toBeInTheDocument();
  });

  it("polls for updated aircraft on its refresh interval", async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(mockedAircraft).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(mockedAircraft).toHaveBeenCalledTimes(2);
  });

  it("labels a missing callsign as UNKNOWN", async () => {
    mockedAircraft.mockResolvedValue({ ...sample, aircraft: [{ ...aircraft, callsign: null }] });
    render(<App />);
    expect(await screen.findByRole("button", { name: "Select UNKNOWN abc123" })).toBeInTheDocument();
  });
});
