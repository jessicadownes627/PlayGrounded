// src/components/ParkCard.jsx
import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { useUser } from "../context/UserContext.jsx";
import { useCrowdSense } from "../hooks/useCrowdSense.js";

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
  const {
    counts,
    record: crowdRecord,
    status: crowdStatus,
    vote,
    isSubmitting: crowdUpdating,
  } = useCrowdSense(park?.id);

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

  const description = (park.description || park.notes || "").trim();

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

        {description && (
          <p className="italic text-sm text-[#0e3325] mb-2">{description}</p>
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

      {/* MIDDLE — Adaptive Energy Tile */}
      {park.indoorPlayArea === "yes" ? (
        <IndoorVibeTile
          park={park}
          counts={counts}
          status={crowdStatus}
          vote={vote}
          updating={crowdUpdating}
          record={crowdRecord}
        />
      ) : (
        <OutdoorLiveLook
          weather={weather}
          counts={counts}
          vote={vote}
          status={crowdStatus}
          updating={crowdUpdating}
          record={crowdRecord}
        />
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

const tallyReports = (counts = {}) =>
  Object.values(counts)
    .map((v) => Number(v) || 0)
    .reduce((sum, val) => sum + val, 0);

const buildCrowdSummary = (counts = {}, record = {}) => {
  const total = tallyReports(counts);
  if (record?.status === "closed" || counts.closed > 0) {
    return {
      emoji: "🚫",
      title: "Marked Closed",
      body: "Recent reports flagged this playground as closed. Tap Directions to verify before heading out.",
      tone: "error",
    };
  }
  if (counts.concerns > 0) {
    return {
      emoji: "⚠️",
      title: "Heads Up!",
      body: "Families shared a concern. Check conditions on arrival.",
      tone: "warn",
    };
  }
  if (counts.crowded >= Math.max(3, counts.clean + counts.conditions)) {
    return {
      emoji: "🎉",
      title: "Busy & Lively",
      body: "Expect a lively crowd right now. Great energy if your crew loves friends.",
      tone: "busy",
    };
  }
  if (counts.clean + counts.conditions > 0) {
    return {
      emoji: "🌿",
      title: "Wide Open",
      body: "Parents say it feels relaxed with good conditions.",
      tone: "chill",
    };
  }
  if (total === 0) {
    return {
      emoji: "👋",
      title: "Share a Quick Update",
      body: "Let other families know what it looks like right now.",
      tone: "idle",
    };
  }
  return {
    emoji: "🌤️",
    title: "Looking Good",
    body: "Reports look positive. Have fun out there!",
    tone: "chill",
  };
};

const renderStatusLabel = (status) => {
  switch (status) {
    case "loading":
      return "Gathering live reports…";
    case "error":
      return "CrowdSense paused — try again soon.";
    case "updating":
      return "Sending your update…";
    default:
      return "Updated every few minutes.";
  }
};

/* ---------- Live Look (Outdoor) ---------- */
function OutdoorLiveLook({ weather, counts, vote, status, updating, record }) {
  const summary = buildCrowdSummary(counts, record);
  const totalReports = tallyReports(counts);
  const statusLabel = renderStatusLabel(updating ? "updating" : status);

  return (
    <div className="rounded-2xl border border-yellow-100 bg-[#fffdf3] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0a2540]">
            ☀️ Live Look
          </h3>
          <p className="text-[11px] text-gray-500">{statusLabel}</p>
        </div>
        {weather ? (
          <div className="text-xs bg-white/90 rounded-md px-2 py-1 border border-yellow-100 shadow-sm">
            <span className="font-semibold">{Math.round(weather.temperature)}°F</span>
            <span className="mx-1">•</span>
            Wind {Math.round(weather.windspeed)} mph
          </div>
        ) : (
          <p className="text-[11px] text-gray-500 italic">Weather loading…</p>
        )}
      </div>

      <div
        className={`rounded-xl px-3 py-3 bg-white/90 border ${
          summary.tone === "error"
            ? "border-red-200"
            : summary.tone === "warn"
            ? "border-amber-200"
            : summary.tone === "busy"
            ? "border-orange-200"
            : "border-green-100"
        } shadow-sm flex items-start gap-3`}
      >
        <span className="text-2xl leading-none">{summary.emoji}</span>
        <div className="text-xs text-[#0a2540]">
          <p className="font-semibold text-sm">{summary.title}</p>
          <p className="leading-relaxed mt-1">{summary.body}</p>
          <p className="mt-2 text-[11px] text-gray-500">
            {totalReports > 0
              ? `${totalReports} recent report${totalReports === 1 ? "" : "s"}`
              : "No reports yet"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <CButton icon="🧼" label="Clean" count={counts.clean} onClick={() => vote("clean")} disabled={updating} />
        <CButton icon="💧" label="Conditions" count={counts.conditions} onClick={() => vote("conditions")} disabled={updating} />
        <CButton icon="🚸" label="Crowded" count={counts.crowded} onClick={() => vote("crowded")} disabled={updating} />
        <CButton icon="😐" label="Concerns" count={counts.concerns} onClick={() => vote("concerns")} disabled={updating} />
        <CButton icon="🚫" label="Closed" count={counts.closed} onClick={() => vote("closed")} disabled={updating} />
        <CButton icon="🍦" label="Treats" count={counts.icecream} onClick={() => vote("icecream")} disabled={updating} />
      </div>

      <p className="text-[11px] text-gray-600 border-t border-yellow-100 pt-2 leading-relaxed">
        Clean = litter-free · Conditions = safe/dry · Crowded = busy now · Concerns = damage/issues · Closed = not open · Treats = dessert truck spotted.
      </p>
    </div>
  );
}

/* ---------- Indoor Vibe Tile ---------- */
function IndoorVibeTile({ park, counts, status, vote, updating, record }) {
  const summary = buildCrowdSummary(counts, record);
  const statusLabel = renderStatusLabel(updating ? "updating" : status);
  return (
    <div className="rounded-2xl border border-yellow-100 bg-[#fffdf3] p-4">
      <h3 className="text-sm font-semibold text-[#0a2540] mb-2">
        🎟️ Live Look — Play Space Vibe
      </h3>
      <p className="text-[11px] text-gray-500 mb-3">
        {statusLabel}
      </p>

      <div
        className={`rounded-xl px-3 py-3 bg-white/90 border ${
          summary.tone === "error"
            ? "border-red-200"
            : summary.tone === "warn"
            ? "border-amber-200"
            : summary.tone === "busy"
            ? "border-orange-200"
            : "border-green-100"
        } shadow-sm flex items-start gap-3 mb-3`}
      >
        <span className="text-2xl leading-none">{summary.emoji}</span>
        <div className="text-xs text-[#0a2540]">
          <p className="font-semibold text-sm">{summary.title}</p>
          <p className="leading-relaxed mt-1">{summary.body}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <CButton icon="🌿" label="Chill" onClick={() => vote("crowded")} disabled={updating} />
        <CButton icon="🎉" label="Busy" onClick={() => vote("crowded")} disabled={updating} />
        <CButton icon="😐" label="Concerns" onClick={() => vote("concerns")} disabled={updating} />
        <CButton icon="🚫" label="Closed" onClick={() => vote("closed")} disabled={updating} />
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
  const highlightTip = hasTips ? tips[0] : null;
  const extraTips = hasTips ? tips.slice(1, 3) : [];

  const highlights = [];
  if (park.shade) highlights.push("🪑 Shaded seating spots");
  if (park.bathrooms) highlights.push("🚻 Bathrooms on-site");
  if (park.parking) highlights.push(`🚗 ${String(park.parking).trim() || "Easy parking"}`);
  if (park.adaptiveEquipment) highlights.push("♿ Inclusive play gear");
  if (park.foodAvailable) highlights.push("🍽️ Snacks or café available");
  if (park.indoorPlayArea) highlights.push("🏠 Indoor play area");

  const notesLower = String(park.notes || "").toLowerCase();
  const packSet = new Set();
  if (!park.indoorPlayArea) {
    if (!park.shade) packSet.add("🧢 Sun hats & sunscreen");
    if (notesLower.includes("sand")) packSet.add("🪣 Sand toys");
    if (notesLower.includes("splash") || notesLower.includes("spray"))
      packSet.add("💦 Water shoes & towels");
    packSet.add("🎒 Water bottles & snacks");
  } else {
    packSet.add("🧦 Grip socks for play structures");
    if (park.foodAvailable) packSet.add("💳 Card for café treats");
    packSet.add("💧 Water bottles for breaks");
  }

  const packList = Array.from(packSet).slice(0, 4);

  return (
    <div className="rounded-2xl border border-pink-100 bg-[#fff7fb] p-4 flex flex-col gap-4">
      <ParkPhoto park={park} />
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-[#0a2540] mb-1">🧺 Family Toolkit</h4>
          <ul className="text-xs text-[#0a2540] leading-relaxed space-y-1">
            {highlights.length > 0 ? (
              highlights.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>🌳 Explore and let us know what you discover!</li>
            )}
          </ul>
        </div>

        <div className="bg-white/80 border border-pink-100 rounded-lg p-3">
          <p className="text-xs font-semibold text-[#0a2540] mb-2">Pack This</p>
          <ul className="text-[11px] text-[#0a2540] leading-relaxed list-disc ml-4 space-y-1">
            {packList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {highlightTip ? (
          <div className="bg-white/80 border border-pink-100 rounded-lg p-3 text-xs text-[#0a2540] space-y-2">
            <p className="font-semibold">Parent Tip</p>
            <p>💬 {highlightTip}</p>
            {extraTips.map((t, i) => (
              <p key={`${i}-${t.slice(0, 12)}`} className="text-[11px] text-[#0a2540]/80">
                • {t}
              </p>
            ))}
          </div>
        ) : (
          <div className="bg-white/70 border border-dashed border-pink-200 rounded-lg p-3 text-[11px] text-[#0a2540]">
            💡 Know a secret about this spot? Tap a crowd button or DM us to add a parent tip!
          </div>
        )}

        {park.specialEvents && (
          <div className="bg-white/80 border border-pink-100 rounded-lg p-2 text-xs text-[#0a2540]">
            🎉 {park.specialEvents}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Reusable ---------- */
function CButton({ icon, label, count, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-between gap-2 bg-white/90 border border-yellow-200 rounded-md px-2 py-2 hover:bg-[#fff7cf] transition disabled:opacity-60 disabled:cursor-not-allowed"
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

  React.useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const rawInput = park?.imageUrlRaw || park?.imageUrl || "";
    const rawString = typeof rawInput === "string" ? rawInput : String(rawInput || "");
    const formulaMatch = rawString.match(/^=image\(["']?([^"')]+)["']?\)$/i);
    const extractedUrl = rawString.match(/https?:\/\/[^\s")]+/i)?.[0];
    const raw = extractedUrl || (formulaMatch ? formulaMatch[1] : rawString);

    // 1️⃣ No photo data at all
    if (!raw) {
      setImgSrc("https://placehold.co/600x400?text=Playground+Photo+Coming+Soon&font=roboto");
      return;
    }

    let directUrl = "";

    // 2️⃣ Full Google Maps API photo URL (already formatted)
    if (raw.includes("maps.googleapis.com/maps/api/place/photo")) {
      directUrl = raw;
    }
    // 3️⃣ Plain photo reference code (looks like a long random ID)
    else if (/^[A-Za-z0-9_-]{50,}$/.test(raw) && key) {
      directUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${raw}&key=${key}`;
    }
    // 4️⃣ Regular web or Google Drive URL — now proxied to avoid CORS
    else if (raw.startsWith("http")) {
      const proxyBase = "https://script.google.com/macros/s/AKfycbzaKleMyq37103scfD1SeRerz71mnWFQNu7SnAvRHFq8JDKaxmVq5NFxeA1kN6eVJKQ/exec";
      directUrl = `${proxyBase}?url=${encodeURIComponent(raw)}`;
    }
    // 5️⃣ Street View fallback (when we have coordinates)
    else if (park.lat && park.lng && key) {
      directUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${park.lat},${park.lng}&key=${key}`;
    }
    // 6️⃣ Last resort: cheerful placeholder
    else {
      directUrl = "https://placehold.co/600x400?text=Playground+Photo+Coming+Soon&font=roboto";
    }

    setImgSrc(directUrl);
  }, [park?.imageUrlRaw, park?.imageUrl, park?.lat, park?.lng]);

  return (
    <img
      src={imgSrc}
      alt={park?.name || "Playground Photo"}
      className="rounded-lg w-full h-28 object-cover"
      onError={() =>
        setImgSrc("https://placehold.co/600x400?text=Playground+Photo+Coming+Soon&font=roboto")
      }
    />
  );
}
