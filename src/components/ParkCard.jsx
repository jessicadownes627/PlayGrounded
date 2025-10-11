import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Papa from "papaparse";

export default function ParkCard({ park, isSelected }) {
  const location = useLocation();
  const selectedFilters = location.state?.filters || [];

  const [weather, setWeather] = useState(null);
  const [crowdData, setCrowdData] = useState(null);
  const [tipsFromSheet, setTipsFromSheet] = useState([]);
  const [tip, setTip] = useState("");

  // 🌦 Fetch weather
  useEffect(() => {
    if (!park?.lat || !park?.lng) return;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${park.lat}&longitude=${park.lng}&current_weather=true&temperature_unit=fahrenheit`
    )
      .then((res) => res.json())
      .then((data) => setWeather(data.current_weather))
      .catch(console.error);
  }, [park]);

  // 🧾 Fetch parent tips (Google Sheet)
  useEffect(() => {
    Papa.parse(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vRT_TDB9umNVXH0bKUFlxzVFKcrFzJFNqKP68OUDKcxoU52JGOWfBPQCYDiwaDCRkFf5LF4UWMLKzkN/pub?output=csv",
      {
        download: true,
        header: true,
        complete: (results) => {
          const filtered = results.data.filter(
            (row) =>
              row["Park Name"] &&
              park.name &&
              row["Park Name"].trim().toLowerCase() ===
                park.name.trim().toLowerCase()
          );
          setTipsFromSheet(filtered);
        },
      }
    );
  }, [park]);

  // 💬 Submit tip (anonymous)
  const handleSubmitTip = async () => {
    if (!tip.trim()) return;
    try {
      await fetch(
        "https://script.google.com/macros/s/AKfycbyY3FSGjyq4L_vt74djzD2Q7obdbbspp_DOKCGSOSqZ9C5SwXBUIf2fZ5zgYd-DbAZo1A/exec",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parkName: park.name, tip }),
        }
      );
      alert("Thanks for sharing your parent tip! 💕");
      setTip("");
    } catch (err) {
      console.error("Error submitting tip:", err);
      alert("Something went wrong — please try again later.");
    }
  };

  // ⚡ Live CrowdSense refresh (every 30s)
  useEffect(() => {
    if (!park?.id) return;
    const fetchCrowd = async () => {
      try {
        const res = await fetch(
          "https://script.google.com/macros/s/AKfycbyY3FSGjyq4L_vt74djzD2Q7obdbbspp_DOKCGSOSqZ9C5SwXBUIf2fZ5zgYd-DbAZo1A/exec"
        );
        const data = await res.json();
        const found = data.data?.find((p) => String(p.id) === String(park.id));
        if (found?.crowd) setCrowdData(found.crowd);
      } catch (err) {
        console.error("Failed to load crowd data", err);
      }
    };

    fetchCrowd();
    const interval = setInterval(fetchCrowd, 30000);
    return () => clearInterval(interval);
  }, [park]);

  // 🪄 Send feedback (+1)
  const handleCrowdVote = async (value) => {
    try {
      await fetch(
        "https://script.google.com/macros/s/AKfycbyY3FSGjyq4L_vt74djzD2Q7obdbbspp_DOKCGSOSqZ9C5SwXBUIf2fZ5zgYd-DbAZo1A/exec",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parkId: park.id,
            signalType: "feedback",
            value,
          }),
        }
      );
    } catch (err) {
      console.error("Error sending feedback:", err);
    }
  };

  const googleLink = `https://www.google.com/maps?q=${encodeURIComponent(
    park.address || park.name
  )}`;

  return (
    <div
      className={`grid md:grid-cols-3 gap-6 p-6 rounded-2xl border shadow-md transition-all ${
        isSelected ? "border-pink-300 bg-white" : "border-gray-200 bg-white"
      }`}
    >
      {/* 🩵 LEFT COLUMN — Park Info */}
      <div className="bg-[#e9f4ff] p-4 rounded-xl border border-blue-100 shadow-sm">
        <h2 className="text-lg font-bold text-[#0a2540] mb-1">{park.name}</h2>
        <a
          href={googleLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-[#0a6cff]/10 text-[#0a6cff] font-semibold text-sm px-3 py-2 rounded-lg hover:bg-[#0a6cff]/20 transition-all underline underline-offset-2 mb-2"
        >
          📍 {park.address}
        </a>
        <p className="text-xs text-gray-600 mb-3">{park.city}</p>

        <h3 className="font-semibold text-sm text-[#0a2540] underline mb-1">
          Features
        </h3>
        {selectedFilters.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedFilters.map((f, i) => (
              <span
                key={i}
                className="bg-[#dcfce7] text-[#0a2540] px-2 py-1 rounded-full text-xs"
              >
                {f}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic mb-2">
            No features selected yet.
          </p>
        )}
      </div>

      {/* 💛 MIDDLE COLUMN — Live Look */}
      <div className="bg-[#fffbe6] p-4 rounded-xl border border-yellow-100 shadow-inner">
        <h3 className="text-sm font-semibold text-[#0a2540] mb-3">
          ☀️ Live Look — The Five C’s
        </h3>

        {weather && (
          <div className="text-xs bg-white/80 rounded-lg p-2 border border-yellow-100 mb-3">
            <p className="font-semibold">
              Current Weather: {weather.temperature}°F — Wind {weather.windspeed} mph
            </p>
          </div>
        )}

        {crowdData ? (
          <>
            <div className="mb-2">
              <span
                className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                style={{ backgroundColor: crowdData.color }}
              />
              <span className="font-semibold text-[#0a2540]">
                {crowdData.label}
              </span>
            </div>
            <div className="text-xs text-gray-600 mb-3">
              <p>
                {crowdData.presence} nearby • {crowdData.busyVotes} busy votes •{" "}
                {crowdData.quietVotes} calm votes
              </p>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-500 italic mb-3">
            Loading live reports…
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <button
            onClick={() => handleCrowdVote("quiet")}
            className="rounded-lg bg-white/90 border border-yellow-200 py-2 hover:bg-[#faffd8] transition"
          >
            ✅ Clean / Calm
          </button>
          <button
            onClick={() => handleCrowdVote("busy")}
            className="rounded-lg bg-white/90 border border-yellow-200 py-2 hover:bg-[#fff3c4] transition"
          >
            🚸 Crowded
          </button>
        </div>

        <p className="text-[11px] text-gray-500 mt-2 border-t border-yellow-100 pt-2">
          Clean (litter-free), Conditions (equipment safe), Crowded (busy now),
          Concerns (issues), Closed (temporarily shut).
        </p>
      </div>

      {/* 🩷 RIGHT COLUMN — Family Tools */}
      <div className="bg-[#fff5f8] p-4 rounded-xl border border-pink-100 shadow-sm flex flex-col gap-3">
        {park.image ? (
          <img
            src={park.image}
            alt={park.name}
            className="rounded-lg w-full h-24 object-cover"
          />
        ) : (
          <div className="rounded-lg w-full h-24 bg-gray-100 text-xs text-gray-500 flex items-center justify-center">
            Photo coming soon
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-[#0a2540] mb-1">
            🧺 Family Tools
          </h4>

          {tipsFromSheet.length > 0 ? (
            <div className="space-y-2">
              {tipsFromSheet.map((t, i) => (
                <div
                  key={i}
                  className="bg-white/80 border border-pink-100 rounded-lg p-2 text-xs"
                >
                  {t.Tip}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-700 italic">
              No parent tips yet — be the first!
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-[#0a2540] mb-1">💬 Add your tip</p>
          <textarea
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            placeholder="Share your parent pro tips..."
            className="w-full border border-gray-200 rounded-lg p-2 text-xs resize-none focus:ring-2 focus:ring-[#fcbad3] focus:outline-none"
            rows={3}
          />
          <button
            onClick={handleSubmitTip}
            className="bg-[#fcbad3] hover:bg-[#f7a5c8] text-[#0a2540] font-semibold py-1.5 px-3 rounded-lg transition text-xs mt-1 w-full"
          >
            Submit Tip
          </button>
        </div>
      </div>
    </div>
  );
}
