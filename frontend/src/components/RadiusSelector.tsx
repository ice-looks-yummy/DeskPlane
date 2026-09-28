import { SUPPORTED_RADII_KM, type RadiusKm } from "../types";

interface RadiusSelectorProps {
  value: RadiusKm | null;
  onChange: (radius: RadiusKm) => void;
}

export function RadiusSelector({ value, onChange }: RadiusSelectorProps) {
  return (
    <section className="radius-toolbar" aria-label="Monitoring range settings">
      <div className="radius-label"><span className="eyebrow">MONITORING RANGE</span><small>FILTER AIRCRAFT BY DISTANCE</small></div>
      <div className="radius-options" role="group" aria-label="Monitoring radius">
        {SUPPORTED_RADII_KM.map((radius) => (
          <button
            key={radius}
            type="button"
            className={`radius-option ${value === radius ? "is-selected" : ""}`}
            aria-pressed={value === radius}
            aria-label={`${radius} km`}
            onClick={() => onChange(radius)}
          >
            {radius}<span>km</span>
          </button>
        ))}
      </div>
    </section>
  );
}
