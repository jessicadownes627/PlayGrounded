// src/pages/MapPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { GoogleMap, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import ParkCard from "../components/ParkCard.jsx";
import { fetchPlaygrounds } from "../data/fetchPlaygrounds";

const defaultCenter = { lat: 40.815, lng: -73.220 };

export default function MapPage() {
  const [parks, setParks] = useState([]);
  const [selectedPark, setSelectedPark] = useState(null);
  const [center, setCenter] = useState(defaultCenter);
  const mapRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // 🎡 Load playgrounds
  useEffect(() => {
    fetchPlaygrounds().then(setParks).catch(console.error);
  }, []);

  // 📍 Center to user location
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

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

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#b7f3da] via-[#c7e9f9] to-[#9fd3f7] text-[#0e3325] font-[Nunito]">
      {/* Header */}
      <header className="relative text-center pt-6 pb-3">
        <h1 className="text-3xl font-extrabold tracking-tight">PlayGrounded</h1>
        <p className="text-sm opacity-80">
          Find the best places to play — with live, parent-powered updates.
        </p>
      </header>

      {/* Map */}
      <div className="relative flex justify-center mt-4">
        <div className="relative w-11/12 max-w-3xl aspect-square rounded-3xl overflow-hidden bg-white/90 backdrop-blur-md shadow-[0_10px_35px_rgba(0,0,0,0.15)] border border-white/50">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={center}
              zoom={11}
              onLoad={(m) => (mapRef.current = m)}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                styles: [
                  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#D7F4DE" }] },
                  { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#DCEEFE" }] },
                ],
              }}
            >
              {parks.map((p) => (
                <OverlayView
                  key={p.id}
                  position={{ lat: Number(p.lat), lng: Number(p.lng) }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <div
                    className={`cursor-pointer text-2xl transition-transform duration-200 ${
                      selectedPark?.id === p.id ? "scale-125" : "scale-100"
                    }`}
                    onClick={() => handleMarkerClick(p)}
                    title={p.name}
                  >
                    ☀️
                  </div>
                </OverlayView>
              ))}
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
        {parks.map((p) => (
          <div
            key={p.id}
            id={`park-${p.id}`}
            className={selectedPark?.id === p.id ? "ring-2 ring-pink-300 rounded-3xl" : ""}
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
