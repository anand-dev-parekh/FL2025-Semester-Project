import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { http } from "../api/http";

const cardClasses =
  "rounded-3xl border border-white/50 bg-white/80 p-10 shadow-xl backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70";
const inputClasses =
  "mt-2 w-full rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/70 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-400";
const buttonBase =
  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";
const goalCardClasses =
  "flex flex-col gap-2 rounded-2xl border border-emerald-200/50 bg-emerald-50/50 p-5 text-sm text-emerald-900 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200";

const STEP_META = [
  {
    title: "Settle in, this is going to be fun",
    subtitle: "We’ll guide you through customizing Magic Journal for your flow.",
  },
  {
    title: "Make it yours",
    subtitle: "Add a friendly name and a short bio so we can greet you properly.",
  },
  {
    title: "Shape your first goals",
    subtitle: "Tie your intentions to habits you want to nurture.",
  },
  {
    title: "Discover the magic",
    subtitle: "A quick tour of the features waiting for you.",
  },
];

const HIGHLIGHTS = [
  {
    title: "Daily reflections",
    blurb: "Capture your thoughts, wins, and lessons with a journal built for growth.",
  },
  {
    title: "Habit-powered goals",
    blurb: "Anchor goals to habits, earn XP as you follow through, and watch momentum build.",
  },
  {
    title: "Progress you can feel",
    blurb: "Levels, badges, and gentle nudges keep progress tangible so you stay motivated.",
  },
];

const HEALTH_GOAL_CONFIG = [
  {
    key: "steps",
    habitName: "Steps",
    metric: "steps",
    unit: "steps",
    defaultTarget: 8000,
    placeholder: "e.g., 8000 steps per day",
    buildGoal: (target) => `Walk ${Number(target || 0).toLocaleString()} steps per day.`,
  },
  {
    key: "exercise_minutes",
    habitName: "Exercise",
    metric: "exercise_minutes",
    unit: "minutes",
    defaultTarget: 30,
    placeholder: "e.g., 30 active minutes daily",
    buildGoal: (target) => `Get ${Number(target || 0)} minutes of exercise daily.`,
  },
  {
    key: "sleep_minutes",
    habitName: "Sleep Well",
    metric: "sleep_minutes",
    unit: "minutes",
    defaultTarget: 480,
    placeholder: "e.g., 8 hours per night",
    buildGoal: (target) => `Sleep ${(Number(target || 0) / 60).toFixed(1)} hours each night.`,
  },
];

const HEALTH_DEFAULT_TARGETS = HEALTH_GOAL_CONFIG.reduce((acc, item) => {
  acc[item.key] = item.defaultTarget;
  return acc;
}, {});

const EXCLUDED_HEALTH_HABITS = ["steps", "exercise", "sleep well"];

