// src/pages/MapPage.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  OverlayView,
  useJsApiLoader,
} from "@react-google-maps/api";
import { useLocation } from "react-router-dom";
import ParkCard from "../components/ParkCard.jsx";
import { fetchPlaygrounds } from "../data/fetchPlaygrounds";
import haversine from "haversine-distance";

const defaultCenter = { lat: 40.815, lng: -73.22 };

export default function MapPage() {
  const [parks, setParks] = useState([]);
  const [selectedPark, setSelectedPark] = useState(null);
  const [center, setCenter] = useState(defaultCenter);
  const mapRef = useRef(null);
  const location = useLocation();
  const activeFilters = location.state?.filters || [];

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // 🎡 Load playground data
  useEffect(() => {
    fetchPlaygrounds()
      .then((data) => {
        console.log("✅ Loaded parks:", data.length);
        setParks(data);
      })
      .catch(console.error);
  }, []);

  // 📍 Center on user
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCenter({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  // 🗺️ Fit bounds to parks
  useEffect(() => {
    if (parks.length && mapRef.current && window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      parks.forEach((p) => {
        const lat = Number(p.lat);
        const lng = Number(p.lng);
        if (!isNaN(lat) && !isNaN(lng)) bounds.extend({ lat, lng });
      });
      mapRef.current.fitBounds(bounds);
    }
  }, [parks]);

  // 💬 Marker click handler
  const handleMarkerClick = (park) => {
    setSelectedPark(park);
    if (mapRef.current) {
      mapRef.current.panTo({ lat: Number(park.lat), lng: Number(park.lng) });
      mapRef.current.setZoom(14);
    }
    setTimeout(() => {
      const el = document.getElementById(`park-${park.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
  };

  // ⚙️ Feature helper
  const hasFeature = (p, key) => {
    const val = String(p[key] || p[`${key}Allowed`] || "").trim().toLowerCase();

    // Lighting gets special logic
    if (key === "lighting") {
      if (["yes", "true", "✅", "full"].includes(val)) return 1; // full lighting
      if (["some", "partial"].includes(val)) return 0.5; // half match
      if (["no", "none", "dark"].includes(val)) return 0;
      return 0;
    }

    return ["true", "yes", "y", "1", "✅", "checked"].includes(val);
  };

  // 📏 Distance helper (meters → miles)
  const distanceMiles = (a, b) => haversine(a, b) / 1609.34;

  // 🧩 Compute match + distance
  const rankedParks = parks
    .map((p) => {
      const parkCoords = { lat: Number(p.lat), lng: Number(p.lng) };
      const userCoords = center;
      const dist = distanceMiles(parkCoords, userCoords);

      // skip invalid coords
      if (isNaN(parkCoords.lat) || isNaN(parkCoords.lng)) return null;

      const selectedCount = activeFilters.length;
      let score = 0;

      activeFilters.forEach((f) => {
        const val = hasFeature(p, f);
        if (val === 1) score += 1;
        else if (val === 0.5) score += 0.5;
      });

      const matchPercent =
        selectedCount > 0 ? Math.round((score / selectedCount) * 100) : 100;

      return { ...p, matchPercent, distance: dist };
    })
    .filter((p) => p && p.distance <= 15) // within 15 miles
    .sort((a, b) => b.matchPercent - a.matchPercent || a.distance - b.distance);

  // ☀️🏠 Emoji marker style
  const getMarkerStyle = (park) => ({
    fontSize: "20px",
    transform: "translate(-50%, -50%)",
    cursor: "pointer",
    zIndex: 9999,
    textShadow: "0 0 3px white",
  });

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#b7f3da] via-[#c7e9f9] to-[#9fd3f7] text-[#0e3325] font-[Nunito]">
      <header className="relative text-center pt-6 pb-3">
        <h1 className="text-3xl font-extrabold tracking-tight">PlayGrounded</h1>
        <p className="text-sm opacity-80">
          Find the best places to play — ranked by your needs and nearby distance.
        </p>
        {activeFilters.length > 0 && (
          <p className="text-xs mt-2 opacity-70">
            Showing within 15 miles, ranked by match:{" "}
            {activeFilters.join(", ")}
          </p>
        )}
      </header>

      {/* Map */}
      <div className="relative flex justify-center mt-4">
        <div className="relative w-11/12 max-w-3xl aspect-square rounded-3xl overflow-hidden bg-white/90 backdrop-blur-md shadow-[0_10px_35px_rgba(0,0,0,0.15)] border border-white/50">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={center}
              zoom={11}
              onLoad={(map) => (mapRef.current = map)}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                styles: [
                  {
                    featureType: "poi.park",
                    elementType: "geometry.fill",
                    stylers: [{ color: "#D7F4DE" }],
                  },
                  {
                    featureType: "water",
                    elementType: "geometry.fill",
                    stylers: [{ color: "#DCEEFE" }],
                  },
                ],
              }}
            >
              {rankedParks.map((p, i) => {
                const lat = Number(p.lat);
                const lng = Number(p.lng);
                if (isNaN(lat) || isNaN(lng)) return null;

                const isIndoor = String(p.indoorPlayArea)
                  .trim()
                  .toLowerCase()
                  .includes("yes");
                const emoji = isIndoor ? "🏠" : "☀️";

                return (
                  <OverlayView
                    key={p.id || i}
                    position={{ lat, lng }}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  >
                    <div
                      style={getMarkerStyle(p)}
                      onClick={() => handleMarkerClick(p)}
                      title={p.name}
                    >
                      {emoji}
                    </div>
                  </OverlayView>
                );
              })}
            </GoogleMap>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm opacity-70">
              Loading map…
            </div>
          )}
        </div>
      </div>

      {/* Park Cards */}
      <div className="relative px-4 py-6 grid gap-6 max-w-6xl mx-auto">
        {rankedParks.map((p) => (
          <div
            key={p.id}
            id={`park-${p.id}`}
            className={
              selectedPark?.id === p.id
                ? "ring-2 ring-pink-300 rounded-3xl"
                : ""
            }
          >
            <ParkCard park={p} isSelected={selectedPark?.id === p.id} />
          </div>
        ))}
      </div>

      <footer className="relative text-center text-[11px] px-4 pb-6 opacity-70">
        Live Look is community-reported. Please verify conditions.
      </footer>
    </div>
  );
}
