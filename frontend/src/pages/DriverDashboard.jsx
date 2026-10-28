import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import MapView from "../components/MapView";

export default function DriverDashboard({ user, socket }) {
  const [online, setOnline] = useState(Boolean(user.isOnline));
  const [position, setPosition] = useState(user.location?.lat != null ? user.location : null);
  const [rides, setRides] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [message, setMessage] = useState("");
  const watchRef = useRef(null);

  async function load() {
    try {
      const [available, mine] = await Promise.all([api.get("/api/rides/available"), api.get("/api/rides/mine")]);
      setRides(available.data.rides);
      setActiveRide(mine.data.rides.find(r => ["accepted", "started"].includes(r.status)) || null);
    } catch (err) { setMessage(err.response?.data?.message || "Could not load rides"); }
  }
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const update = ({ ride }) => { setActiveRide(ride && ["accepted", "started"].includes(ride.status) ? ride : null); load(); };
    socket.on("ride:requested", load);
    socket.on("ride:updated", update);
    return () => { socket.off("ride:requested", load); socket.off("ride:updated", update); };
  }, [socket]);

  useEffect(() => () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); }, []);

  async function setAvailability(next) {
    setMessage("");
    try {
      await api.patch("/api/drivers/status", { isOnline: next });
      setOnline(next);
      if (next) startGPS(); else stopGPS();
    } catch (err) { setMessage(err.response?.data?.message || "Could not update status"); }
  }
  function startGPS() {
    if (!("geolocation" in navigator)) { setMessage("This browser does not support GPS."); return; }
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      p => {
        const coords = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPosition(coords);
        socket.emit("driver:location", coords, result => { if (!result?.ok) setMessage(result?.message || "Location update failed"); });
      },
      err => setMessage(`GPS error: ${err.message}. Allow location access in browser settings.`),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
  }
  function stopGPS() {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  }
  async function acceptRide(id) {
    try {
      const { data } = await api.patch(`/api/rides/${id}/accept`);
      setActiveRide(data.ride); setMessage("Ride accepted"); await load();
      socket.emit("ride:watch", { rideId: id });
    } catch (err) { setMessage(err.response?.data?.message || "Could not accept ride"); await load(); }
  }
  async function updateStatus(status) {
    try {
      const { data } = await api.patch(`/api/rides/${activeRide._id}/status`, { status });
      setActiveRide(["accepted", "started"].includes(data.ride.status) ? data.ride : null);
      setMessage(`Ride ${status}`); await load();
    } catch (err) { setMessage(err.response?.data?.message || "Could not update ride"); }
  }

  const center = position || { lat: 23.2599, lng: 77.4126 };
  return <div className="dashboard-grid">
    <section className="panel map-panel">
      <div className="panel-heading"><div><p className="eyebrow">DRIVER MODE</p><h2>Your driving map</h2></div><span className={`status-pill ${online ? "online" : ""}`}><span />{online ? "Online" : "Offline"}</span></div>
      <MapView center={center} trackedDriver={position} pickup={activeRide?.pickup} destination={activeRide?.destination} />
      <div className="map-caption"><span className="pulse-dot" /> {position ? "GPS location available" : "Waiting for GPS permission"} <span className="muted">· Default map center: Bhopal</span></div>
      <button className={online ? "secondary-btn" : "primary-btn"} onClick={() => setAvailability(!online)}>{online ? "Go offline" : "Go online and share GPS"}</button>
      {message && <p className="notice">{message}</p>}
    </section>
    <aside className="side-column">
      {activeRide ? <section className="panel">
        <p className="eyebrow">CURRENT RIDE</p><h2>{activeRide.status === "accepted" ? "Pickup passenger" : "Ride in progress"}</h2>
        <p className="muted">Passenger: {activeRide.passenger?.name || "Passenger"}</p>
        <p className="coord">Pickup {activeRide.pickup.lat.toFixed(4)}, {activeRide.pickup.lng.toFixed(4)}</p>
        <p className="coord">Destination {activeRide.destination.lat.toFixed(4)}, {activeRide.destination.lng.toFixed(4)}</p>
        {activeRide.status === "accepted" && <button className="primary-btn full" onClick={() => updateStatus("started")}>Start ride</button>}
        {activeRide.status === "started" && <button className="primary-btn full" onClick={() => updateStatus("completed")}>Complete ride</button>}
        {activeRide.status === "accepted" && <button className="text-btn" onClick={() => updateStatus("cancelled")}>Cancel assignment</button>}
      </section> : <section className="panel">
        <p className="eyebrow">DRIVER STATUS</p><h2>{online ? "Ready for requests" : "You're offline"}</h2>
        <p className="muted">{online ? "Keep this page open and allow location access to receive ride requests." : "Go online when you're ready to drive."}</p>
      </section>}
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">RIDE QUEUE</p><h2>Available requests</h2></div><span className="count-badge">{rides.length}</span></div>
        {rides.length === 0 ? <p className="empty-state">No ride requests right now.</p> : <div className="ride-list">{rides.map(r => <article className="ride-item" key={r._id}>
          <div><strong>{r.passenger?.name || "Passenger"}</strong><p className="coord">Pickup: {r.pickup.lat.toFixed(3)}, {r.pickup.lng.toFixed(3)}</p><p className="coord">Drop: {r.destination.lat.toFixed(3)}, {r.destination.lng.toFixed(3)}</p></div>
          <button className="small-btn" disabled={!online || Boolean(activeRide)} onClick={() => acceptRide(r._id)}>Accept</button>
        </article>)}</div>}
      </section>
    </aside>
  </div>;
}
