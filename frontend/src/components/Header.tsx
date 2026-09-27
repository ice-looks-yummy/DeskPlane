interface HeaderProps {
  online: boolean | null;
}

export function Header({ online }: HeaderProps) {
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
      <div className="topbar-meta"><span className="live-dot" /> LIVE TELEMETRY <span className="meta-divider">/</span> PHASE 02</div>
    </header>
  );
}
