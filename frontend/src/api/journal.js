import { http } from "./http";

function toQueryString(params = {}) {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (!entries.length) return "";
  const search = new URLSearchParams();
  for (const [key, value] of entries) {
    search.set(key, value);
  }
  return `?${search.toString()}`;
}

export function listJournalEntries({ goalId, from, to, limit } = {}) {
  const query = toQueryString({
    goal_id: goalId,
    from,
    to,
    limit,
  });
  return http(`/api/journal/entries${query}`);
}

export function saveJournalEntry(body) {
  return http("/api/journal/entries", {
    method: "POST",
    body,
  });
}
