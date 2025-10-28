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
import { fetchIndoorPlayplaces } from "../data/fetchIndoorPlayplaces";
import haversine from "haversine-distance";

const defaultCenter = { lat: 40.815, lng: -73.22 };

export default function MapPage() {
  const [parks, setParks] = useState([]);
  const [selectedPark, setSelectedPark] = useState(null);
  const [center, setCenter] = useState(defaultCenter);
  const [showAll, setShowAll] = useState(false);
  const mapRef = useRef(null);
  const location = useLocation();

  const activeFilters = location.state?.filters || [];
  const playMode = location.state?.playMode || "outdoor"; // indoor or outdoor

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  /* ---------- Load Data ---------- */
  useEffect(() => {
    const loadData = async () => {
      try {
        const data =
          playMode === "indoor"
            ? await fetchIndoorPlayplaces()
            : await fetchPlaygrounds();

        console.log(`✅ Loaded ${playMode} places:`, data.length);
        setParks(data);
      } catch (err) {
        console.error(`❌ Error loading ${playMode} data:`, err);
      }
    };

    loadData();
  }, [playMode]);

  /* ---------- Center on user ---------- */
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

  /* ---------- Distance Helper ---------- */
  const distanceMiles = (a, b) => haversine(a, b) / 1609.34;

  /* ---------- Feature Check ---------- */
  const hasFeature = (p, key) => {
    const val = String(p[key] || p[`${key}Allowed`] || "").trim().toLowerCase();
    if (key === "lighting") {
      if (["yes", "true", "✅", "full"].includes(val)) return 1;
      if (["some", "partial"].includes(val)) return 0.5;
      return 0;
    }
    return ["true", "yes", "y", "1", "✅"].includes(val);
  };

  /* ---------- Ranking ---------- */
  const rankedParks = parks
    .map((p) => {
      const parkCoords = { lat: Number(p.lat), lng: Number(p.lng) };
      const userCoords = center;
      const dist = distanceMiles(parkCoords, userCoords);

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
    .filter((p) => p && p.distance <= 25)
    .sort((a, b) => b.matchPercent - a.matchPercent || a.distance - b.distance);

  /* ---------- Marker Click ---------- */
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

  /* ---------- Marker Style ---------- */
  const getMarkerWrapperStyle = (park) => ({
    transform: "translate(-50%, -50%)",
    cursor: "pointer",
    zIndex: selectedPark?.id === park.id ? 9999 : 1,
    filter:
      selectedPark?.id === park.id
        ? "drop-shadow(0 0 8px gold)"
        : "drop-shadow(0 0 3px rgba(0,0,0,0.25))",
  });

  /* ---------- Visible Parks ---------- */
  const visibleParks = showAll ? rankedParks : rankedParks.slice(0, 10);

  /* ---------- Render ---------- */
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#b7f3da] via-[#c7e9f9] to-[#9fd3f7] text-[#0e3325] font-[Nunito]">
      {/* Header */}
      <header className="text-center pt-6 pb-3">
        <h1 className="text-3xl font-extrabold tracking-tight">PlayGrounded</h1>
        <p className="text-sm opacity-80">
          {playMode === "indoor"
            ? "Showing indoor play spaces nearby!"
            : "Showing outdoor playgrounds nearby!"}
        </p>
        {activeFilters.length > 0 && (
          <p className="text-xs mt-2 opacity-70">
            Ranked by: {activeFilters.join(", ")} (within 25 miles)
          </p>
        )}
      </header>

      {/* Map */}
      <div className="flex justify-center mt-4">
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
                    featureType: "poi",
                    elementType: "labels.icon",
                    stylers: [{ visibility: "off" }],
                  },
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
              {visibleParks.map((p, i) => {
                const lat = Number(p.lat);
                const lng = Number(p.lng);
                if (isNaN(lat) || isNaN(lng)) return null;

                const isIndoor = playMode === "indoor";

                return (
                  <OverlayView
                    key={p.id || i}
                    position={{ lat, lng }}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  >
                    <div
                      style={getMarkerWrapperStyle(p)}
                      onClick={() => handleMarkerClick(p)}
                      title={p.name}
                    >
                      {isIndoor ? (
                        // 🏠 Pink house marker for indoor spaces
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="28"
                          height="28"
                          fill="#f06292"
                          stroke="#fff"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            borderRadius: "50%",
                            background: "white",
                            boxShadow: "0 0 10px rgba(240,98,146,0.7)",
                            padding: "3px",
                          }}
                        >
                          <path d="M12 3L2 10h3v8h6v-5h2v5h6v-8h3L12 3z" />
                        </svg>
                      ) : (
                        // ☀️ Glowing sun marker for outdoor parks
                        <img
                          src="/icons/sunMarker.png"
                          alt="Outdoor Marker"
                          width={36}
                          height={36}
                          style={{
                            filter:
                              "drop-shadow(0 0 8px rgba(255,193,7,0.9))",
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                      )}
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
      <div className="px-4 py-6 grid gap-6 max-w-6xl mx-auto">
        {visibleParks.map((p) => (
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

      {/* Show More Button */}
      {!showAll && rankedParks.length > 10 && (
        <div className="w-full flex justify-center mt-10 mb-10">
          <button
            onClick={() => setShowAll(true)}
            className="px-8 py-3 rounded-full text-sm font-semibold text-[#0a2540]
                       bg-white border border-[#aacbff] shadow-md
                       hover:bg-[#e6f4ff] hover:shadow-lg transition-all duration-200"
          >
            Show More {playMode === "indoor" ? "Play Spaces" : "Parks"} (
            {rankedParks.length - 10} more)
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-[11px] px-4 pb-6 opacity-70">
        {playMode === "indoor"
          ? "Parent tips, deals, and events vary by play space — check websites before visiting."
          : "Live Look updates every few minutes from local parents — please verify conditions on arrival."}
      </footer>
    </div>
  );
}
