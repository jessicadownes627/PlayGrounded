// src/pages/Welcome.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";

export default function Welcome() {
  const navigate = useNavigate();
  const { filters, setFilters } = useUser();

  // Toggle each filter on/off
  const toggleFilter = (key) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key] === true ? null : true,
    }));
  };

  const options = [
    { emoji: "🧱", label: "Fenced In", key: "fenced" },
    { emoji: "🐾", label: "Allows Dogs", key: "dogs" },
    { emoji: "🚻", label: "Has Bathrooms", key: "bathrooms" },
    { emoji: "🌳", label: "Has Shade", key: "shade" },
    { emoji: "🚗", label: "Easy Parking", key: "parking" },
    { emoji: "💡", label: "Good Lighting", key: "lighting" },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#bde0fe] via-[#dfffd9] to-[#fff7ae] text-[#1b4332] font-[Nunito] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/playground-pattern.svg')] bg-center bg-contain opacity-10 pointer-events-none"></div>

      <div className="bg-white/80 backdrop-blur-md border border-[#cde8d8] rounded-3xl shadow-2xl p-8 w-11/12 max-w-md text-center z-10">
        <h1 className="text-4xl font-extrabold text-[#1b4332] mb-2">
          PlayGrounded
        </h1>
        <p className="text-[#3b5d50] italic mb-6">
          The app that helps families find the best places to play.
        </p>

        <h2 className="text-lg font-semibold mb-4">
          Find the PERFECT playground
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {options.map((f) => (
            <button
              key={f.key}
              onClick={() => toggleFilter(f.key)}
              className={`rounded-xl py-3 px-4 shadow-sm transition-all duration-300 flex items-center justify-center space-x-2 ${
                filters[f.key]
                  ? "bg-[#3ba776] text-white shadow-md"
                  : "bg-white border border-[#a7d7b0] hover:bg-[#e9fff0]"
              }`}
            >
              <span className="text-xl">{f.emoji}</span>
              <span className="font-semibold">{f.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() =>
  navigate("/map", {
    state: { filters: Object.keys(filters).filter((k) => filters[k]) },
  })
}

          className="w-full bg-[#3ba776] hover:bg-[#2e8a61] text-white rounded-full py-3 font-semibold shadow-md transition-all duration-300"
        >
          Show Me Nearby Parks
        </button>
      </div>

      <footer className="text-center text-sm mt-8 px-6 text-[#3b5d50] italic max-w-md">
        <p>
          Privacy first — your location is used <strong>only</strong> to find
          nearby playgrounds. We never store, sell, or share your data.
        </p>
        <p className="mt-2">
          No accounts, no tracking — just sunshine, swings, and safe fun.
        </p>
      </footer>
    </div>
  );
}
