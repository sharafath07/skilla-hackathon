import dayjs from "dayjs";
export function short(addr) { if (!addr) return ""; return addr.slice(0, 6) + "..." + addr.slice(-4); }
export function timeLeft(ts) { const now = dayjs(); const end = dayjs(ts * 1000); const diff = end.diff(now, 'second'); if (diff <= 0) return "Ended"; const m = Math.floor(diff / 60); const s = diff % 60; return `${m}m ${s}s`; }
