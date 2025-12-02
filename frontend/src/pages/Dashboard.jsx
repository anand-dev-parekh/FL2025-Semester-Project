import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import AuthNavbar from "../components/AuthNavbar";
import { http } from "../api/http";

const XP_PER_LEVEL = 100;
const DAYS_WINDOW = 14;

export default function Dashboard() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loadingXp, setLoadingXp] = useState(true);
  const [xpError, setXpError] = useState("");
  const [entries, setEntries] = useState([]);
  const [entriesError, setEntriesError] = useState("");
  const [entriesLoading, setEntriesLoading] = useState(true);

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

    async function fetchEntries() {
      setEntriesLoading(true);
      setEntriesError("");
      try {
        const today = new Date();
        const from = new Date(today);
        from.setDate(today.getDate() - (DAYS_WINDOW - 1));
        const params = new URLSearchParams();
        params.set("from", from.toISOString().slice(0, 10));
        params.set("to", today.toISOString().slice(0, 10));
        params.set("limit", "400");
        const response = await http(`/api/journal/entries?${params.toString()}`);
        if (cancelled) return;
        setEntries(Array.isArray(response) ? response : []);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load entries", err);
        setEntries([]);
        setEntriesError("We couldn't load your latest check-ins.");
      } finally {
        if (!cancelled) setEntriesLoading(false);
      }
    }

    fetchGoals();
    fetchEntries();

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

  const dailyTrend = useMemo(() => {
    if (!entries.length) return [];
    const byDate = new Map();
    for (const entry of entries) {
      const date = entry.entry_date;
      if (!date) continue;
      const ratio = Number(entry.value_ratio ?? entry.health_ratio);
      const safeRatio = Number.isFinite(ratio) ? Math.max(0, ratio) : null;
      const xp = Number(entry.xp_delta);
      const safeXp = Number.isFinite(xp) ? xp : 0;
      const current = byDate.get(date) || { totalXp: 0, ratios: [] };
      byDate.set(date, {
        totalXp: current.totalXp + safeXp,
        ratios: safeRatio !== null ? [...current.ratios, safeRatio] : current.ratios,
      });
    }
    return Array.from(byDate.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, stats]) => {
        const avgRatio =
          stats.ratios.length > 0
            ? stats.ratios.reduce((s, r) => s + r, 0) / stats.ratios.length
            : 0;
        return {
          date,
          avgRatio,
          xp: stats.totalXp,
        };
      });
  }, [entries]);

  const habitSnapshots = useMemo(() => {
    if (!entries.length) return [];
    const byHabit = new Map();
    for (const entry of entries) {
      const habitId = entry.habit_id;
      if (!habitId) continue;
      const ratio = Number(entry.value_ratio ?? entry.health_ratio);
      const safeRatio = Number.isFinite(ratio) ? ratio : null;
      const xp = Number(entry.xp_delta);
      const safeXp = Number.isFinite(xp) ? xp : 0;
      const current = byHabit.get(habitId) || {
        habitId,
        habitName: entry.habit_name || entry.goal_text || "Habit",
        totalXp: 0,
        samples: [],
        lastValue: entry.value_used ?? entry.health_value ?? entry.numeric_value ?? null,
        target: entry.target_value,
        unit: entry.numeric_unit || entry.target_unit || entry.habit_unit,
      };
      byHabit.set(habitId, {
        ...current,
        totalXp: current.totalXp + safeXp,
        samples: safeRatio !== null ? [...current.samples, safeRatio] : current.samples,
        lastValue: entry.value_used ?? entry.health_value ?? entry.numeric_value ?? current.lastValue,
        target: entry.target_value ?? current.target,
        unit: current.unit || entry.numeric_unit || entry.target_unit,
      });
    }
    return Array.from(byHabit.values())
      .map((item) => {
        const avgRatio =
          item.samples.length > 0
            ? item.samples.reduce((s, r) => s + r, 0) / item.samples.length
            : 0;
        return { ...item, avgRatio };
      })
      .sort((a, b) => b.totalXp - a.totalXp || (b.avgRatio || 0) - (a.avgRatio || 0))
      .slice(0, 5);
  }, [entries]);

  const maxDailyXp = dailyTrend.reduce((m, d) => Math.max(m, d.xp || 0), 0) || 10;

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

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.6fr,1.4fr]">
          <div className="rounded-3xl border border-white/50 bg-white/80 p-6 shadow-lg backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                  Last {DAYS_WINDOW} Days
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  XP and completion ratios from your quantitative logs.
                </p>
              </div>
              <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/50 dark:text-emerald-200">
                Recent trend
              </span>
            </div>

            {entriesLoading ? (
              <div className="mt-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-10 w-full animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70"
                  />
                ))}
              </div>
            ) : entriesError ? (
              <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{entriesError}</p>
            ) : !dailyTrend.length ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                Log a few days to see your momentum here.
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {dailyTrend.map((day) => {
                  const ratioPercent = Math.min(100, Math.max(0, Math.round(day.avgRatio * 100)));
                  const xpHeight = Math.max(6, Math.round((day.xp / maxDailyXp) * 100));
                  return (
                    <div key={day.date} className="flex items-center gap-3">
                      <div className="w-16 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                        {day.date.slice(5)}
                      </div>
                      <div className="flex-1 rounded-2xl border border-emerald-100/80 bg-emerald-50/70 p-3 dark:border-emerald-800/50 dark:bg-emerald-950/40">
                        <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200">
                          <span>Avg completion</span>
                          <span>{ratioPercent}%</span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-emerald-100/60 dark:bg-emerald-900/70">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 transition-[width] duration-500"
                            style={{ width: `${ratioPercent}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex w-12 flex-col items-center text-[11px] text-emerald-800 dark:text-emerald-200">
                        <div
                          className="w-7 rounded-full bg-emerald-400/80 dark:bg-emerald-500/80"
                          style={{ height: `${xpHeight}%` }}
                          title={`${day.xp} XP`}
                        />
                        <span className="mt-1 font-semibold">{day.xp} XP</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/50 bg-white/80 p-6 shadow-lg backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                  Habit Snapshots
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Rolling averages from your recent logs (top 5 habits).
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                Insights
              </span>
            </div>

            {entriesLoading ? (
              <div className="mt-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 w-full animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70"
                  />
                ))}
              </div>
            ) : entriesError ? (
              <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{entriesError}</p>
            ) : !habitSnapshots.length ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                Log values to see habit-by-habit progress.
              </p>
            ) : (
              <ul className="mt-5 space-y-4">
                {habitSnapshots.map((habit) => {
                  const percent = Math.min(120, Math.max(0, Math.round(habit.avgRatio * 100)));
                  const targetText =
                    habit.target && habit.unit
                      ? `${habit.target} ${habit.unit}`
                      : habit.target
                        ? habit.target
                        : "";
                  return (
                    <li
                      key={habit.habitId}
                      className="rounded-2xl border border-emerald-100/80 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-950/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                            {habit.habitName}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            Avg {percent}% of target {targetText ? `(${targetText})` : ""} · Last:{" "}
                            {habit.lastValue !== null && habit.lastValue !== undefined
                              ? `${habit.lastValue} ${habit.unit || ""}`.trim()
                              : "no log"}
                          </p>
                        </div>
                        <div className="text-right text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                          +{habit.totalXp} XP
                        </div>
                      </div>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-100/60 dark:bg-emerald-900/70">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-cyan-400 transition-[width] duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
