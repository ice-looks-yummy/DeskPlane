import { useCallback, useEffect, useMemo, useState } from "react";
import { AircraftDetails } from "./components/AircraftDetails";
import { AircraftList } from "./components/AircraftList";
import { Header } from "./components/Header";
import { Radar } from "./components/Radar";
import { StatusCards } from "./components/StatusCards";
import { getAircraft, getHealth } from "./services/api";
import type { Aircraft, AircraftResponse } from "./types";
import { sourceTime } from "./utils/format";

const REFRESH_INTERVAL_MS = 15_000;

export default function App() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [data, setData] = useState<AircraftResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const poll = useCallback(async () => {
    const healthRequest = getHealth().then(
      () => setOnline(true),
      () => setOnline(false),
    );
    const aircraftRequest = getAircraft().then((next) => {
      setData(next);
      setApiError(null);
      setUpdatedAt(next.timestamp);
      setSelectedId((current) => current && next.aircraft.some((item) => item.icao24 === current) ? current : null);
    }, (error: unknown) => {
      setApiError(error instanceof Error ? error.message : "Could not load aircraft data.");
    }).finally(() => setLoading(false));
    await Promise.all([healthRequest, aircraftRequest]);
  }, []);

  useEffect(() => {
    let running = false;
    let mounted = true;
    const refresh = async () => {
      if (running || !mounted) return;
      running = true;
      try { await poll(); } finally { running = false; }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, REFRESH_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [poll]);

  const selected = useMemo(() => data?.aircraft.find((item) => item.icao24 === selectedId) ?? null, [data, selectedId]);
  const selectAircraft = (aircraft: Aircraft) => setSelectedId(aircraft.icao24);

  return (
    <div className="app-shell" id="main">
      <Header online={online} />
      <main className="dashboard">
        <section className="page-intro">
          <div><span className="eyebrow intro-eyebrow">AIRSPACE MONITORING / LOCAL SYSTEM</span><h1>Live airspace<span className="title-period">.</span></h1><p>Real-time aircraft intelligence, centered on your DeskPlane.</p></div>
          <div className="source-stamp"><span className="stamp-line" /><div><small>DATA SOURCE</small><strong>OPENSKY NETWORK</strong><span>STATE VECTOR FEED</span></div></div>
        </section>

        {!loading && online === false && (
          <div className="notice notice-offline" role="alert"><span className="notice-icon">!</span><div><strong>DESKPLANE BACKEND OFFLINE</strong><span>Unable to connect to the local backend. Start the FastAPI service at 127.0.0.1:8000.</span></div><span className="notice-code">CONNECTION LOST</span></div>
        )}
        {!loading && online !== false && apiError && (
          <div className="notice notice-error" role="alert"><span className="notice-icon">!</span><div><strong>AIRCRAFT DATA UNAVAILABLE</strong><span>{apiError}</span></div><span className="notice-code">API ERROR</span></div>
        )}

        <StatusCards data={data} loading={loading} />

        <div className="primary-grid">
          <Radar data={data} selectedId={selectedId} onSelect={selectAircraft} loading={loading} online={online} />
          <AircraftDetails aircraft={selected} />
        </div>
        <AircraftList aircraft={data?.aircraft ?? []} selectedId={selectedId} onSelect={selectAircraft} />

        <footer className="page-footer"><span>DESKPLANE <i>—</i> PERSONAL AIRSPACE MONITOR</span><span>SOURCE UPDATE <strong>{sourceTime(updatedAt)}</strong></span><span className="footer-health"><i className={online ? "health-ok" : online === false ? "health-bad" : ""} />{online ? "LOCAL API CONNECTED" : online === false ? "LOCAL API UNAVAILABLE" : "CHECKING LOCAL API"}</span></footer>
      </main>
    </div>
  );
}
