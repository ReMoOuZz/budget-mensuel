export function toPlainNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value);
}

export function cleanLabel(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
}

export function parseDateISO(value, fallback = new Date()) {
  if (typeof value !== "string") return fallback;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return fallback;
  return new Date(timestamp);
}

export function toISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