export default function Onboarding() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(user?.name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [habits, setHabits] = useState([]);
  const [habitsLoading, setHabitsLoading] = useState(true);
  const [habitsError, setHabitsError] = useState("");
  const [selectedHabitId, setSelectedHabitId] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [deletingGoalId, setDeletingGoalId] = useState(null);
  const [connectHealth, setConnectHealth] = useState(false);
  const [healthTargets, setHealthTargets] = useState(HEALTH_DEFAULT_TARGETS);
  const [healthSaving, setHealthSaving] = useState(false);
  const [healthError, setHealthError] = useState("");

  const visibleHabits = useMemo(
    () =>
      habits.filter(
        (h) => !EXCLUDED_HEALTH_HABITS.includes((h.name || "").trim().toLowerCase())
      ),
    [habits]
  );

  const totalSteps = STEP_META.length;
  const redirectTarget = useMemo(() => {
    const from = location.state?.from?.pathname;
    if (from && from !== "/onboarding") return from;
    return "/app";
  }, [location.state]);

  useEffect(() => {
    if (user?.onboarding_complete) {
      navigate("/app", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    setFullName(user?.name ?? "");
    setBio(user?.bio ?? "");
  }, [user]);

  useEffect(() => {
    setError("");
    if (step !== 2) setGoalError("");
  }, [step]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setHabitsLoading(true);
      setHabitsError("");
      try {
        const data = await http("/api/habits?include_healthkit=1");
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setHabits(list);
        const firstVisible = list.find(
          (h) => !EXCLUDED_HEALTH_HABITS.includes((h.name || "").trim().toLowerCase())
        );
        setSelectedHabitId((prev) => prev || (firstVisible ? String(firstVisible.id) : ""));
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setHabitsError("We couldn’t load habit ideas right now. You can add goals later from the Habits page.");
        }
      } finally {
        if (!cancelled) setHabitsLoading(false);
      }
    })();

    (async () => {
      setGoalsLoading(true);
      try {
        const data = await http("/api/goals");
        if (!cancelled) setGoals(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setGoalsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!goals.length) return;
    setHealthTargets((prev) => {
      const next = { ...prev };
      HEALTH_GOAL_CONFIG.forEach((config) => {
        const match = goals.find(
          (g) =>
            g.health_metric === config.metric ||
            (g.habit?.name || "").toLowerCase() === config.habitName.toLowerCase()
        );
        if (match?.target_value) {
          next[config.key] = match.target_value;
        }
      });
      return next;
    });
    if (goals.some((g) => g.uses_healthkit)) {
      setConnectHealth(true);
    }
  }, [goals]);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const trimmedName = (fullName || "").trim();
    if (!trimmedName) {
      setError("Please add your name so we know what to call you.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await http("/api/user/me", {
        method: "PATCH",
        body: {
          name: trimmedName,
          bio: bio?.trim() ? bio.trim() : null,
        },
      });
      await refreshUser();
      setStep(2);
    } catch (err) {
      console.error(err);
      setError("We couldn't save those details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddHealthGoals = async () => {
    if (healthSaving) return;
    setHealthSaving(true);
    setHealthError("");
    setGoalError("");

    try {
      if (!habits.length) {
        throw new Error("We need the shared habits to load before adding HealthKit goals.");
      }

      const updated = [];
      for (const config of HEALTH_GOAL_CONFIG) {
        const targetRaw = Number(healthTargets[config.key]);
        if (!Number.isFinite(targetRaw) || targetRaw <= 0) {
          throw new Error(`Please enter a valid target for ${config.habitName}.`);
        }
        const target =
          config.key === "sleep_minutes" && targetRaw > 0 && targetRaw < 100
            ? Math.round(targetRaw * 60) // allow people to type hours
            : targetRaw;
        const habit = habits.find(
          (h) => (h.name || "").toLowerCase() === config.habitName.toLowerCase()
        );
        if (!habit) {
          throw new Error(`Could not find the ${config.habitName} habit.`);
        }

        const goalText = config.buildGoal(target);
        const existing = goals.find((g) => g.habit_id === habit.id);
        const body = {
          habit_id: habit.id,
          goal_text: goalText,
          uses_healthkit: true,
          health_metric: config.metric,
          target_value: target,
          target_unit: config.unit,
        };

        const response = existing
          ? await http(`/api/goals/${existing.id}`, { method: "PATCH", body })
          : await http("/api/goals", { method: "POST", body });
        const normalized = response?.goal ?? response;
        updated.push({ habitId: habit.id, goal: normalized });
      }

      if (updated.length) {
        setGoals((prev) => {
          const filtered = prev.filter(
            (goal) => !updated.some((item) => item.habitId === goal.habit_id)
          );
          return [...updated.map((item) => item.goal), ...filtered];
        });
        setConnectHealth(true);
      }
    } catch (err) {
      console.error(err);
      setHealthError(err?.message || "Unable to add HealthKit-backed goals right now.");
    } finally {
      setHealthSaving(false);
    }
  };

  const handleAddGoal = async () => {
    if (goalSaving) return;
    if (goals.length >= 3) {
      setGoalError("Let’s start with up to three goals. You can add more later from the Habits page.");
      return;
    }
    if (!visibleHabits.length) {
      setGoalError("Habits aren’t available yet, so you can skip this step.");
      return;
    }
    if (!selectedHabitId) {
      setGoalError("Pick a habit to anchor your goal.");
      return;
    }
    const trimmed = (goalDraft || "").trim();
    if (!trimmed) {
      setGoalError("Describe what success looks like for this habit.");
      return;
    }
    const numericTarget = Number(goalTarget);
    if (!Number.isFinite(numericTarget) || numericTarget <= 0) {
      setGoalError("Add a numeric target greater than zero for this habit.");
      return;
    }

    setGoalSaving(true);
    setGoalError("");
    try {
      const created = await http("/api/goals", {
        method: "POST",
        body: {
          habit_id: Number(selectedHabitId),
          goal_text: trimmed,
          target_value: Math.round(numericTarget),
          target_unit: selectedHabit?.unit || null,
        },
      });
      const newGoal = created?.habit ? created : created?.goal ?? created;
      setGoals((prev) => [newGoal, ...prev]);
      setGoalDraft("");
      setGoalTarget(selectedHabit?.default_target ?? goalTarget);
    } catch (err) {
      console.error(err);
      setGoalError("We couldn’t save that goal. Please try again.");
    } finally {
      setGoalSaving(false);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (deletingGoalId) return;
    setDeletingGoalId(goalId);
    setGoalError("");
    try {
      await http(`/api/goals/${goalId}`, { method: "DELETE" });
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch (err) {
      console.error(err);
      setGoalError("We couldn’t remove that goal. Please try again.");
    } finally {
      setDeletingGoalId(null);
    }
  };

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await http("/api/user/me", {
        method: "PATCH",
        body: { onboarding_complete: true },
      });
      const latest = await refreshUser();
      navigate(latest?.onboarding_complete ? redirectTarget : "/app", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Something went wrong finishing setup. Give it another go?");
    } finally {
      setSaving(false);
    }
  };

  const proceedFromGoals = () => {
    const hasHabits = visibleHabits.length > 0;
    const canContinue = ((!hasHabits && !habitsLoading) || goals.length > 0) && !goalsLoading;
    if (canContinue) {
      setGoalError("");
      setStep(3);
      return;
    }
    setGoalError("Let’s anchor at least one goal before we continue.");
  };

  const header = STEP_META[step];
  const selectedHabit = useMemo(
    () => habits.find((h) => String(h.id) === String(selectedHabitId)),
    [habits, selectedHabitId]
  );
  useEffect(() => {
    if (selectedHabit) {
      setGoalTarget(selectedHabit.default_target ?? "");
    } else {
      setGoalTarget("");
    }
  }, [selectedHabit]);
  const orderedGoals = useMemo(() => {
    const list = goals.slice();
    list.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
    return list;
  }, [goals]);
  const formatHealthTarget = (goal) => {
    if (!goal?.uses_healthkit || !goal?.target_value) return "";
    const metric = goal.health_metric;
    if (metric === "sleep_minutes") return `${(goal.target_value / 60).toFixed(1)} hrs/night`;
    if (metric === "exercise_minutes") return `${goal.target_value} min/day`;
    if (metric === "steps") return `${goal.target_value.toLocaleString()} steps/day`;
    return `${goal.target_value}`;
  };
  const canContinueFromGoals =
    ((!habits.length && !habitsLoading) || goals.length > 0) &&
    !goalSaving &&
    !deletingGoalId &&
    !goalsLoading &&
    !healthSaving;

  return (
    <div className="flex flex-1 flex-col gap-10 pb-16">
      <header className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-700/70 dark:text-emerald-400/70">
              Step {step + 1} of {totalSteps}
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-emerald-900 dark:text-emerald-200">
              {header.title}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{header.subtitle}</p>
          </div>

          <div className="hidden gap-2 sm:flex">
            {STEP_META.map((_, idx) => (
              <span
                key={idx}
                className={`h-2 w-8 rounded-full transition ${
                  idx <= step
                    ? "bg-emerald-500/80 dark:bg-emerald-400"
                    : "bg-slate-200/70 dark:bg-slate-700/70"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {step === 0 && (
        <section className={`${cardClasses} mx-auto w-full max-w-3xl`}>
          <div className="space-y-6 text-left">
            <div>
              <h2 className="text-3xl font-semibold text-emerald-900 dark:text-emerald-200">
                Welcome, {user?.name?.split(" ")[0] || "friend"}!
              </h2>
              <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
                Magic Journal helps you grow a little every day. Let’s set a strong foundation so
                your dashboard feels like home from the start.
              </p>
            </div>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li>• Personalize how we greet you across the app.</li>
              <li>• Craft the first goals that matter most right now.</li>
              <li>• Learn how quests and XP keep you motivated.</li>
            </ul>
            <div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`${buttonBase} border border-emerald-300/70 bg-emerald-400/80 text-emerald-950 hover:bg-emerald-300/80 dark:border-emerald-500/40 dark:bg-emerald-500/80 dark:text-slate-950 dark:hover:bg-emerald-400/80`}
              >
                Start onboarding
              </button>
            </div>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className={`${cardClasses} mx-auto w-full max-w-3xl`}>
          <form className="space-y-6" onSubmit={handleProfileSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Preferred name
                <input
                  className={inputClasses}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="How should we address you?"
                />
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Bio (optional)
                <textarea
                  className={`${inputClasses} resize-none`}
                  rows={4}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Share a sentence about your goals or vibe."
                />
              </label>
            </div>

            {error && (
              <p className="text-sm text-rose-500 dark:text-rose-300" role="alert">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => setStep(0)}
                className={`${buttonBase} border border-slate-200/70 bg-white/80 text-slate-700 hover:bg-slate-100/70 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-900`}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`${buttonBase} border border-emerald-300/70 bg-emerald-400/80 text-emerald-950 hover:bg-emerald-300/80 disabled:opacity-60 dark:border-emerald-500/40 dark:bg-emerald-500/80 dark:text-slate-950 dark:hover:bg-emerald-400/80`}
              >
                {saving ? "Saving…" : "Save and continue"}
              </button>
            </div>
          </form>
        </section>
      )}

      {step === 2 && (
        <section className={`${cardClasses} mx-auto w-full max-w-4xl space-y-8`}>
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-emerald-900 dark:text-emerald-200">
              Build your starter goals
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Choose up to three habits you want to nurture first. Pair each habit with a short goal
              statement so your Journal knows what progress looks like.
            </p>
          </div>

          <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/70 p-5 shadow-sm dark:border-indigo-500/40 dark:bg-indigo-900/30">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                  Connect Apple Health?
                </p>
                <p className="text-xs text-indigo-800/80 dark:text-indigo-200/80">
                  We can auto-track Steps, Exercise, and Sleep from HealthKit. Set clear, numeric
                  goals and we’ll add them for you.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-indigo-900 dark:text-indigo-100">
                <input
                  type="checkbox"
                  checked={connectHealth}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setConnectHealth(next);
                    if (
                      next &&
                      !healthSaving &&
                      habits.length &&
                      !goals.some((g) => g.uses_healthkit)
                    ) {
                      handleAddHealthGoals();
                    }
                  }}
                  className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-400 dark:border-indigo-600 dark:bg-indigo-900"
                />
                <span>Yes, sync HealthKit</span>
              </label>
            </div>

            {connectHealth ? (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {HEALTH_GOAL_CONFIG.map((config) => (
                  <label
                    key={config.key}
                    className="flex flex-col rounded-2xl border border-white/40 bg-white/70 p-4 text-sm font-medium text-indigo-900 shadow-sm dark:border-indigo-700/50 dark:bg-indigo-950/40 dark:text-indigo-100"
                  >
                    <span>{config.habitName} goal</span>
                    <input
                      type="number"
                      min="0"
                      className={`${inputClasses} mt-2`}
                      value={healthTargets[config.key] ?? ""}
                      onChange={(event) =>
                        setHealthTargets((prev) => ({
                          ...prev,
                          [config.key]: Number(event.target.value),
                        }))
                      }
                      placeholder={config.placeholder}
                    />
                    <span className="mt-2 text-xs font-normal text-indigo-800/80 dark:text-indigo-200/80">
                      {config.unit === "minutes"
                        ? "Aim for minutes per day (sleep minutes = hours × 60)."
                        : "Daily steps target."}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-indigo-800/80 dark:text-indigo-200/80">
                Not ready yet? You can always connect later from the Habits page and still add goals
                here manually.
              </p>
            )}

            {healthError && (
              <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">{healthError}</p>
            )}

            <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <button
                type="button"
                onClick={handleAddHealthGoals}
                disabled={!connectHealth || healthSaving}
                className={`${buttonBase} border border-indigo-200/70 bg-white/90 text-indigo-800 hover:bg-white disabled:opacity-60 dark:border-indigo-600/50 dark:bg-indigo-950/60 dark:text-indigo-100 dark:hover:bg-indigo-900/40`}
              >
                {healthSaving ? "Saving…" : "Add HealthKit goals"}
              </button>
              <p className="text-xs text-indigo-800/80 dark:text-indigo-200/80">
                We’ll add Steps, Exercise, and Sleep goals with your targets and auto-track them when
                HealthKit data arrives.
              </p>
            </div>
          </div>

          {habitsLoading ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">Loading habit ideas…</p>
          ) : habitsError ? (
            <p className="text-sm text-amber-600 dark:text-amber-300">{habitsError}</p>
          ) : visibleHabits.length ? (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Pick a habit
                <select
                  className={`${inputClasses} appearance-none`}
                  value={selectedHabitId}
                    onChange={(event) => {
                      setSelectedHabitId(event.target.value);
                      setGoalError("");
                    }}
                  >
                    {visibleHabits.map((habit) => (
                      <option key={habit.id} value={habit.id}>
                        {habit.name}
                      </option>
                  ))}
                </select>
                  {selectedHabit?.description && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {selectedHabit.description}
                    </p>
                  )}
                </label>

                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Daily target ({selectedHabit?.unit || "units"})
                  <input
                    className={inputClasses}
                    type="number"
                    min="0"
                    value={goalTarget}
                    onChange={(event) => setGoalTarget(event.target.value)}
                    placeholder={selectedHabit?.default_target ? String(selectedHabit.default_target) : "Add a number"}
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Quantitative goals earn XP linearly up to 10 when you hit this number.
                  </p>
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Describe your goal
                <textarea
                  className={`${inputClasses} min-h-[140px] resize-none`}
                  value={goalDraft}
                  onChange={(event) => {
                    setGoalDraft(event.target.value);
                    if (goalError) setGoalError("");
                  }}
                  placeholder="Example: Complete a 20-minute strength workout three times a week."
                />
              </label>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                <button
                  type="button"
                  onClick={handleAddGoal}
                  disabled={goalSaving || goals.length >= 3}
                  className={`${buttonBase} border border-emerald-300/70 bg-emerald-400/80 text-emerald-950 hover:bg-emerald-300/80 disabled:opacity-60 dark:border-emerald-500/40 dark:bg-emerald-500/80 dark:text-slate-950 dark:hover:bg-emerald-400/80`}
                >
                  {goalSaving ? "Adding…" : "Add goal"}
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400 md:leading-tight">
                  You can add up to three goals now and create more later from the Habits page.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              We don’t have shared habits available yet. You can head to the Habits page later to
              add your own habits and goals.
            </p>
          )}

          {goalError && (
            <p className="text-sm text-rose-500 dark:text-rose-300" role="alert">
              {goalError}
            </p>
          )}

          <div className="space-y-4 rounded-2xl border border-white/40 bg-white/60 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/60">
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-700 dark:text-slate-300">
              Your starting goals
            </h3>
            {goalsLoading ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">Loading…</p>
            ) : orderedGoals.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                No goals yet. Add at least one to continue.
              </p>
            ) : (
              <ul className="space-y-3">
                {orderedGoals.map((goal) => (
                  <li key={goal.id} className={goalCardClasses}>
                    <div>
                      <p className="font-medium">{goal.goal_text}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.25em] text-emerald-700/70 dark:text-emerald-300/70">
                        Habit · {goal.habit?.name || "Untitled"}
                      </p>
                      {goal.uses_healthkit ? (
                        <p className="text-xs text-emerald-800 dark:text-emerald-200">
                          HealthKit target: {formatHealthTarget(goal)}
                        </p>
                      ) : goal.target_value ? (
                        <p className="text-xs text-emerald-800 dark:text-emerald-200">
                          Target: {goal.target_value} {goal.target_unit || goal.habit?.unit || "units"}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteGoal(goal.id)}
                      disabled={deletingGoalId === goal.id}
                      className="self-start text-xs font-semibold text-rose-600 transition hover:text-rose-500 disabled:opacity-60 dark:text-rose-300"
                    >
                      {deletingGoalId === goal.id ? "Removing…" : "Remove"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`${buttonBase} border border-slate-200/70 bg-white/80 text-slate-700 hover:bg-slate-100/70 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-900`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={proceedFromGoals}
              disabled={!canContinueFromGoals}
              className={`${buttonBase} border border-emerald-300/70 bg-emerald-400/80 text-emerald-950 hover:bg-emerald-300/80 disabled:opacity-60 dark:border-emerald-500/40 dark:bg-emerald-500/80 dark:text-slate-950 dark:hover:bg-emerald-400/80`}
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className={`${cardClasses} mx-auto grid w-full max-w-4xl gap-8`}>
          <div>
            <h2 className="text-2xl font-semibold text-emerald-900 dark:text-emerald-200">
              Here’s what’s waiting for you
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Each space in Magic Journal is designed around gentle accountability. Explore these
              highlights and then dive right in.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {HIGHLIGHTS.map((item) => (
              <article
                key={item.title}
                className="flex h-full flex-col gap-3 rounded-2xl border border-emerald-200/60 bg-emerald-50/60 p-6 text-sm text-emerald-900 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-200"
              >
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm opacity-90">{item.blurb}</p>
              </article>
            ))}
          </div>

          {orderedGoals.length > 0 && (
            <div className="rounded-2xl border border-white/40 bg-white/60 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/60">
              <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-700 dark:text-slate-300">
                You’re kicking off with
              </h3>
              <ul className="mt-4 space-y-3">
                {orderedGoals.map((goal) => (
                  <li
                    key={goal.id}
                    className="rounded-xl border border-emerald-200/60 bg-white/80 p-4 text-sm text-slate-700 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-100"
                  >
                    <p className="font-medium">{goal.goal_text}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.25em] text-emerald-700/70 dark:text-emerald-300/70">
                      Habit · {goal.habit?.name || "Untitled"}
                    </p>
                    {goal.uses_healthkit ? (
                      <p className="text-xs text-emerald-800 dark:text-emerald-200">
                        HealthKit target: {formatHealthTarget(goal)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="text-sm text-rose-500 dark:text-rose-300" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className={`${buttonBase} border border-slate-200/70 bg-white/80 text-slate-700 hover:bg-slate-100/70 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-900`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving}
              className={`${buttonBase} border border-emerald-300/70 bg-emerald-400/80 text-emerald-950 hover:bg-emerald-300/80 disabled:opacity-60 dark:border-emerald-500/40 dark:bg-emerald-500/80 dark:text-slate-950 dark:hover:bg-emerald-400/80`}
            >
              {saving ? "Wrapping up…" : "Finish and go to app"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
