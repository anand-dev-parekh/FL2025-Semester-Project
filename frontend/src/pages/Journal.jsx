import { useCallback, useEffect, useMemo, useState } from "react";
import AuthNavbar from "../components/AuthNavbar";
import { http } from "../api/http";
import { listJournalEntries, saveJournalEntry } from "../api/journal";

const COMPLETION_OPTIONS = [
  {
    value: "missed",
    label: "Skipped",
    xp: 0,
    helper: "Did not focus on this habit today.",
  },
  {
    value: "partial",
    label: "Partially Complete",
    xp: 5,
    helper: "You nearly followed the habit but missed a piece.",
  },
  {
    value: "complete",
    label: "Completed",
    xp: 10,
    helper: "Followed the habit as planned.",
  },
];

const pageContainer =
  "rounded-3xl border border-white/60 bg-white/75 p-8 shadow-xl backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/60";

const inputBase =
  "mt-2 w-full rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/70 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-400";

const textareaBase = `${inputBase} resize-none min-h-[160px]`;

const buttonPrimary =
  "inline-flex items-center justify-center rounded-full border border-emerald-300/70 bg-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/60 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoIso() {
  const now = new Date();
  const past = new Date(now);
  past.setDate(now.getDate() - 30);
  return past.toISOString().slice(0, 10);
}

function findEntry(entries, entryDate) {
  return entries.find((entry) => entry.entry_date === entryDate);
}

function formatHabitLabel(goal) {
  if (!goal) return "";
  const parts = [goal.habit?.name || goal.goal_text];
  if (goal.goal_text && goal.goal_text !== goal.habit?.name) {
    parts.push(`- ${goal.goal_text}`);
  }
  return parts.join(" ");
}

function inferCompletionLevel(xpDelta) {
  const numeric = Number(xpDelta || 0);
  if (numeric >= 10) return "complete";
  if (numeric <= 0) return "missed";
  return "partial";
}

function formatCompletion(value) {
  const option = COMPLETION_OPTIONS.find((item) => item.value === value);
  return option ? option.label : "Unknown";
}

