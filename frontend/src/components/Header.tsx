import { useEffect, useState } from "react";
import { clockTime } from "../utils/format";

interface HeaderProps {
  online: boolean | null;
  receivedAt: number | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function Header({ online, receivedAt, refreshing, onRefresh }: HeaderProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="topbar">
      <a className="brand" href="#main" aria-label="DeskPlane dashboard home">
        <span className="brand-mark" aria-hidden="true"><span /></span>
        <span className="brand-copy"><strong>DESKPLANE</strong><small>LOCAL AIRSPACE SYSTEM</small></span>
      </a>
      <div className={`connection ${online === true ? "is-online" : online === false ? "is-offline" : "is-pending"}`} role="status">
        <span className="connection-light" />
        {online === null ? "CONNECTING" : online ? "BACKEND ONLINE" : "BACKEND OFFLINE"}
      </div>
      <div className="topbar-time" aria-label="System time and aircraft data update">
        <div className="time-block"><span>LOCAL TIME</span><time aria-label="Live local time" dateTime={now.toISOString()}>{now.toLocaleTimeString(undefined, { hour12: false })}</time></div>
        <div className="time-block data-time"><span>LAST DATA RECEIVED</span><time>{clockTime(receivedAt === null ? null : receivedAt / 1000)}</time></div>
      </div>
      <button className="refresh-button" type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh aircraft data" title="Refresh aircraft data">
        <span className={refreshing ? "refresh-icon is-refreshing" : "refresh-icon"} aria-hidden="true">↻</span>
        <span>{refreshing ? "UPDATING" : "REFRESH"}</span>
      </button>
    </header>
  );
}
