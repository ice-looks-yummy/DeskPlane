import type { AircraftResponse } from "../types";
import { clockTime, fixed } from "../utils/format";

interface StatusCardsProps {
  data: AircraftResponse | null;
  loading: boolean;
}

export function StatusCards({ data, loading }: StatusCardsProps) {
  const cards = [
    { label: "AIRCRAFT DETECTED", value: data ? String(data.count).padStart(2, "0") : loading ? "··" : "—", unit: "TRACKS", icon: "◎" },
    { label: "DETECTION RADIUS", value: data ? fixed(data.radius_km, 0) : "—", unit: "KM", icon: "◉" },
    { label: "DESKPLANE LOCATION", value: data ? `${fixed(data.center.latitude, 4)}°, ${fixed(data.center.longitude, 4)}°` : "—", unit: "LAT / LON", icon: "⌖" },
    { label: "SOURCE UPDATE", value: data ? clockTime(data.timestamp) : "—", unit: "LOCAL TIME", icon: "◷" },
  ];
  return (
    <section className="status-grid" aria-label="Airspace summary">
      {cards.map((card, index) => (
        <article className={`status-card status-card-${index + 1}`} key={card.label}>
          <div className="card-top"><span>{card.label}</span><span className="card-icon" aria-hidden="true">{card.icon}</span></div>
          <div className="card-value">{card.value}<small>{card.unit}</small></div>
          <div className="card-rule"><i /></div>
        </article>
      ))}
    </section>
  );
}
