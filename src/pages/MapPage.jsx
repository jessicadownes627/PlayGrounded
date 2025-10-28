// src/pages/MapPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const [amenityFilter, setAmenityFilter] = useState(null);
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
  const radiusSetting = Number(import.meta.env.VITE_DEFAULT_RADIUS_MILES);
  const maxRadiusMiles = Number.isFinite(radiusSetting) && radiusSetting > 0 ? radiusSetting : 25;

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
    .filter((p) => {
      if (!p) return false;
      if (!Number.isFinite(maxRadiusMiles)) return true;
      return p.distance <= maxRadiusMiles;
    })
    .sort((a, b) => b.matchPercent - a.matchPercent || a.distance - b.distance);

  const getParkDomId = (park) => {
    const prime =
      (park?.id && String(park.id)) ||
      (park?.name && String(park.name)) ||
      `${park?.lat || "lat"}-${park?.lng || "lng"}`;
    const cleaned = String(prime)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    return `park-${cleaned || "unknown"}`;
  };

  /* ---------- Marker Click ---------- */
  const handleMarkerClick = (park) => {
    setSelectedPark(park);
    const targetId = getParkDomId(park);
    const isAlreadyVisible =
      showAll ||
      visibleParks.some((candidate) => String(candidate.id) === String(park.id));

    if (!isAlreadyVisible) {
      setShowAll(true);
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 450);
    } else {
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
    }
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

  const amenityDefinitions = useMemo(
    () => [
      { id: "shade", label: "Shade", get: (p) => p.shade },
      { id: "bathrooms", label: "Bathrooms", get: (p) => p.bathrooms },
      { id: "parking", label: "Parking", get: (p) => p.parking || p.parkingNotes },
      { id: "seating", label: "Seating", get: (p) => p.seating },
      { id: "fenced", label: "Fenced", get: (p) => p.fenced },
      { id: "dogsAllowed", label: "Dogs OK", get: (p) => p.dogsAllowed },
      { id: "adaptiveEquipment", label: "Inclusive", get: (p) => p.adaptiveEquipment },
      { id: "lighting", label: "Lighting", get: (p) => p.lighting },
    ],
    []
  );

  const hasAmenity = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "boolean") return value;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return false;
    return !["no", "none", "not available", "n/a", "false"].includes(normalized);
  };

  const amenityStats = useMemo(() => {
    if (!rankedParks.length) return [];
    return amenityDefinitions
      .map((def) => {
        const count = rankedParks.reduce(
          (sum, park) => sum + (hasAmenity(def.get?.(park)) ? 1 : 0),
          0
        );
        const pct = count > 0 ? Math.round((count / rankedParks.length) * 100) : 0;
        return { ...def, count, pct };
      })
      .filter((stat) => stat.count > 0);
  }, [rankedParks, amenityDefinitions]);

  const activeAmenity = amenityDefinitions.find((a) => a.id === amenityFilter) || null;

  const handleAmenityToggle = (id) => {
    setAmenityFilter((prev) => (prev === id ? null : id));
    setShowAll(false);
  };

  const filteredParks = activeAmenity
    ? rankedParks.filter((park) => hasAmenity(activeAmenity.get?.(park)))
    : rankedParks;

  const cardSource = amenityFilter ? filteredParks : rankedParks;
  const cardsTotal = cardSource.length;
  const visibleParks = showAll ? cardSource : cardSource.slice(0, 10);
  const mapParks = rankedParks;

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
            Ranked by: {activeFilters.join(", ")} (within {Math.round(maxRadiusMiles)} miles)
          </p>
        )}
      </header>

      <section className="flex flex-col gap-4 mt-4 px-4 md:px-6 lg:flex-row lg:items-stretch lg:justify-center">
        <div className="flex-1 flex justify-center">
          <div className="relative w-full max-w-3xl aspect-square rounded-3xl overflow-hidden bg-white/90 backdrop-blur-md shadow-[0_10px_35px_rgba(0,0,0,0.15)] border border-white/50">
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
                {mapParks.map((p, i) => {
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
                            width="24"
                            height="24"
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
                            width={28}
                            height={28}
                            style={{
                              filter: "drop-shadow(0 0 6px rgba(255,193,7,0.8))",
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

        {amenityStats.length > 0 && (
          <aside className="w-full max-w-3xl mx-auto lg:max-w-sm">
            <div className="bg-white/85 backdrop-blur-md border border-white/60 rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-5 h-full flex flex-col">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-[#0a2540]">
                  🧺 Amenities Snapshot
                </h2>
                <p className="text-[11px] text-gray-500">
                  {filteredParks.length} {filteredParks.length === 1 ? "park" : "parks"} in view
                </p>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Tap a bar to show only parks with that amenity.
              </p>
              {activeAmenity && (
                <div className="mt-2 flex items-center justify-between text-[11px] text-[#0a2540]">
                  <span>
                    Filtering by <strong>{activeAmenity.label}</strong>
                  </span>
                  <button
                    onClick={() => setAmenityFilter(null)}
                    className="text-[#0a6cff] underline underline-offset-2 hover:text-[#0647a6] transition"
                  >
                    Clear filter
                  </button>
                </div>
              )}
              <div className="mt-4 space-y-3">
                {amenityStats.map((stat) => (
                  <button
                    key={stat.id}
                    type="button"
                    onClick={() => handleAmenityToggle(stat.id)}
                    aria-pressed={amenityFilter === stat.id}
                    className={`w-full text-left rounded-xl px-3 py-2 transition ${
                      amenityFilter === stat.id
                        ? "bg-[#e2f3fb] ring-1 ring-[#5fa8ff]"
                        : "hover:bg-white/70 cursor-pointer"
                    }`}
                  >
                    <div className="flex justify-between text-[11px] text-[#0a2540] mb-1">
                      <span>{stat.label}</span>
                      <span className="text-gray-500">
                        {stat.count} ({stat.pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#d8ebff] overflow-hidden">
                      <div
                        className={`h-full ${
                          amenityFilter === stat.id
                            ? "bg-gradient-to-r from-[#5fa8ff] to-[#9d5cff]"
                            : "bg-gradient-to-r from-[#8ec5fc] to-[#e0c3fc]"
                        }`}
                        style={{
                          width: `${Math.min(Math.max(stat.pct, 6), 100)}%`,
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}
      </section>

      {/* Park Cards */}
      <section className="px-4 pt-6 max-w-6xl mx-auto">
        <div className="bg-white/85 backdrop-blur-md border border-white/60 rounded-3xl shadow-[0_8px_18px_rgba(0,0,0,0.08)] p-4 mb-6 text-center">
          <p className="text-sm font-semibold text-[#0a2540]">
            {amenityFilter && activeAmenity
              ? `Showing nearby parks with ${activeAmenity.label.toLowerCase()}`
              : "Closest parks first—scroll the cards to pick your play spot today."}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            Tap a card to highlight it on the map, or use Live Look to see crowd updates in real time.
          </p>
        </div>
        <div className="grid gap-6">
          {visibleParks.map((p) => {
            const domId = getParkDomId(p);
            return (
              <div
                key={p.id || domId}
                id={domId}
                className={
                  selectedPark?.id === p.id
                    ? "ring-2 ring-pink-300 rounded-3xl"
                    : ""
                }
              >
                <ParkCard park={p} isSelected={selectedPark?.id === p.id} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Show More Button */}
      {!showAll && filteredParks.length > 10 && (
        <div className="w-full flex justify-center mt-10 mb-10">
          <button
            onClick={() => setShowAll(true)}
            className="px-8 py-3 rounded-full text-sm font-semibold text-[#0a2540]
                       bg-white border border-[#aacbff] shadow-md
                       hover:bg-[#e6f4ff] hover:shadow-lg transition-all duration-200"
          >
            Show More {playMode === "indoor" ? "Play Spaces" : "Parks"} (
            {filteredParks.length - 10} more)
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
