import { useEffect, useState } from "react";
import api from "../services/api";
import MapView from "../components/MapView";

const DEFAULT_CENTER = { lat: 23.2599, lng: 77.4126 };

export default function PassengerDashboard({ socket }) {
  const [drivers, setDrivers] = useState([]);
  const [position, setPosition] = useState(null);
  const [destination, setDestination] = useState(null);
  const [ride, setRide] = useState(null);
  const [rides, setRides] = useState([]);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [driverRes, rideRes] = await Promise.all([api.get("/api/drivers/online"), api.get("/api/rides/mine")]);
      setDrivers(driverRes.data.drivers);
      setRides(rideRes.data.rides);
      setRide(current => {
        if (current && ["requested", "accepted", "started"].includes(current.status)) {
          return rideRes.data.rides.find(r => r._id === current._id) || current;
        }
        return rideRes.data.rides.find(r => ["requested", "accepted", "started"].includes(r.status)) || null;
      });
    } catch (err) { setMessage(err.response?.data?.message || "Could not load map data"); }
  }
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const update = ({ ride: updated }) => {
      setRide(current => current?._id === updated?._id || !current ? updated : current);
      load();
    };
    const loc = data => setDrivers(old => old.map(d => d.id === data.driverId ? { ...d, location: { lat: data.lat, lng: data.lng, updatedAt: data.updatedAt } } : d));
    socket.on("ride:requested", load);
    socket.on("ride:updated", update);
    socket.on("driver:location", loc);
    return () => { socket.off("ride:requested", load); socket.off("ride:updated", update); socket.off("driver:location", loc); };
  }, [socket]);

  function useGPS() {
    if (!navigator.geolocation) { setMessage("This browser does not support GPS."); return; }
    navigator.geolocation.getCurrentPosition(
      p => { setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }); setMessage("Pickup set to your current location."); },
      e => setMessage(`GPS error: ${e.message}. Allow location permission or select a demo pickup on the map later.`),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }
  async function requestRide() {
    if (!position || !destination) { setMessage("Set your pickup using GPS and choose a destination on the map."); return; }
    try {
      const { data } = await api.post("/api/rides", { pickup: position, destination });
      setRide(data.ride); setMessage("Ride requested. Waiting for a driver to accept.");
      socket.emit("ride:watch", { rideId: data.ride._id });
      await load();
    } catch (err) { setMessage(err.response?.data?.message || "Could not request ride"); }
  }
  function chooseDestination(e) {
    const lat = Number(e.target.elements.destLat.value);
    const lng = Number(e.target.elements.destLng.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setMessage("Enter valid destination coordinates."); return;
    }
    setDestination({ lat, lng }); setMessage("Destination saved.");
  }

  const center = position || drivers[0]?.location || DEFAULT_CENTER;
  const active = ride && ["requested", "accepted", "started"].includes(ride.status);
  const trackedDriver = ride?.driver?.location?.lat != null ? ride.driver.location : null;
  return <div className="dashboard-grid">
    <section className="panel map-panel">
      <div className="panel-heading"><div><p className="eyebrow">PASSENGER MODE</p><h2>Find your ride</h2></div><span className="status-pill online"><span />{drivers.length} online</span></div>
      <MapView center={center} drivers={drivers} pickup={position} destination={destination} trackedDriver={trackedDriver} />
      <div className="map-caption"><span className="pulse-dot" /> Live map · OpenStreetMap</div>
      <div className="action-row"><button className="secondary-btn" onClick={useGPS}>◎ Use my GPS for pickup</button><button className="primary-btn" onClick={requestRide} disabled={Boolean(active)}>Request a ride →</button></div>
      {message && <p className="notice">{message}</p>}
    </section>
    <aside className="side-column">
      <section className="panel">
        <p className="eyebrow">YOUR JOURNEY</p><h2>{active ? ride.status === "requested" ? "Finding your driver" : ride.status === "accepted" ? "Driver assigned" : "You're on your way" : "Plan a ride"}</h2>
        {active && <><p className="muted">Status: <strong>{ride.status}</strong></p><p className="muted">Driver: {ride.driver?.name || "Searching for a driver…"}</p></>}
        <form className="form-stack compact" onSubmit={e => { e.preventDefault(); chooseDestination(e); }}>
          <label>Destination latitude<input name="destLat" type="number" step="any" placeholder="e.g. 23.2156" required /></label>
          <label>Destination longitude<input name="destLng" type="number" step="any" placeholder="e.g. 77.4010" required /></label>
          <button className="secondary-btn">Set destination coordinates</button>
        </form>
        <p className="tiny muted">For this MVP, destination is entered as GPS coordinates. A searchable address field can be added with a geocoding provider.</p>
      </section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">NEARBY</p><h2>Online drivers</h2></div><span className="count-badge">{drivers.length}</span></div>
        {drivers.length ? drivers.map(d => <div className="driver-row" key={d.id}><div className="avatar">{d.name?.[0]?.toUpperCase() || "D"}</div><div><strong>{d.name}</strong><p className="muted tiny">Driver · Online</p></div><span className="pulse-dot" /></div>) : <p className="empty-state">No online drivers with GPS yet.</p>}
      </section>
      <section className="panel"><p className="eyebrow">RECENT RIDES</p>
        {rides.slice(0, 4).map(r => <div className="history-row" key={r._id}><span>{r.status}</span><span className="muted tiny">{new Date(r.createdAt).toLocaleDateString()}</span></div>)}
        {!rides.length && <p className="empty-state">Your rides will appear here.</p>}
      </section>
    </aside>
  </div>;
}