export default function Journal() {
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalError, setGoalError] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState(null);

  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState("");

  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const [reflection, setReflection] = useState("");
  const [completionLevel, setCompletionLevel] = useState(COMPLETION_OPTIONS[1].value);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [saveError, setSaveError] = useState("");

  const refreshGoals = useCallback(async (opts = { dispatch: false }) => {
    setGoalsLoading(true);
    setGoalError("");
    try {
      const data = await http("/api/goals");
      const goalList = Array.isArray(data) ? data : [];
      setGoals(goalList);
      if (goalList.length) {
        setSelectedGoalId((current) => (current ?? goalList[0].id));
      }
      if (opts.dispatch !== false && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("habits:goalsChange", {
            detail: goalList.map((goal) => ({ ...goal })),
          }),
        );
      }
    } catch (err) {
      console.error(err);
      setGoalError("We couldn't load your tracked habits right now.");
    } finally {
      setGoalsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshGoals({ dispatch: false });
  }, [refreshGoals]);

  const loadEntries = useCallback(
    async (goalId) => {
      if (!goalId) {
        setEntries([]);
        return;
      }
      setEntriesLoading(true);
      setEntriesError("");
      try {
        const response = await listJournalEntries({
          goalId,
          from: thirtyDaysAgoIso(),
          to: todayIso(),
        });
        setEntries(Array.isArray(response) ? response : []);
      } catch (err) {
        console.error(err);
        setEntriesError("Unable to load journal entries for this habit.");
        setEntries([]);
      } finally {
        setEntriesLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedGoalId) return;
    setSelectedDate(todayIso());
    loadEntries(selectedGoalId);
  }, [loadEntries, selectedGoalId]);

  useEffect(() => {
    const entry = findEntry(entries, selectedDate);
    if (entry) {
      setReflection(entry.reflection || "");
      const level = entry.completion_level || inferCompletionLevel(entry.xp_delta);
      setCompletionLevel(level);
    } else {
      setReflection("");
      setCompletionLevel(COMPLETION_OPTIONS[1].value);
    }
    setSaveNotice("");
    setSaveError("");
  }, [entries, selectedDate]);

  const handleGoalChange = (event) => {
    const value = Number(event.target.value);
    setSelectedGoalId(Number.isFinite(value) ? value : null);
  };

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };

  const selectedCompletionIndex = useMemo(() => {
    const idx = COMPLETION_OPTIONS.findIndex((option) => option.value === completionLevel);
    return idx >= 0 ? idx : 1;
  }, [completionLevel]);

  const selectedCompletion =
    COMPLETION_OPTIONS[selectedCompletionIndex] || COMPLETION_OPTIONS[1];

  const sliderFillStyle = useMemo(() => {
    const maxIndex = COMPLETION_OPTIONS.length - 1 || 1;
    const percent = Math.max(0, Math.min(100, (selectedCompletionIndex / maxIndex) * 100));
    const activeColor = "rgba(16, 185, 129, 0.85)";
    const inactiveColor = "rgba(148, 163, 184, 0.35)";
    return {
      background: `linear-gradient(90deg, ${activeColor} 0%, ${activeColor} ${percent}%, ${inactiveColor} ${percent}%, ${inactiveColor} 100%)`,
    };
  }, [selectedCompletionIndex]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!selectedGoalId) {
      setSaveError("Choose a habit to journal about.");
      return;
    }
    if (!selectedDate) {
      setSaveError("Pick a date for this entry.");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveNotice("");
    try {
      const payload = await saveJournalEntry({
        goal_id: selectedGoalId,
        entry_date: selectedDate,
        reflection,
        completion_level: completionLevel,
      });

      const entry = payload?.entry;
      if (entry) {
        setEntries((prev) => {
          const others = prev.filter((item) => item.id !== entry.id);
          return [...others, entry].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
        });
      }

      await refreshGoals({ dispatch: true });

      setSaveNotice("Journal entry saved.");
    } catch (err) {
      console.error(err);
      const message = err?.body?.trim?.() || err.message || "Unable to save journal entry.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const formattedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      if (a.entry_date === b.entry_date) return (b.created_at || "").localeCompare(a.created_at || "");
      return (b.entry_date || "").localeCompare(a.entry_date || "");
    });
    return sorted.slice(0, 10);
  }, [entries]);

  return (
    <>
      <AuthNavbar />
      <main className="flex-1">
        <header className="mb-10 space-y-3">
          <h1 className="text-4xl font-semibold text-emerald-800 dark:text-emerald-200">
            Daily Journal
          </h1>
          <p className="max-w-2xl text-sm text-slate-700 dark:text-slate-300">
            Capture reflections for each habit you track. Entries add XP to your goals and keep your
            dashboard progress bar up to date.
          </p>
        </header>

        <section className={pageContainer}>
          <form onSubmit={handleSave} className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>Habit</span>
                <select
                  value={selectedGoalId ?? ""}
                  onChange={handleGoalChange}
                  className={`${inputBase} appearance-none`}
                  disabled={goalsLoading || !goals.length}
                >
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {formatHabitLabel(goal)}
                    </option>
                  ))}
                </select>
                {goalError ? (
                  <em className="mt-2 text-xs text-rose-500 dark:text-rose-300">{goalError}</em>
                ) : null}
              </label>

              <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>Date</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  max={todayIso()}
                  className={inputBase}
                />
              </label>
            </div>

            <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Reflection</span>
              <textarea
                value={reflection}
                onChange={(event) => setReflection(event.target.value)}
                placeholder="How did practicing this habit feel today?"
                className={textareaBase}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>How did today go?</span>
                <input
                  type="range"
                  min="0"
                  max={COMPLETION_OPTIONS.length - 1}
                  step="1"
                  value={selectedCompletionIndex}
                  onChange={(event) => {
                    const index = Number(event.target.value);
                    const next = COMPLETION_OPTIONS[index];
                    setCompletionLevel(next ? next.value : COMPLETION_OPTIONS[1].value);
                  }}
                  className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                  style={sliderFillStyle}
                />
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {COMPLETION_OPTIONS.map((option, index) => (
                    <span
                      key={option.value}
                      className={
                        index === selectedCompletionIndex
                          ? "rounded-full border border-emerald-300/70 bg-emerald-100 px-3 py-1 text-center text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/20 dark:text-emerald-200"
                          : "rounded-full border border-transparent bg-slate-100 px-3 py-1 text-center dark:bg-slate-800/60"
                      }
                    >
                      {option.label}
                    </span>
                  ))}
                </div>
              </label>
              <div className="flex min-w-[12rem] flex-col gap-1 rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 text-sm shadow-sm dark:border-slate-800/60 dark:bg-slate-900/60">
                <span className="font-medium text-emerald-700 dark:text-emerald-300">
                  {selectedCompletion.label} • Earns {selectedCompletion.xp} XP
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  {selectedCompletion.helper}
                </span>
              </div>
            </div>

            {saveError ? (
              <p className="text-sm text-rose-600 dark:text-rose-300">{saveError}</p>
            ) : null}
            {saveNotice ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{saveNotice}</p>
            ) : null}

            <div className="flex justify-end">
              <button type="submit" className={buttonPrimary} disabled={saving || goalsLoading}>
                {saving ? "Saving…" : "Save entry"}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-10">
          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-lg backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Recent entries</h2>
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                Last 30 days
              </span>
            </div>

            {entriesLoading ? (
              <div className="mt-6 space-y-3">
                <div className="h-16 w-full animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
                <div className="h-16 w-full animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
              </div>
            ) : entriesError ? (
              <p className="mt-6 text-sm text-rose-600 dark:text-rose-400">{entriesError}</p>
            ) : !formattedEntries.length ? (
              <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
                No journal entries yet. Start by saving a reflection above.
              </p>
            ) : (
              <ul className="mt-6 space-y-4">
                {formattedEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm transition hover:border-emerald-300/70 hover:shadow-md dark:border-slate-800/60 dark:bg-slate-900/60"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDate(entry.entry_date)}
                      className="flex w-full flex-col gap-1 text-left"
                    >
                      <span className="text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">
                        {entry.entry_date}
                      </span>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {entry.goal_text}
                        </span>
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          {formatCompletion(entry.completion_level)} · {entry.xp_delta} XP | Goal total {entry.goal_xp} XP
                        </span>
                      </div>
                      {entry.reflection ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                          {entry.reflection}
                        </p>
                      ) : (
                        <p className="text-xs italic text-slate-500 dark:text-slate-400">
                          No reflection written.
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
