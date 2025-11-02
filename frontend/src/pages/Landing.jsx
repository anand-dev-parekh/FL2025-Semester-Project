import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import Navbar from "../components/Navbar";

const coreFeatures = [
  {
    title: "Habit Tracking",
    description:
      "Create routines that stick with adaptive reminders and check-ins that celebrate every win.",
    accent: "Design, repeat, and refine your habits with confidence.",
  },
  {
    title: "Reflective Journaling",
    description:
      "Log how each habit feels, capture daily reflections, and spot patterns in your mindset over time.",
    accent: "Your words fuel clarity, accountability, and self-awareness.",
  },
  {
    title: "Goal-Focused Planning",
    description:
      "Break habits into clear milestones, track progress against goals, and keep momentum visible.",
    accent: "Small intentional steps lead to meaningful change.",
  },
  {
    title: "Gamified Progress",
    description:
      "Earn XP, unlock progress, and watch your habit journey level up as you stay consistent.",
    accent: "Motivation meets measurable momentum.",
  },
];

const communityHighlights = [
  {
    title: "Accountability With Friends",
    description:
      "Invite friends to share progress, trade encouragement, and stay connected through every milestone.",
  },
  {
    title: "Collaborative Friend Challenges",
    description:
      "Launch short-term challenges that help everyone build the same habit together—and celebrate as a team.",
  },
];

const comingSoon = [
  {
    title: "HealthKit Integration",
    details:
      "Connect sleep, steps, and more from Apple HealthKit to enrich your habit dashboard with real-world data.",
  },
  {
    title: "AI Coaching",
    details:
      "Let AI synthesize your health, habit, and journal insights to surface personalized guidance and keep you on track.",
  },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const destination = user.onboarding_complete ? "/app" : "/onboarding";
    navigate(destination, { replace: true });
  }, [user, navigate]);

  return (
    <>
      <Navbar />
      <div className="flex flex-1 flex-col gap-12">
        <header className="rounded-3xl border border-white/40 bg-white/60 px-6 py-6 backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70 sm:px-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100 sm:text-4xl">
              Design your habits, capture your story
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Build rituals that reflect who you are becoming. Track your progress, celebrate your
              wins, and stay grounded through mindful journaling.
            </p>
          </div>
        </header>

      <main className="flex flex-1 flex-col gap-14 text-slate-700 dark:text-slate-300">
        <section className="grid gap-10 rounded-3xl border border-white/40 bg-white/60 p-10 backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70 md:grid-cols-[1.05fr_0.95fr] md:items-center">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Build habits that last, backed by insight and inspiration.
              </h2>
              <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
                Magic Journal combines mindful reflection with motivating feedback. Track what you
                do, how you feel, and why it matters—right inside one calm space that guides your
                next step.
              </p>
            </div>
            <ul className="grid gap-4 text-sm font-medium text-slate-700 dark:text-slate-300 sm:grid-cols-2">
              <li className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 px-4 py-3 text-emerald-800 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-900/30 dark:text-emerald-200">
                Focused dashboards that keep your routines visible.
              </li>
              <li className="rounded-2xl border border-amber-200/70 bg-amber-50/50 px-4 py-3 text-amber-800 shadow-sm dark:border-amber-400/40 dark:bg-amber-900/30 dark:text-amber-100">
                Ritual notes to capture context, intent, and emotions.
              </li>
              <li className="rounded-2xl border border-rose-200/70 bg-rose-50/50 px-4 py-3 text-rose-800 shadow-sm dark:border-rose-400/40 dark:bg-rose-900/30 dark:text-rose-100">
                Flexible schedules that adapt as your routines evolve.
              </li>
              <li className="rounded-2xl border border-sky-200/70 bg-sky-50/50 px-4 py-3 text-sky-800 shadow-sm dark:border-sky-400/40 dark:bg-sky-900/30 dark:text-sky-100">
                Insights that spotlight wins and opportunities to adjust.
              </li>
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-emerald-200 via-amber-100 to-rose-100 p-8 shadow-2xl dark:border-slate-800/70 dark:from-emerald-950 dark:via-slate-900 dark:to-rose-950">
            <div className="absolute -right-20 -top-12 h-48 w-48 rounded-full bg-emerald-300/40 blur-3xl dark:bg-emerald-500/20" />
            <div className="absolute bottom-[-3rem] left-[-2rem] h-40 w-40 rounded-full bg-amber-300/30 blur-3xl dark:bg-amber-500/20" />
            <div className="relative space-y-5 text-slate-800 dark:text-slate-100">
              <h3 className="text-lg font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Why users love Magic Journal
              </h3>
              <p className="text-base leading-relaxed">
                See every habit, reflection, and milestone in one timeline. Track momentum, hold your
                future self accountable, and celebrate meaningful wins along the way.
              </p>
              <p className="text-sm text-slate-700/80 dark:text-slate-300/90">
                When you are ready to begin, tap the Google sign-in button up top—your journey is one
                click away.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
              Core features for intentional growth
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Built for builders, reflectors, and anyone committed to steady progress.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {coreFeatures.map(({ title, description, accent }) => (
              <article
                key={title}
                className="flex h-full flex-col justify-between rounded-3xl border border-white/40 bg-white/60 p-6 shadow-md backdrop-blur-md transition-colors duration-500 hover:border-emerald-200 hover:bg-white/80 dark:border-slate-800/70 dark:bg-slate-900/70 dark:hover:border-emerald-500/30 dark:hover:bg-slate-900/80"
              >
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {description}
                  </p>
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  {accent}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl border border-white/40 bg-white/60 p-8 backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70 md:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
              Grow stronger together
            </h2>
            <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Sharing progress with friends keeps accountability warm, fun, and human. Build your
              crew and watch everyone rise.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1">
            {communityHighlights.map(({ title, description }) => (
              <article
                key={title}
                className="rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-100/70 via-white to-emerald-50/80 p-6 text-slate-800 shadow-md dark:border-emerald-500/30 dark:from-emerald-950/50 dark:via-slate-900 dark:to-emerald-900/40 dark:text-emerald-100"
              >
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6 rounded-3xl border border-dashed border-emerald-300/70 bg-white/40 p-8 text-slate-700 backdrop-blur-md transition dark:border-emerald-500/40 dark:bg-slate-900/60 dark:text-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            On the horizon
          </h2>
          <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
            We are already building the next generation of wellness tooling designed to feel personal
            and proactive.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {comingSoon.map(({ title, details }) => (
              <article
                key={title}
                className="rounded-3xl border border-white/50 bg-white/70 p-6 shadow-sm backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-900/70"
              >
                <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {details}
                </p>
                <span className="mt-4 inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                  Coming soon
                </span>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
    </>
  );
}
