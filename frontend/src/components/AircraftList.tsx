import type { Aircraft } from "../types";
import { degrees, fixed } from "../utils/format";

interface AircraftListProps {
  aircraft: Aircraft[];
  selectedId: string | null;
  onSelect: (aircraft: Aircraft) => void;
}

function statusClass(status: string): string {
  return `status-pill status-${status.toLowerCase()}`;
}

export function AircraftList({ aircraft, selectedId, onSelect }: AircraftListProps) {
  return (
    <section className="panel aircraft-panel" aria-labelledby="aircraft-heading">
      <div className="panel-heading list-heading">
        <div><span className="eyebrow">TRACK REGISTER</span><h2 id="aircraft-heading">Detected aircraft <span className="count-badge">{aircraft.length.toString().padStart(2, "0")}</span></h2></div>
        <span className="list-live"><span className="live-dot" /> LIVE</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>CALLSIGN / ICAO24</th><th>ALTITUDE</th><th>SPEED</th><th>HDG</th><th>DIST</th><th>BRG</th><th>STATUS</th></tr></thead>
          <tbody>
            {aircraft.length === 0 ? (
              <tr><td className="table-empty" colSpan={7}>No aircraft inside the detection radius.</td></tr>
            ) : aircraft.map((item) => (
              <tr key={item.icao24} className={selectedId === item.icao24 ? "row-selected" : ""}>
                <td><button className="aircraft-row-button" onClick={() => onSelect(item)} aria-label={`Select ${item.callsign || "UNKNOWN"} ${item.icao24}`} aria-pressed={selectedId === item.icao24}>
                  <span className="callsign">{item.callsign || "UNKNOWN"}</span><span className="icao">{item.icao24}</span>
                </button></td>
                <td>{item.altitude_ft === null ? "N/A" : `${fixed(item.altitude_ft)} ft`}</td>
                <td>{item.speed_kmh === null ? "N/A" : `${fixed(item.speed_kmh)} km/h`}</td>
                <td>{degrees(item.heading)}</td><td>{item.distance_km === null ? "N/A" : `${fixed(item.distance_km, 1)} km`}</td>
                <td>{degrees(item.bearing)}</td><td><span className={statusClass(item.status)}>{item.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot"><span>LIVE AIRCRAFT STATE VECTORS</span><span>SELECT A TRACK TO INSPECT</span></div>
    </section>
  );
}
