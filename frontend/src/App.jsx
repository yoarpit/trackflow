import { useEffect, useState } from "react";
import api from "./services/api";
import { connectSocket } from "./services/socket";
import AuthPage from "./pages/AuthPage";
import DriverDashboard from "./pages/DriverDashboard";
import PassengerDashboard from "./pages/PassengerDashboard";

export default function App() {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function restore() {
      const token = localStorage.getItem("trackflow_token");
      if (token) {
        try {
          const { data } = await api.get("/api/auth/me");
          if (mounted) setUser(data.user);
        } catch { localStorage.removeItem("trackflow_token"); }
      }
      if (mounted) setLoading(false);
    }
    restore();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!user) { socket?.disconnect(); setSocket(null); return; }
    const token = localStorage.getItem("trackflow_token");
    const s = connectSocket(token);
    setSocket(s);
    return () => s.disconnect();
  }, [user?._id || user?.id]);

  function logout() {
    if (socket) socket.disconnect();
    localStorage.removeItem("trackflow_token");
    setSocket(null); setUser(null);
  }

  if (loading) return <div className="loading-screen"><div className="brand-mark">T</div><p>Preparing your journey…</p></div>;
  if (!user) return <AuthPage onLogin={setUser} />;

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark small">T</div><span>track<span>flow</span></span></div>
      <div className="topbar-right"><span className="role-tag">{user.role}</span><div className="user-chip"><div className="avatar">{user.name?.[0]?.toUpperCase()}</div><span>{user.name}</span></div><button className="logout-btn" onClick={logout}>Sign out</button></div>
    </header>
    <main className="main-content">
      <div className="welcome-row"><div><p className="eyebrow">YOUR DAY, IN MOTION</p><h1>{user.role === "driver" ? "Ready to hit the road?" : "Where to today?"}</h1><p className="muted">{user.role === "driver" ? "Go online to share your live location and receive ride requests." : "Book a ride and follow your driver's journey in real time."}</p></div><div className="date-chip">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div></div>
      {socket ? (user.role === "driver" ? <DriverDashboard key={user.id || user._id} user={user} socket={socket} /> : <PassengerDashboard key={user.id || user._id} socket={socket} />) : <div className="panel">Connecting to live updates…</div>}
      <footer>TrackFlow <span>·</span> Demo ride tracking platform <span>·</span> Map data © OpenStreetMap contributors</footer>
    </main>
  </div>;
}
