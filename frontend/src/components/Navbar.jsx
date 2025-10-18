import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/40 bg-white/80 backdrop-blur-xl transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-950/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
        <Link
          to="/"
          className="text-lg font-semibold tracking-tight text-emerald-700 transition hover:text-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 dark:text-emerald-300 dark:hover:text-emerald-200"
        >
          Magic Journal
        </Link>
        <Link
          to="/signin"
          className="rounded-full border border-emerald-300/70 bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 dark:border-emerald-600/70 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          Sign In
        </Link>
      </div>
    </nav>
  );
}
