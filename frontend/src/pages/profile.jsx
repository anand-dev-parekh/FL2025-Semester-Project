// frontend/src/pages/Profile.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/useAuth";
import { http } from "../api/http";
import AuthNavbar from "../components/AuthNavbar";
import { useTheme } from "../theme/useTheme";

const cardClasses =
  "rounded-3xl border border-white/50 bg-white/80 p-8 shadow-xl backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70";
const inputClasses =
  "mt-2 w-full rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/70 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-400";
const buttonBase =
  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";
const themeToggleClasses =
  "inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm font-medium text-emerald-600 transition hover:text-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-60 disabled:pointer-events-none dark:text-emerald-300 dark:hover:text-emerald-200";

export default function Profile() {
  const { user: authUser, refreshUser } = useAuth();
  const { theme, preference: themePreferenceContext, setPreference: setThemePreference } = useTheme();

  const [form, setForm] = useState(() => ({
    fullName: authUser?.name || "",
    email: authUser?.email || "",
    bio: authUser?.bio || "",
    themePreference: themePreferenceContext || authUser?.theme_preference || "system",
  }));

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitNotice, setSubmitNotice] = useState("");
  const [submitError, setSubmitError] = useState("");

  const updateThemePreference = (next) => {
    const candidate = typeof next === "string" ? next.toLowerCase() : "system";
    const normalized = candidate === "light" || candidate === "dark" ? candidate : "system";
    setForm((f) => ({ ...f, themePreference: normalized }));
    setThemePreference(normalized);
  };

  // Load user data from backend
  useEffect(() => {
    (async () => {
      try {
        const u = await http("/api/user/me");
        setForm({
          fullName: u.name || "",
          email: u.email || "",
          bio: u.bio || "",
          themePreference: u.theme_preference || "system",
        });
        setThemePreference(u.theme_preference || "system");
      } catch (err) {
        console.error(err);
        setLoadError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [setThemePreference]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const validate = () => {
    const next = {};
    if (!form.fullName.trim()) next.fullName = "Full name is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitError("");
    setSubmitNotice("");
    setSaving(true);
    try {
      const saved = await http("/api/user/me", {
        method: "PATCH",
        body: {
          name: form.fullName,
          bio: form.bio === "" ? null : form.bio,
          theme_preference: form.themePreference,
        },
      });

      setForm((f) => ({
        ...f,
        fullName: saved.name ?? f.fullName,
        email: saved.email ?? f.email,
        bio: saved.bio ?? f.bio,
        themePreference: saved.theme_preference ?? f.themePreference,
      }));
      if (saved.theme_preference) {
        setThemePreference(saved.theme_preference);
      }
      try {
        await refreshUser();
      } catch (refreshErr) {
        console.error(refreshErr);
      }
      setSubmitNotice("Profile saved.");
    } catch (err) {
      console.error(err);
      setSubmitError("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };


  const themePreference = form.themePreference;
  const themeIsDark = theme === "dark";
  const nextTogglePreference =
    themePreference === "system"
      ? themeIsDark
        ? "light"
        : "dark"
      : themePreference === "dark"
        ? "light"
        : "dark";
  const toggleLabel =
    themePreference === "system"
      ? `System (${themeIsDark ? "Dark" : "Light"})`
      : themePreference === "dark"
        ? "Dark mode"
        : "Light mode";

  const persistThemePreference = async (nextPreference) => {
    const previousPreference = form.themePreference;
    updateThemePreference(nextPreference);
    setThemeSaving(true);
    try {
      await http("/api/user/me", {
        method: "PATCH",
        body: {
          theme_preference: nextPreference,
        },
      });
      try {
        await refreshUser();
      } catch (refreshErr) {
        console.error(refreshErr);
      }
    } catch (err) {
      console.error(err);
      updateThemePreference(previousPreference);
      alert("Failed to update theme preference.");
    } finally {
      setThemeSaving(false);
    }
  };

  const handleThemeToggle = async () => {
    if (themeSaving) return;
    await persistThemePreference(nextTogglePreference);
  };

  return (
    <>
      <AuthNavbar />
      <div className="relative flex-1 pb-12">
        <header>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-semibold text-emerald-900 dark:text-emerald-200">
              Your Profile
            </h1>
            <button
              type="button"
              onClick={handleThemeToggle}
              aria-label={`Switch to ${nextTogglePreference} mode`}
              aria-pressed={themeIsDark}
              className={`${themeToggleClasses} ml-auto`}
            >
              {toggleLabel}
            </button>
          </div>
          <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
            Manage your account details.
          </p>
        </header>

        {(submitError || submitNotice) && (
          <div className="mt-6 space-y-2">
            {submitError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/20 dark:text-rose-100">
                {submitError}
              </div>
            ) : null}
            {submitNotice ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-100">
                {submitNotice}
              </div>
            ) : null}
          </div>
        )}

        <main className={`${cardClasses} mt-8`}>
          {loading ? (
            <p className="text-slate-600 dark:text-slate-300">Loading profile…</p>
          ) : loadError ? (
            <p className="text-rose-600 dark:text-rose-400">Error: {loadError}</p>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <div className="grid gap-6 md:grid-cols-2">
                <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span>Full name</span>
                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={onChange}
                    placeholder={authUser?.name || "Your name"}
                    className={inputClasses}
                  />
                  {errors.fullName && (
                    <em className="mt-1 text-sm text-rose-500 dark:text-rose-300">
                      {errors.fullName}
                    </em>
                  )}
                </label>

                <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span>Email</span>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={onChange}
                    placeholder="you@example.com"
                    className={inputClasses}
                    disabled
                  />
                  {errors.email && (
                    <em className="mt-1 text-sm text-rose-500 dark:text-rose-300">
                      {errors.email}
                    </em>
                  )}
                </label>

                <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200 md:col-span-2">
                  <span>Bio</span>
                  <textarea
                    name="bio"
                    rows={4}
                    value={form.bio}
                    onChange={onChange}
                    placeholder="Tell us about yourself..."
                    className={`${inputClasses} resize-none`}
                  />
                </label>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className={`${buttonBase} border border-emerald-300/70 bg-emerald-400/80 text-emerald-950 hover:bg-emerald-300/80 disabled:opacity-60 dark:border-emerald-500/40 dark:bg-emerald-500/80 dark:text-slate-950 dark:hover:bg-emerald-400/80`}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </>
  );
}
