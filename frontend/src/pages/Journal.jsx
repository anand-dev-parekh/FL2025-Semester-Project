import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthNavbar from "../components/AuthNavbar";
import { http } from "../api/http";
import { listJournalEntries, saveJournalEntry } from "../api/journal";
import { requestWiseAdvice } from "../api/ai";
import wizardImg from "../assets/wizard_2d.jpg";

const XP_PER_LEVEL = 100;

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
  badge.style.top = "15%";
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
    dot.style.top = "15%";
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

function broadcastJournalEntries(entries) {
  if (typeof window === "undefined") return;
  const detail = Array.isArray(entries) ? entries.map((e) => ({ ...e })) : [];
  window.dispatchEvent(new CustomEvent("journal:entriesChange", { detail }));
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
  const [wizardAdvice, setWizardAdvice] = useState("");
  const [wizardError, setWizardError] = useState("");
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardContext, setWizardContext] = useState(null);
  const prevTotalXpRef = useRef(null);

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) || null,
    [goals, selectedGoalId],
  );

  const refreshGoals = useCallback(async (opts = { dispatch: false }) => {
    setGoalsLoading(true);
    setGoalError("");
    try {
      const data = await http("/api/goals");
      const goalList = Array.isArray(data) ? data : [];
      const newTotalXp = goalList.reduce((acc, goal) => {
        const value = Number(goal?.xp);
        return acc + (Number.isFinite(value) ? value : 0);
      }, 0);
      const prevTotalXp = prevTotalXpRef.current ?? null;
      if (prevTotalXp !== null) {
        const prevLevel = Math.floor(prevTotalXp / XP_PER_LEVEL) + 1;
        const newLevel = Math.floor(newTotalXp / XP_PER_LEVEL) + 1;
        if (newLevel > prevLevel) {
          celebrate({ message: `Level up! Level ${newLevel} 🏆` });
        }
      }
      prevTotalXpRef.current = newTotalXp;
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
        const incoming = Array.isArray(response) ? response : [];
        setEntries(incoming);
        broadcastJournalEntries(incoming);
      } catch (err) {
        console.error(err);
        setEntriesError("Unable to load journal entries for this habit.");
        setEntries([]);
        broadcastJournalEntries([]);
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

  const recentEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      if (a.entry_date === b.entry_date) {
        return (b.created_at || "").localeCompare(a.created_at || "");
      }
      return (b.entry_date || "").localeCompare(a.entry_date || "");
    });
    return sorted.slice(0, 10);
  }, [entries]);

  const askJournalWizard = useCallback(async () => {
    if (!selectedGoal) {
      setWizardError("Choose a habit so the Wise Wizard knows what to reflect on.");
      return;
    }
    setWizardLoading(true);
    setWizardAdvice("");
    setWizardError("");
    try {
      const latestEntry = recentEntries[0];
      const promptParts = [
        `Habit: ${formatHabitLabel(selectedGoal) || "Unnamed habit"}.`,
        `Today's completion level: ${formatCompletion(completionLevel)}.`,
        reflection?.trim()
          ? `User reflection: """${reflection.trim().slice(0, 400)}""".`
          : "User has not written a reflection yet.",
        latestEntry
          ? `Most recent saved entry (${latestEntry.entry_date}) xp ${latestEntry.xp_delta} and reflection: """${(latestEntry.reflection || "").slice(0, 200)}""".`
          : null,
        "Offer 2-3 sentences of encouraging feedback or journaling prompts tailored to this habit.",
      ]
        .filter(Boolean)
        .join(" ");
      const systemPrompt =
        "You are the Wise Wizard journaling companion. Be gentle, specific, and invite deeper reflection. Avoid medical claims.";
      const response = await requestWiseAdvice({
        prompt: promptParts,
        systemPrompt,
        context: wizardContext || undefined,
      });
      setWizardAdvice(response?.response?.trim() || "The wizard had no guidance this time.");
      if (response?.context) {
        setWizardContext(response.context);
      }
    } catch (err) {
      console.error("Journal wizard request failed", err);
      setWizardError("The Wise Wizard is busy writing scrolls. Try again soon.");
    } finally {
      setWizardLoading(false);
    }
  }, [selectedGoal, completionLevel, reflection, recentEntries, wizardContext]);

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
          const updated = [...others, entry].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
          broadcastJournalEntries(updated);
          return updated;
        });
      } else {
        broadcastJournalEntries(entries);
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

            <div className="rounded-3xl border border-indigo-200/70 bg-indigo-50/70 p-5 shadow-sm dark:border-indigo-500/40 dark:bg-indigo-900/30">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl border border-indigo-500/40 bg-indigo-600/60 shadow-md">
                    <img
                      src={wizardImg}
                      alt="Wise Wizard illustration"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                      Stuck on what to write?
                    </p>
                    <p className="text-sm text-indigo-700 dark:text-indigo-200/80">
                      Ask the Wise Wizard for a journaling prompt or a gentle nudge.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={askJournalWizard}
                  disabled={wizardLoading || !selectedGoal}
                  className="rounded-full border border-indigo-300 bg-white/80 px-4 py-2 text-sm font-medium text-indigo-800 shadow-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-100 dark:hover:bg-indigo-900/40"
                >
                  {wizardLoading ? "Summoning..." : "Ask the Wise Wizard"}
                </button>
              </div>
              {wizardError ? (
                <p className="mt-4 rounded-2xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/60 dark:bg-rose-900/40 dark:text-rose-100">
                  {wizardError}
                </p>
              ) : null}
              {wizardAdvice ? (
                <p className="mt-4 rounded-2xl bg-white/90 p-4 text-sm leading-relaxed text-slate-800 shadow-inner dark:bg-slate-900/60 dark:text-slate-100">
                  {wizardAdvice}
                </p>
              ) : null}
            </div>

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
            ) : !recentEntries.length ? (
              <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
                No journal entries yet. Start by saving a reflection above.
              </p>
            ) : (
              <ul className="mt-6 space-y-4">
                {recentEntries.map((entry) => (
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
