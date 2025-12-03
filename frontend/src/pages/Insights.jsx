import { useEffect, useMemo, useState } from "react";
import AuthNavbar from "../components/AuthNavbar";
import { http } from "../api/http";

const card =
  "rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70";
const selectBase =
  "mt-2 w-full rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/70 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100";

function TrendChart({ points }) {
  if (!points.length) {
    return <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No entries yet for this habit.</p>;
  }

  const maxRatio = 1.2; // allow 120%
  const padded = points.map((p) => Math.max(0, Math.min(maxRatio, p)));
  const width = Math.max(560, padded.length * 60);
  const height = 260;
  const padLeft = 56; // for y-axis labels
  const padRight = 32;
  const padTop = 52;
  const padBottom = 40;
  const spanX = width - padLeft - padRight;
  const spanY = height - padTop - padBottom;
  const xs = padded.map((_, i) => (i / Math.max(1, padded.length - 1)) * spanX + padLeft);
  const ys = padded.map((p) => padTop + (maxRatio - p) / maxRatio * spanY);

  const areaPoints = [`${padLeft},${height - padBottom}`]
    .concat(xs.map((x, i) => `${x},${ys[i]}`))
    .concat(`${xs[xs.length - 1]},${height - padBottom}`)
    .join(" ");

  const gridLines = [0, 0.25, 0.5, 0.75, 1, 1.2];

  return (
    <div className="mt-6 overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full"
        style={{ minWidth: `${width}px` }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines.map((g) => {
          const y = padTop + (maxRatio - g) / maxRatio * spanY;
          return (
            <g key={g}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="#cbd5e1"
                strokeDasharray="4 4"
                opacity="0.5"
              />
              <text
                x={padLeft - 10}
                y={y + 4}
                fontSize="11"
                fill="#0f172a"
                opacity="0.7"
                textAnchor="end"
              >
                {(g * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}
        <polygon points={areaPoints} fill="url(#trend-fill)" />
        <polyline
          fill="none"
          stroke="#10B981"
          strokeWidth="3.5"
          strokeLinecap="round"
          points={xs.map((x, i) => `${x},${ys[i]}`).join(" ")}
        />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r="4" fill="#059669" />
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
        <span>Lower values mean further from target.</span>
        <span>Above 100% = goal surpassed.</span>
      </div>
    </div>
  );
}

function BarChart({ data, color = "#10B981" }) {
  const maxVal = data.reduce((m, d) => Math.max(m, d.value || 0), 0) || 1;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(40px,1fr))] gap-3">
      {data.map((item) => {
        const height = Math.max(8, Math.round((item.value / maxVal) * 100));
        return (
          <div key={item.label} className="flex flex-col items-center gap-1">
            <div className="flex h-16 w-full items-end justify-center rounded-xl bg-emerald-50/70 p-1 dark:bg-emerald-950/40">
              <div
                className="w-3 rounded-full"
                style={{
                  height: `${height}%`,
                  background: `linear-gradient(180deg, ${color}, #34d399)`,
                }}
              />
            </div>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {item.label}
            </span>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-200">{item.value} XP</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Insights() {
  const [goals, setGoals] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedHabit, setSelectedHabit] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [g, e] = await Promise.all([
          http("/api/goals"),
          http("/api/journal/entries?limit=400"),
        ]);
        if (cancelled) return;
        setGoals(Array.isArray(g) ? g : []);
        setEntries(Array.isArray(e) ? e : []);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError("Unable to load insights data right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const habitOptions = useMemo(() => {
    const map = new Map();
    goals.forEach((g) => {
      const habitId = g.habit?.id || g.habit_id;
      if (!habitId) return;
      if (!map.has(habitId)) {
        map.set(habitId, {
          id: habitId,
          name: g.habit?.name || "Habit",
          description: g.habit?.description || "",
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [goals]);

  useEffect(() => {
    if (!selectedHabit && habitOptions.length) {
      setSelectedHabit(String(habitOptions[0].id));
    }
  }, [habitOptions, selectedHabit]);

  const filteredEntries = useMemo(() => {
    if (!selectedHabit) return [];
    return entries.filter((e) => String(e.habit_id) === String(selectedHabit));
  }, [entries, selectedHabit]);

  const trend = useMemo(() => {
    const byDate = new Map();
    filteredEntries.forEach((e) => {
      const ratio = Number(e.value_ratio ?? e.health_ratio);
      const safeRatio = Number.isFinite(ratio) ? Math.max(0, ratio) : null;
      const xp = Number(e.xp_delta);
      const safeXp = Number.isFinite(xp) ? xp : 0;
      if (!byDate.has(e.entry_date)) {
        byDate.set(e.entry_date, { ratios: [], xp: 0 });
      }
      const current = byDate.get(e.entry_date);
      if (safeRatio !== null) current.ratios.push(safeRatio);
      current.xp += safeXp;
    });
    return Array.from(byDate.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, stats]) => ({
        date,
        avgRatio:
          stats.ratios.length > 0
            ? stats.ratios.reduce((s, r) => s + r, 0) / stats.ratios.length
            : 0,
        xp: stats.xp,
      }));
  }, [filteredEntries]);

  const summary = useMemo(() => {
    if (!trend.length) return { avg: 0, best: 0, totalXp: 0 };
    const avg =
      trend.reduce((s, d) => s + d.avgRatio, 0) / Math.max(1, trend.length);
    const best = Math.max(...trend.map((d) => d.avgRatio));
    const totalXp = trend.reduce((s, d) => s + d.xp, 0);
    return { avg, best, totalXp };
  }, [trend]);

  return (
    <>
      <AuthNavbar />
      <main className="flex-1 space-y-10">
        <header className="space-y-3">
          <h1 className="text-4xl font-semibold text-emerald-800 dark:text-emerald-200">
            Insights
          </h1>
          <p className="max-w-2xl text-sm text-slate-700 dark:text-slate-300">
            Filter a habit to see how your tracking is trending. All charts use your logged values and XP.
          </p>
        </header>

        <section className={card}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Habit
              <select
                value={selectedHabit}
                onChange={(e) => setSelectedHabit(e.target.value)}
                className={`${selectBase} appearance-none`}
              >
                {habitOptions.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              {habitOptions.find((h) => String(h.id) === String(selectedHabit))?.description ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {habitOptions.find((h) => String(h.id) === String(selectedHabit))?.description}
                </p>
              ) : null}
            </label>
            <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/60 p-4 text-sm shadow-inner dark:border-emerald-700/50 dark:bg-emerald-950/40">
              <p className="text-emerald-800 dark:text-emerald-100">
                Avg completion: {(summary.avg * 100).toFixed(0)}% · Best day: {(summary.best * 100).toFixed(0)}% · XP earned: {summary.totalXp}
              </p>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
                XP scales linearly to 10 when you meet or exceed your target.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className={card}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                Completion trend
              </h3>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                Daily average
              </span>
            </div>
            {loading ? (
              <div className="mt-6 h-20 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
            ) : error ? (
              <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>
            ) : (
              <TrendChart points={trend.map((t) => t.avgRatio)} />
            )}
          </div>

          <div className={card}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">XP by day</h3>
              <span className="rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/50 dark:text-emerald-200">
                Progress
              </span>
            </div>
            {loading ? (
              <div className="mt-6 h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
            ) : error ? (
              <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>
            ) : !trend.length ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No XP yet for this habit.</p>
            ) : (
              <div className="mt-6">
                <BarChart
                  data={trend.slice(-12).map((t) => ({
                    label: t.date.slice(5),
                    value: t.xp,
                  }))}
                />
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
