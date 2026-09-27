export function fixed(value: number | null, digits = 0): string {
  return value === null || !Number.isFinite(value) ? "N/A" : value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function degrees(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "N/A" : `${Math.round(((value % 360) + 360) % 360).toString().padStart(3, "0")}°`;
}

export function sourceTime(timestamp: number | null): string {
  if (timestamp === null || !Number.isFinite(timestamp)) return "Awaiting source timestamp";
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function clockTime(timestamp: number | null): string {
  if (timestamp === null || !Number.isFinite(timestamp)) return "—";
  return new Date(timestamp * 1000).toLocaleTimeString(undefined, { hour12: false });
}
