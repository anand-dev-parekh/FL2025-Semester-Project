import { Routes, Route, NavLink } from "react-router-dom";

// ⬇️ match your lowercase filenames exactly
import Journal from "./pages/journal.jsx";
import Profile from "./pages/profile.jsx";

function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Home renders ✅</h1>
      <p>Use the tabs to open Journal or Profile.</p>
    </div>
  );
}

export default function App() {
  return (
    <>
      {/* simple nav */}
      <nav style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", gap: 12 }}>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/journal">Journal</NavLink>
        <NavLink to="/profile">Profile</NavLink>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </>
  );
}
