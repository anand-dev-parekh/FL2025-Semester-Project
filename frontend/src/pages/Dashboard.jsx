import { useAuth } from "../auth/useAuth";
import { useNavigate } from "react-router-dom";

const navContainer =
  "flex flex-wrap items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 p-2 shadow-sm transition-colors duration-300 focus-within:ring-2 focus-within:ring-emerald-200 dark:border-slate-700/60 dark:bg-slate-900/70 dark:focus-within:ring-emerald-500/40";
const navButton =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 dark:text-slate-200 dark:hover:bg-slate-800";
const signOutButton =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-rose-50 bg-rose-500 transition hover:bg-rose-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 dark:bg-rose-500/80 dark:hover:bg-rose-500";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <main className="flex-1">
      <header className="mb-10 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-700/70 dark:text-emerald-400/70">
              Magic Journal
            </p>
            <h2 className="text-4xl font-semibold text-emerald-800 dark:text-emerald-300">Dashboard</h2>
          </div>
        </div>

        <nav className={navContainer} aria-label="Primary">
          <button
            onClick={() => navigate("/profile")}
            className={navButton}
          >
            Profile
          </button>
          <button
            onClick={() => navigate("/friends")}
            className={navButton}
          >
            Friends
          </button>
          <button
            onClick={() => navigate("/habits")}
            className={navButton}
          >
            Habits
          </button>
          <button
            onClick={logout}
            className={signOutButton}
          >
            Sign out
          </button>
        </nav>
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
    </main>
  );
}
