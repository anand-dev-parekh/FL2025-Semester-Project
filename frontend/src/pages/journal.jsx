import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "habitsJournal:v1";

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const cardClasses =
  "rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70";
const inputClasses =
  "mt-2 w-full rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/70 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-400";
const buttonBase =
  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

const categoryChipStyles = {
  wellness: "bg-emerald-200/80 text-emerald-900 dark:bg-emerald-500/30 dark:text-emerald-200",
  fitness: "bg-orange-200/80 text-orange-900 dark:bg-orange-500/30 dark:text-orange-200",
  productivity: "bg-amber-200/80 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200",
  learning: "bg-purple-200/80 text-purple-900 dark:bg-purple-500/30 dark:text-purple-200",
  nutrition: "bg-lime-200/80 text-lime-900 dark:bg-lime-500/30 dark:text-lime-200",
  mindfulness: "bg-rose-200/80 text-rose-900 dark:bg-rose-500/30 dark:text-rose-200",
  other: "bg-slate-200/80 text-slate-800 dark:bg-slate-700/40 dark:text-slate-200",
};

export default function JournalPage() {
  const navigate = useNavigate();

  const [entries, setEntries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });

  // form state
  const [date, setDate] = useState(todayISO());
  const [habit, setHabit] = useState("");
  const [category, setCategory] = useState("Wellness");
  const [rating, setRating] = useState(3);
  const [notes, setNotes] = useState("");

  // filters
  const [filterDate, setFilterDate] = useState(todayISO());
  const [search, setSearch] = useState("");

  // persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const addEntry = (e) => {
    e.preventDefault();
    if (!habit.trim()) return;

    const newEntry = {
      id: crypto.randomUUID(),
      date,
      habit: habit.trim(),
      category,
      rating: Number(rating),
      notes: notes.trim(),
      done: false,
      createdAt: Date.now(),
    };
    setEntries((prev) => [newEntry, ...prev]);

    // reset
    setHabit("");
    setNotes("");
    setRating(3);
  };

  const toggleDone = (id) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, done: !e.done } : e)));

  const removeEntry = (id) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      const matchesDate = filterDate ? e.date === filterDate : true;
      const matchesSearch =
        !q ||
        e.habit.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q);
      return matchesDate && matchesSearch;
    });
  }, [entries, filterDate, search]);

  // group by date
  const grouped = useMemo(() => {
    const byDate = {};
    for (const e of filtered) {
      byDate[e.date] ??= [];
      byDate[e.date].push(e);
    }
    Object.values(byDate).forEach((arr) => arr.sort((a, b) => b.createdAt - a.createdAt));
    return Object.entries(byDate).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [filtered]);

  // quick stats for the selected day
  const todayEntries = entries.filter((e) => e.date === filterDate);
  const doneCount = todayEntries.filter((e) => e.done).length;
  const totalCount = todayEntries.length || 0;
  const completion = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  const avgRating =
    totalCount ? (todayEntries.reduce((s, e) => s + e.rating, 0) / totalCount).toFixed(1) : "-";

  return (
    <div className="relative flex-1 pb-16">
      <button
        onClick={() => navigate("/app")}
        className={`${buttonBase} absolute left-0 top-0 border border-emerald-200/60 bg-white/80 text-emerald-800 hover:bg-emerald-50/80 dark:border-emerald-700/40 dark:bg-slate-900/70 dark:text-emerald-200 dark:hover:bg-slate-900`}
      >
        ← Home
      </button>
      <h1 className="mt-16 text-4xl font-semibold text-emerald-900 dark:text-emerald-200">
        Daily Habits Journal
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
        Log habits, capture notes, and see your progress bloom. Filter by date or search to revisit
        your wins.
      </p>

      {/* Summary card */}
      <section className={`${cardClasses} mt-10`}>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-100/40 p-5 text-sm text-emerald-900 shadow-inner dark:border-emerald-500/30 dark:bg-emerald-900/30 dark:text-emerald-200">
            <div className="text-xs uppercase tracking-[0.2em]">Completion</div>
            <div className="mt-3 text-3xl font-semibold">{completion}%</div>
          </div>
          <div className="rounded-2xl border border-orange-200/60 bg-orange-100/40 p-5 text-sm text-orange-900 shadow-inner dark:border-orange-500/30 dark:bg-orange-900/30 dark:text-orange-200">
            <div className="text-xs uppercase tracking-[0.2em]">Habits Today</div>
            <div className="mt-3 text-3xl font-semibold">{totalCount}</div>
          </div>
          <div className="rounded-2xl border border-rose-200/60 bg-rose-100/40 p-5 text-sm text-rose-900 shadow-inner dark:border-rose-500/30 dark:bg-rose-900/30 dark:text-rose-200">
            <div className="text-xs uppercase tracking-[0.2em]">Avg Rating</div>
            <div className="mt-3 text-3xl font-semibold">{avgRating}</div>
          </div>
        </div>
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-800/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-400 transition-[width]"
            style={{ width: `${completion}%` }}
          />
        </div>
      </section>

      {/* Add form */}
      <form onSubmit={addEntry} className={`${cardClasses} mt-8`}>
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClasses}
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`${inputClasses} appearance-none`}
            >
              <option>Wellness</option>
              <option>Fitness</option>
              <option>Productivity</option>
              <option>Learning</option>
              <option>Nutrition</option>
              <option>Mindfulness</option>
              <option>Other</option>
            </select>
          </label>
        </div>

        <label className="mt-6 flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
          <span>Habit</span>
          <input
            value={habit}
            onChange={(e) => setHabit(e.target.value)}
            placeholder="e.g., 30-min run, read 20 pages"
            className={inputClasses}
            required
          />
        </label>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Rating (1–5)</span>
            <input
              type="number"
              min={1}
              max={5}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className={inputClasses}
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it go?"
              className={inputClasses}
            />
          </label>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            className={`${buttonBase} border border-emerald-300/70 bg-emerald-400/80 text-emerald-950 hover:bg-emerald-300/80 dark:border-emerald-500/40 dark:bg-emerald-500/80 dark:text-slate-950 dark:hover:bg-emerald-400/80`}
          >
            Add Entry
          </button>
        </div>
      </form>

      {/* Filters */}
      <section className={`${cardClasses} mt-8`}>
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Filter by date</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className={inputClasses}
            />
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search habit / category / notes…"
              className={inputClasses}
            />
          </label>
        </div>
      </section>

      {/* List */}
      {grouped.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-emerald-300/70 bg-white/60 p-10 text-center text-sm text-slate-600 shadow-inner dark:border-emerald-500/40 dark:bg-slate-900/60 dark:text-slate-300">
          No entries yet. Add your first habit above! ✨
        </p>
      ) : (
        grouped.map(([d, items]) => (
          <section key={d} className="mt-10">
            <h3 className="text-xl font-semibold text-emerald-900 dark:text-emerald-200">{d}</h3>
            <ul className="mt-4 space-y-6">
              {items.map((e) => (
                <li
                  key={e.id}
                  className={`rounded-3xl border p-6 shadow-lg transition-colors duration-300 backdrop-blur-md ${
                    e.done
                      ? "border-emerald-300/70 bg-emerald-100/50 dark:border-emerald-500/40 dark:bg-emerald-900/40"
                      : "border-white/60 bg-white/80 dark:border-slate-800/70 dark:bg-slate-900/70"
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={e.done}
                          onChange={() => toggleDone(e.id)}
                          aria-label="mark done"
                          className="h-5 w-5 rounded border border-emerald-400 text-emerald-600 focus:ring-emerald-400 dark:border-emerald-600 dark:bg-slate-900 dark:text-emerald-400"
                        />
                      </label>

                      <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {e.habit}
                      </div>
                    </div>

                    <span
                      className={`inline-flex min-w-[7rem] items-center justify-center rounded-full px-4 py-1 text-sm font-semibold ${chipClassForCategory(e.category)}`}
                    >
                      {e.category}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-medium text-emerald-800 dark:text-emerald-300">
                      Rating: {e.rating}/5
                    </span>
                    {e.notes && <span className="text-slate-500 dark:text-slate-400">• {e.notes}</span>}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => toggleDone(e.id)}
                      className={`${buttonBase} border border-emerald-200/60 bg-white/70 text-emerald-800 hover:bg-emerald-50/70 dark:border-emerald-600/40 dark:bg-slate-900/60 dark:text-emerald-200 dark:hover:bg-slate-900`}
                      type="button"
                    >
                      {e.done ? "Mark Undone" : "Mark Done"}
                    </button>
                    <button
                      onClick={() => removeEntry(e.id)}
                      className={`${buttonBase} border border-rose-200/70 bg-rose-400/80 text-rose-50 hover:bg-rose-400 dark:border-rose-500/40 dark:bg-rose-500/70 dark:text-white dark:hover:bg-rose-500`}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function slug(s) {
  return s.toLowerCase().replace(/\s+/g, "-");
}

function chipClassForCategory(category) {
  return categoryChipStyles[slug(category)] ?? "bg-slate-200/80 text-slate-800 dark:bg-slate-700/40 dark:text-slate-200";
}
