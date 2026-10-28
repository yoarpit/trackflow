import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

const driverIcon = new L.DivIcon({
  className: "driver-marker",
  html: '<div class="car-pin">🚗</div>',
  iconSize: [38, 38],
  iconAnchor: [19, 19]
});
const pinIcon = new L.DivIcon({
  className: "place-marker",
  html: '<div class="place-pin">●</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

function Recenter({ point }) {
  const map = useMap();
  useEffect(() => { if (point) map.setView([point.lat, point.lng], Math.max(map.getZoom(), 14)); }, [point?.lat, point?.lng, map]);
  return null;
}

export default function MapView({ center, drivers = [], pickup, destination, trackedDriver }) {
  const route = [pickup, destination].filter(Boolean).map(p => [p.lat, p.lng]);
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} scrollWheelZoom className="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter point={trackedDriver || center} />
      {drivers.map(d => d.location && (
        <Marker key={d.id} position={[d.location.lat, d.location.lng]} icon={driverIcon}>
          <Popup>{d.name || "Driver"} · {d.isOnline ? "Online" : "Offline"}</Popup>
        </Marker>
      ))}
      {trackedDriver && (
        <Marker position={[trackedDriver.lat, trackedDriver.lng]} icon={driverIcon}>
          <Popup>Assigned driver</Popup>
        </Marker>
      )}
      {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pinIcon}><Popup>Pickup</Popup></Marker>}
      {destination && <Marker position={[destination.lat, destination.lng]} icon={pinIcon}><Popup>Destination</Popup></Marker>}
      {route.length === 2 && <Polyline positions={route} pathOptions={{ color: "#7c5cff", weight: 4, dashArray: "8 8" }} />}
    </MapContainer>
  );
}
