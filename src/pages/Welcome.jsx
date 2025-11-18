// src/pages/Welcome.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../context/UserContext.jsx";

export default function Welcome() {
  const navigate = useNavigate();
  const { filters, setFilters } = useUser();
  const [playMode, setPlayMode] = useState(null);

  // 🧹 Clear saved play mode on first mount only
  useEffect(() => {
    localStorage.removeItem("playMode");
  }, []);

  // Save selection so it can persist between pages if needed
  useEffect(() => {
    if (playMode) localStorage.setItem("playMode", playMode);
  }, [playMode]);

  const toggleFilter = (key) => {
    // Restrict filters depending on mode
    if (
      playMode === "indoor" &&
      !["indoorPlayArea", "adaptiveEquipment"].includes(key)
    )
      return;
    if (playMode === "outdoor" && key === "indoorPlayArea") return;
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetFilters = () => setFilters({});

  const options = [
    { emoji: "🧱", label: "Fenced In", key: "fenced" },
    { emoji: "🐾", label: "Allows Dogs", key: "dogs" },
    { emoji: "🚻", label: "Has Bathrooms", key: "bathrooms" },
    { emoji: "🌳", label: "Has Shade", key: "shade" },
    { emoji: "🚗", label: "Easy Parking", key: "parking" },
    { emoji: "💡", label: "Good Lighting", key: "lighting" },
    { emoji: "♿️", label: "Adaptive Equipment", key: "adaptiveEquipment" },
    { emoji: "🏠", label: "Indoor Play Area", key: "indoorPlayArea" },
  ];

  const isOutdoorMode = playMode === "outdoor";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#bde0fe] via-[#dfffd9] to-[#fff7ae] text-[#0a2540] font-[Nunito] relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-[url('/playground-pattern.svg')] bg-center bg-contain opacity-10 pointer-events-none" />

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="bg-white/80 backdrop-blur-md border border-[#b7ece2] rounded-3xl shadow-2xl p-8 w-11/12 max-w-md text-center z-10"
      >
        <h1 className="text-[42px] font-extrabold leading-tight mb-2 flex flex-col items-center gap-1">
          <span className="text-[48px] drop-shadow flex items-center gap-1">
            <span className="text-[#f06292]">Go</span>
            <span className="text-[#f97316]">Play</span>
            <span>There</span>
          </span>
        </h1>
        <p className="text-[#22665e] italic mb-6">
          Helping families find the best places to play — together.
        </p>

        {/* --- Intro Prompt --- */}
        {!playMode && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg font-semibold mb-6 text-[#0a2540]"
          >
            Hey! Where are we playing today?
          </motion.p>
        )}

        {/* --- Mode Buttons --- */}
        <div className="flex justify-center items-center gap-4 mb-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold shadow-md transition-all duration-300 text-lg ${
              isOutdoorMode
                ? "bg-[#9b5de5] text-white scale-105 shadow-[0_0_15px_rgba(155,93,229,0.6)]"
                : "bg-white text-[#5a3b9c] border border-[#9b5de5] hover:bg-[#f3e8ff]"
            }`}
            onClick={() => setPlayMode("outdoor")}
          >
            🛝 Outdoors
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold shadow-md transition-all duration-300 text-lg ${
              playMode === "indoor"
                ? "bg-[#f06292] text-white scale-105 shadow-[0_0_15px_rgba(240,98,146,0.6)]"
                : "bg-white text-[#b84b74] border border-[#f06292] hover:bg-[#ffe4ec]"
            }`}
            onClick={() => setPlayMode("indoor")}
          >
            🏠 Indoors
          </motion.button>
        </div>

        {/* --- Filters Fade In --- */}
        <AnimatePresence>
          {playMode && (
            <motion.div
              key={playMode}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <h2 className="text-lg font-semibold mb-5">
                {isOutdoorMode
                  ? "Choose what matters most to your family"
                  : "Indoor fun — no sunscreen required!"}
              </h2>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.7, ease: "easeInOut" }}
                className="grid grid-cols-2 gap-3 mb-10"
              >
                {options.map((f) => {
                  const isDisabled =
                    (playMode === "indoor" &&
                      !["indoorPlayArea", "adaptiveEquipment"].includes(
                        f.key
                      )) ||
                    (playMode === "outdoor" && f.key === "indoorPlayArea");
                  return (
                    <motion.button
                      key={f.key}
                      whileTap={!isDisabled ? { scale: 0.97 } : {}}
                      onClick={() => toggleFilter(f.key)}
                      disabled={isDisabled}
                      className={`rounded-xl py-3 px-3 shadow-sm transition-all duration-300 flex items-center justify-center space-x-2 ${
                        isDisabled
                          ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60"
                          : filters[f.key]
                          ? "bg-[#22a699] text-white shadow-md"
                          : "bg-white border border-[#a8e0d5] hover:bg-[#e8fffa]"
                      }`}
                    >
                      <span className="text-xl">{f.emoji}</span>
                      <span className="font-semibold text-sm">{f.label}</span>
                    </motion.button>
                  );
                })}
              </motion.div>

              {/* --- Buttons --- */}
              <div className="space-y-3">
                <button
                  onClick={() =>
                    navigate("/map", {
                      state: {
                        filters: Object.keys(filters).filter((k) => filters[k]),
                        mode: "ranked",
                        playMode,
                      },
                    })
                  }
                  className="w-full bg-[#3ba4f7] hover:bg-[#329af0] text-white rounded-full py-3 font-semibold shadow-md text-lg transition-all duration-300"
                >
                  😎 Show My Best Matches Nearby
                </button>

                <button
                  onClick={() => {
                    resetFilters();
                    navigate("/map", { state: { mode: "all", playMode } });
                  }}
                  className="w-full bg-white/80 border border-[#a8e0d5] text-[#0a2540] rounded-full py-2.5 text-sm font-semibold hover:bg-[#e8fffa] transition-all duration-300"
                >
                  🌍 Show All {playMode === "indoor" ? "Play Spaces" : "Parks"}{" "}
                  (Full List)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* --- Footer --- */}
      <footer className="text-center text-sm mt-8 px-6 text-[#22665e] italic max-w-md">
        <p>
          Privacy first — your location is used <strong>only</strong> to find
          nearby playgrounds. We never store, sell, or share your data.
        </p>
        <p className="mt-2">
          No accounts, no tracking — just sunshine, swings, and safe fun.
        </p>
      </footer>
    </motion.div>
  );
}
