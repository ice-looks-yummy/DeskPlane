import type { Aircraft, AircraftResponse, RadiusKm } from "../types";
import { degrees, fixed } from "../utils/format";
import { radarPoint } from "../utils/radar";

interface RadarProps {
  data: AircraftResponse | null;
  selectedRadius: RadiusKm | null;
  selectedId: string | null;
  onSelect: (aircraft: Aircraft) => void;
  loading: boolean;
  online: boolean | null;
}

export function Radar({ data, selectedRadius, selectedId, onSelect, loading, online }: RadarProps) {
  const size = 500;
  const center = size / 2;
  const outer = size * 0.42;
  const rings = [0.25, 0.5, 0.75, 1];
  const rangeKm = data?.radius_km ?? selectedRadius;
  return (
    <section className="panel radar-panel" aria-labelledby="radar-heading">
      <div className="panel-heading">
        <div><span className="eyebrow">LIVE PLOT</span><h2 id="radar-heading">Airspace radar</h2></div>
        <div className="radar-legend"><span className="legend-key" /> TRACK <span className="legend-divider">·</span> RANGE {rangeKm === null ? "—" : `${fixed(rangeKm)} KM`}</div>
      </div>
      <div className="radar-wrap">
        <svg className="radar-svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Radar showing aircraft within ${rangeKm ?? "configured"} kilometer detection radius`}>
          <defs>
            <pattern id="radarGrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#7d9a8b" strokeOpacity=".025" strokeWidth=".5" /></pattern>
          </defs>
          <circle cx={center} cy={center} r={outer} fill="url(#radarGrid)" />
          {rings.map((ring) => <circle key={ring} className={ring === 1 ? "range-ring range-ring-outer" : "range-ring"} cx={center} cy={center} r={outer * ring} />)}
          <line className="crosshair" x1={center - outer} y1={center} x2={center + outer} y2={center} />
          <line className="crosshair" x1={center} y1={center - outer} x2={center} y2={center + outer} />
          <line className="diagonal" x1={center - outer * .707} y1={center - outer * .707} x2={center + outer * .707} y2={center + outer * .707} />
          <line className="diagonal" x1={center + outer * .707} y1={center - outer * .707} x2={center - outer * .707} y2={center + outer * .707} />
          <path className="north-tick" d={`M ${center} ${center - outer - 8} l -4 9 h 8 z`} />
          <text className="cardinal cardinal-n" x={center} y={center - outer - 17}>N</text>
          <text className="cardinal" x={center + outer + 17} y={center + 4}>E</text>
          <text className="cardinal" x={center} y={center + outer + 23}>S</text>
          <text className="cardinal" x={center - outer - 17} y={center + 4}>W</text>
          {rings.slice(0, 3).map((ring) => <text key={ring} className="range-label" x={center + 7} y={center - outer * ring - 4}>{rangeKm === null ? "" : `${fixed(rangeKm * ring, 0)} km`}</text>)}
          <circle className="center-halo" cx={center} cy={center} r="14" />
          <circle className="center-point" cx={center} cy={center} r="4" />
          <path className="center-cross" d={`M ${center - 20} ${center}h12m8 0h12m-20 -20v12m0 8v12`} />
        </svg>
        <div className="radar-marker-layer" aria-label="Aircraft radar targets">
          {data?.aircraft.map((aircraft) => {
            const point = radarPoint(aircraft, data, size);
            const selected = selectedId === aircraft.icao24;
            const label = aircraft.callsign || "UNKNOWN";
            return (
              <button
                type="button"
                key={aircraft.icao24}
                className={`radar-target ${selected ? "selected" : ""}`}
                style={{ left: `${point.x / size * 100}%`, top: `${point.y / size * 100}%` }}
                aria-label={`Select ${label}, ${fixed(aircraft.distance_km, 1)} kilometers away, bearing ${degrees(point.bearing)}`}
                aria-pressed={selected}
                onClick={() => onSelect(aircraft)}
                title={`${label} · ${fixed(aircraft.distance_km, 1)} km · bearing ${degrees(point.bearing)}`}
              >
                <svg className="target-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 10.4 7.2 8 6.4 5.6 7.2 8 1.5ZM8 6.4v8.1m0-3.2-3.1 2.2m3.1-2.2 3.1 2.2" /></svg>
                <span className="target-label">{label}</span>
              </button>
            );
          })}
        </div>
        {loading && !data && <div className="radar-overlay"><span className="loader" /><strong>ACQUIRING TELEMETRY</strong><small>Connecting to local flight data service</small></div>}
        {!loading && online === false && <div className="radar-overlay radar-error"><span className="overlay-mark">!</span><strong>DESKPLANE BACKEND OFFLINE</strong><small>Start the local backend to receive aircraft data.</small></div>}
        {!loading && online !== false && data?.count === 0 && <div className="radar-overlay radar-empty"><span className="empty-scan" /><strong>NO AIRCRAFT DETECTED</strong><small>Clear skies within the configured radius</small></div>}
        {!loading && online !== false && !data && <div className="radar-overlay radar-error"><span className="overlay-mark">!</span><strong>DATA UNAVAILABLE</strong><small>Could not read aircraft telemetry.</small></div>}
      </div>
      <div className="radar-footer"><span><i className="center-key" /> DESKPLANE CENTER</span><span>RINGS IN KM</span><span>{data ? `${data.count} TRACK${data.count === 1 ? "" : "S"}` : "NO FEED"}</span></div>
    </section>
  );
}
