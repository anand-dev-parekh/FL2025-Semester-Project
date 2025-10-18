// frontend/src/pages/Habits.jsx
import { useEffect, useMemo, useState } from "react";
import { http } from "../api/http"; // your helper
import AuthNavbar from "../components/AuthNavbar";

const cardClasses =
  "rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70";
const inputClasses =
  "mt-2 w-full rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/70 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-400";
const buttonBase =
  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

export default function HabitsPage() {
  // server state
  const [habits, setHabits] = useState([]);
  const [goals, setGoals] = useState([]);

  // ui state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // form state (create / update)
  const [habitId, setHabitId] = useState("");
  const [goalText, setGoalText] = useState("");

  // filters (client-side convenience)
  const [filterHabit, setFilterHabit] = useState("");
  const [search, setSearch] = useState("");

  // computed: currently selected habit (for description preview)
  const selectedHabit = useMemo(
    () => habits.find((h) => String(h.id) === String(habitId)),
    [habits, habitId]
  );

  // load habits + goals
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const [h, g] = await Promise.all([http("/api/habits"), http("/api/goals")]);
        setHabits(h || []);
        setGoals(Array.isArray(g) ? g : []);
        if (!h?.length) setHabitId(""); // no habits yet
        else setHabitId(String(h[0].id));
      } catch (e) {
        console.error(e);
        setErr("Failed to load habits/goals.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onCreateGoal = async (e) => {
    e.preventDefault();
    if (!habitId || !goalText.trim()) return;
    try {
      const created = await http("/api/goals", {
        method: "POST",
        body: { habit_id: Number(habitId), goal_text: goalText.trim() },
      });
      const newGoal = created?.goal ?? created;
      setGoals((gs) => [newGoal, ...gs]);
      setGoalText("");
    } catch (e) {
      console.error(e);
      alert("Could not create goal.");
    }
  };

  const onDeleteGoal = async (id) => {
    const keep = goals;
    setGoals((gs) => gs.filter((g) => g.id !== id)); // optimistic
    try {
      await http(`/api/goals/${id}`, { method: "DELETE" });
    } catch (e) {
      console.error(e);
      alert("Could not delete goal.");
      setGoals(keep); // revert
    }
  };

  const onEditGoalText = async (id, newText) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const prev = goals;
    setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, goal_text: trimmed } : g))); // optimistic
    try {
      const updated = await http(`/api/goals/${id}`, {
        method: "PATCH",
        body: { goal_text: trimmed },
      });
      const upd = updated?.goal ?? updated;
      setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, ...upd } : g)));
    } catch (e) {
      console.error(e);
      alert("Could not update goal text.");
      setGoals(prev); // revert
    }
  };

  const adjustXp = async (id, delta) => {
    const target = goals.find((g) => g.id === id);
    if (!target) return;
    const newXp = Math.max(0, (target.xp || 0) + delta);
    const prev = goals;
    setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, xp: newXp } : g))); // optimistic
    try {
      const updated = await http(`/api/goals/${id}`, {
        method: "PATCH",
        body: { xp: newXp },
      });
      const upd = updated?.goal ?? updated;
      setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, ...upd } : g)));
    } catch (e) {
      console.error(e);
      alert("Could not update XP.");
      setGoals(prev); // revert
    }
  };

  // local helpers
  const habitsById = useMemo(() => {
    const m = new Map();
    for (const h of habits) m.set(h.id, h);
    return m;
  }, [habits]);

  // filter + search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return goals.filter((g) => {
      const h = habitsById.get(g.habit_id);
      const byHabit = filterHabit ? String(g.habit_id) === filterHabit : true;
      const text = `${g.goal_text || ""} ${(h?.name || "")} ${(h?.description || "")}`.toLowerCase();
      const bySearch = q ? text.includes(q) : true;
      return byHabit && bySearch;
    });
  }, [goals, habitsById, filterHabit, search]);

  // group by habit for a nice layout
  const grouped = useMemo(() => {
    const byHabit = new Map();
    for (const g of filtered) {
      const k = String(g.habit_id);
      if (!byHabit.has(k)) byHabit.set(k, []);
      byHabit.get(k).push(g);
    }
    for (const [, arr] of byHabit.entries()) {
      arr.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
    }
    return Array.from(byHabit.entries()).map(([k, arr]) => [habitsById.get(Number(k)), arr]);
  }, [filtered, habitsById]);

  // stats
  const totalGoals = filtered.length;
  const totalXp = filtered.reduce((acc, g) => acc + (g.xp || 0), 0);

  return (
    <>
      <AuthNavbar />
      <main className="flex-1 space-y-8">
      <header>
         <div>
          <h2 className="text-4xl font-semibold text-emerald-900 dark:text-emerald-300">Your Habits and Goals</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Create goals tied to habits, track XP, and keep moving forward.
          </p>
        </div>
      </header>

      {/* Summary */}
      <section className={`${cardClasses} mt-10`}>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-100/40 p-5 text-sm text-emerald-900 shadow-inner dark:border-emerald-500/30 dark:bg-emerald-900/30 dark:text-emerald-200">
            <div className="text-xs uppercase tracking-[0.2em]">Goals</div>
            <div className="mt-3 text-3xl font-semibold">{totalGoals}</div>
          </div>
          <div className="rounded-2xl border border-lime-200/60 bg-lime-100/40 p-5 text-sm text-lime-900 shadow-inner dark:border-lime-500/30 dark:bg-lime-900/30 dark:text-lime-200">
            <div className="text-xs uppercase tracking-[0.2em]">Total XP</div>
            <div className="mt-3 text-3xl font-semibold">{totalXp}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-slate-100/40 p-5 text-sm text-slate-900 shadow-inner dark:border-slate-700/30 dark:bg-slate-800/30 dark:text-slate-200">
            <div className="text-xs uppercase tracking-[0.2em]">Habits</div>
            <div className="mt-3 text-3xl font-semibold">{habits.length}</div>
          </div>
        </div>
      </section>

      {/* Create Goal */}
      <form onSubmit={onCreateGoal} className={`${cardClasses} mt-8`}>
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Habit</span>
            <select
              value={habitId}
              onChange={(e) => setHabitId(e.target.value)}
              className={`${inputClasses} appearance-none`}
              required
            >
              {habits.map((h) => (
                <option key={h.id} value={h.id} title={h.description || ""}>
                  {h.name}
                </option>
              ))}
            </select>
            {/* Description preview for selected habit */}
            {selectedHabit?.description ? (
              <em className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                {selectedHabit.description}
              </em>
            ) : null}
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Goal</span>
            <input
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              placeholder="e.g., Run 3x per week"
              className={inputClasses}
              required
            />
          </label>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            className={`${buttonBase} border border-emerald-300/70 bg-emerald-400/80 text-emerald-950 hover:bg-emerald-300/80 dark:border-emerald-500/40 dark:bg-emerald-500/80 dark:text-slate-950 dark:hover:bg-emerald-400/80`}
          >
            Add Goal
          </button>
        </div>
      </form>

      {/* Filters */}
      <section className={`${cardClasses} mt-8`}>
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Filter by habit</span>
            <select
              value={filterHabit}
              onChange={(e) => setFilterHabit(e.target.value)}
              className={`${inputClasses} appearance-none`}
            >
              <option value="">All habits</option>
              {habits.map((h) => (
                <option key={h.id} value={String(h.id)} title={h.description || ""}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search goal or habit…"
              className={inputClasses}
            />
          </label>
        </div>
      </section>

      {/* Goals grouped by habit */}
      {loading ? (
        <p className="mt-10 text-slate-600 dark:text-slate-300">Loading…</p>
      ) : err ? (
        <p className="mt-10 text-rose-600 dark:text-rose-400">{err}</p>
      ) : grouped.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-emerald-300/70 bg-white/60 p-10 text-center text-sm text-slate-600 shadow-inner dark:border-emerald-500/40 dark:bg-slate-900/60 dark:text-slate-300">
          No goals yet. Create your first one above! ✨
        </p>
      ) : (
        grouped.map(([habit, items]) => (
          <section key={habit?.id || "unknown"} className="mt-10">
            <h3 className="text-xl font-semibold text-emerald-900 dark:text-emerald-200">
              {habit?.name || "Unknown habit"}
            </h3>
            {habit?.description && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {habit.description}
              </p>
            )}
            <ul className="mt-4 space-y-6">
              {items.map((g) => (
                <GoalItem
                  key={g.id}
                  goal={g}
                  habitName={habit?.name || ""}
                  habitDescription={habit?.description || ""}
                  onDelete={() => onDeleteGoal(g.id)}
                  onSaveText={(txt) => onEditGoalText(g.id, txt)}
                  onGainXp={() => adjustXp(g.id, +5)}
                  onLoseXp={() => adjustXp(g.id, -5)}
                />
              ))}
            </ul>
          </section>
        ))
      )}
      </main>
    </>
  );
}

