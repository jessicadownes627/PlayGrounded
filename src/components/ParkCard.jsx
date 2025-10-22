import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { useUser } from "../context/UserContext.jsx";

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwfk-5FhIJxcowwUCMAd27KIVKTCct-9Hx-ym4Io3H_3STz6E3QgQrDKtkAxu9bo8vS/exec";

export default function ParkCard({ park, isSelected }) {
  const { filters } = useUser();

  // ------------ Tips (Sheet) ------------
  const [tips, setTips] = useState([]);
  useEffect(() => {
    if (!park?.name) return;
    Papa.parse(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vRT_TDB9umNVXH0bKUFlxzVFKcrFzJFNqKP68OUDKcxoU52JGOWfBPQCYDiwaDCRkFf5LF4UWMLKzkN/pub?output=csv",
      {
        download: true,
        header: true,
        complete: (res) => {
          const rows = (res.data || []).filter(
            (r) =>
              (r["Park Name"] || "").trim().toLowerCase() ===
              (park.name || "").trim().toLowerCase()
          );
          setTips(rows.map((r) => r["Tip"]).filter(Boolean));
        },
      }
    );
  }, [park?.name]);

  // ------------ Weather ------------
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    if (!park?.lat || !park?.lng) return;
    const load = async () => {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${park.lat}&longitude=${park.lng}&current_weather=true&temperature_unit=fahrenheit&windspeed_unit=mph`
        );
        const j = await r.json();
        setWeather(j.current_weather);
      } catch (e) {
        console.error("weather", e);
      }
    };
    load();
    const id = setInterval(load, 180000); // 3 min
    return () => clearInterval(id);
  }, [park?.lat, park?.lng]);

  // ------------ CrowdSense ------------
  const [crowd, setCrowd] = useState(null);

  const fetchCrowd = async () => {
    try {
      const r = await fetch(SCRIPT_URL);
      const j = await r.json();
      const found = (j.data || []).find((p) => String(p.id) === String(park.id));
      setCrowd(found?.crowd || null);
    } catch (e) {
      console.error("crowd fetch", e);
    }
  };

  useEffect(() => {
    if (!park?.id) return;
    fetchCrowd();
    const id = setInterval(fetchCrowd, 30000);
    return () => clearInterval(id);
  }, [park?.id]);

  // send a feedback (+1)
  const vote = async (category) => {
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parkId: park.id,
          signalType: "feedback",
          value: category,
        }),
      });
      if (category === "clean" || category === "crowded") {
        await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parkId: park.id,
            signalType: "feedback",
            value: category === "clean" ? "quiet" : "busy",
          }),
        });
      }
      fetchCrowd();
    } catch (e) {
      console.error("vote", e);
    }
  };

  const counts = crowd?.counts || {
    clean: 0,
    conditions: 0,
    crowded: 0,
    concerns: 0,
    closed: 0,
    icecream: 0,
  };

  // ------------ Features logic ------------
  const selected = useMemo(
    () => Object.keys(filters || {}).filter((k) => !!filters[k]),
    [filters]
  );

  const parkFeatureMap = {
    fenced: !!park?.fenced,
    dogs: !!park?.dogsAllowed,
    bathrooms: !!park?.bathrooms,
    shade: !!park?.shade,
    parking: !!park?.parking,
    lighting: !!park?.lighting,
  };

  const amenities = Object.entries(parkFeatureMap)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const needs = selected.filter((k) => !amenities.includes(k));
  const matchScore =
    selected.length === 0
      ? 100
      : Math.round(((selected.length - needs.length) / selected.length) * 100);

  const matchText =
    matchScore === 100
      ? "Perfect match!"
      : matchScore >= 75
      ? "Great fit."
      : matchScore >= 50
      ? "Worth checking out."
      : "Might not have what you need.";

  // ------------ Tips submit ------------
  const [tipDraft, setTipDraft] = useState("");
  const submitTip = async () => {
    if (!tipDraft.trim()) return;
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parkName: park.name, tip: tipDraft }),
      });
      setTipDraft("");
      setTimeout(() => {
        Papa.parse(
          "https://docs.google.com/spreadsheets/d/e/2PACX-1vRT_TDB9umNVXH0bKUFlxzVFKcrFzJFNqKP68OUDKcxoU52JGOWfBPQCYDiwaDCRkFf5LF4UWMLKzkN/pub?output=csv",
          {
            download: true,
            header: true,
            complete: (res) => {
              const rows = (res.data || []).filter(
                (r) =>
                  (r["Park Name"] || "").trim().toLowerCase() ===
                  (park.name || "").trim().toLowerCase()
              );
              setTips(rows.map((r) => r["Tip"]).filter(Boolean));
            },
          }
        );
      }, 1200);
    } catch (e) {
      console.error("tip", e);
      alert("Couldn’t submit that tip. Try again later.");
    }
  };

  const googleLink = `https://www.google.com/maps?q=${encodeURIComponent(
    park.address || park.name
  )}`;

  const description =
    (park.description || "").trim() ||
    "Open play areas, green space, and room to relax together.";

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-3xl bg-white/90 backdrop-blur-md border border-white/60 shadow-[0_8px_25px_rgba(0,0,0,0.08)] ${
        isSelected ? "ring-2 ring-[#a8e0ff]" : ""
      }`}
    >
      {/* LEFT — Park Info */}
      <div className="rounded-2xl border border-[#e7f0fb] bg-[#f6fbff] p-4">
        <h2 className="text-lg font-extrabold text-[#0a2540] mb-1">
          {park.name}
        </h2>
        <a
          href={googleLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-[#0a6cff] underline underline-offset-2 font-semibold text-sm mb-1"
        >
          📍 {park.address || park.name}
        </a>
        <p className="text-xs text-gray-600 mb-3">{park.city}</p>

        <p className="italic text-sm text-[#0e3325] mb-2">{description}</p>

        {/* ♿️ Adaptive Equipment */}
        {park.adaptiveEquipment && (
          <p className="text-sm font-semibold text-green-800 mb-3">
            ♿️ Adaptive Equipment: {park.adaptiveEquipment}
          </p>
        )}

        <Section title="Your Selected Features">
          <BadgeRow items={selected} empty="No preferences set" color="green" />
        </Section>

        <Section title="Amenities">
          <BadgeRow items={amenities} empty="Not listed yet" color="blue" />
        </Section>

        <Section title="Needs Improvement">
          <BadgeRow items={needs} empty="Nothing missing 🎉" color="rose" />
        </Section>

        <div className="mt-2">
          <p className="text-sm font-semibold text-[#0a2540]">
            💛 {matchScore}% Match — {matchText}
          </p>
          <div className="h-2 mt-1 w-full bg-gray-200/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#ffe29a] to-[#ffd1e4]"
              style={{ width: `${matchScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* MIDDLE — Live Look */}
      <div className="rounded-2xl border border-yellow-100 bg-[#fffdf3] p-4">
        <h3 className="text-sm font-semibold text-[#0a2540] mb-2">
          ☀️ Live Look — The Six C’s
        </h3>
        {weather ? (
          <div className="text-xs bg-white/80 rounded-md px-2 py-1 border border-yellow-100 inline-block mb-3">
            <span className="font-semibold">{weather.temperature}°F</span> — Wind{" "}
            {weather.windspeed} mph
          </div>
        ) : (
          <p className="text-xs text-gray-500 mb-3 italic">Loading weather…</p>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <CButton icon="🧼" label="Clean" count={counts.clean} onClick={() => vote("clean")} />
          <CButton icon="💧" label="Conditions" count={counts.conditions} onClick={() => vote("conditions")} />
          <CButton icon="🚸" label="Crowded" count={counts.crowded} onClick={() => vote("crowded")} />
          <CButton icon="😐" label="Concerns" count={counts.concerns} onClick={() => vote("concerns")} />
          <CButton icon="🚫" label="Closed" count={counts.closed} onClick={() => vote("closed")} />
          <CButton icon="🍦" label="iCe Cream Man" count={counts.icecream} onClick={() => vote("icecream")} />
        </div>
        <p className="text-[11px] text-gray-600 mt-3 border-t border-yellow-100 pt-2 leading-relaxed">
          Clean = litter-free · Conditions = safe/dry · Crowded = busy now · Concerns = issues/damage · Closed = shut ·
          iCe Cream Man = vendor nearby.
        </p>
      </div>

      {/* RIGHT — Family Tools */}
      <div className="rounded-2xl border border-pink-100 bg-[#fff7fb] p-4 flex flex-col gap-3">
       {park.imageUrlRaw ? (
  <img
    src={park.imageUrlRaw}
    alt={park.name}
    className="rounded-lg w-full h-28 object-cover"
  />
) : park.imageUrl ? (
  <img
    src={park.imageUrl}
    alt={park.name}
    className="rounded-lg w-full h-28 object-cover"
  />
) : (
  <div className="rounded-lg w-full h-28 bg-white/70 border border-pink-100 text-xs text-gray-500 flex items-center justify-center">
    {park.indoorPlayArea
      ? "🏠 Photo coming soon"
      : "☀️ Photo coming soon"}
  </div>
)}

        <div>
          <h4 className="text-sm font-semibold text-[#0a2540] mb-1">🧺 Family Toolkit</h4>
          {tips.length ? (
            <div className="space-y-2">
              {tips.map((t, i) => (
                <div
                  key={`${i}-${t.slice(0, 12)}`}
                  className="bg-white/80 border border-pink-100 rounded-lg p-2 text-xs"
                >
                  {t}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-600 italic">
              No parent tips yet — be the first!
            </p>
          )}
        </div>

        <div>
          <textarea
            value={tipDraft}
            onChange={(e) => setTipDraft(e.target.value)}
            rows={3}
            placeholder="Share your parent pro tips…"
            className="w-full border border-gray-200 rounded-lg p-2 text-xs resize-none focus:ring-2 focus:ring-[#fcbad3] focus:outline-none"
          />
          <button
            onClick={submitTip}
            className="bg-[#fcbad3] hover:bg-[#f7a5c8] text-[#0a2540] font-semibold py-1.5 px-3 rounded-lg transition text-xs mt-2 w-full"
          >
            Submit Tip
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- small helpers ---------- */

function Section({ title, children }) {
  return (
    <div className="mb-3">
      <h3 className="font-semibold text-sm text-[#0a2540] mb-1">{title}:</h3>
      {children}
    </div>
  );
}

function BadgeRow({ items, empty, color }) {
  if (!items?.length) {
    return <p className="text-xs italic text-gray-500">{empty}</p>;
  }
  const colorMap = {
    green: "bg-[#dcfce7] text-[#14532d]",
    blue: "bg-[#e0f2fe] text-[#1e3a8a]",
    rose: "bg-[#ffe4e6] text-[#9f1239]",
  };
  const cls = colorMap[color] || "bg-gray-100 text-gray-700";
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((x) => (
        <span
          key={x}
          className={`${cls} px-2 py-1 rounded-full text-[11px] font-semibold`}
        >
          {x}
        </span>
      ))}
    </div>
  );
}

function CButton({ icon, label, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between gap-2 bg-white/90 border border-yellow-200 rounded-md px-2 py-2 hover:bg-[#fff7cf] transition"
      title={label}
    >
      <span className="flex items-center gap-2">
        <span className="text-lg leading-none">{icon}</span>
        <span className="font-semibold text-[#0a2540]">{label}</span>
      </span>
      <span className="text-xs text-gray-600 tabular-nums">{count ?? 0}</span>
    </button>
  );
}
