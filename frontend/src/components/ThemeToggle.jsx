import { useTheme } from "../theme/useTheme";

function SunIcon(props) {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m13.72-13.72 1.41-1.41" />
    </svg>
  );
}

function MoonIcon(props) {
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
      <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79Z" />
    </svg>
  );
}

const baseButtonClasses =
  "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300/70 bg-white/70 text-slate-700 shadow-sm transition hover:border-emerald-400 hover:text-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-emerald-500/70 dark:hover:text-emerald-300";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme, isSystemTheme } = useTheme();
  const isDark = theme === "dark";
  const nextMode = isDark ? "light" : "dark";
  const label = `Switch to ${nextMode} mode`;
  const title = isSystemTheme
    ? `Following system theme. Click to switch to ${nextMode} mode.`
    : `Currently in ${theme ?? "light"} mode. Click to switch to ${nextMode} mode.`;

  const buttonClasses = [baseButtonClasses, className].filter(Boolean).join(" ");
  const sunClasses = [
    "flex h-full w-full items-center justify-center transition-opacity duration-200",
    isDark ? "opacity-0" : "opacity-100",
  ]
    .filter(Boolean)
    .join(" ");
  const moonClasses = [
    "pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200",
    isDark ? "opacity-100" : "opacity-0",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={buttonClasses}
      aria-label={label}
      aria-pressed={isDark}
      title={title}
    >
      <span className="sr-only">{label}</span>
      <span className={sunClasses}>
        <SunIcon className="h-5 w-5" />
      </span>
      <span className={moonClasses}>
        <MoonIcon className="h-5 w-5" />
      </span>
    </button>
  );
}
