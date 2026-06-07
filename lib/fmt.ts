export function fmtMoney(g: number | null | undefined): string {
  return "G$" + Number(g ?? 0).toLocaleString();
}

export function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });
}

export function relTime(ms: number): string {
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

export function countdownLabel(targetMs: number): string {
  const diff = targetMs - Date.now();
  if (diff < -60000) return Math.floor(-diff / 60000) + "m late";
  if (diff < 60000) return "now";
  if (diff < 3600000) return "in " + Math.floor(diff / 60000) + " min";
  if (diff < 86400000) {
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return "in " + h + "h " + (m ? m + "m" : "");
  }
  return fmtDateTime(targetMs);
}
