import { useCallback, useEffect, useMemo, useState } from "react";
import AuthNavbar from "../components/AuthNavbar";
import { http } from "../api/http";
import { listJournalEntries, saveJournalEntry } from "../api/journal";
import { requestWiseAdvice } from "../api/ai";
import wizardImg from "../assets/wizard_2d.jpg";

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

function computeXpFromValue(value, target) {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) {
    return { xp: 0, ratio: null };
  }
  const ratio = Math.max(0, value / target);
  return { xp: Math.min(10, Math.round(ratio * 10)), ratio };
}

function formatValue(metric, unit, value) {
  if (value === null || value === undefined) return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  const key = String(metric || "").toLowerCase();
  if (key === "sleep_minutes") return `${(numeric / 60).toFixed(1)} hrs`;
  if (key === "exercise_minutes") return `${numeric} min`;
  if (key === "steps") return `${numeric.toLocaleString()} steps`;
  if ((unit || "").toLowerCase() === "oz") return `${numeric} oz`;
  if ((unit || "").toLowerCase() === "dollars") return `$${numeric.toFixed(2)}`;
  const label = unit ? unit : "units";
  return `${numeric} ${label}`;
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
  const [valueInput, setValueInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [wizardAdvice, setWizardAdvice] = useState("");
  const [wizardError, setWizardError] = useState("");
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardContext, setWizardContext] = useState(null);

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) || null,
    [goals, selectedGoalId],
  );
  const selectedEntry = useMemo(
    () => findEntry(entries, selectedDate) || null,
    [entries, selectedDate],
  );
  const selectedGoalIsHealth = Boolean(selectedGoal?.uses_healthkit && selectedGoal?.health_metric);
  const healthValue = selectedEntry?.health_value ?? null;
  const healthMetric = selectedGoal?.health_metric ?? null;
  const hasHealthData =
    selectedGoalIsHealth && healthValue !== undefined && healthValue !== null;
  const targetValueRaw = selectedGoal?.target_value;
  const targetValue = Number.isFinite(Number(targetValueRaw)) ? Number(targetValueRaw) : 0;
  const targetUnit = selectedGoal?.target_unit || selectedGoal?.habit?.unit || "";
  const manualNumericValue = Number(valueInput);
  const hasManualValue = valueInput !== "" && Number.isFinite(manualNumericValue);
  const valueForXp = selectedGoalIsHealth && hasHealthData
    ? Number(healthValue)
    : hasManualValue
      ? manualNumericValue
      : null;
  const { xp: computedXp, ratio: progressRatio } = useMemo(
    () => computeXpFromValue(valueForXp, targetValue),
    [valueForXp, targetValue],
  );
  const progressPercent = progressRatio === null ? null : Math.round(Math.min(1, progressRatio) * 100);

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
    if (selectedEntry) {
      setReflection(selectedEntry.reflection || "");
      if (
        selectedEntry.value_used !== undefined &&
        selectedEntry.value_used !== null &&
        selectedEntry.value_used !== ""
      ) {
        setValueInput(String(selectedEntry.value_used));
      } else if (selectedEntry.numeric_value !== undefined && selectedEntry.numeric_value !== null) {
        setValueInput(String(selectedEntry.numeric_value));
      } else if (selectedEntry.health_value !== undefined && selectedEntry.health_value !== null) {
        setValueInput(String(selectedEntry.health_value));
      } else {
        setValueInput("");
      }
    } else {
      setReflection("");
      setValueInput("");
    }
    setSaveNotice("");
    setSaveError("");
  }, [selectedEntry]);

  const handleGoalChange = (event) => {
    const value = Number(event.target.value);
    setSelectedGoalId(Number.isFinite(value) ? value : null);
  };

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };

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
    const unitLabel = targetUnit || selectedGoal?.habit?.unit || "units";
    const todayValueForPrompt = Number.isFinite(valueForXp) ? valueForXp : null;
    setWizardLoading(true);
    setWizardAdvice("");
    setWizardError("");
    try {
      const latestEntry = recentEntries[0];
      const promptParts = [
        `Habit: ${formatHabitLabel(selectedGoal) || "Unnamed habit"}.`,
        targetValue
          ? `Today's value: ${
              todayValueForPrompt !== null ? `${todayValueForPrompt} ${unitLabel}` : "not logged yet"
            } toward ${targetValue} ${unitLabel}. Estimated XP: ${computedXp}.`
          : "Goal target is missing; ask the user to set one.",
        reflection?.trim()
          ? `User reflection: """${reflection.trim().slice(0, 400)}""".`
          : "User has not written a reflection yet.",
        latestEntry
          ? `Most recent saved entry (${latestEntry.entry_date}) logged ${latestEntry.value_used ?? latestEntry.numeric_value ?? latestEntry.health_value ?? "no value"} ${latestEntry.target_unit || unitLabel} for ${latestEntry.xp_delta} XP. Reflection: """${(latestEntry.reflection || "").slice(0, 200)}""".`
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
  }, [selectedGoal, computedXp, reflection, recentEntries, targetUnit, targetValue, valueForXp, wizardContext]);

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
    if (!targetValue || !Number.isFinite(targetValue) || targetValue <= 0) {
      setSaveError("This goal needs a numeric target before logging progress.");
      return;
    }

    const numericValue =
      selectedGoalIsHealth && hasHealthData
        ? Number(healthValue)
        : valueInput === ""
          ? null
          : Number(valueInput);
    const requiresManualValue = !selectedGoalIsHealth || !hasHealthData;
    if (requiresManualValue && (numericValue === null || !Number.isFinite(numericValue))) {
      setSaveError("Enter a numeric value for this habit to earn XP.");
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
        value: Number.isFinite(numericValue) ? numericValue : null,
        value_unit: targetUnit,
      });

      const entry = payload?.entry;
      if (entry) {
        setEntries((prev) => {
          const others = prev.filter((item) => item.id !== entry.id);
          return [...others, entry].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
        });
        if (entry.value_used !== undefined && entry.value_used !== null) {
          setValueInput(String(entry.value_used));
        }
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

            {selectedGoalIsHealth ? (
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 text-sm shadow-sm dark:border-emerald-700/50 dark:bg-emerald-950/40">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                      HealthKit tracking
                    </p>
                    <p className="text-emerald-800 dark:text-emerald-200">
                      {hasHealthData
                        ? `Synced ${formatValue(healthMetric, targetUnit, healthValue)} vs. goal ${formatValue(healthMetric, targetUnit, targetValue)} (${progressPercent ?? 0}% of goal)`
                        : "No HealthKit data for this date yet. You can still log the number manually below."}
                    </p>
                  </div>
                  {valueForXp !== null ? (
                    <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm dark:bg-emerald-900/50 dark:text-emerald-200">
                      Earned {computedXp} XP
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

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

            <div className="rounded-3xl border border-slate-200/60 bg-white/70 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/60">
              <div className="grid gap-4 md:grid-cols-[1.2fr,0.8fr] md:items-center">
                <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span>Today's value ({targetUnit || "units"})</span>
                  <input
                    type="number"
                    min="0"
                    value={valueInput}
                    onChange={(event) => setValueInput(event.target.value)}
                    disabled={selectedGoalIsHealth && hasHealthData}
                    className={inputBase}
                    placeholder="Enter the number you hit today"
                  />
                  <span className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                    {selectedGoalIsHealth && hasHealthData
                      ? "This value is synced from HealthKit. Update it in Apple Health to refresh here."
                      : "Add today's number to log progress. Hitting the target awards 10 XP; everything below scales linearly."}
                  </span>
                </label>
                <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200/60 bg-emerald-50/60 p-4 text-sm shadow-inner dark:border-emerald-700/40 dark:bg-emerald-900/30">
                  <div className="flex items-center justify-between font-semibold text-emerald-800 dark:text-emerald-100">
                    <span>
                      Goal: {targetValue ? `${targetValue} ${targetUnit || "units"}` : "Add a target"}
                    </span>
                    <span>{computedXp} XP</span>
                  </div>
                  <div className="h-3 rounded-full bg-emerald-100 dark:bg-emerald-950/50">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, progressPercent ?? 0))}%` }}
                    />
                  </div>
                  <p className="text-xs text-emerald-800 dark:text-emerald-200">
                    {progressPercent !== null
                      ? `Tracked ${valueForXp ?? "?"} / ${targetValue || "?"} ${targetUnit || "units"} (${progressPercent}% of goal).`
                      : "Log a value to see progress toward your target."}
                  </p>
                </div>
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
                          {formatValue(
                            entry.health_metric,
                            entry.numeric_unit || entry.target_unit,
                            entry.value_used ?? entry.numeric_value ?? entry.health_value,
                          ) || "No value logged"}{" "}
                          · {entry.xp_delta} XP | Goal total {entry.goal_xp} XP
                        </span>
                      </div>
                      {entry.value_used !== null && entry.value_used !== undefined ? (
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">
                          Logged{" "}
                          {formatValue(
                            entry.health_metric,
                            entry.numeric_unit || entry.target_unit,
                            entry.value_used ?? entry.numeric_value ?? entry.health_value,
                          )}{" "}
                          vs goal {formatValue(entry.health_metric, entry.target_unit, entry.target_value)}
                        </p>
                      ) : null}
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
