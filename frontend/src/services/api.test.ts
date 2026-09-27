import { afterEach, describe, expect, it, vi } from "vitest";
import { getAircraft, getHealth } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("local backend API client", () => {
  it("checks health and reads the aircraft endpoint from the local API", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "ok" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        timestamp: 1750000000,
        center: { latitude: 20.2961, longitude: 85.8245 },
        radius_km: 50,
        count: 0,
        aircraft: [],
      }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getHealth()).resolves.toBe(true);
    const response = await getAircraft();
    expect(response.count).toBe(0);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:8000/health",
      "http://127.0.0.1:8000/api/aircraft",
    ]);
  });

  it("rejects an unexpected API response instead of treating it as empty data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ timestamp: 12, center: {}, radius_km: 50, count: 1, aircraft: [] }),
    }));
    await expect(getAircraft()).rejects.toThrow("Aircraft response did not match the DeskPlane API format");
  });
});