function GoalItem({ goal, habitName, habitDescription, onDelete, onSaveText, onGainXp, onLoseXp }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(goal.goal_text || "");

  const buttonBase =
    "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

  return (
    <li className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg transition-colors duration-300 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-900/70">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {editing ? (
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl border border-slate-200/60 bg-white/70 px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/70 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100"
            />
          ) : (
            goal.goal_text
          )}
          <div className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">
            Habit: {habitName}
          </div>
          {habitDescription ? (
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {habitDescription}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onLoseXp}
            className={`${buttonBase} border border-slate-200/70 bg-white/80 text-slate-700 hover:bg-slate-100/70 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200`}
            type="button"
          >
            −5 XP
          </button>
          <span className="min-w-[5rem] text-center text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            {goal.xp ?? 0} XP
          </span>
          <button
            onClick={onGainXp}
            className={`${buttonBase} border border-emerald-300/70 bg-emerald-400/80 text-emerald-950 hover:bg-emerald-300/80 dark:border-emerald-500/40 dark:bg-emerald-500/80 dark:text-slate-950`}
            type="button"
          >
            +5 XP
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {editing ? (
          <>
            <button
              onClick={() => {
                if (text.trim() && text.trim() !== goal.goal_text) onSaveText(text);
                setEditing(false);
              }}
              className={`${buttonBase} border border-emerald-300/70 bg-emerald-400/80 text-emerald-950 hover:bg-emerald-300/80`}
              type="button"
            >
              Save
            </button>
            <button
              onClick={() => {
                setText(goal.goal_text || "");
                setEditing(false);
              }}
              className={`${buttonBase} border border-slate-200/70 bg-white/80 text-slate-700 hover:bg-slate-100/70 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200`}
              type="button"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              className={`${buttonBase} border border-slate-200/60 bg-white/70 text-slate-800 hover:bg-slate-100/70 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200`}
              type="button"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className={`${buttonBase} border border-rose-200/70 bg-rose-400/80 text-rose-50 hover:bg-rose-400 dark:border-rose-500/40 dark:bg-rose-500/70 dark:text-white dark:hover:bg-rose-500`}
              type="button"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}
