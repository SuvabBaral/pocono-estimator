import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

const pin = (emoji, color) =>
  L.divIcon({
    className: "pin-wrap",
    html: `<div class="pin" style="background:${color}"><span>${emoji}</span></div>`,
    iconSize: [38, 46],
    iconAnchor: [19, 44],
    popupAnchor: [0, -40],
  });

function Fit({ points }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(L.latLngBounds(points), { padding: [50, 50], animate: true, duration: 1.1 });
    setTimeout(() => map.invalidateSize(), 300);
  }, [map, points]);
  return null;
}

export default function PropertyMap({ property, plaza }) {
  const home = [plaza.home.lat, plaza.home.lon];
  const shop = [plaza.plaza.lat, plaza.plaza.lon];
  const line = plaza.route || [home, shop];
  return (
    <div className="map">
      <MapContainer center={home} zoom={13} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={line} pathOptions={{ color: "#6366f1", weight: 5, opacity: 0.85, dashArray: plaza.route ? null : "8 8" }} className="route" />
        <Marker position={home} icon={pin("🏡", "#6366f1")}><Popup><b>{property.address}</b></Popup></Marker>
        <Marker position={shop} icon={pin("🛒", "#f59e0b")}>
          <Popup><b>{plaza.plaza.name}</b><br />{plaza.driveMiles ?? plaza.straightMiles} mi</Popup>
        </Marker>
        <Fit points={line} />
      </MapContainer>
    </div>
  );
}
