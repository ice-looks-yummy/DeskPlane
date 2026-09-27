import type { Aircraft } from "../types";
import { POSITION_SOURCES } from "../types";
import { degrees, fixed, sourceTime } from "../utils/format";

interface AircraftDetailsProps { aircraft: Aircraft | null }

export function AircraftDetails({ aircraft }: AircraftDetailsProps) {
  const items = aircraft ? [
    ["ORIGIN COUNTRY", aircraft.origin_country],
    ["ALTITUDE", aircraft.altitude_ft === null ? null : `${fixed(aircraft.altitude_ft)} ft`],
    ["GEO ALTITUDE", aircraft.geo_altitude_m === null ? null : `${fixed(aircraft.geo_altitude_m)} m`],
    ["SPEED", aircraft.speed_kmh === null ? null : `${fixed(aircraft.speed_kmh)} km/h`],
    ["HEADING", degrees(aircraft.heading)],
    ["VERTICAL RATE", aircraft.vertical_rate_ms === null ? null : `${fixed(aircraft.vertical_rate_ms, 1)} m/s`],
    ["DISTANCE", aircraft.distance_km === null ? null : `${fixed(aircraft.distance_km, 1)} km`],
    ["BEARING", degrees(aircraft.bearing)],
    ["STATUS", aircraft.status],
    ["REGISTRATION", aircraft.registration],
    ["AIRCRAFT MODEL", aircraft.aircraft_model],
    ["AIRLINE", aircraft.airline],
    ["SQUAWK", aircraft.squawk],
    ["POSITION SOURCE", aircraft.position_source === null ? null : POSITION_SOURCES[aircraft.position_source] ?? `Unknown (${aircraft.position_source})`],
    ["SPI", aircraft.spi === null ? null : aircraft.spi ? "YES" : "NO"],
    ["TIME POSITION", aircraft.time_position === null ? null : sourceTime(aircraft.time_position)],
    ["LAST CONTACT", aircraft.last_contact === null ? null : sourceTime(aircraft.last_contact)],
  ] as const : [];

  return (
    <section className="panel details-panel" aria-labelledby="details-heading">
      <div className="panel-heading details-heading">
        <div><span className="eyebrow">FLIGHT DATA</span><h2 id="details-heading">Track details</h2></div>
        {aircraft && <span className={`status-pill status-${aircraft.status.toLowerCase()}`}>{aircraft.status}</span>}
      </div>
      {!aircraft ? (
        <div className="details-empty"><span className="details-reticle">⌖</span><strong>NO TRACK SELECTED</strong><span>Select an aircraft from the radar or register to inspect its telemetry.</span></div>
      ) : (
        <>
          <div className="selected-identity"><div className="identity-glyph" aria-hidden="true">✦</div><div><strong>{aircraft.callsign || "UNKNOWN"}</strong><span>ICAO24 / {aircraft.icao24}</span></div><span className="identity-live"><i /> TRACKED</span></div>
          <dl className="details-grid">
            {items.map(([label, value]) => <div className="detail-cell" key={label}><dt>{label}</dt><dd>{value === null || value === undefined || value === "" ? "N/A" : value}</dd></div>)}
          </dl>
          <div className="details-coordinate"><span>POSITION</span><strong>{fixed(aircraft.latitude, 4)}°, {fixed(aircraft.longitude, 4)}°</strong></div>
        </>
      )}
    </section>
  );
}
