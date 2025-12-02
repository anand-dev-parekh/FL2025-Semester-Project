import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import AuthNavbar from "../components/AuthNavbar";
import { http } from "../api/http";
import { listJournalEntries } from "../api/journal";

const XP_PER_LEVEL = 100;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function toDateOnly(value) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffInDays(a, b) {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / MS_PER_DAY);
}

function computeStreakStats(entries = []) {
  const activeDays = new Set();

  for (const entry of entries) {
    const key = entry?.entry_date || entry?.entryDate;
    if (!key) continue;

    const level = (entry?.completion_level || entry?.completionLevel || "").toLowerCase();
    const xpDelta = Number(entry?.xp_delta ?? entry?.xpDelta ?? entry?.xp ?? 0);
    const productive = level === "complete" || level === "partial" || xpDelta > 0;
    if (!productive) continue;

    const date = toDateOnly(key);
    if (!date) continue;
    activeDays.add(date.toISOString().slice(0, 10));
  }

  const datesDesc = Array.from(activeDays).sort(
    (a, b) => (toDateOnly(b)?.getTime() ?? 0) - (toDateOnly(a)?.getTime() ?? 0),
  );
  if (!datesDesc.length) {
    return { current: 0, longest: 0, lastEntry: null, activeDates: [] };
  }

  // Current streak counts back from most recent logged day.
  let current = 0;
  let previous = null;
  for (const dateStr of datesDesc) {
    const date = toDateOnly(dateStr);
    if (!date) continue;
    if (previous === null) {
      current = 1;
    } else if (diffInDays(previous, date) === 1) {
      current += 1;
    } else {
      break;
    }
    previous = date;
  }

  // Longest streak across all logged days.
  const datesAsc = [...datesDesc].reverse();
  let longest = 0;
  let run = 0;
  previous = null;
  for (const dateStr of datesAsc) {
    const date = toDateOnly(dateStr);
    if (!date) continue;
    if (previous && diffInDays(date, previous) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    previous = date;
  }

  return {
    current,
    longest,
    lastEntry: datesDesc[0] ?? null,
    activeDates: datesDesc,
  };
}

function formatPrettyDate(value) {
  const date = toDateOnly(value);
  if (!date) return "No entries yet";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loadingXp, setLoadingXp] = useState(true);
  const [xpError, setXpError] = useState("");
  const [journalEntries, setJournalEntries] = useState([]);
  const [streakLoading, setStreakLoading] = useState(true);
  const [streakError, setStreakError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchGoals() {
      setLoadingXp(true);
      setXpError("");
      try {
        const response = await http("/api/goals");
        if (cancelled) return;
        const fallback = Array.isArray(response)
          ? response
          : Array.isArray(response?.goals)
            ? response.goals
            : [];
        setGoals(fallback);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load XP data", err);
        setXpError("We couldn't update your XP right now.");
      } finally {
        if (!cancelled) {
          setLoadingXp(false);
        }
      }
    }

    fetchGoals();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchStreakEntries() {
      setStreakLoading(true);
      setStreakError("");
      try {
        const response = await listJournalEntries({ limit: 400 });
        if (cancelled) return;
        const list = Array.isArray(response) ? response : [];
        setJournalEntries(list);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load streak data", err);
        setStreakError("We couldn't load your streak right now.");
        setJournalEntries([]);
      } finally {
        if (!cancelled) {
          setStreakLoading(false);
        }
      }
    }

    fetchStreakEntries();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handler = (event) => {
      const payload = event?.detail;
      if (!Array.isArray(payload)) return;
      setGoals(payload);
      setXpError("");
      setLoadingXp(false);
    };

    window.addEventListener("habits:goalsChange", handler);
    return () => window.removeEventListener("habits:goalsChange", handler);
  }, []);

  const totalXp = useMemo(
    () =>
      goals.reduce((acc, goal) => {
        const value = Number(goal?.xp);
        return acc + (Number.isFinite(value) ? value : 0);
      }, 0),
    [goals],
  );

  const streakStats = useMemo(() => computeStreakStats(journalEntries), [journalEntries]);
  const streakPreview = useMemo(() => {
    const today = new Date();
    const activeSet = new Set(streakStats.activeDates);

    const lastSeven = Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      const key = day.toISOString().slice(0, 10);
      const label = day.toLocaleDateString(undefined, { weekday: "short" });
      return { key, label, active: activeSet.has(key), dayIndex: day.getDay() };
    });

    return lastSeven.sort((a, b) => a.dayIndex - b.dayIndex); // Sunday (0) through Saturday (6)
  }, [streakStats.activeDates]);

  const frequentHabits = useMemo(() => {
    const totals = new Map();

    for (const goal of goals) {
      const habitId = goal?.habit_id ?? goal?.habit?.id;
      if (!habitId) continue;

      const habitName = goal?.habit?.name || "Habit";
      const habitDescription = goal?.habit?.description || "";
      const xp = Number(goal?.xp);
      const safeXp = Number.isFinite(xp) ? xp : 0;

      const current = totals.get(habitId) || {
        id: habitId,
        name: habitName,
        description: habitDescription,
        totalXp: 0,
        goalsCount: 0,
      };

      totals.set(habitId, {
        ...current,
        name: current.name || habitName,
        description: current.description || habitDescription,
        totalXp: current.totalXp + safeXp,
        goalsCount: current.goalsCount + 1,
      });
    }

    return Array.from(totals.values())
      .sort(
        (a, b) =>
          b.totalXp - a.totalXp ||
          b.goalsCount - a.goalsCount ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 3);
  }, [goals]);
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = totalXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel || XP_PER_LEVEL;
  const progressPercent = Math.min(100, (xpIntoLevel / XP_PER_LEVEL) * 100);

  return (
    <>
      <AuthNavbar />
      <main className="flex-1">
        <header className="mb-10 space-y-4">
          <h2 className="text-4xl font-semibold text-emerald-800 dark:text-emerald-300">Dashboard</h2>
        </header>

        <section>
          <div className="rounded-3xl border border-white/50 bg-white/80 p-8 shadow-lg backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70">
            <p className="text-lg font-medium text-emerald-900 dark:text-emerald-200">
              Hello {user?.name || "friend"}!
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{user?.email}</p>
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
              Use the habits page to track your goals and visit your profile to update your preferences.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <div className="rounded-3xl border border-emerald-200/60 bg-emerald-50/70 p-8 shadow-xl backdrop-blur-md transition-colors duration-500 dark:border-emerald-700/50 dark:bg-emerald-950/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-emerald-800 dark:text-emerald-200">
                Journal Streak
              </h3>
            </div>
            <p className="mt-2 text-sm text-emerald-900/80 dark:text-emerald-200/80">
              Calculated from your journal timestamps — keep logging daily to keep the chain alive.
            </p>

            {streakLoading ? (
              <div className="mt-6 space-y-3">
                <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-emerald-200/60 dark:bg-emerald-900/60" />
                <div className="h-10 w-1/2 animate-pulse rounded-2xl bg-emerald-200/60 dark:bg-emerald-900/60" />
                <div className="h-12 w-full animate-pulse rounded-2xl bg-emerald-200/60 dark:bg-emerald-900/60" />
              </div>
            ) : streakError ? (
              <p className="mt-4 rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4 text-sm text-rose-700 dark:border-rose-700/60 dark:bg-rose-900/40 dark:text-rose-100">
                {streakError}
              </p>
            ) : (
              <>
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200/70 bg-white/70 p-4 dark:border-emerald-700/60 dark:bg-emerald-900/50">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                      Current streak
                    </p>
                    <div className="mt-2 text-3xl font-bold text-emerald-900 dark:text-emerald-50">
                      {streakStats.current} day{streakStats.current === 1 ? "" : "s"}
                    </div>
                    <p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-100/70">
                      Last entry: {formatPrettyDate(streakStats.lastEntry)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/70 bg-white/70 p-4 dark:border-emerald-700/60 dark:bg-emerald-900/50">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                      Best streak
                    </p>
                    <div className="mt-2 text-3xl font-bold text-emerald-900 dark:text-emerald-50">
                      {streakStats.longest} day{streakStats.longest === 1 ? "" : "s"}
                    </div>
                    <p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-100/70">
                      We track this locally from your journal history.
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-emerald-200/70 bg-white/70 p-4 dark:border-emerald-700/60 dark:bg-emerald-900/50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                    Past 7 days
                  </p>
                  <div className="mt-3 grid grid-cols-7 gap-2">
                    {streakPreview.map((day) => (
                      <div
                        key={day.key}
                        className={[
                          "flex h-12 flex-col items-center justify-center rounded-xl border text-xs font-semibold transition",
                          day.active
                            ? "border-emerald-400 bg-emerald-200/70 text-emerald-900 shadow-sm dark:border-emerald-500/70 dark:bg-emerald-700/60 dark:text-emerald-50"
                            : "border-emerald-100 bg-emerald-50/70 text-emerald-600 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300",
                        ].join(" ")}
                        title={`${day.label} (${day.key})`}
                      >
                        <span className="text-[10px] uppercase tracking-wide">{day.label}</span>
                        <span className="text-sm">{day.active ? "●" : "–"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="mt-10">
          <div className="rounded-3xl border border-white/50 bg-white/80 p-6 shadow-lg backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                Frequent Habits
              </h4>
              <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/50 dark:text-emerald-200">
                Top by XP earned
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Your most productive habits based on the XP you’ve earned from goals tied to them.
            </p>

            {loadingXp ? (
              <div className="mt-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 w-full animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70"
                  />
                ))}
              </div>
            ) : frequentHabits.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-emerald-200/70 bg-emerald-50/60 p-4 text-sm text-slate-600 dark:border-emerald-700/50 dark:bg-emerald-900/40 dark:text-slate-300">
                Complete goals on the Habits page to see your top habits here.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {frequentHabits.map((habit) => (
                  <li
                    key={habit.id}
                    className="rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-4 shadow-sm transition-colors duration-300 dark:border-emerald-700/50 dark:bg-emerald-900/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
                          {habit.name}
                        </div>
                        {habit.description ? (
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {habit.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold text-emerald-700 dark:text-emerald-200">
                          +{habit.totalXp} XP
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {habit.goalsCount} goal{habit.goalsCount === 1 ? "" : "s"} tracked
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mt-10">
          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="rounded-3xl border border-emerald-200/60 bg-emerald-50/70 p-8 shadow-xl backdrop-blur-md transition-colors duration-500 dark:border-emerald-700/50 dark:bg-emerald-950/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-emerald-800 dark:text-emerald-200">
                  XP Tracker
                </h3>
                <div className="rounded-full border border-emerald-300/60 bg-white/70 px-4 py-1 text-sm font-semibold text-emerald-700 shadow-sm dark:border-emerald-600/50 dark:bg-emerald-900/60 dark:text-emerald-200">
                  Level {level}
                </div>
              </div>
              <p className="mt-2 text-sm text-emerald-900/80 dark:text-emerald-200/80">
                Complete habits to earn XP and push your progress bar forward.
              </p>

              <div className="mt-6">
                {loadingXp ? (
                  <div className="h-3 w-full animate-pulse rounded-full bg-emerald-200/70 dark:bg-emerald-900/60" />
                ) : xpError ? (
                  <p className="text-sm text-emerald-900/80 dark:text-emerald-200/80">{xpError}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm text-emerald-900 dark:text-emerald-100">
                      <span>Total XP</span>
                      <span>{totalXp}</span>
                    </div>
                    <div className="relative mt-3 h-3 w-full overflow-hidden rounded-full bg-emerald-200/60 dark:bg-emerald-900/60">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out dark:bg-emerald-400"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-emerald-900/80 dark:text-emerald-200/80">
                      <span>
                        {xpIntoLevel} / {XP_PER_LEVEL} XP this level
                      </span>
                      <span>
                        {xpToNextLevel === XP_PER_LEVEL
                          ? "Keep going to build momentum!"
                          : `${xpToNextLevel} XP to level ${level + 1}`}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/50 bg-white/80 p-6 shadow-lg backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70">
              <h4 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                Daily Momentum
              </h4>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Every adjustment on the habits page updates these numbers instantly, so you can see
                the impact of each completed task.
              </p>
              <dl className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <div className="flex justify-between">
                  <dt>Current XP</dt>
                  <dd>{loadingXp ? "…" : totalXp}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Next Level</dt>
                  <dd>{loadingXp ? "…" : `Level ${level + 1}`}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>XP Needed</dt>
                  <dd>{loadingXp ? "…" : xpToNextLevel}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
