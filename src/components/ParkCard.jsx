// src/components/ParkCard.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "../context/UserContext.jsx";
import { useCrowdSense, CROWD_SENSE_URL } from "../hooks/useCrowdSense.js";
import LiveReportSection from "./LiveReportSection.jsx";
import { fetchWeatherBundle } from "../utils/fetchWeatherBundle.js";

const AMENITY_LABELS = {
  fenced: "Fenced play area",
  dogs: "Dog friendly",
  dogsAllowed: "Dog friendly",
  bathrooms: "Bathrooms",
  shade: "Shaded seating",
  parking: "Parking",
  lighting: "Evening lighting",
  adaptiveEquipment: "Inclusive play gear",
  indoorPlayArea: "Indoor play",
};

const DEFAULT_SECTION_STYLE =
  "rounded-2xl border bg-white/95 shadow-[0_10px_24px_rgba(15,23,42,0.08)]";

const WEATHER_CODE_MAP = [
  { icon: "☀️", label: "Sunny", codes: [0] },
  { icon: "🌤️", label: "Mostly sunny", codes: [1] },
  { icon: "⛅", label: "Partly cloudy", codes: [2] },
  { icon: "☁️", label: "Cloudy", codes: [3] },
  { icon: "🌫️", label: "Foggy", codes: [45, 48] },
  { icon: "🌦️", label: "Light rain", codes: [51, 53, 55, 61, 63, 80, 81] },
  { icon: "🌧️", label: "Rainy", codes: [65, 66, 67, 82] },
  { icon: "❄️", label: "Snowy", codes: [71, 73, 75, 77] },
  { icon: "⛈️", label: "Stormy", codes: [95, 96, 99] },
];

