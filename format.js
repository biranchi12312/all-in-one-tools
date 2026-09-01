export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B","KB","MB","GB"];
  let value = bytes, i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value >= 10 || i === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}
