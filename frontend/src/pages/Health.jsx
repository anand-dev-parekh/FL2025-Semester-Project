import { useCallback, useEffect, useMemo, useState } from "react";
import AuthNavbar from "../components/AuthNavbar";
import { fetchDailyHealth } from "../api/health";
import { requestWiseAdvice } from "../api/ai";
import wizardImg from "../assets/wizard_2d.jpg";

const RANGE_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];

function normalizeRecord(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  return {
    date: record.date,
    steps: Number.isFinite(record.steps) ? record.steps : Number(record.steps) || 0,
    exerciseMinutes:
      Number.isFinite(record.exercise_minutes) || Number.isFinite(record.exerciseMinutes)
        ? Number(record.exercise_minutes ?? record.exerciseMinutes)
        : 0,
    sleepMinutes:
      Number.isFinite(record.sleep_minutes) || Number.isFinite(record.sleepMinutes)
        ? Number(record.sleep_minutes ?? record.sleepMinutes)
        : 0,
    source: typeof record.source === "string" ? record.source : "apple_health",
    updatedAt: record.updated_at ?? record.updatedAt ?? null,
  };
}

function WiseWizardAvatar() {
  return (
    <div className="h-16 w-16 overflow-hidden rounded-2xl border border-indigo-500/50 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 shadow-md">
      <img
        src={wizardImg}
        alt="Wise Wizard illustration"
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

export default function Health() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(RANGE_OPTIONS[0].value);
  const [wizardAdvice, setWizardAdvice] = useState("");
  const [wizardError, setWizardError] = useState("");
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardContext, setWizardContext] = useState(null);

  const summary = useMemo(() => {
    if (records.length === 0) {
      return null;
    }
    const totals = records.reduce(
      (acc, record) => ({
        steps: acc.steps + (record.steps || 0),
        exerciseMinutes: acc.exerciseMinutes + (record.exerciseMinutes || 0),
        sleepMinutes: acc.sleepMinutes + (record.sleepMinutes || 0),
      }),
      { steps: 0, exerciseMinutes: 0, sleepMinutes: 0 },
    );

    return {
      averageSteps: Math.round(totals.steps / records.length),
      averageExercise: Math.round(totals.exerciseMinutes / records.length),
      averageSleepMinutes: Math.round(totals.sleepMinutes / records.length),
    };
  }, [records]);

  const loadRecords = useCallback(
    async (requestedDays = days) => {
      setLoading(true);
      setError("");
      try {
        const response = await fetchDailyHealth({ days: requestedDays });
        const incoming =
          Array.isArray(response?.records) && response.records.length > 0
            ? response.records
            : Array.isArray(response)
              ? response
              : [];
        const normalized = incoming
          .map((record) => normalizeRecord(record))
          .filter(Boolean)
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecords(normalized);
      } catch (err) {
        console.error("Unable to load health data", err);
        setError("We couldn't load your latest health data. Try refreshing in a moment.");
      } finally {
        setLoading(false);
      }
    },
    [days],
  );

  useEffect(() => {
    loadRecords(days);
  }, [days, loadRecords]);

  const summonWiseWizard = useCallback(async () => {
    if (!summary) {
      setWizardError("We need at least a few days of data before the wizard can advise you.");
      return;
    }
    setWizardLoading(true);
    setWizardAdvice("");
    setWizardError("");
    try {
      const latest = records[0];
      const prompt = [
        "You are the Wise Wellness Wizard guiding a friendly check-in.",
        `Average steps per day: ${summary.averageSteps}.`,
        `Average exercise minutes per day: ${summary.averageExercise}.`,
        `Average sleep hours per night: ${(summary.averageSleepMinutes / 60).toFixed(1)}.`,
        latest
          ? `Most recent day (${latest.date}) stats — steps: ${latest.steps}, exercise minutes: ${latest.exerciseMinutes}, sleep hours: ${(latest.sleepMinutes / 60).toFixed(1)}.`
          : null,
        "Share 2-3 sentences of encouraging, actionable advice.",
      ]
        .filter(Boolean)
        .join(" ");
      const systemPrompt =
        "You are a supportive wellness guide called the Wise Wizard. Keep tone playful but respectful. Offer concrete suggestions based on the provided stats.";
      const response = await requestWiseAdvice({
        prompt,
        systemPrompt,
        context: wizardContext || undefined,
      });
      setWizardAdvice(response?.response?.trim() || "The wizard had no words this time.");
      if (response?.context) {
        setWizardContext(response.context);
      }
    } catch (err) {
      console.error("Wise wizard request failed", err);
      setWizardError("The Wise Wizard is napping. Try again in a moment.");
    } finally {
      setWizardLoading(false);
    }
  }, [records, summary, wizardContext]);

  return (
    <>
      <AuthNavbar />
      <main className="flex-1">
        <header className="mb-10 space-y-2">
          <h2 className="text-4xl font-semibold text-emerald-800 dark:text-emerald-300">
            Health Trends
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Sync your Apple Health data from the mobile app to see a snapshot of your recent steps,
            exercise, and sleep.
          </p>
        </header>

        <section className="rounded-3xl border border-white/50 bg-white/75 p-6 shadow-lg backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {RANGE_OPTIONS.map((option) => {
                const isActive = option.value === days;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDays(option.value)}
                    className={[
                      "rounded-full border px-4 py-1 text-sm font-medium transition",
                      isActive
                        ? "border-emerald-500 bg-emerald-500 text-white shadow-md"
                        : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-200 dark:hover:bg-emerald-900/60",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => loadRecords(days)}
              className="rounded-full border border-emerald-300 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-rose-300/70 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-600/70 dark:bg-rose-900/40 dark:text-rose-200">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="mt-8 animate-pulse space-y-4">
              <div className="h-8 w-1/3 rounded-full bg-emerald-200/70 dark:bg-emerald-900/60" />
              <div className="h-32 rounded-3xl bg-emerald-100/60 dark:bg-emerald-950/40" />
              <div className="h-24 rounded-3xl bg-white/60 dark:bg-slate-900/40" />
            </div>
          ) : records.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-emerald-300/70 bg-emerald-50/50 p-8 text-center text-sm text-emerald-700 dark:border-emerald-600/60 dark:bg-emerald-900/40 dark:text-emerald-200">
              No synced data just yet. Open the Magic Journal iOS app, visit the Health tab, and tap
              “Sync Latest Data”.
            </div>
          ) : (
            <>
              {summary ? (
                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 text-emerald-800 shadow-sm dark:border-emerald-700/50 dark:bg-emerald-950/50 dark:text-emerald-200">
                    <p className="text-xs uppercase tracking-wide text-emerald-600/80 dark:text-emerald-300/70">
                      Avg steps / day
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{summary.averageSteps.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 text-emerald-800 shadow-sm dark:border-emerald-700/50 dark:bg-emerald-950/50 dark:text-emerald-200">
                    <p className="text-xs uppercase tracking-wide text-emerald-600/80 dark:text-emerald-300/70">
                      Avg exercise (min)
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{summary.averageExercise.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 text-emerald-800 shadow-sm dark:border-emerald-700/50 dark:bg-emerald-950/50 dark:text-emerald-200">
                    <p className="text-xs uppercase tracking-wide text-emerald-600/80 dark:text-emerald-300/70">
                      Avg sleep (hrs)
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {(summary.averageSleepMinutes / 60).toFixed(1)}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="mt-8 rounded-3xl border border-indigo-200/70 bg-indigo-50/70 p-5 shadow-sm dark:border-indigo-500/40 dark:bg-indigo-900/40">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <WiseWizardAvatar />
                    <div>
                      <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                        Summon the Wise Wizard
                      </p>
                      <p className="text-sm text-indigo-700 dark:text-indigo-200/80">
                        Get a quick pulse check based on your latest health streaks.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={summonWiseWizard}
                    disabled={wizardLoading || !summary}
                    className="rounded-full border border-indigo-300 bg-white/80 px-4 py-2 text-sm font-medium text-indigo-800 shadow-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-100 dark:hover:bg-indigo-900/50"
                  >
                    {wizardLoading ? "Conjuring..." : "Ask for advice"}
                  </button>
                </div>
                {wizardError ? (
                  <p className="mt-4 rounded-2xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/60 dark:bg-rose-900/40 dark:text-rose-100">
                    {wizardError}
                  </p>
                ) : null}
                {wizardAdvice ? (
                  <p className="mt-4 rounded-2xl bg-white/80 p-4 text-sm leading-relaxed text-slate-800 shadow-inner dark:bg-slate-900/50 dark:text-slate-100">
                    {wizardAdvice}
                  </p>
                ) : null}
              </div>

              <div className="mt-10 overflow-hidden rounded-3xl border border-white/50 bg-white/90 shadow-lg dark:border-slate-800/70 dark:bg-slate-900/70">
                <table className="min-w-full divide-y divide-emerald-100 text-sm dark:divide-slate-800">
                  <thead className="bg-emerald-100/70 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left font-medium">
                        Date
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Steps
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Exercise (min)
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Sleep (hrs)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50/70 dark:divide-slate-800">
                    {records.map((record) => (
                      <tr key={record.date}>
                        <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-200">
                          {new Date(record.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-800 dark:text-emerald-200">
                          {record.steps.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                          {record.exerciseMinutes.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                          {(record.sleepMinutes / 60).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
