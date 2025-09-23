import { useEffect, useMemo, useState } from "react";
import "./Journal.css";

const STORAGE_KEY = "habitsJournal:v1";

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function JournalPage() {
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
    <div className="jrnl wrap">
      <h1 className="jrnl title">Daily Habits Journal</h1>

      {/* Summary card */}
      <section className="jrnl card summary">
        <div className="summary-row">
          <div className="summary-metric">
            <div className="metric-label">Completion</div>
            <div className="metric-value">{completion}%</div>
          </div>
          <div className="summary-metric">
            <div className="metric-label">Habits Today</div>
            <div className="metric-value">{totalCount}</div>
          </div>
          <div className="summary-metric">
            <div className="metric-label">Avg Rating</div>
            <div className="metric-value">{avgRating}</div>
          </div>
        </div>
        <div className="progress">
          <div className="progress-bar" style={{ width: `${completion}%` }} />
        </div>
      </section>

      {/* Add form */}
      <form onSubmit={addEntry} className="jrnl card form">
        <div className="grid-2">
          <label className="field">
            <span className="label">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </label>
          <label className="field">
            <span className="label">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
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

        <label className="field">
          <span className="label">Habit</span>
          <input
            value={habit}
            onChange={(e) => setHabit(e.target.value)}
            placeholder="e.g., 30-min run, read 20 pages"
            className="input"
            required
          />
        </label>

        <div className="grid-2">
          <label className="field">
            <span className="label">Rating (1–5)</span>
            <input
              type="number"
              min={1}
              max={5}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="input"
            />
          </label>
          <label className="field">
            <span className="label">Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it go?"
              className="input"
            />
          </label>
        </div>

        <div className="actions">
          <button type="submit" className="btn primary">Add Entry</button>
        </div>
      </form>

      {/* Filters */}
      <section className="jrnl card filters">
        <div className="grid-2">
          <label className="field">
            <span className="label">Filter by date</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="input"
            />
          </label>

          <label className="field">
            <span className="label">Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search habit / category / notes…"
              className="input"
            />
          </label>
        </div>
      </section>

      {/* List */}
      {grouped.length === 0 ? (
        <p className="empty">No entries yet. Add your first habit above! ✨</p>
      ) : (
        grouped.map(([d, items]) => (
          <section key={d} className="jrnl section">
            <h3 className="date-heading">{d}</h3>
            <ul className="list">
              {items.map((e) => (
                <li key={e.id} className={`item ${e.done ? "done" : ""}`}>
                  <div className="item-header">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={e.done}
                        onChange={() => toggleDone(e.id)}
                        aria-label="mark done"
                      />
                      <span className="custom-checkbox" />
                    </label>

                    <div className="item-title">{e.habit}</div>

                    <span className={`chip chip-${slug(e.category)}`}>
                      {e.category}
                    </span>
                  </div>

                  <div className="item-meta">
                    <span className="rating">Rating: {e.rating}/5</span>
                    {e.notes && <span className="notes">• {e.notes}</span>}
                  </div>

                  <div className="item-actions">
                    <button
                      onClick={() => toggleDone(e.id)}
                      className="btn subtle"
                      type="button"
                    >
                      {e.done ? "Mark Undone" : "Mark Done"}
                    </button>
                    <button
                      onClick={() => removeEntry(e.id)}
                      className="btn danger"
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
