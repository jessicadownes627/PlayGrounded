import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import teddy from "../assets/teddy.png";

export default function TeddySplash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/welcome");
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      className="h-screen w-full flex flex-col items-center justify-center text-center"
      style={{
        background: "linear-gradient(135deg, #FFF9C4, #FFE0B2, #C8E6C9)",
      }}
    >
      <motion.img
        src={teddy}
        alt="Teddy bear mascot"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, y: [0, -10, 0] }}
        transition={{ duration: 1.8, ease: "easeOut" }}
        className="w-40 h-auto"
      />
      <h1 className="text-5xl font-extrabold text-[#5c4033] mt-4">
        PlayGrounded
      </h1>
      <p className="text-lg text-[#6d4c41] mt-2">
        The app that knows where the good swings are.
      </p>
    </div>
  );
}
