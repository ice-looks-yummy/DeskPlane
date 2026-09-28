import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  mockedAircraft.mockImplementation(async (radius) => ({ ...sample, radius_km: radius ?? sample.radius_km }));
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
    expect(await screen.findByRole("button", { name: "50 km" })).toHaveAttribute("aria-pressed", "true");
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
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(mockedAircraft).toHaveBeenCalledTimes(2);
  });

  it("does not overlap a scheduled aircraft request that is still running", async () => {
    vi.useFakeTimers();
    let finishRequest: ((value: AircraftResponse) => void) | undefined;
    mockedAircraft.mockImplementationOnce(() => new Promise((resolve) => { finishRequest = resolve; }));
    render(<App />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(mockedAircraft).toHaveBeenCalledTimes(1);
    await act(async () => { finishRequest?.(sample); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(mockedAircraft).toHaveBeenCalledTimes(2);
  });

  it("aborts outstanding backend requests and clears polling timers on unmount", () => {
    vi.useFakeTimers();
    let pendingSignal: AbortSignal | undefined;
    mockedAircraft.mockImplementationOnce((_radius, signal) => {
      pendingSignal = signal;
      return new Promise(() => undefined);
    });
    const { unmount } = render(<App />);
    const timerCountBeforeUnmount = vi.getTimerCount();
    expect(timerCountBeforeUnmount).toBeGreaterThan(0);
    unmount();
    expect(pendingSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refreshes aircraft immediately without reloading the page", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Select IGO927 abc123" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh aircraft data" }));
    await act(async () => { await Promise.resolve(); });
    expect(mockedAircraft).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Select IGO927 abc123" })).toBeInTheDocument();
  });

  it("selects a track when another cell in its aircraft row is clicked", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("35,200 ft"));
    expect(screen.getByText("ICAO24 / abc123")).toBeInTheDocument();
  });

  it("rechecks backend health on the fixed polling interval", async () => {
    vi.useFakeTimers();
    mockedHealth.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("offline"));
    render(<App />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText("BACKEND ONLINE")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(screen.getByText("BACKEND OFFLINE")).toBeInTheDocument();
  });

  it("clears selection when an aircraft is no longer in a successful response", async () => {
    vi.useFakeTimers();
    mockedAircraft.mockResolvedValueOnce(sample).mockResolvedValueOnce({ ...sample, count: 0, aircraft: [] });
    render(<App />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Select IGO927 abc123" }));
    expect(screen.getByText("ICAO24 / abc123")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(screen.queryByText("ICAO24 / abc123")).not.toBeInTheDocument();
    expect(screen.getByText("NO TRACK SELECTED")).toBeInTheDocument();
  });

  it("labels a missing callsign as UNKNOWN", async () => {
    mockedAircraft.mockResolvedValue({ ...sample, aircraft: [{ ...aircraft, callsign: null }] });
    render(<App />);
    expect(await screen.findByRole("button", { name: "Select UNKNOWN abc123" })).toBeInTheDocument();
  });

  it("shows all supported radii and marks the configured default", async () => {
    render(<App />);
    const range = await screen.findByRole("group", { name: "Monitoring radius" });
    for (const radius of [50, 100, 200, 500, 1000]) {
      expect(screen.getByRole("button", { name: `${radius} km` })).toBeInTheDocument();
    }
    expect(range).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "50 km" })).toHaveAttribute("aria-pressed", "true");
  });

  it.each([100, 200, 500, 1000] as const)("requests and displays the selected %i km range", async (radius) => {
    mockedAircraft.mockImplementation(async (requested) => ({
      ...sample,
      radius_km: requested ?? 50,
      count: radius === 200 && requested === 200 ? 0 : 1,
      aircraft: radius === 200 && requested === 200 ? [] : [aircraft],
    }));
    render(<App />);
    await screen.findByRole("button", { name: "50 km" });
    fireEvent.click(screen.getByRole("button", { name: `${radius} km` }));
    await waitFor(() => expect(mockedAircraft).toHaveBeenLastCalledWith(radius, expect.any(AbortSignal)));
    expect(screen.getByRole("button", { name: `${radius} km` })).toHaveAttribute("aria-pressed", "true");
    const formattedRadius = new Intl.NumberFormat("en-US").format(radius);
    expect(document.querySelector(".radar-legend")).toHaveTextContent(`RANGE ${formattedRadius} KM`);
    if (radius === 200) {
      expect(await screen.findByText("NO AIRCRAFT DETECTED")).toBeInTheDocument();
      expect(screen.getAllByText("00").length).toBeGreaterThan(0);
    } else {
      expect(await screen.findByRole("button", { name: "Select IGO927 abc123" })).toBeInTheDocument();
    }
  });

  it("preserves selected aircraft when it is still returned at the new range", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Select IGO927 abc123" }));
    fireEvent.click(screen.getByRole("button", { name: "100 km" }));
    await waitFor(() => expect(mockedAircraft).toHaveBeenLastCalledWith(100, expect.any(AbortSignal)));
    expect(await screen.findByText("ICAO24 / abc123")).toBeInTheDocument();
  });

  it("keeps the selected radius and reports a radius request error", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "50 km" });
    mockedAircraft.mockRejectedValueOnce(new Error("Invalid radius"));
    fireEvent.click(screen.getByRole("button", { name: "500 km" }));
    expect(await screen.findByText("Invalid radius")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "500 km" })).toHaveAttribute("aria-pressed", "true");
  });
});