export default function ParkCard({ park, isSelected, onSelect, onLiveSignalsUpdate, domId }) {
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

  const distanceText = useMemo(() => {
    const miles = Number(park?.distance);
    if (!Number.isFinite(miles)) return null;
    if (miles < 0.1) return "< 0.1 mi away";
    const rounded = miles >= 10 ? Math.round(miles) : parseFloat(miles.toFixed(1));
    return `${rounded} mi away`;
  }, [park?.distance]);

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

  const [environmentBundle, setEnvironmentBundle] = useState(null);
  const [environmentStatus, setEnvironmentStatus] = useState("idle");

  useEffect(() => {
    const latNum = Number(park?.lat);
    const lonNum = Number(park?.lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      setEnvironmentStatus("idle");
      setEnvironmentBundle(null);
      return;
    }

    let cancelled = false;

    const loadEnvironment = async () => {
      try {
        setEnvironmentStatus((prev) => (prev === "ready" ? prev : "loading"));
        const bundle = await fetchWeatherBundle(latNum, lonNum);
        if (!cancelled) {
          setEnvironmentBundle(bundle);
          setEnvironmentStatus("ready");
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("environment", err);
        if (!cancelled) {
          setEnvironmentBundle(null);
          setEnvironmentStatus("error");
        }
      }
    };

    loadEnvironment();
    const timer = setInterval(loadEnvironment, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
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

  const parkFeatureMap = useMemo(
    () => ({
      fenced: !!park?.fenced,
      dogs: !!park?.dogsAllowed,
      bathrooms: !!park?.bathrooms,
      shade: !!park?.shade,
      parking: !!park?.parking,
      lighting: !!park?.lighting,
      adaptiveEquipment: !!park?.adaptiveEquipment,
      indoorPlayArea: !!park?.indoorPlayArea,
    }),
    [
      park?.fenced,
      park?.dogsAllowed,
      park?.bathrooms,
      park?.shade,
      park?.parking,
      park?.lighting,
      park?.adaptiveEquipment,
      park?.indoorPlayArea,
    ]
  );

  const amenities = useMemo(
    () =>
      Object.entries(parkFeatureMap)
        .filter(([, v]) => v)
        .map(([k]) => k),
    [parkFeatureMap]
  );

  const topMatches = useMemo(
    () => selected.filter((key) => amenities.includes(key)),
    [amenities, selected]
  );

  const extraAmenities = useMemo(
    () => amenities.filter((key) => !topMatches.includes(key)),
    [amenities, topMatches]
  );

  const needs = useMemo(
    () => selected.filter((key) => !amenities.includes(key)),
    [amenities, selected]
  );

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
  const alternateName = useMemo(() => {
    const candidate =
      park?.akaName ||
      park?.aka ||
      park?.AKA ||
      park?.altName ||
      park?.alternateName ||
      park?.alternativeName ||
      park?.alsoKnownAs ||
      park?.nickname ||
      park?.nickName ||
      "";
    return typeof candidate === "string" ? candidate.trim() : "";
  }, [park]);

/* ---------- Render ---------- */
  const concernCount = Number(counts?.concerns) || 0;
  const hasConcernReports = concernCount > 0;

  useEffect(() => {
    if (!onLiveSignalsUpdate || !park?.id) return;
    onLiveSignalsUpdate(park.id, { hasConcerns: hasConcernReports });
  }, [onLiveSignalsUpdate, park?.id, hasConcernReports]);

  const handleCardActivate = useCallback(() => {
    onSelect?.(park, { hasConcerns: hasConcernReports });
  }, [onSelect, park, hasConcernReports]);

  const handleSurfaceClick = useCallback(
    (event) => {
      const interactive = event.target.closest("a, button");
      if (interactive) return;
      handleCardActivate();
    },
    [handleCardActivate]
  );

  const handleSurfaceKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleCardActivate();
      }
    },
    [handleCardActivate]
  );

  return (
    <article
      id={domId}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={handleSurfaceClick}
      onKeyDown={handleSurfaceKeyDown}
      className={`grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-4 md:auto-rows-auto p-5 md:p-6 rounded-3xl backdrop-blur-md border-2 border-black transition-all duration-200 ease-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6a00f4] ${
        isSelected
          ? "bg-white shadow-[0_22px_55px_rgba(106,0,244,0.2)] ring-2 ring-[#6a00f4] scale-[1.01]"
          : "bg-white shadow-[0_14px_30px_rgba(15,23,42,0.08)] hover:shadow-[0_18px_36px_rgba(14,52,91,0.12)]"
      }`}
    >
      <section
        className={`${DEFAULT_SECTION_STYLE} border-[#e7f0fb] bg-[#f6fbff] p-4 flex flex-col gap-4 order-1 md:order-none md:col-span-7 md:row-start-1`}
      >
        <div className="space-y-2">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-[#0a2540] leading-tight">
              {park.name}
            </h2>
            {alternateName && (
              <div className="inline-flex items-center gap-1 rounded-full border border-[#fed7aa] bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#f97316]">
                <span>Also known as:</span>
                <span className="text-[#ea580c]">{alternateName}</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <a
              href={googleLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#0a6cff] underline underline-offset-2 font-semibold text-sm"
            >
              <span role="img" aria-hidden="true">
                📍
              </span>
              <span>{park.address || park.name}</span>
            </a>
            {park.city && (
              <p className="text-xs text-gray-600">
                {park.city}
                {park.state ? `, ${park.state}` : ""}
              </p>
            )}
            {distanceText && (
              <p className="text-xs font-semibold text-[#045472] flex items-center gap-1">
                <span role="img" aria-hidden="true">
                  📏
                </span>
                <span>{distanceText}</span>
              </p>
            )}
            <p className="text-[10px] text-[#6a00f4]/80">
              Tap this card to spotlight it on the map.
            </p>
          </div>
        </div>

        {description && (
          <p className="italic text-sm text-[#0e3325] leading-relaxed">{description}</p>
        )}

        <ParkPhoto
          park={park}
          onShare={() =>
            setShareFeedback(
              "Photo form opened in a new tab — thank you for sharing!"
            )
          }
        />

        <div className="flex flex-wrap gap-2">
          {park.hours && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] text-[#0a2540] border border-[#cee5ff]">
              <span role="img" aria-hidden="true">
                🕒
              </span>
              {park.hours}
            </span>
          )}
          {park.contact && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] text-[#0a2540] border border-[#cee5ff]">
              <span role="img" aria-hidden="true">
                📞
              </span>
              {park.contact}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {park.website && (
            <a
              href={park.website}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-full bg-white/80 border border-[#cee5ff] text-[11px] font-semibold text-[#0a6cff] hover:bg-[#e0f2ff] transition"
            >
              Website ↗
            </a>
          )}
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
      </section>

      <section
        className={`${DEFAULT_SECTION_STYLE} border-[#eae8ff] bg-[#f6f5ff] p-4 order-3 md:order-none md:col-span-7 md:row-start-2`}
      >
        <h3 className="text-sm font-semibold text-[#0a2540] mb-3 flex items-center gap-2">
          <span role="img" aria-hidden="true">
            🛝
          </span>
          <span>
            Amenities overview at{" "}
            <span className="text-[#6a00f4] font-extrabold">
              {park?.name || "this playground"}
            </span>
          </span>
        </h3>
        <Section title="Top features">
          <BadgeRow
            items={topMatches}
            empty="None of your must-haves yet"
            color="green"
          />
        </Section>
        <Section title="Extra amenities">
          <BadgeRow items={extraAmenities} empty="More details coming soon" color="blue" />
        </Section>
        <Section title="Needs improvement">
          <BadgeRow items={needs} empty="Nothing missing 🎉" color="rose" />
        </Section>
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-[#0a2540]">
            💛 {matchScore}% match — {matchText}
          </p>
          <div className="h-2 w-full bg-gray-200/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#ffe29a] to-[#ffd1e4]"
              style={{ width: `${matchScore}%` }}
            />
          </div>
        </div>
      </section>

      <section className="order-4 md:order-none md:col-span-5 md:row-start-1">
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
            environment={environmentBundle}
            environmentStatus={environmentStatus}
            counts={counts}
            parkId={park?.id}
            status={crowdStatus}
            updating={crowdUpdating}
            record={crowdRecord}
          />
        )}
      </section>

      <section className="order-5 md:order-none md:col-span-5 md:row-start-2">
        <FamilyToolkit
          park={park}
          tips={tips}
          shareFeedback={shareFeedback}
          onShare={(message) => setShareFeedback(message)}
        />
      </section>
    </article>
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

function formatAmenityLabel(key) {
  if (!key) return "";
  if (AMENITY_LABELS[key]) return AMENITY_LABELS[key];
  const spaced = String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) return "";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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
          {formatAmenityLabel(x) || x}
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
  const clean = Number(counts.clean) || 0;
  const wetGround = Number(counts.conditions || counts.wetGround) || 0;
  const crowded = Number(counts.crowded) || 0;
  const concerns = Number(counts.concerns) || 0;
  const closed = Number(counts.closed) || 0;
  const total = tallyReports(counts);

  if (record?.status === "closed" || closed > 0) {
    return {
      emoji: "🚫",
      title: "Marked Closed",
      body:
        closed === 1
        ? "One family says this playground is currently closed — double-check before heading out."
        : `${closed} families say this playground is currently closed — double-check before heading out.`,
      tone: "error",
    };
  }
  if (concerns >= 3) {
    return {
      emoji: "⚠️",
      title: "Multiple Concerns",
      body: `${concerns} families spotted something that needs attention. Have a backup plan just in case.`,
      tone: "error",
    };
  }
  if (concerns > 0) {
    return {
      emoji: "⚠️",
      title: "Heads Up!",
      body:
        concerns === 1
          ? "One family shared a concern. Check conditions on arrival."
          : `${concerns} families shared a concern. Check conditions on arrival.`,
      tone: "warn",
    };
  }
  if (wetGround >= 2) {
    return {
      emoji: "💧",
      title: "Wet Equipment",
      body: `${wetGround} reports of damp equipment — bring towels or water shoes.`,
      tone: "warn",
    };
  }
  if (crowded >= Math.max(3, clean + wetGround)) {
    return {
      emoji: "🎉",
      title: "Busy & Lively",
      body: "Expect a lively crowd right now. Great energy if your crew loves friends.",
      tone: "busy",
    };
  }
  if (clean + wetGround > 0) {
    return {
      emoji: "🌿",
      title: "Wide Open",
      body: "Families say it feels relaxed with good conditions.",
      tone: "chill",
    };
  }
  if (total === 0) {
    return {
      emoji: "📡",
      title: "Live reporting",
      body: "No updates yet — tap a button to share what you see.",
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
      return "Live signals refresh every 15 minutes — here’s the latest.";
  }
};

const AQI_BANDS = [
  { max: 50, label: "Good" },
  { max: 100, label: "Moderate" },
  { max: 150, label: "Unhealthy (Sensitive)" },
  { max: 200, label: "Unhealthy" },
  { max: 300, label: "Very Unhealthy" },
  { max: Infinity, label: "Hazardous" },
];

function describeAqi(value) {
  if (value == null) return "—";
  const band = AQI_BANDS.find((entry) => value <= entry.max) ?? AQI_BANDS[AQI_BANDS.length - 1];
  return `${value} • ${band.label}`;
}

function EnvMetric({ emoji, label, value }) {
  return (
    <div className="flex flex-col bg-white/80 rounded-lg border border-sky-100 px-2 py-2">
      <span className="text-[11px] font-semibold flex items-center gap-1">
        <span>{emoji}</span>
        <span>{label}</span>
      </span>
      <span className="text-[11px] text-[#0a2540] mt-1">{value ?? "—"}</span>
    </div>
  );
}

function formatTime(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function describeWeather(code) {
  if (code == null) return { icon: "🌤️", label: "Weather" };
  const numeric = Number(code);
  const match = WEATHER_CODE_MAP.find((entry) => entry.codes.includes(numeric));
  return match || { icon: "🌤️", label: "Weather" };
}

function formatWind(value) {
  if (value == null) return "Wind —";
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return "Wind —";
  return `Wind ${rounded} mph`;
}

/* ---------- Live Look (Outdoor) ---------- */
function OutdoorLiveLook({
  weather,
  environment,
  environmentStatus,
  counts,
  parkId,
  status,
  updating,
  record,
}) {
  const summary = useMemo(() => buildCrowdSummary(counts, record), [counts, record]);
  const liveCounts = useMemo(
    () => ({
      clean: Number(counts.clean) || 0,
      wetGround: Number(counts.conditions) || 0,
      crowded: Number(counts.crowded) || 0,
      concerns: Number(counts.concerns) || 0,
      closed: Number(counts.closed) || 0,
      iceCream: Number(counts.icecream) || 0,
    }),
    [counts]
  );
  const totalReports = useMemo(
    () =>
      Object.values(liveCounts).reduce(
        (sum, value) => sum + (Number.isFinite(value) ? Number(value) : 0),
        0
      ),
    [liveCounts]
  );
  const showSummaryCard = summary.tone !== "idle" && totalReports > 0;
  const statusLabel = renderStatusLabel(updating ? "updating" : status);
  const envCurrent = environment?.current ?? null;
  const metricsStatus =
    environmentStatus === "error"
      ? "error"
      : environmentStatus === "loading" || (!weather && environmentStatus !== "ready")
      ? "loading"
      : "ready";

  const envReady = metricsStatus === "ready" && envCurrent;
  const envLoading = metricsStatus === "loading";
  const envError = metricsStatus === "error";
  const weatherSummary = useMemo(
    () => describeWeather(weather?.weathercode),
    [weather?.weathercode]
  );
  const temperatureDisplay =
    weather?.temperature != null
      ? Math.round(weather.temperature)
      : envCurrent?.temperatureF != null
      ? Math.round(envCurrent.temperatureF)
      : null;
  const windText = formatWind(weather?.windspeed ?? envCurrent?.windMph);

  return (
    <div className="rounded-2xl border border-yellow-100 bg-[#fffdf3] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-[#0a2540] flex items-center gap-2">
            <span role="img" aria-hidden="true">
              ☀️
            </span>
            <span>Live Look</span>
          </h3>
          <p className="text-[11px] text-gray-500">
            Here's a snapshot of the current weather in your area.
          </p>
        </div>
        {temperatureDisplay != null ? (
          <div className="flex items-center gap-3 bg-white/90 rounded-xl px-3 py-2 border border-yellow-100 shadow-sm">
            <span className="text-2xl leading-none" aria-hidden="true">
              {weatherSummary.icon}
            </span>
            <div className="text-center flex-1">
              <p className="text-lg font-extrabold text-[#0a2540] leading-tight">
                {temperatureDisplay}°F
              </p>
              <p className="text-sm font-extrabold text-[#0a2540] uppercase tracking-wide">
                {weatherSummary.label}
              </p>
            </div>
            <span className="ml-auto text-[11px] text-[#0a2540]/70 whitespace-nowrap">
              {windText}
            </span>
          </div>
        ) : (
          <div className="text-center text-[11px] text-gray-500 italic">
            Weather snapshot loading…
          </div>
        )}
      </div>

      <div className="rounded-xl px-3 py-3 bg-[#e8f7ff] border border-sky-100 shadow-inner text-[11px] text-[#064b66]">
        <p className="font-semibold text-xs mb-2 flex items-center gap-2">
          <span>🌤</span>
          <span>Environment snapshot</span>
        </p>
        {envLoading && <p>Checking air quality…</p>}
        {envError && <p>Couldn't reach the weather service right now. Try again soon.</p>}
        {envReady && (
          <div className="grid grid-cols-2 gap-2">
            <EnvMetric label="Sunrise" value={formatTime(envCurrent.sunrise)} emoji="🌅" />
            <EnvMetric label="Sunset" value={formatTime(envCurrent.sunset)} emoji="🌙" />
            <EnvMetric
              label="Rain chance"
              value={
                envCurrent.precipitationProbability != null
                  ? `${Math.round(envCurrent.precipitationProbability)}%`
                  : "—"
              }
              emoji="🌧️"
            />
            <EnvMetric label="Air quality" value={describeAqi(envCurrent.airQuality?.usAqi)} emoji="😮‍💨" />
            <EnvMetric
              label="Feels like"
              value={
                envCurrent.temperatureF != null
                  ? `${Math.round(envCurrent.temperatureF)}°F`
                  : "—"
              }
              emoji="🌡️"
            />
            <EnvMetric label="Wind" value={windText.replace("Wind ", "") || "—"} emoji="🍃" />
          </div>
        )}
      </div>

      {showSummaryCard && (
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
              {totalReports} recent report{totalReports === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      )}

      <LiveReportSection
        dataUrl={CROWD_SENSE_URL}
        parkId={parkId}
        initialCounts={liveCounts}
        statusLabel={statusLabel}
      />
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

      <div className="bg-white/90 border border-dashed border-[#fbbf24]/70 rounded-xl px-3 py-3 text-[11px] text-[#92400e] flex flex-col gap-2">
        <div className="font-semibold flex items-center gap-2">
          <span>📣</span>
          <span>Live reporting — refreshes every 15 minutes</span>
        </div>
        <p className="text-[#92400e]/90">
          Tap a button to share the indoor vibe so other families know whether it feels chill or high-energy.
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs text-[#0a2540]">
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
      <header className="space-y-2">
        <h4 className="text-sm font-semibold text-[#0a2540] flex items-center gap-2">
          <span role="img" aria-hidden="true">
            🧺
          </span>
          Family Toolkit
        </h4>
        <p className="text-[11px] text-[#0a2540]/80">
          Quick links and pack lists to make the visit easy.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <ShareLinkButton
            icon="💬"
            label="Share a tip about this place"
            href={buildTipFormUrl(park)}
            onShare={() =>
              onShare(
                "Tip form opened in a new tab — thank you for helping other families!"
              )
            }
          />
        </div>
        {shareFeedback && (
          <div className="bg-white/90 border border-[#6a00f4]/30 text-[#6a00f4] text-xs rounded-lg px-3 py-2 shadow-sm">
            {shareFeedback}
          </div>
        )}
      </header>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-[#0a2540] mb-1">Highlights</p>
          <ul className="text-xs text-[#0a2540] leading-relaxed space-y-1">
            {highlights.length > 0 ? (
              highlights.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>🌳 Explore and let us know what you discover!</li>
            )}
          </ul>
        </div>

        <div className="bg-white/80 border border-pink-100 rounded-lg p-3">
          <p className="text-xs font-semibold text-[#0a2540] mb-2">Pack this</p>
          <ul className="text-[11px] text-[#0a2540] leading-relaxed list-disc ml-4 space-y-1">
            {packList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {hasTips && (
          <div className="bg-white/80 border border-pink-100 rounded-lg p-3 text-xs text-[#0a2540] space-y-2">
            <p className="font-semibold">Parent tips</p>
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

function ParkPhoto({ park, onShare }) {
  const [imgSrc, setImgSrc] = React.useState(null);

  React.useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const override = typeof park?.photoOverride === "string" ? park.photoOverride.trim() : "";
    const normalized = typeof park?.imageUrl === "string" ? park.imageUrl.trim() : "";
    const rawValue = typeof park?.imageUrlRaw === "string" ? park.imageUrlRaw.trim() : "";
    const reference =
      typeof park?.photoReference === "string" ? park.photoReference.trim() : "";

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
    }

    setImgSrc(resolved || null);
  }, [park?.photoOverride, park?.imageUrl, park?.imageUrlRaw, park?.photoReference]);

  const hasPhoto = Boolean(imgSrc);
  const locationLabel =
    park?.city || park?.state
      ? [park.city, park.state].filter(Boolean).join(", ")
      : "GoPlayThere";

  return (
    <div className="flex flex-col gap-2">
      {hasPhoto ? (
        <div className="relative w-full overflow-hidden rounded-lg border border-white shadow-sm aspect-[4/3]">
          <img
            src={imgSrc}
            alt={park?.name || "Playground Photo"}
            className="w-full h-full object-cover"
            onError={() => setImgSrc(null)}
          />
          <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide bg-black/55 text-white px-2 py-1 rounded-full">
            {locationLabel}
          </span>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#1fb6ff]/40 bg-gradient-to-br from-[#c3f1ff] via-[#a6e9ff] to-[#d7fff6] flex flex-col justify-center px-4 py-5 shadow-inner aspect-[4/3] w-full">
          <p className="text-sm font-semibold text-[#045472] text-center">📸 Photo coming soon!</p>
          <p className="text-[11px] text-[#045472]/75 leading-relaxed mt-2 text-center">
            Be the first to share a snap of {park?.name || "this playground"} and help families plan
            their day.
          </p>
        </div>
      )}
      {park?.photoCredit && (
        <p className="text-[10px] text-gray-500 italic flex items-center gap-1">
          <span>📸</span>
          <span>{park.photoCredit}</span>
        </p>
      )}
      <ShareLinkButton
        icon="📷"
        label="Share a Photo"
        href={buildPhotoFormUrl(park)}
        onShare={() =>
          onShare?.(
            "Photo form opened in a new tab — thank you for sharing!"
          )
        }
      />
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
