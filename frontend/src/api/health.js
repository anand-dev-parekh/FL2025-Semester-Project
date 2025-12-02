import { http } from "./http";

export async function fetchDailyHealth({ days = 7 } = {}) {
  const params = new URLSearchParams();
  if (Number.isFinite(days) && days > 0) {
    params.set("days", String(Math.floor(days)));
  }
  const search = params.toString();
  const path = `/api/health/daily${search ? `?${search}` : ""}`;
  return http(path);
}

export async function enableHealthkitGoals() {
  return http("/api/health/enable", { method: "POST" });
}
