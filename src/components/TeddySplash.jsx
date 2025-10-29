// src/pages/TeddySplash.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function TeddySplash() {
  const navigate = useNavigate();
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 2300); // start fade before nav
    const navTimer = setTimeout(() => navigate("/welcome"), 2600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
    };
  }, [navigate]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: fadeOut ? 0 : 1 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-sky-100 to-sky-300 text-[#0a2540] overflow-hidden relative"
      aria-label="PlayGrounded splash screen"
    >
      {/* ☀️ Animated Sun */}
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1 }}
        className="absolute top-10 right-10 flex items-center justify-center"
      >
        <div className="relative">
          {/* Core sun */}
          <div className="w-20 h-20 bg-yellow-300 rounded-full shadow-[0_0_60px_15px_rgba(255,223,0,0.5)] animate-pulse" />
          {/* Rays */}
          <div className="absolute inset-0 border-4 border-yellow-200 rounded-full animate-spin-slow" />
        </div>
      </motion.div>

      {/* 🌳 Logo / App Name */}
      <motion.h1
        aria-label="PlayGrounded App Title"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="text-4xl md:text-6xl font-bold tracking-tight mb-3"
      >
        <span className="text-[#f06292]">Hey!</span> PlayGrounded
      </motion.h1>

      {/* 💬 Tagline */}
      <motion.p
        aria-label="Loading tagline"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 1 }}
        className="text-lg italic"
      >
        Hey! Let&rsquo;s find your next play adventure 🌳
      </motion.p>

      {/* ⏳ Loading Dots */}
      <motion.div
        className="flex mt-8 space-x-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-3 h-3 bg-[#0a2540] rounded-full"
            animate={{ y: [0, -8, 0] }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              repeatDelay: 0.2,
              delay: i * 0.2,
            }}
          />
        ))}
      </motion.div>

      {/* 🌦️ Bottom Hint */}
      <motion.div
        className="absolute bottom-10 text-sm opacity-80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
      >
        <p>Loading parks, weather, and crowd vibes...</p>
      </motion.div>

      {/* 👣 Footer credit (optional polish) */}
      <motion.p
        className="absolute bottom-3 right-4 text-xs opacity-70 italic"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        powered by CrowdSense™
      </motion.p>
    </motion.div>
  );
}
