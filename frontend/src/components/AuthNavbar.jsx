import { useCallback } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import ThemeToggle from "./ThemeToggle";

const navLinkBase =
  "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 dark:text-slate-300 dark:hover:text-emerald-300";

function DashboardIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 11h7v10h-7zM3 15h7v6H3z" />
    </svg>
  );
}

export default function AuthNavbar() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleSignOut = useCallback(async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Failed to sign out:", err);
    } finally {
      navigate("/", { replace: true });
    }
  }, [logout, navigate]);

  const links = [
    { to: "/app", label: "Dashboard", icon: DashboardIcon },
    { to: "/habits", label: "Habits" },
    { to: "", label: "Journal" },
    { to: "/friends", label: "Friends" },
    { to: "/profile", label: "Profile" },
  ];

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/40 bg-white/80 backdrop-blur-xl transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-950/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
        <Link
          to="/app"
          className="text-lg font-semibold tracking-tight text-emerald-700 transition hover:text-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 dark:text-emerald-300 dark:hover:text-emerald-200"
        >
          Magic Journal
        </Link>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    navLinkBase,
                    isActive
                      ? "bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-transparent",
                  ].join(" ")
                }
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                <span>{label}</span>
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-rose-200/70 bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-rose-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 dark:border-rose-500/70 dark:bg-rose-600 dark:hover:bg-rose-500"
            >
              Sign Out
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}
