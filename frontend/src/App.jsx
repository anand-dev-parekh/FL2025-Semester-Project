import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Profile from "./pages/profile"; 
import { Routes, Route } from "react-router-dom";
import journal from "./pages/journal.jsx";

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route path="/journal" element={<JournalPage />} />
      </Routes>
    </div>
    
     
      //<Profile />
    
  )
}

export default App;
