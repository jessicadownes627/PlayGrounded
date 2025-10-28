// src/components/ParkCard.jsx
import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { useUser } from "../context/UserContext.jsx";

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwfk-5FhIJxcowwUCMAd27KIVKTCct-9Hx-ym4Io3H_3STz6E3QgQrDKtkAxu9bo8vS/exec";

export default function ParkCard({ park, isSelected }) {
  const { filters } = useUser();

  /* ---------- Parent Tips (Google Sheet) ---------- */
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

  /* ---------- Weather ---------- */
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    if (!park?.lat || !park?.lng) return;
    const loadWeather = async () => {
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
    loadWeather();
    const id = setInterval(loadWeather, 180000);
    return () => clearInterval(id);
  }, [park?.lat, park?.lng]);

  /* ---------- Crowd / Vibe ---------- */
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

  /* ---------- Matching / Features ---------- */
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
    adaptiveEquipment: !!park?.adaptiveEquipment,
    indoorPlayArea: !!park?.indoorPlayArea,
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

  const googleLink = `https://www.google.com/maps?q=${encodeURIComponent(
    park.address || park.name
  )}`;

  const description =
    (park.description || "").trim() ||
    "Open play areas, green space, and room to relax together.";

  /* ---------- Render ---------- */
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-3xl bg-white/90 backdrop-blur-md border border-white/60 shadow-[0_8px_25px_rgba(0,0,0,0.08)] ${
        isSelected ? "ring-2 ring-[#a8e0ff]" : ""
      }`}
    >
      {/* LEFT — Smart Info */}
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
        {park.city && <p className="text-xs text-gray-600 mb-1">{park.city}</p>}

        {/* contact + hours + socials */}
        {park.hours && (
          <p className="text-xs text-gray-700 mb-1">🕒 {park.hours}</p>
        )}
        {park.contact && (
          <p className="text-xs text-gray-700 mb-1">📞 {park.contact}</p>
        )}
        {park.website && (
          <a
            href={park.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#0a6cff] underline underline-offset-2 block mb-1"
          >
            🌐 Website
          </a>
        )}
        <div className="flex gap-2 mb-2">
          {park.instagram && (
            <a
              href={park.instagram}
              target="_blank"
              rel="noopener noreferrer"
              title="Instagram"
            >
              <img src="/icons/instagram.svg" alt="Instagram" className="w-4 h-4" />
            </a>
          )}
          {park.facebook && (
            <a
              href={park.facebook}
              target="_blank"
              rel="noopener noreferrer"
              title="Facebook"
            >
              <img src="/icons/facebook.svg" alt="Facebook" className="w-4 h-4" />
            </a>
          )}
        </div>

        <p className="italic text-sm text-[#0e3325] mb-2">{description}</p>

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

      {/* MIDDLE — Adaptive Energy Tile */}
      {park.indoorPlayArea === "yes" ? (
        <IndoorVibeTile park={park} crowd={crowd} vote={vote} />
      ) : (
        <OutdoorLiveLook weather={weather} counts={counts} vote={vote} />
      )}

      {/* RIGHT — Family Toolkit 2.0 */}
      <FamilyToolkit park={park} tips={tips} />
    </div>
  );
}

/* ---------- Small helpers ---------- */
function Section({ title, children }) {
  return (
    <div className="mb-3">
      <h3 className="font-semibold text-sm text-[#0a2540] mb-1">{title}:</h3>
      {children}
    </div>
  );
}

function BadgeRow({ items, empty, color }) {
  if (!items?.length)
    return <p className="text-xs italic text-gray-500">{empty}</p>;
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

/* ---------- Live Look (Outdoor) ---------- */
function OutdoorLiveLook({ weather, counts, vote }) {
  return (
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
        Clean = litter-free · Conditions = safe/dry · Crowded = busy now · Concerns = issues/damage · Closed = shut · iCe Cream Man = vendor nearby.
      </p>
    </div>
  );
}

/* ---------- Indoor Vibe Tile ---------- */
function IndoorVibeTile({ park, crowd, vote }) {
  const vibe =
    crowd?.counts?.crowded > 5
      ? "🎉 Busy & Fun!"
      : crowd?.counts?.crowded > 1
      ? "😄 Active"
      : "🌿 Chill";
  return (
    <div className="rounded-2xl border border-yellow-100 bg-[#fffdf3] p-4">
      <h3 className="text-sm font-semibold text-[#0a2540] mb-2">
        🎟️ Live Look — Play Space Vibe
      </h3>
      <div className="text-base font-semibold mb-2 text-[#0a2540]">{vibe}</div>
      <p className="text-[11px] text-gray-600 mb-3">
        Parents nearby say it’s {vibe.toLowerCase()} right now.
      </p>
      <div className="flex gap-2">
        <CButton icon="🌿" label="Chill" onClick={() => vote("crowded")} />
        <CButton icon="🎉" label="Busy & Fun" onClick={() => vote("crowded")} />
      </div>
      {park.liveAnnouncement && (
        <div className="mt-3 bg-white/80 border border-yellow-100 rounded-lg p-2 text-xs text-[#0a2540]">
          🎈 {park.liveAnnouncement}
        </div>
      )}
    </div>
  );
}

/* ---------- Family Toolkit 2.0 ---------- */
function FamilyToolkit({ park, tips }) {
  const hasTips = tips?.length > 0;
  return (
    <div className="rounded-2xl border border-pink-100 bg-[#fff7fb] p-4 flex flex-col gap-3">
      <ParkPhoto park={park} />
      <div>
        <h4 className="text-sm font-semibold text-[#0a2540] mb-1">🧺 Family Toolkit</h4>

        <ul className="text-xs text-[#0a2540] leading-relaxed list-disc ml-4">
          {park.indoorPlayArea ? (
            <>
              {park.foodAvailable && <li>Snacks or café on-site.</li>}
              {park.adaptiveEquipment && <li>Inclusive & sensory-friendly zones.</li>}
              <li>{park.notes || "Socks required • Bring water bottles."}</li>
            </>
          ) : (
            <>
              {park.shade && <li>Shaded seating areas available.</li>}
              {park.bathrooms && <li>Restrooms nearby.</li>}
              {park.parking && <li>Free parking on-site.</li>}
              <li>{park.notes || "Pack sunscreen & snacks for the day!"}</li>
            </>
          )}
        </ul>

        {hasTips && (
          <div className="mt-3 space-y-2">
            {tips.map((t, i) => (
              <div
                key={`${i}-${t.slice(0, 12)}`}
                className="bg-white/80 border border-pink-100 rounded-lg p-2 text-xs text-[#0a2540]"
              >
                💬 {t}
              </div>
            ))}
          </div>
        )}

        {park.specialEvents && (
          <div className="mt-3 bg-white/80 border border-pink-100 rounded-lg p-2 text-xs text-[#0a2540]">
            🎉 {park.specialEvents}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Reusable ---------- */
function CButton({ icon, label, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between gap-2 bg-white/90 border border-yellow-200 rounded-md px-2 py-2 hover:bg-[#fff7cf] transition"
      title={label}
    >
      <span className="flex items-center gap-2">
        <span className="text-base leading-none">{icon}</span>
        <span className="font-semibold text-[#0a2540]">{label}</span>
      </span>
      {count !== undefined && (
        <span className="text-xs text-gray-600 tabular-nums">{count}</span>
      )}
    </button>
  );
}

function ParkPhoto({ park }) {
  const [imgSrc, setImgSrc] = React.useState(null);
  useEffect(() => {
    const raw = park.imageUrlRaw || park.imageUrl;
    if (!raw) return;
    let directUrl = raw;
    const match = raw.match(/\/d\/(.*?)\//);
    if (match && match[1]) {
      directUrl = `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    setImgSrc(directUrl);
  }, [park.imageUrlRaw, park.imageUrl]);

  if (!imgSrc)
    return (
      <div className="rounded-lg w-full h-28 bg-white/70 border border-pink-100 text-xs text-gray-500 flex items-center justify-center">
        {park.indoorPlayArea ? "🏠 Photo coming soon" : "☀️ Photo coming soon"}
      </div>
    );

  return (
    <img
      src={imgSrc}
      alt={park.name}
      className="rounded-lg w-full h-28 object-cover"
    />
  );
}
