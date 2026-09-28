import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AircraftDetails } from "./components/AircraftDetails";
import { AircraftList } from "./components/AircraftList";
import { Header } from "./components/Header";
import { Radar } from "./components/Radar";
import { RadiusSelector } from "./components/RadiusSelector";
import { StatusCards } from "./components/StatusCards";
import { getAircraft, getHealth } from "./services/api";
import { SUPPORTED_RADII_KM, type Aircraft, type AircraftResponse, type RadiusKm } from "./types";
import { sourceTime } from "./utils/format";

const REFRESH_INTERVAL_MS = 5_000;

export default function App() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [data, setData] = useState<AircraftResponse | null>(null);
  const [selectedRadius, setSelectedRadius] = useState<RadiusKm | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const radiusRef = useRef<RadiusKm | null>(null);
  const radiusVersionRef = useRef(0);
  const pendingPollRef = useRef(false);

  const poll = useCallback(async () => {
    if (inFlightRef.current || !mountedRef.current) return;
    inFlightRef.current = true;
    setRefreshing(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestedRadius = radiusRef.current;
    const requestVersion = radiusVersionRef.current;
    try {
      const healthRequest = getHealth(controller.signal).then(
        () => { if (mountedRef.current) setOnline(true); },
        () => { if (mountedRef.current && !controller.signal.aborted) setOnline(false); },
      );
      const aircraftRequest = getAircraft(requestedRadius, controller.signal).then((next) => {
        if (!mountedRef.current || requestVersion !== radiusVersionRef.current) return;
        if (requestedRadius === null) {
          const configuredOption = SUPPORTED_RADII_KM.find((radius) => radius === next.radius_km) ?? null;
          if (configuredOption !== null) {
            radiusRef.current = configuredOption;
            setSelectedRadius(configuredOption);
          }
        }
        setData(next);
        setApiError(null);
        setUpdatedAt(next.timestamp);
        setReceivedAt(Date.now());
        setSelectedId((current) => current && next.aircraft.some((item) => item.icao24 === current) ? current : null);
      }, (error: unknown) => {
        if (!mountedRef.current || requestVersion !== radiusVersionRef.current || controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setApiError(error instanceof Error ? error.message : "Could not load aircraft data.");
        setData(null);
      });
      await Promise.all([healthRequest, aircraftRequest]);
    } finally {
      let rerunImmediately = false;
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        inFlightRef.current = false;
        rerunImmediately = pendingPollRef.current;
        pendingPollRef.current = false;
      }
      if (mountedRef.current) {
        if (!rerunImmediately) {
          setLoading(false);
          setRefreshing(false);
        }
      }
      if (rerunImmediately && mountedRef.current) queueMicrotask(() => { void poll(); });
    }
  }, []);

  const changeRadius = useCallback((radius: RadiusKm) => {
    if (radiusRef.current === radius) {
      void poll();
      return;
    }
    radiusRef.current = radius;
    radiusVersionRef.current += 1;
    setSelectedRadius(radius);
    setData(null);
    setApiError(null);
    setLoading(true);
    if (inFlightRef.current) {
      pendingPollRef.current = true;
      controllerRef.current?.abort();
      return;
    }
    void poll();
  }, [poll]);

  useEffect(() => {
    mountedRef.current = true;
    void poll();
    const timer = window.setInterval(() => { void poll(); }, REFRESH_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
      controllerRef.current?.abort();
      controllerRef.current = null;
      inFlightRef.current = false;
    };
  }, [poll]);

  const selected = useMemo(() => data?.aircraft.find((item) => item.icao24 === selectedId) ?? null, [data, selectedId]);
  const selectAircraft = (aircraft: Aircraft) => setSelectedId(aircraft.icao24);

  return (
    <div className="app-shell" id="main">
      <Header online={online} receivedAt={receivedAt} refreshing={refreshing} onRefresh={poll} />
      <main className="dashboard">
        <section className="page-intro">
          <div><span className="eyebrow intro-eyebrow">AIRSPACE MONITORING / LOCAL SYSTEM</span><h1>Live airspace<span className="title-period">.</span></h1><p>Real-time aircraft intelligence, centered on your DeskPlane.</p></div>
          <div className="source-stamp"><span className="stamp-line" /><div><small>DATA SOURCE</small><strong>OPENSKY NETWORK</strong><span>STATE VECTOR FEED</span></div></div>
        </section>

        <RadiusSelector value={selectedRadius} onChange={changeRadius} />

        {!loading && online === false && (
          <div className="notice notice-offline" role="alert"><span className="notice-icon">!</span><div><strong>DESKPLANE BACKEND OFFLINE</strong><span>Unable to connect to the local backend. Start the FastAPI service at 127.0.0.1:8000.</span></div><span className="notice-code">CONNECTION LOST</span></div>
        )}
        {!loading && online !== false && apiError && (
          <div className="notice notice-error" role="alert"><span className="notice-icon">!</span><div><strong>AIRCRAFT DATA UNAVAILABLE</strong><span>{apiError}</span></div><span className="notice-code">API ERROR</span></div>
        )}

        <StatusCards data={data} loading={loading} selectedRadius={selectedRadius} />

        <div className="primary-grid">
          <Radar data={data} selectedRadius={selectedRadius} selectedId={selectedId} onSelect={selectAircraft} loading={loading} online={online} />
          <AircraftDetails aircraft={selected} />
        </div>
        <AircraftList aircraft={data?.aircraft ?? []} selectedId={selectedId} onSelect={selectAircraft} loading={loading} error={apiError} />

        <footer className="page-footer"><span>DESKPLANE <i>—</i> PERSONAL AIRSPACE MONITOR</span><span>SOURCE UPDATE <strong>{sourceTime(updatedAt)}</strong></span><span className="footer-health"><i className={online ? "health-ok" : online === false ? "health-bad" : ""} />{online ? "LOCAL API CONNECTED" : online === false ? "LOCAL API UNAVAILABLE" : "CHECKING LOCAL API"}</span></footer>
      </main>
    </div>
  );
}
