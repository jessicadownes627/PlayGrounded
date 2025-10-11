// src/components/MapView.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, InfoWindow, useLoadScript } from "@react-google-maps/api";
import { haversineMiles } from "../utils/haversine.js";
import { fetchPlaygrounds } from "../data/fetchPlaygrounds.js";
import PlaygroundCard from "./PlaygroundCard.jsx";

const containerStyle = { width: "100%", height: "70vh" };
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzogzlAz2GRh_v0LkOE9At6EAkAVy63fNBmK8EGbAN5FP09MY91-lB1lU_1V5mJJVCG/exec";

export default function MapView({ radiusMiles, filters }) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [all, setAll] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    fetchPlaygrounds().then(setAll).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("Location permission denied — use Explore radius to browse."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // --- Filter parks ---
  const filtered = useMemo(() => {
    if (!me) return [];
    return all
      .map((p) => ({ ...p, _dist: haversineMiles(me.lat, me.lng, p.lat, p.lng) }))
      .filter((p) => p._dist <= radiusMiles)
      .filter((p) => (filters.fenced === null || p.fenced === filters.fenced))
      .filter((p) => (filters.dogs === null || p.dogsAllowed === filters.dogs))
      .filter((p) => (filters.bathrooms === null || p.bathrooms === filters.bathrooms))
      .sort((a, b) => a._dist - b._dist);
  }, [all, me, radiusMiles, filters]);

  const center = me || { lat: 40.78, lng: -73.96 };

  // --- Send presence or feedback ---
  const sendPresence = useCallback(async (parkId) => {
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ parkId, signalType: "presence" }),
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.warn("Presence send failed:", err);
    }
  }, []);

  const sendFeedback = useCallback(async (parkId, value) => {
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ parkId, signalType: "feedback", value }),
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.warn("Feedback send failed:", err);
    }
  }, []);

  if (!isLoaded) return <div style={{ padding: 16 }}>Loading map…</div>;

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {error && <div className="card" style={{ marginBottom: 12 }}>{error}</div>}
      <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={me ? 12 : 10}>
        {me && <Marker position={me} options={{ title: "You are here" }} />}

        {filtered.map((p) => (
          <Marker
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            onClick={() => {
              setActive(p.id);
              sendPresence(p.id);
            }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: p.crowd?.color || "#2e7d32",
              fillOpacity: 1,
              strokeWeight: 1,
              strokeColor: "#fff",
            }}
          />
        ))}

        {active && (() => {
          const p = filtered.find((x) => x.id === active);
          if (!p) return null;

          return (
            <InfoWindow position={{ lat: p.lat, lng: p.lng }} onCloseClick={() => setActive(null)}>
              <div style={{ maxWidth: 260 }}>
                <PlaygroundCard p={p} />

                {/* Crowd badge */}
                <div
                  className="inline-flex items-center gap-1 px-2 py-1 mt-2 rounded-full text-sm"
                  style={{
                    background: `${p.crowd?.color || "#2e7d32"}22`,
                    color: p.crowd?.color || "#2e7d32",
                    fontWeight: 600,
                  }}
                >
                  ● {p.crowd?.label || "Quiet"}
                </div>

                {/* Feedback buttons */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => sendFeedback(p.id, "quiet")}
                    className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-800 hover:bg-green-200"
                  >
                    Quiet
                  </button>
                  <button
                    onClick={() => sendFeedback(p.id, "busy")}
                    className="px-3 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                  >
                    Busy
                  </button>
                </div>
              </div>
            </InfoWindow>
          );
        })()}
      </GoogleMap>

      {!me && (
        <div className="card" style={{ marginTop: 12 }}>
          Tip: allow location for “near me”, or just use Explore (25mi) to browse.
        </div>
      )}
    </div>
  );
}
