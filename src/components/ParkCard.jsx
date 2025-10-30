// src/components/ParkCard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "../context/UserContext.jsx";
import { useCrowdSense } from "../hooks/useCrowdSense.js";

export default function ParkCard({ park, isSelected }) {
  const { filters } = useUser();
  const [shareFeedback, setShareFeedback] = useState("");

  /* ---------- Parent Tips (from sheet payload) ---------- */
  const tips = useMemo(() => {
    const parseTips = (value) => {
      if (!value) return [];
      return String(value)
        .split(/[\n\r]+|(?:\s*\|\|\s*)/)
        .map((tip) => tip.replace(/^[-•\s]+/, "").trim())
        .filter(Boolean);
    };

    const merged = [
      ...parseTips(park?.tipText),
      ...parseTips(park?.parentTip),
    ];
    const seen = new Set();
    const unique = merged.filter((tip) => {
      const key = tip.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique.slice(0, 3);
  }, [park?.tipText, park?.parentTip]);

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

  useEffect(() => {
    if (!shareFeedback) return undefined;
    const timer = setTimeout(() => setShareFeedback(""), 4000);
    return () => clearTimeout(timer);
  }, [shareFeedback]);

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
      className={`grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-3xl backdrop-blur-md border transition-all duration-200 ease-out ${
        isSelected
          ? "bg-white shadow-[0_20px_45px_rgba(106,0,244,0.25)] ring-2 ring-[#6a00f4] scale-[1.01] border-black/30"
          : "bg-white/95 shadow-[0_8px_25px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.12)] border-black/15"
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
        <div className="flex flex-wrap gap-2 mb-2">
          {park.instagram && (
            <a
              href={park.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-full bg-[#f06292]/15 text-[#c53d6f] text-[11px] font-semibold hover:bg-[#f06292]/25 transition"
            >
              Instagram ↗
            </a>
          )}
          {park.facebook && (
            <a
              href={park.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-full bg-[#1877f2]/15 text-[#1b4da3] text-[11px] font-semibold hover:bg-[#1877f2]/25 transition"
            >
              Facebook ↗
            </a>
          )}
        </div>

        <p className="text-[10px] text-[#6a00f4]/80 mb-2">
          Tap this card to spotlight it on the map.
        </p>

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
      <FamilyToolkit
        park={park}
        tips={tips}
        shareFeedback={shareFeedback}
        onShare={(message) => setShareFeedback(message)}
      />
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

      <p className="text-[11px] text-[#0a2540]/70 -mt-1">
        Tap a button below to share what you see right now.
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <CButton
          icon="🧼"
          label="Clean"
          title="Area is tidy"
          count={counts.clean}
          onClick={() => vote("clean")}
          disabled={updating}
        />
        <CButton
          icon="💧"
          label="Wet Ground"
          title="Equipment or surfaces are wet"
          count={counts.conditions}
          onClick={() => vote("conditions")}
          disabled={updating}
        />
        <CButton
          icon="🚸"
          label="Crowded"
          title="Lots of people right now"
          count={counts.crowded}
          onClick={() => vote("crowded")}
          disabled={updating}
        />
        <CButton
          icon="😐"
          label="Concerns"
          title="Something needs attention"
          count={counts.concerns}
          onClick={() => vote("concerns")}
          disabled={updating}
        />
        <CButton
          icon="🚫"
          label="Closed"
          title="Location is closed"
          count={counts.closed}
          onClick={() => vote("closed")}
          disabled={updating}
        />
        <CButton
          icon="🍦"
          label="Ice Cream"
          title="Treat truck spotted"
          count={counts.icecream}
          onClick={() => vote("icecream")}
          disabled={updating}
        />
      </div>

      <p className="text-[11px] text-gray-600 border-t border-yellow-100 pt-2 leading-relaxed">
        Clean = litter-free · Wet Ground = equipment or surfaces are wet · Crowded = busy now · Concerns = safety alerts · Closed = not open · Ice Cream = treat truck spotted.
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

      <p className="text-[11px] text-[#0a2540]/70 mb-1">
        Tap a button below to share the indoor vibe.
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <CButton
          icon="🌿"
          label="Chill"
          title="Relaxed vibe"
          onClick={() => vote("crowded")}
          disabled={updating}
        />
        <CButton
          icon="🎉"
          label="Busy & Fun"
          title="High energy right now"
          onClick={() => vote("crowded")}
          disabled={updating}
        />
        <CButton
          icon="😐"
          label="Concerns"
          title="Something needs attention"
          onClick={() => vote("concerns")}
          disabled={updating}
        />
        <CButton
          icon="🚫"
          label="Closed"
          title="Location is closed"
          onClick={() => vote("closed")}
          disabled={updating}
        />
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
function FamilyToolkit({ park, tips, shareFeedback, onShare }) {
  const hasTips = tips?.length > 0;
  const highlightTip = hasTips ? tips[0] : null;
  const extraTips = hasTips ? tips.slice(1, 3) : [];
  const tipSource =
    (typeof park?.tipSource === "string" && park.tipSource.trim()) ||
    (typeof park?.source === "string" && park.source.trim()) ||
    "";


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
      <div className="space-y-3">
        <ParkPhoto park={park} />
        <div className="flex flex-col sm:flex-row gap-2">
          <ShareLinkButton
            icon="📷"
            label="Share a Photo"
            href={buildPhotoFormUrl(park)}
            onShare={() => onShare("Photo form opened in a new tab — thank you for sharing!")}
          />
          <ShareLinkButton
            icon="💬"
            label="Share a Tip"
            href={buildTipFormUrl(park)}
            onShare={() => onShare("Tip form opened in a new tab — thank you for helping other families!")}
          />
        </div>
        {shareFeedback && (
          <div className="bg-white/90 border border-[#6a00f4]/30 text-[#6a00f4] text-xs rounded-lg px-3 py-2 shadow-sm">
            {shareFeedback}
          </div>
        )}
      </div>
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

        {hasTips && (
          <div className="bg-white/80 border border-pink-100 rounded-lg p-3 text-xs text-[#0a2540] space-y-2">
            <p className="font-semibold">Parent Tips</p>
            {highlightTip && <p>💬 {highlightTip}</p>}
            {extraTips.map((t, i) => (
              <p key={`${i}-${t.slice(0, 12)}`} className="text-[11px] text-[#0a2540]/80">
                • {t}
              </p>
            ))}
            {tipSource && (
              <p className="text-[10px] text-[#6a5acd] italic">Shared by {tipSource}</p>
            )}
          </div>
        )}
        {!hasTips && (
          <div className="bg-white/70 border border-dashed border-pink-200 rounded-lg p-3 text-[11px] text-[#0a2540]">
            No parent tips yet — share one above to help other families.
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
function CButton({ icon, label, count, onClick, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-between gap-2 bg-white/90 border border-yellow-200 rounded-md px-2 py-2 hover:bg-[#fff7cf] transition disabled:opacity-60 disabled:cursor-not-allowed"
      title={title || label}
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
    const override = typeof park?.photoOverride === "string" ? park.photoOverride.trim() : "";
    const normalized = typeof park?.imageUrl === "string" ? park.imageUrl.trim() : "";
    const rawValue = typeof park?.imageUrlRaw === "string" ? park.imageUrlRaw.trim() : "";
    const reference =
      typeof park?.photoReference === "string"
        ? park.photoReference.trim()
        : "";

    const candidate = override || normalized || rawValue || reference;

    if (!candidate) {
      setImgSrc("https://placehold.co/600x400?text=Playground+Photo+Coming+Soon&font=roboto");
      return;
    }

    const buildPlacePhoto = (ref) =>
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ref}&key=${key}`;

    let resolved = "";

    if (override && override.startsWith("http")) {
      resolved = override;
    } else if (normalized && normalized.startsWith("http")) {
      resolved = normalized;
    } else if (rawValue && rawValue.startsWith("http")) {
      resolved = rawValue;
    } else if (reference && reference.length > 45 && key) {
      resolved = buildPlacePhoto(reference);
    } else if (park.lat && park.lng && key) {
      resolved = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${park.lat},${park.lng}&key=${key}`;
    } else {
      resolved = "https://placehold.co/600x400?text=Playground+Photo+Coming+Soon&font=roboto";
    }

    setImgSrc(resolved);
  }, [
    park?.photoOverride,
    park?.imageUrl,
    park?.imageUrlRaw,
    park?.photoReference,
    park?.lat,
    park?.lng,
  ]);

  return (
    <div className="flex flex-col gap-1">
      <img
        src={imgSrc}
        alt={park?.name || "Playground Photo"}
        className="rounded-lg w-full h-28 object-cover"
        onError={() =>
          setImgSrc("https://placehold.co/600x400?text=Playground+Photo+Coming+Soon&font=roboto")
        }
      />
      {park?.photoCredit && (
        <p className="text-[10px] text-gray-500 italic flex items-center gap-1">
          <span>📸</span>
          <span>{park.photoCredit}</span>
        </p>
      )}
    </div>
  );
}

const PHOTO_FORM_BASE_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSerLfBMbloLDgqR3ebZKkYGea-FMkuAqm3ljlWMZwqWUHesWw/viewform?usp=pp_url&";
const PHOTO_FORM_PARAM_NAME = "entry.1153606241=";
const PHOTO_FORM_PARAM_ID = "entry.624997259=";

// TODO: replace with your tip form prefill URL + params
const TIP_FORM_BASE_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfh8aaPvGfmDY85OzxeBqrDXFPy46Td2mrSKEHjS1D9_Qtpbw/viewform?usp=pp_url&";
const TIP_FORM_PARAM_NAME = "entry.781476267=";
const TIP_FORM_PARAM_ID = "entry.980561211=";

function buildPhotoFormUrl(park) {
  if (!park?.name || !park?.id) return "#";
  return `${PHOTO_FORM_BASE_URL}${PHOTO_FORM_PARAM_NAME}${encodeURIComponent(
    park.name
  )}&${PHOTO_FORM_PARAM_ID}${encodeURIComponent(park.id)}`;
}

function buildTipFormUrl(park) {
  if (!park?.name || !park?.id) return "#";
  return `${TIP_FORM_BASE_URL}${TIP_FORM_PARAM_NAME}${encodeURIComponent(
    park.name
  )}&${TIP_FORM_PARAM_ID}${encodeURIComponent(park.id)}`;
}

function ShareLinkButton({ icon, label, href, onShare }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onShare?.()}
      className="flex-1 inline-flex items-center justify-center gap-2 text-sm text-[#6a00f4] hover:text-[#45009d] font-semibold bg-white border border-[#6a00f4]/30 rounded-full px-3 py-2 shadow-sm transition"
    >
      <span role="img" aria-hidden="true">
        {icon}
      </span>
      {label}
    </a>
  );
}
