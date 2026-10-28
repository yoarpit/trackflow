import { useState } from "react";
import api from "../services/api";

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "passenger", phone: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const change = e => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const { data } = await api.post(`/api/auth/${mode === "login" ? "login" : "register"}`, form);
      localStorage.setItem("trackflow_token", data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Could not connect to TrackFlow API");
    } finally { setBusy(false); }
  }

  return <main className="auth-shell">
    <section className="auth-brand">
      <div className="brand-mark">T</div>
      <p className="eyebrow">MOVE WITH CONFIDENCE</p>
      <h1>Your city.<br /><span>Your route.</span></h1>
      <p className="muted">A smarter way to get there. Request a ride or get on the road.</p>
      <div className="auth-stat"><span className="pulse-dot" /> Live driver tracking · Built for the journey</div>
    </section>
    <section className="auth-card">
      <div className="auth-switch">
        <button className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>Sign in</button>
        <button className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")}>Create account</button>
      </div>
      <h2>{mode === "login" ? "Welcome back" : "Join TrackFlow"}</h2>
      <p className="muted">{mode === "login" ? "Sign in to continue your journey." : "Choose how you'll use TrackFlow."}</p>
      <form onSubmit={submit} className="form-stack">
        {mode === "register" && <>
          <label>Full name<input name="name" value={form.name} onChange={change} placeholder="Your name" required maxLength={80} /></label>
          <label>Phone (optional)<input name="phone" value={form.phone} onChange={change} placeholder="+91 ..." /></label>
          <label>Account type<select name="role" value={form.role} onChange={change}><option value="passenger">Passenger</option><option value="driver">Driver</option></select></label>
        </>}
        <label>Email address<input type="email" name="email" value={form.email} onChange={change} placeholder="you@example.com" required autoComplete="email" /></label>
        <label>Password<input type="password" name="password" value={form.password} onChange={change} placeholder="At least 8 characters" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary-btn" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in →" : "Create account →"}</button>
      </form>
      <p className="tiny muted">Demo MVP · Use a test account. Never reuse your important passwords.</p>
    </section>
  </main>;
}
