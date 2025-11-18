// src/pages/MapPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleMap,
  OverlayView,
  Circle,
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
  const [mapAlertTone, setMapAlertTone] = useState(null);
  const defaultRadiusSetting = Number(import.meta.env.VITE_DEFAULT_RADIUS_MILES);
  const fallbackRadius = Number.isFinite(defaultRadiusSetting) && defaultRadiusSetting > 0 ? defaultRadiusSetting : 25;
  const [showAll, setShowAll] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(fallbackRadius);
  const [amenityFilters, setAmenityFilters] = useState([]);
  const [zoom, setZoom] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [parkAlerts, setParkAlerts] = useState({});
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const lastFitRef = useRef({ lat: null, lng: null, radius: null });
  const location = useLocation();

  const activeFilters = location.state?.filters || [];
  const initialPlayMode =
    location.state?.playMode ||
    (typeof window !== "undefined"
      ? localStorage.getItem("goplay_mode") || "outdoor"
      : "outdoor");
  const [playMode, setPlayMode] = useState(initialPlayMode); // indoor or outdoor
  const isIndoorMode = playMode === "indoor";

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("goplay_mode", playMode);
    }
  }, [playMode]);

  useEffect(() => {
    setSelectedPark(null);
    setShowAll(false);
  }, [playMode]);

  const handlePlayModeChange = (mode) => {
    if (mode === playMode) return;
    setPlayMode(mode);
  };

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
      (pos) => {
        const nextCenter = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCenter(nextCenter);
        const closerZoom = 11;
        setZoom((prev) => Math.max(prev, closerZoom));
        if (mapRef.current) {
          mapRef.current.panTo(nextCenter);
          mapRef.current.setZoom(closerZoom);
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  /* ---------- Fit Radius Ring ---------- */
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;

    const radius = Math.max(radiusMiles, 0.5);
    const last = lastFitRef.current;
    if (
      last.lat === center.lat &&
      last.lng === center.lng &&
      Math.abs((last.radius ?? 0) - radius) < 0.01
    ) {
      return;
    }

    const lat = center.lat;
    const lng = center.lng;
    const milesPerDegreeLat = 69.0;
    const milesPerDegreeLng = Math.cos((lat * Math.PI) / 180) * 69.172;
    const latDelta = radius / milesPerDegreeLat;
    const lngDelta = radius / (Math.abs(milesPerDegreeLng) < 0.0001 ? milesPerDegreeLat : milesPerDegreeLng);

    const bounds = new window.google.maps.LatLngBounds(
      { lat: lat - latDelta, lng: lng - lngDelta },
      { lat: lat + latDelta, lng: lng + lngDelta }
    );

    const map = mapRef.current;
    map.fitBounds(bounds);

    const currentZoom = map.getZoom();
    if (currentZoom > 14) map.setZoom(14);

    lastFitRef.current = { lat, lng, radius };
  }, [center.lat, center.lng, radiusMiles, isLoaded]);

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
  const maxRadiusMiles = Number.isFinite(radiusMiles) && radiusMiles > 0 ? radiusMiles : fallbackRadius;

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

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const nounSingular = isIndoorMode ? "play space" : "park";
  const nounPlural = isIndoorMode ? "play spaces" : "parks";
  const nounPluralCapitalized = isIndoorMode ? "Play Spaces" : "Parks";

  const searchFiltered = useMemo(() => {
    if (!normalizedQuery) return rankedParks;
    return rankedParks.filter((park) =>
      park?.name?.toLowerCase().includes(normalizedQuery)
    );
  }, [rankedParks, normalizedQuery]);
  const searchMatchesCount = searchFiltered.length;

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

  const focusMapOnPark = (park, { scrollMap = false } = {}) => {
    setSelectedPark(park);
    const map = mapRef.current;
    const lat = Number(park?.lat);
    const lng = Number(park?.lng);

    if (map && Number.isFinite(lat) && Number.isFinite(lng)) {
      const target = { lat, lng };
      map.panTo(target);
      const currentZoom = map.getZoom();
      if (typeof currentZoom === "number" && currentZoom < 13) {
        map.setZoom(13);
      }
    }

    if (scrollMap && mapContainerRef.current) {
      mapContainerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  /* ---------- Marker Click ---------- */
  const handleMarkerClick = (park) => {
    focusMapOnPark(park);
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

    setSelectedPark(park);
    const alert = parkAlerts[park?.id];
    setMapAlertTone(alert?.hasConcerns ? "concern" : null);
  };
  const handleLiveSignalsUpdate = useCallback((parkId, updates = {}) => {
    if (!parkId) return;
    setParkAlerts((prev) => {
      const prevMeta = prev[parkId] || {};
      const nextMeta = { ...prevMeta, ...updates };
      if (prevMeta.hasConcerns === nextMeta.hasConcerns) return prev;
      return { ...prev, [parkId]: nextMeta };
    });
  }, []);

  const handleCardSelect = (park, meta = {}) => {
    if (!park) return;
    setSelectedPark(park);
    focusMapOnPark(park, { scrollMap: true });
    const hasConcerns =
      meta?.hasConcerns ?? parkAlerts[park?.id]?.hasConcerns ?? false;
    setMapAlertTone(hasConcerns ? "concern" : null);
  };

  useEffect(() => {
    if (!selectedPark?.id) return;
    const alert = parkAlerts[selectedPark.id];
    setMapAlertTone(alert?.hasConcerns ? "concern" : null);
  }, [selectedPark, parkAlerts]);

  /* ---------- Marker Style ---------- */
  const getMarkerWrapperStyle = (park, { dimmed = false } = {}) => {
    const baseTransform = "translate(-50%, -50%)";
    return {
      transform:
        selectedPark?.id === park.id
          ? `${baseTransform} scale(1.1)`
          : dimmed
          ? `${baseTransform} scale(0.9)`
          : baseTransform,
      cursor: "pointer",
      opacity: selectedPark?.id === park.id ? 1 : dimmed ? 0.4 : 1,
      zIndex: selectedPark?.id === park.id ? 9999 : dimmed ? 0 : 1,
      filter:
        selectedPark?.id === park.id
          ? "drop-shadow(0 0 12px rgba(106,0,244,0.9))"
          : dimmed
          ? "grayscale(0.4) drop-shadow(0 0 1px rgba(0,0,0,0.1))"
          : "drop-shadow(0 0 3px rgba(0,0,0,0.25))",
      transition: "all 0.2s ease",
    };
  };

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
    if (!searchFiltered.length) return [];
    return amenityDefinitions
      .map((def) => {
        const count = searchFiltered.reduce(
          (sum, park) => sum + (hasAmenity(def.get?.(park)) ? 1 : 0),
          0
        );
        const pct = count > 0 ? Math.round((count / searchFiltered.length) * 100) : 0;
        return { ...def, count, pct };
      })
      .filter((stat) => stat.count > 0);
  }, [searchFiltered, amenityDefinitions]);

  const activeAmenities = useMemo(
    () => amenityDefinitions.filter((a) => amenityFilters.includes(a.id)),
    [amenityDefinitions, amenityFilters]
  );

  const handleAmenityToggle = (id) => {
    setAmenityFilters((prev) => {
      const exists = prev.includes(id);
      if (exists) return prev.filter((item) => item !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
    setShowAll(false);
  };

  const handleRadiusChange = (event) => {
    const value = Number(event.target.value);
    if (Number.isFinite(value)) {
      setRadiusMiles(value);
      setShowAll(false);
    }
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setShowAll(false);
  };

  const handleSearchClear = () => {
    setSearchQuery("");
    setShowAll(false);
  };

  const filterLabelMap = useMemo(
    () => ({
      fenced: "Fenced in",
      dogs: "Allows dogs",
      bathrooms: "Bathrooms",
      shade: "Shade",
      parking: "Easy parking",
      lighting: "Lighting",
      adaptiveEquipment: "Adaptive equipment",
      indoorPlayArea: "Indoor play area",
    }),
    []
  );

  const filteredParks = useMemo(() => {
    if (!amenityFilters.length) return searchFiltered;
    if (!activeAmenities.length) return [];
    return searchFiltered.filter((park) =>
      activeAmenities.every((amenity) => hasAmenity(amenity.get?.(park)))
    );
  }, [searchFiltered, amenityFilters, activeAmenities]);

  const cardSource = filteredParks;
  const cardsTotal = cardSource.length;
  const visibleParks = showAll ? cardSource : cardSource.slice(0, 10);
  const mapParks = searchFiltered;
  const matchesCount = rankedParks.length;
  const highlightedCount = filteredParks.length;
  const showingCount = visibleParks.length;
  const mustHaveLabels = useMemo(
    () => activeFilters.map((key) => filterLabelMap[key] || key),
    [activeFilters, filterLabelMap]
  );

  /* ---------- Render ---------- */
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#b7f3da] via-[#c7e9f9] to-[#9fd3f7] text-[#0e3325] font-[Nunito]">
      {/* Header */}
      <header className="text-center pt-6 pb-3">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="text-[#f06292]">Go</span>
          <span className="text-[#f97316]">Play</span>
          <span>There</span>
        </h1>
        <p className="text-sm opacity-80">
          {playMode === "indoor"
            ? "Curated indoor play spaces from Long Island parents."
            : "Fresh outdoor park intel for wherever you roam."}
        </p>
        {activeFilters.length > 0 && !isIndoorMode && (
          <p className="text-xs mt-2 opacity-70">
            Ranked by: {activeFilters.join(", ")} (within {Math.round(maxRadiusMiles)} miles)
          </p>
        )}
      </header>

      <div className="mt-4 px-4 md:px-6">
        <div className="relative max-w-3xl mx-auto">
          <input
            value={searchQuery}
            onChange={handleSearchChange}
            type="search"
            placeholder={`Search by ${nounSingular} name`}
            className="w-full rounded-full border border-[#aacbff] bg-white/90 px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5fa8ff] focus:border-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleSearchClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#0a6cff] hover:text-[#0647a6]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 px-4 md:px-6">
        <div className="max-w-3xl mx-auto flex justify-center gap-3">
          {[
            { key: "outdoor", label: "Outdoor Parks", emoji: "🛝" },
            { key: "indoor", label: "Indoor Play", emoji: "🏠" },
          ].map((mode) => {
            const isActive = playMode === mode.key;
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => handlePlayModeChange(mode.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-[#f06292] text-white shadow-[0_6px_16px_rgba(240,98,146,0.3)]"
                    : "bg-white/80 text-[#b84b74] border border-[#f8b4c8] hover:bg-white"
                }`}
              >
                <span>{mode.emoji}</span>
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 px-4 md:px-6">
        <div className="max-w-3xl mx-auto rounded-3xl border border-[#fed7aa] bg-gradient-to-r from-[#fff7ed] via-[#fff1e1] to-[#ffe4d3] px-6 py-4 text-center text-sm text-[#8a3a0a] shadow-[0_10px_30px_rgba(255,122,0,0.15)]">
          <span className="font-bold uppercase tracking-wide text-[#fb923c]">
            Know of another great place to play?
          </span>{" "}
          Email us at{" "}
          <a
            href="mailto:goplaythere@gmail.com"
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#ea580c] shadow-sm transition hover:bg-[#ffe8d0]"
          >
            goplaythere@gmail.com
            <span aria-hidden="true">↗</span>
          </a>
          .
        </div>
      </div>

      <section className="flex flex-col gap-4 mt-4 px-4 md:px-6 lg:flex-row lg:items-stretch lg:justify-center">
        <div className="flex-1 flex justify-center">
          <div
            ref={mapContainerRef}
            className={`relative w-full max-w-3xl aspect-square rounded-3xl overflow-hidden bg-white/90 backdrop-blur-md shadow-[0_10px_35px_rgba(0,0,0,0.15)] transition-shadow duration-300 ${
              mapAlertTone === "concern"
                ? "border-2 border-[#f472b6] ring-4 ring-[#ec4899]/60 ring-offset-4 ring-offset-white shadow-[0_0_28px_rgba(236,72,153,0.35)]"
                : "border border-white/50"
            }`}
          >
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={center}
                zoom={zoom}
                onLoad={(map) => {
                  mapRef.current = map;
                  map.setZoom(zoom);
                }}
                onZoomChanged={() => {
                  const current = mapRef.current?.getZoom();
                  if (typeof current === "number") setZoom(current);
                }}
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
              <Circle
                center={center}
                radius={Math.max(radiusMiles, 1) * 1609.34}
                options={{
                  strokeColor: "#6a00f4",
                  strokeOpacity: 0.4,
                  strokeWeight: 1.5,
                  fillColor: "#6a00f4",
                  fillOpacity: 0.05,
                }}
              />

              {mapParks.map((p, i) => {
                const lat = Number(p.lat);
                const lng = Number(p.lng);
                if (isNaN(lat) || isNaN(lng)) return null;

                const isIndoor = playMode === "indoor";
                const isAmenityMatch =
                  !amenityFilters.length ||
                  activeAmenities.every((amenity) => hasAmenity(amenity.get?.(p)));
                const markerKey = p.id ? `${p.id}-${i}` : `${lat}-${lng}-${i}`;

                return (
                  <OverlayView
                    key={markerKey}
                    position={{ lat, lng }}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  >
                    <div
                      style={getMarkerWrapperStyle(p, {
                        dimmed: amenityFilters.length > 0 && !isAmenityMatch,
                      })}
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
            <div className="w-full h-full flex flex-col items-center justify-center text-sm opacity-70 gap-1">
              <span className="text-base font-semibold text-[#6a00f4]">Hey! Hang tight…</span>
              <span>Loading the map.</span>
            </div>
          )}
        </div>
      </div>

        <aside className="w-full max-w-3xl mx-auto lg:max-w-sm">
          <div className="flex flex-col gap-4 h-full">
            <div className="bg-white/90 backdrop-blur-md border border-white/60 rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-[#0a2540]">🧭 Plan Status</h2>
                <span className="text-[11px] text-gray-500">
                  Within {Math.round(maxRadiusMiles)} miles
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Tune your search radius and keep an eye on the parks that match your vibe.
              </p>

              <div className="mt-4">
                <label
                  htmlFor="radius-slider"
                  className="text-xs font-semibold text-[#0a2540] flex justify-between"
                >
                  <span>Search radius</span>
                  <span>{Math.round(radiusMiles)} miles</span>
                </label>
                <input
                  id="radius-slider"
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={radiusMiles}
                  onChange={handleRadiusChange}
                  className="w-full mt-2 accent-[#5fa8ff]"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>5 mi</span>
                  <span>50 mi</span>
                </div>
              </div>

              <div className="mt-4 text-xs text-[#0a2540] space-y-2">
                <p>
                  🎯 Must-haves:{" "}
                  {mustHaveLabels.length > 0 ? mustHaveLabels.join(", ") : "None selected"}
                </p>
                <p>🗺️ Matching parks: {matchesCount}</p>
                <p>
                  🔍 Search:{" "}
                  {normalizedQuery
                    ? `“${searchQuery.trim()}” — ${searchMatchesCount} match${
                        searchMatchesCount === 1 ? "" : "es"
                      }`
                    : "No search filter"}
                </p>
                <p>
                  ✨ Amenity focus:{" "}
                  {amenityFilters.length > 0
                    ? activeAmenities.map((a) => a.label).join(", ")
                    : "All amenities"}
                </p>
                <p>
                  📋 Showing {showingCount} of {cardsTotal} cards (
                  {highlightedCount} highlighted on the map)
                </p>
              </div>
              {amenityFilters.length > 0 && (
                <button
                  onClick={() => setAmenityFilters([])}
                  className="mt-4 text-[11px] text-[#0a6cff] underline underline-offset-2 hover:text-[#0647a6] transition"
                >
                  Clear amenity filters
                </button>
              )}
            </div>

            {amenityStats.length > 0 && (
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
                <div className="mt-4 space-y-3">
                  {amenityStats.map((stat) => {
                    const isActive = amenityFilters.includes(stat.id);
                    return (
                      <button
                        key={stat.id}
                        type="button"
                        onClick={() => handleAmenityToggle(stat.id)}
                        aria-pressed={isActive}
                        className={`w-full text-left rounded-xl px-3 py-2 transition ${
                          isActive
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
                              isActive
                                ? "bg-gradient-to-r from-[#5fa8ff] to-[#9d5cff]"
                                : "bg-gradient-to-r from-[#8ec5fc] to-[#e0c3fc]"
                            }`}
                            style={{
                              width: `${Math.min(Math.max(stat.pct, 6), 100)}%`,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>

      {/* Park Cards */}
      <section className="px-4 pt-6 max-w-6xl mx-auto">
        <div className="bg-white/85 backdrop-blur-md border border-white/60 rounded-3xl shadow-[0_8px_18px_rgba(0,0,0,0.08)] p-4 mb-6 text-center">
          <p className="text-sm font-semibold text-[#0a2540]">
            {amenityFilters.length > 0
              ? `Showing ${nounPlural} with ${activeAmenities
                  .map((a) => a.label.toLowerCase())
                  .join(" + ")}`
              : `Closest ${nounPlural} first—scroll the cards to pick your play spot today.`}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            Tap a card to highlight it on the map, or use Live Look to see crowd updates in real time.
          </p>
        </div>
        <div className="flex flex-col gap-10">
          {visibleParks.map((p, idx) => {
            const domId = getParkDomId(p);
            const cardKey = p.id ? `${p.id}-${idx}` : domId || idx;
            return (
              <ParkCard
                key={cardKey}
                park={p}
                domId={domId}
                isSelected={selectedPark?.id === p.id}
                onSelect={handleCardSelect}
                onLiveSignalsUpdate={handleLiveSignalsUpdate}
              />
            );
          })}
        </div>
      </section>

      {/* Show More Button */}
      {!showAll && cardsTotal > visibleParks.length && (
        <div className="w-full flex justify-center mt-10 mb-10">
          <button
            onClick={() => setShowAll(true)}
            className="px-8 py-3 rounded-full text-sm font-semibold text-[#0a2540]
                       bg-white border border-[#aacbff] shadow-md
                       hover:bg-[#e6f4ff] hover:shadow-lg transition-all duration-200"
          >
            Show More {playMode === "indoor" ? "Play Spaces" : "Parks"} (
            {cardsTotal - visibleParks.length} more)
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
