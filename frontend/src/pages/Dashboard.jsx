import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import AuthNavbar from "../components/AuthNavbar";
import { http } from "../api/http";

const XP_PER_LEVEL = 100;

export default function Dashboard() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loadingXp, setLoadingXp] = useState(true);
  const [xpError, setXpError] = useState("");

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

  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = totalXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel || XP_PER_LEVEL;
  const progressPercent = Math.min(100, (xpIntoLevel / XP_PER_LEVEL) * 100);

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
