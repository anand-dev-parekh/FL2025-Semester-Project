import { useAuth } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";

const buttonBase =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:text-slate-100";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <main className="flex-1">
      <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-700/70 dark:text-emerald-400/70">
            Magic Journal
          </p>
          <h2 className="text-4xl font-semibold text-emerald-800 dark:text-emerald-300">Dashboard</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            className={`${buttonBase} border border-emerald-200/60 bg-white/80 text-emerald-800 hover:bg-emerald-50/80 dark:border-emerald-700/40 dark:bg-slate-900/60 dark:text-emerald-200 dark:hover:bg-slate-900`}
          >
            Profile
          </button>
          <button
            onClick={() => navigate("/journal")}
            className={`${buttonBase} border border-amber-200/70 bg-amber-300/70 text-amber-900 hover:bg-amber-200/70 dark:border-amber-500/40 dark:bg-amber-500/70 dark:text-slate-950 dark:hover:bg-amber-400/70`}
          >
            Journal
          </button>
          <button
            onClick={logout}
            className={`${buttonBase} border border-rose-200/70 bg-rose-400/80 text-rose-50 hover:bg-rose-400 dark:border-rose-500/40 dark:bg-rose-500/70 dark:text-white dark:hover:bg-rose-500`}
          >
            Sign out
          </button>
        </div>
      </header>

      <section>
        <div className="rounded-3xl border border-white/50 bg-white/80 p-8 shadow-lg backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70">
          <p className="text-lg font-medium text-emerald-900 dark:text-emerald-200">
            Hello {user?.name || "friend"}!
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{user?.email}</p>
          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            Use the journal to track your habits and visit your profile to update your preferences.
          </p>
        </div>
      </section>
    </main>
  );
}
