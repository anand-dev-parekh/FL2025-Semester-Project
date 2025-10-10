// frontend/src/pages/Profile.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

// Local demo storage (replace with real API later)
const STORAGE_KEY = "profile_demo_v1";

const cardClasses =
  "rounded-3xl border border-white/50 bg-white/80 p-8 shadow-xl backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70";
const inputClasses =
  "mt-2 w-full rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/70 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-400";
const buttonBase =
  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

export default function Profile() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    bio: "",
    darkMode: false,
    notifications: true,
    avatarDataUrl: "",
  });
  const [errors, setErrors] = useState({});
  const { user } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setForm(JSON.parse(saved));
      } catch {
        // ignore malformed data
      }
    }
  }, []);

  const onChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const onAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, avatarDataUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const next = {};
    if (!form.fullName.trim()) next.fullName = "Full name is required.";
    if (!form.username.trim()) next.username = "Username is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    alert("Profile saved (demo).");
  };

  const onReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setForm({
      fullName: "",
      username: "",
      email: "",
      bio: "",
      darkMode: false,
      notifications: true,
      avatarDataUrl: "",
    });
    setErrors({});
  };

  return (
    <div className="relative flex-1 pb-12">
      <button
        onClick={() => navigate("/app")}
        className={`${buttonBase} absolute left-0 top-0 border border-emerald-200/60 bg-white/80 text-emerald-800 hover:bg-emerald-50/80 dark:border-emerald-700/40 dark:bg-slate-900/70 dark:text-emerald-200 dark:hover:bg-slate-900`}
      >
        ← Home
      </button>

      <header className={`${cardClasses} mt-16 flex flex-col gap-8 md:flex-row md:items-center md:justify-between`}>
        <div className="flex items-center gap-6">
          <div className="relative">
            {form.avatarDataUrl ? (
              <img
                className="h-32 w-32 rounded-3xl border border-white/60 object-cover shadow-lg dark:border-slate-700/70"
                src={form.avatarDataUrl}
                alt="avatar"
              />
            ) : (
              <div
                className="flex h-32 w-32 items-center justify-center rounded-3xl border border-dashed border-emerald-400/60 bg-emerald-200/60 text-4xl shadow-inner dark:border-emerald-500/60 dark:bg-emerald-950/40"
                aria-label="default avatar"
              >
                🧑
              </div>
            )}
            <label className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-emerald-300/60 bg-emerald-400/80 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-950 shadow-sm transition hover:bg-emerald-300/80 dark:border-emerald-500/50 dark:bg-emerald-500/80 dark:text-slate-950">
              <input type="file" accept="image/*" onChange={onAvatarChange} className="hidden" />
              Change photo
            </label>
          </div>

          <div>
            <h1 className="text-4xl font-semibold text-emerald-900 dark:text-emerald-200">Your Profile</h1>
            <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
              Manage your account details and tailor notifications to match the rhythm of your habits.
            </p>
          </div>
        </div>
      </header>

      <form className={`${cardClasses} mt-8`} onSubmit={onSubmit} noValidate>
        <div className="grid gap-6 md:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Full name</span>
            <input
              name="fullName"
              value={form.fullName}
              onChange={onChange}
              placeholder={user?.name || "Your name"}
              className={inputClasses}
            />
            {errors.fullName && <em className="mt-1 text-sm text-rose-500 dark:text-rose-300">{errors.fullName}</em>}
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Username</span>
            <input
              name="username"
              value={form.username}
              onChange={onChange}
              placeholder={user?.name || "username"}
              className={inputClasses}
            />
            {errors.username && <em className="mt-1 text-sm text-rose-500 dark:text-rose-300">{errors.username}</em>}
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
            />
            {errors.email && <em className="mt-1 text-sm text-rose-500 dark:text-rose-300">{errors.email}</em>}
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

        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-emerald-200/60 bg-emerald-100/40 p-5 text-sm font-medium text-emerald-900 shadow-inner dark:border-emerald-500/30 dark:bg-emerald-900/40 dark:text-emerald-200">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="notifications"
              checked={form.notifications}
              onChange={onChange}
              className="h-5 w-5 rounded border border-emerald-400 text-emerald-600 focus:ring-emerald-400 dark:border-emerald-600 dark:bg-slate-900 dark:text-emerald-400"
            />
            <span>Enable notifications</span>
          </label>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="submit"
            className={`${buttonBase} border border-emerald-300/70 bg-emerald-400/80 text-emerald-950 hover:bg-emerald-300/80 dark:border-emerald-500/40 dark:bg-emerald-500/80 dark:text-slate-950 dark:hover:bg-emerald-400/80`}
          >
            Save changes
          </button>
          <button
            type="button"
            className={`${buttonBase} border border-slate-200/70 bg-white/80 text-slate-700 hover:bg-slate-100/70 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-900`}
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
