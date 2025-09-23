// frontend/src/pages/Profile.jsx
import React, { useState, useEffect } from "react";
import "./Profile.css";

// Local demo storage (replace with real API later)j
const STORAGE_KEY = "profile_demo_v1";

export default function Profile() {
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    bio: "",
    darkMode: false,
    notifications: true,
    avatarDataUrl: "", // preview image
  });
  const [errors, setErrors] = useState({});

  // Load saved draft (demo)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setForm(JSON.parse(saved));
      } catch {}
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Enter a valid email.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    // DEMO save locally. Replace with a real API call when backend is ready.
    // await fetch("/api/me", { method:"PUT", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(form) })
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
    <div className="profile-container">
      <header className="profile-header">
        <div className="avatar-wrap">
          {form.avatarDataUrl ? (
            <img className="avatar" src={form.avatarDataUrl} alt="avatar" />
          ) : (
            <div className="avatar placeholder" aria-label="default avatar">🧑</div>
          )}
          <label className="avatar-upload">
            <input type="file" accept="image/*" onChange={onAvatarChange} />
            Change photo
          </label>
        </div>

        <div>
          <h1 className="title">Your Profile</h1>
          <p className="subtitle">Manage your info and preferences.</p>
        </div>
      </header>

      <form className="profile-form" onSubmit={onSubmit} noValidate>
        <div className="grid">
          <label className="field">
            <span>Full name</span>
            <input
              name="fullName"
              value={form.fullName}
              onChange={onChange}
              placeholder="Andrew Cai"
            />
            {errors.fullName && <em className="error">{errors.fullName}</em>}
          </label>

          <label className="field">
            <span>Username</span>
            <input
              name="username"
              value={form.username}
              onChange={onChange}
              placeholder="andrew999"
            />
            {errors.username && <em className="error">{errors.username}</em>}
          </label>

          <label className="field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="andrew@example.com"
            />
            {errors.email && <em className="error">{errors.email}</em>}
          </label>

          <label className="field full">
            <span>Bio</span>
            <textarea
              name="bio"
              rows={4}
              value={form.bio}
              onChange={onChange}
              placeholder="Tell us about yourself..."
            />
          </label>
        </div>

        <div className="prefs">
          <label className="switch">
            <input
              type="checkbox"
              name="darkMode"
              checked={form.darkMode}
              onChange={onChange}
            />
            <span>Dark mode</span>
          </label>

          <label className="switch">
            <input
              type="checkbox"
              name="notifications"
              checked={form.notifications}
              onChange={onChange}
            />
            <span>Enable notifications</span>
          </label>
        </div>

        <div className="actions">
          <button type="submit" className="btn primary">Save changes</button>
          <button type="button" className="btn" onClick={onReset}>Reset</button>
        </div>
      </form>
    </div>
  );
}
