import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import AuthNavbar from "../components/AuthNavbar";
import { http } from "../api/http";
import { listJournalEntries } from "../api/journal";

function WeeklySparkline({ data = [], maxValue = 10 }) {
  if (!data.length) return null;
  const width = 220;
  const height = 70;
  const padding = 8;
  const usableHeight = height - padding * 2;
  const step = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
  const safeMax = Math.max(maxValue, 1);

  const points = data.map((day, idx) => {
    const x = padding + idx * step;
    const ratio = Math.max(0, Math.min(1, day.value / safeMax));
    const y = height - padding - ratio * usableHeight;
    return `${x},${y}`;
  });

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      <polyline
        fill="none"
        stroke="#10b981"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
      {data.map((day, idx) => {
        const x = padding + idx * step;
        const ratio = Math.max(0, Math.min(1, day.value / safeMax));
        const y = height - padding - ratio * usableHeight;
        return (
          <circle
            key={day.iso || idx}
            cx={x}
            cy={y}
            r="4"
            fill="#10b981"
            stroke="#ecfdf3"
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
}

const XP_PER_LEVEL = 100;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MOTIVATION_API = "https://api.quotable.io/random?tags=inspirational|success|life";
const FALLBACK_QUOTES = [
  { content: "Small steps add up. Keep going.", author: "Unknown" },
  { content: "Momentum beats motivation. Start, then adjust.", author: "Unknown" },
  { content: "Discipline is remembering what you want.", author: "David Campbell" },
  { content: "Action is the antidote to anxiety.", author: "Unknown" },
  { content: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
];

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

function computeWeeklyFocus(entries = []) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - 6); // last 7 days inclusive

  const days = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return {
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
    };
  });

  const habits = new Map(); // habitId -> {name, totalXp, series}

  for (const entry of entries) {
    const iso = (entry?.entry_date || entry?.entryDate || "").slice(0, 10);
    if (!iso) continue;
    if (iso < days[0].iso || iso > days[6].iso) continue; // outside week window

    const habitId = entry?.habit_id ?? entry?.habitId;
    if (!habitId) continue;
    const habitName = entry?.habit_name || entry?.habitName || entry?.habit?.name || "Habit";
    const xp = Number(entry?.xp_delta ?? entry?.xpDelta ?? entry?.xp ?? 0);
    if (!Number.isFinite(xp)) continue;

    const targetIndex = days.findIndex((d) => d.iso === iso);
    if (targetIndex === -1) continue;

    const current = habits.get(habitId) || {
      name: habitName,
      totalXp: 0,
      series: Array.from({ length: 7 }).map(() => 0),
    };

    current.name = current.name || habitName;
    current.totalXp += xp;
    current.series[targetIndex] += xp;
    habits.set(habitId, current);
  }

  const ranked = Array.from(habits.values())
    .filter((h) => h.totalXp > 0)
    .sort((a, b) => b.totalXp - a.totalXp || a.name.localeCompare(b.name));

  const top = ranked[0];
  if (!top) {
    return null;
  }

  return {
    name: top.name,
    totalXp: top.totalXp,
    series: days.map((d, idx) => ({ ...d, value: top.series[idx] })),
    maxValue: Math.max(10, ...top.series),
  };
}

function celebrate({ message }) {
  if (typeof document === "undefined") return;
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.pointerEvents = "none";
  root.style.zIndex = "9999";
  root.style.overflow = "hidden";

  const badge = document.createElement("div");
  badge.textContent = message;
  badge.style.position = "absolute";
  badge.style.left = "50%";
  badge.style.top = "20%";
  badge.style.transform = "translateX(-50%)";
  badge.style.padding = "12px 18px";
  badge.style.borderRadius = "999px";
  badge.style.background = "rgba(16, 185, 129, 0.92)";
  badge.style.color = "#ecfdf3";
  badge.style.fontWeight = "700";
  badge.style.boxShadow = "0 12px 35px rgba(16, 185, 129, 0.35)";
  badge.style.backdropFilter = "blur(6px)";
  root.appendChild(badge);

  const colors = ["#10b981", "#34d399", "#f97316", "#22c55e", "#a7f3d0"];
  const count = 60;
  for (let i = 0; i < count; i += 1) {
    const dot = document.createElement("span");
    const size = Math.max(6, Math.random() * 10);
    dot.style.position = "absolute";
    dot.style.left = "50%";
    dot.style.top = "20%";
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.borderRadius = "50%";
    dot.style.background = colors[i % colors.length];
    dot.style.opacity = "0.9";
    const angle = Math.random() * Math.PI * 2;
    const velocity = 12 + Math.random() * 14;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity;
    const duration = 900 + Math.random() * 400;
    dot.animate(
      [
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.4)`, opacity: 0 },
      ],
      { duration, easing: "ease-out", fill: "forwards" },
    );
    root.appendChild(dot);
  }

  document.body.appendChild(root);
  setTimeout(() => root.remove(), 1500);
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
  const [quote, setQuote] = useState({ content: "", author: "" });
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [journalEntries, setJournalEntries] = useState([]);
  const [streakLoading, setStreakLoading] = useState(true);
  const [streakError, setStreakError] = useState("");
  const prevStreakRef = useRef(null);
  const prevGoalsRef = useRef([]);
  const prevLevelRef = useRef(null);

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
    let cancelled = false;

    async function fetchQuote() {
      setQuoteLoading(true);
      try {
        const resp = await fetch(MOTIVATION_API);
        if (!resp.ok) {
          throw new Error(`Quote fetch failed: ${resp.status}`);
        }
        const data = await resp.json();
        if (cancelled) return;
        setQuote({
          content: data?.content || "Keep going—you’re closer than you think.",
          author: data?.author || "",
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Motivation quote fetch failed", err);
        const fallback = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
        setQuote({
          content: fallback.content,
          author: fallback.author || "",
        });
      } finally {
        if (!cancelled) {
          setQuoteLoading(false);
        }
      }
    }

    fetchQuote();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handler = (event) => {
      const payload = event?.detail;
      if (!Array.isArray(payload)) return;
      setJournalEntries(payload);
      setStreakError("");
      setStreakLoading(false);
    };

    window.addEventListener("journal:entriesChange", handler);
    return () => window.removeEventListener("journal:entriesChange", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handler = (event) => {
      const payload = event?.detail;
      if (!Array.isArray(payload)) return;
      setJournalEntries(payload);
      setStreakError("");
      setStreakLoading(false);
    };

    window.addEventListener("journal:entriesChange", handler);
    return () => window.removeEventListener("journal:entriesChange", handler);
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

  const weeklyFocus = useMemo(() => computeWeeklyFocus(journalEntries), [journalEntries]);

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

  useEffect(() => {
    if (streakLoading || streakError) return;
    const previous = prevStreakRef.current;
    if (previous !== null && streakStats.current > previous) {
      celebrate({ message: "Streak up! 🔥" });
    }
    prevStreakRef.current = streakStats.current;
  }, [streakLoading, streakError, streakStats.current]);

  useEffect(() => {
    const prevMap = new Map((prevGoalsRef.current || []).map((g) => [g.id, !!g.completed]));
    const firstRun = prevGoalsRef.current.length === 0;
    const newlyCompleted = goals.filter(
      (g) => g && g.id !== undefined && g.id !== null && g.completed && !prevMap.get(g.id),
    );
    if (!firstRun && newlyCompleted.length) {
      celebrate({ message: "Goal completed! 🎉" });
    }
    prevGoalsRef.current = goals.map((g) => ({ id: g.id, completed: !!g.completed }));
  }, [goals]);

  useEffect(() => {
    if (loadingXp || xpError) return;
    const prev = prevLevelRef.current;
    if (prev !== null && level > prev) {
      celebrate({ message: `Level up! Level ${level} 🏆` });
    }
    prevLevelRef.current = level;
  }, [level, loadingXp, xpError]);

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
            <div className="mt-6 rounded-2xl border border-emerald-100/80 bg-emerald-50/70 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                    Motivation boost
                  </p>
                  <p className="mt-2 text-base font-medium text-emerald-900 dark:text-emerald-50">
                    {quoteLoading ? "Loading a fresh quote..." : quote.content || "Keep going."}
                  </p>
                  {quoteLoading ? null : quote.author && quote.author !== "Unknown" ? (
                    <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-200/80">
                      — {quote.author}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // trigger a new quote on demand
                    const refresh = async () => {
                      setQuoteLoading(true);
                      try {
                        const resp = await fetch(MOTIVATION_API);
                        if (!resp.ok) throw new Error(`Quote fetch failed: ${resp.status}`);
                        const data = await resp.json();
                        setQuote({
                          content: data?.content || "Keep going—you’re closer than you think.",
                          author: data?.author || "",
                        });
                      } catch (err) {
                        console.error("Motivation quote fetch failed", err);
                        const fallback =
                          FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
                        setQuote({
                          content: fallback.content,
                          author: fallback.author || "",
                        });
                      } finally {
                        setQuoteLoading(false);
                      }
                    };
                    refresh();
                  }}
                  className="rounded-full border border-emerald-200/70 bg-white/70 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 dark:border-emerald-700/70 dark:bg-emerald-900/60 dark:text-emerald-200 dark:hover:bg-emerald-800/70"
                  disabled={quoteLoading}
              >
                {quoteLoading ? "Refreshing…" : "New quote"}
              </button>
            </div>
            </div>
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                  Weekly Focus
                </h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Your top habit by XP earned in the last 7 days.
                </p>
              </div>
              <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/50 dark:text-emerald-200">
                Auto-calculated
              </span>
            </div>

            {!weeklyFocus ? (
              <p className="mt-4 rounded-2xl border border-dashed border-emerald-200/70 bg-emerald-50/60 p-4 text-sm text-slate-600 dark:border-emerald-700/50 dark:bg-emerald-900/40 dark:text-slate-300">
                Log journal entries this week to see your focus habit.
              </p>
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-700/60 dark:bg-emerald-950/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                        This week’s top habit
                      </p>
                      <p className="mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-50">
                        {weeklyFocus.name}
                      </p>
                      <p className="text-sm text-emerald-800/80 dark:text-emerald-100/80">
                        +{weeklyFocus.totalXp} XP in 7 days
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <WeeklySparkline data={weeklyFocus.series} maxValue={weeklyFocus.maxValue} />
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-200/70 bg-white/70 p-4 text-sm text-slate-700 shadow-sm dark:border-emerald-700/60 dark:bg-emerald-900/50 dark:text-emerald-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                    Daily XP
                  </p>
                  <ul className="mt-3 space-y-2">
                    {weeklyFocus.series.map((day) => (
                      <li key={day.iso} className="flex justify-between">
                        <span className="text-emerald-800 dark:text-emerald-100">{day.label}</span>
                        <span className="font-semibold text-emerald-900 dark:text-emerald-50">
                          {day.value} XP
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
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
