// src/components/LiveReportSection.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { refreshCrowdSense } from "../hooks/useCrowdSense.js";

const PERSIST_MS = 15 * 60 * 1000;
const BUTTON_COOLDOWN_MS = 10_000;
const FLASH_DURATION_MS = 600;
const STORAGE_PREFIX = "playgrounded::live::";

const BUTTONS = [
  { key: "clean", payload: "clean", icon: "🧼", label: "Clean", legend: "litter-free" },
  { key: "wetGround", payload: "conditions", icon: "💧", label: "Wet Ground", legend: "surfaces are wet" },
  { key: "crowded", payload: "crowded", icon: "🚸", label: "Crowded", legend: "busy now" },
  { key: "concerns", payload: "concerns", icon: "⚠️", label: "Concerns", legend: "needs attention" },
  { key: "closed", payload: "closed", icon: "🚫", label: "Closed", legend: "not open" },
  { key: "iceCream", payload: "icecream", icon: "🍦", label: "Ice Cream", legend: "treat truck spotted" },
];

const EMPTY_COUNTS = BUTTONS.reduce((acc, btn) => {
  acc[btn.key] = 0;
  return acc;
}, {});

const CONCERNS_JEWEL_TONES = {
  background: "bg-gradient-to-r from-[#f43f5e] via-[#ec4899] to-[#d946ef]",
  border: "border-[#ec4899]",
  text: "text-white",
};

const STATUS_STYLES = {
  clean: {
    tone: "positive",
    palette: {
      background: "bg-[#dcfce7]",
      border: "border-[#86efac]",
      text: "text-[#065f46]",
      icon: "🧼",
    },
    message: (count, { localOnly } = {}) =>
      localOnly
        ? "You marked this park clean — thanks for keeping families informed!"
        : `${count === 1 ? "One family" : `${count} families`} say everything looks tidy and ready to play!`,
  },
  wetGround: {
    tone: "info",
    palette: {
      background: "bg-[#e0f2fe]",
      border: "border-[#93c5fd]",
      text: "text-[#0f172a]",
      icon: "💧",
    },
    message: (count, { localOnly } = {}) =>
      localOnly
        ? "You marked wet equipment — we’ll keep it highlighted for 15 minutes."
        : `${count === 1 ? "One report" : `${count} reports`} of damp equipment — pack towels or water shoes.`,
  },
  crowded: {
    tone: "warn",
    palette: {
      background: "bg-[#fef3c7]",
      border: "border-[#fbbf24]",
      text: "text-[#7c2d12]",
      icon: "🚸",
    },
    message: (count, { localOnly } = {}) =>
      localOnly
        ? "You marked it crowded — thanks for the heads-up!"
        : `${count === 1 ? "One family" : `${count} families`} say it's hopping right now — expect a lively crowd.`,
  },
  concerns: {
    tone: "danger",
    palette: {
      ...CONCERNS_JEWEL_TONES,
      icon: "⚠️",
    },
    message: (count, { localOnly } = {}) =>
      localOnly
        ? "You flagged a concern — other families will see it for the next 15 minutes."
        : `${count === 1 ? "One family" : `${count} families`} spotted something that needs attention.`,
  },
  closed: {
    tone: "danger",
    palette: {
      background: "bg-[#fee2e2]",
      border: "border-[#fca5a5]",
      text: "text-[#7f1d1d]",
      icon: "🚫",
    },
    message: (count, { localOnly } = {}) =>
      localOnly
        ? "You marked this playground closed — thanks for letting everyone know!"
        : `${count === 1 ? "One family says" : `${count} families say`} this playground is currently closed.`,
  },
  iceCream: {
    tone: "treat",
    palette: {
      background: "bg-[#fdf2f8]",
      border: "border-[#f9a8d4]",
      text: "text-[#831843]",
      icon: "🍦",
    },
    message: (count, { localOnly } = {}) =>
      localOnly
        ? "You spotted a treat truck — sweet!"
        : `${count === 1 ? "Sweet tip" : `${count} sweet tips`}: Treat truck spotted nearby!`,
  },
};

const BUTTON_ACTIVE_STYLES = {
  clean: {
    background: "bg-gradient-to-r from-[#4ade80] via-[#86efac] to-[#bbf7d0]",
    border: "border-[#4ade80]",
    text: "text-[#064e3b]",
  },
  wetGround: {
    background: "bg-gradient-to-r from-[#38bdf8] via-[#22d3ee] to-[#bae6fd]",
    border: "border-[#38bdf8]",
    text: "text-[#0f172a]",
  },
  crowded: {
    background: "bg-gradient-to-r from-[#fbbf24] via-[#f59e0b] to-[#f97316]",
    border: "border-[#f59e0b]",
    text: "text-[#7c2d12]",
  },
  concerns: {
    ...CONCERNS_JEWEL_TONES,
  },
  closed: {
    background: "bg-gradient-to-r from-[#fca5a5] via-[#f87171] to-[#fb7185]",
    border: "border-[#f87171]",
    text: "text-[#7f1d1d]",
  },
  iceCream: {
    background: "bg-gradient-to-r from-[#f9a8d4] via-[#f472b6] to-[#fbcfe8]",
    border: "border-[#f472b6]",
    text: "text-[#831843]",
  },
};

const BANNER_PRIORITY = ["closed", "concerns", "crowded", "wetGround", "clean", "iceCream"];

const REPORT_BAR_COLORS = {
  clean: "bg-gradient-to-r from-[#bbf7d0] via-[#86efac] to-[#34d399]",
  wetGround: "bg-gradient-to-r from-[#bae6fd] via-[#38bdf8] to-[#0ea5e9]",
  crowded: "bg-gradient-to-r from-[#fde68a] via-[#fbbf24] to-[#f97316]",
  concerns: "bg-gradient-to-r from-[#fda4af] via-[#fb7185] to-[#ec4899]",
  closed: "bg-gradient-to-r from-[#fecaca] via-[#f87171] to-[#ef4444]",
  iceCream: "bg-gradient-to-r from-[#fbcfe8] via-[#f472b6] to-[#db2777]",
};

const BANNER_STYLES = {
  danger: {
    border: "border-[#fecaca]",
    background: "bg-[#fee2e2]",
    text: "text-[#7f1d1d]",
    icon: "🚨",
  },
  warn: {
    border: "border-[#fde68a]",
    background: "bg-[#fef3c7]",
    text: "text-[#92400e]",
    icon: "⚠️",
  },
  info: {
    border: "border-[#bfdbfe]",
    background: "bg-[#e0f2fe]",
    text: "text-[#0f172a]",
    icon: "ℹ️",
  },
  positive: {
    border: "border-[#bbf7d0]",
    background: "bg-[#ecfdf5]",
    text: "text-[#047857]",
    icon: "💚",
  },
  treat: {
    border: "border-[#fbcfe8]",
    background: "bg-[#fdf2f8]",
    text: "text-[#9d174d]",
    icon: "🍦",
  },
};

export default function LiveReportSection({ dataUrl, parkId, initialCounts = {}, statusLabel }) {
  const normalizedInitial = useMemo(
    () => ({ ...EMPTY_COUNTS, ...normalizeCounts(initialCounts) }),
    [initialCounts]
  );

  const [counts, setCounts] = useState(normalizedInitial);
  const [status, setStatus] = useState("ready");
  const [submitError, setSubmitError] = useState("");
  const [disabledMap, setDisabledMap] = useState({});
  const [sentMap, setSentMap] = useState({});
  const [flashKey, setFlashKey] = useState(null);
  const [localSignals, setLocalSignals] = useState({});

  const disableTimers = useRef({});
  const flashTimers = useRef({});
  const localExpiryTimers = useRef({});

  const storageKey = useMemo(
    () => (parkId ? `${STORAGE_PREFIX}${parkId}` : null),
    [parkId]
  );

  const persistSignals = useCallback(
    (map) => {
      if (!storageKey || typeof window === "undefined") return;
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(map));
      } catch (err) {
        console.warn("LiveReportSection persist failed", err);
      }
    },
    [storageKey]
  );

  const pruneSignals = useCallback((map = {}) => {
    const now = Date.now();
    const next = {};
    Object.entries(map).forEach(([key, value]) => {
      const ts = Number(value);
      if (Number.isFinite(ts) && ts > now) {
        next[key] = ts;
      }
    });
    return next;
  }, []);

  const clearDisableTimer = useCallback((key) => {
    if (disableTimers.current[key]) {
      window.clearTimeout(disableTimers.current[key]);
      delete disableTimers.current[key];
    }
  }, []);

  const clearFlashTimer = useCallback((key) => {
    if (flashTimers.current[key]) {
      window.clearTimeout(flashTimers.current[key]);
      delete flashTimers.current[key];
    }
  }, []);

  const clearLocalTimer = useCallback((key) => {
    if (localExpiryTimers.current[key]) {
      window.clearTimeout(localExpiryTimers.current[key]);
      delete localExpiryTimers.current[key];
    }
  }, []);

  const removeLocalSignal = useCallback(
    (key) => {
      if (!key) return;
      clearLocalTimer(key);
      setLocalSignals((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        persistSignals(next);
        return next;
      });
    },
    [clearLocalTimer, persistSignals]
  );

  const scheduleLocalExpiry = useCallback(
    (key, expiresAt) => {
      if (typeof window === "undefined") return;
      const delay = Math.max((expiresAt ?? 0) - Date.now(), 0);
      clearLocalTimer(key);
      if (delay <= 0) {
        removeLocalSignal(key);
        return;
      }
      localExpiryTimers.current[key] = window.setTimeout(() => {
        delete localExpiryTimers.current[key];
        removeLocalSignal(key);
      }, delay);
    },
    [clearLocalTimer, removeLocalSignal]
  );

  useEffect(() => {
    setCounts(normalizedInitial);
    setStatus("ready");
  }, [normalizedInitial]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      const cleaned = pruneSignals(parsed);
      setLocalSignals(cleaned);
      persistSignals(cleaned);
      Object.entries(cleaned).forEach(([key, expiresAt]) => {
        scheduleLocalExpiry(key, Number(expiresAt));
      });
    } catch (err) {
      console.warn("LiveReportSection storage load failed", err);
    }
  }, [storageKey, pruneSignals, persistSignals, scheduleLocalExpiry]);

  useEffect(
    () => () => {
      Object.values(disableTimers.current).forEach((timer) => window.clearTimeout(timer));
      Object.values(flashTimers.current).forEach((timer) => window.clearTimeout(timer));
      Object.values(localExpiryTimers.current).forEach((timer) => window.clearTimeout(timer));
      disableTimers.current = {};
      flashTimers.current = {};
      localExpiryTimers.current = {};
    },
    []
  );

  const markCooldown = useCallback(
    (key) => {
      if (typeof window === "undefined") return;
      clearDisableTimer(key);
      disableTimers.current[key] = window.setTimeout(() => {
        setDisabledMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setSentMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        clearDisableTimer(key);
      }, BUTTON_COOLDOWN_MS);
    },
    [clearDisableTimer]
  );

  const triggerFlash = useCallback(
    (key) => {
      clearFlashTimer(key);
      setFlashKey(key);
      flashTimers.current[key] = window.setTimeout(() => {
        setFlashKey((prev) => (prev === key ? null : prev));
        clearFlashTimer(key);
      }, FLASH_DURATION_MS);
    },
    [clearFlashTimer]
  );

  const statusBanners = useMemo(() => {
    return BUTTONS.map(({ key }) => {
      const details = STATUS_STYLES[key];
      if (!details) return null;
      const serverCount = Number(counts[key]) || 0;
      const localActive = localSignals[key] && localSignals[key] > Date.now();
      const effectiveCount = Math.max(serverCount, localActive ? 1 : 0);
      if (effectiveCount <= 0) return null;
      const localOnly = serverCount === 0 && localActive;
      const tone = details.tone || "info";
      const basePalette = details.palette || BANNER_STYLES[tone] || BANNER_STYLES.info;
      const palette = {
        ...basePalette,
        icon: basePalette.icon ?? BANNER_STYLES[tone]?.icon ?? "ℹ️",
      };
      return {
        key,
        palette,
        message: details.message(effectiveCount, { localOnly }),
        localOnly,
      };
    }).filter(Boolean);
  }, [counts, localSignals]);

  const orderedStatusBanners = useMemo(() => {
    if (statusBanners.length === 0) return [];
    const rank = (key) => {
      const idx = BANNER_PRIORITY.indexOf(key);
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };
    return [...statusBanners].sort((a, b) => rank(a.key) - rank(b.key));
  }, [statusBanners]);

  const statusHighlights = useMemo(() => {
    return BUTTONS.map(({ key, label, legend, icon }) => {
      const serverCount = Number(counts[key]) || 0;
      const localActive = localSignals[key] && localSignals[key] > Date.now();
      const effectiveCount = Math.max(serverCount, localActive ? 1 : 0);
      if (effectiveCount <= 0) return null;
      return {
        key,
        label,
        legend,
        count: effectiveCount,
        icon,
        localOnly: serverCount === 0 && localActive,
      };
    }).filter(Boolean);
  }, [counts, localSignals]);

  const hasReports = statusHighlights.length > 0;

  const totalReports = useMemo(
    () => statusHighlights.reduce((sum, item) => sum + (item?.count || 0), 0),
    [statusHighlights]
  );
  const maxReportCount = useMemo(() => {
    return statusHighlights.reduce((max, item) => {
      const value = Number(item?.count) || 0;
      return value > max ? value : max;
    }, 0);
  }, [statusHighlights]);

  const handleReport = useCallback(
    async (button) => {
      const { key, payload } = button;
      const now = Date.now();
      const localExpires = localSignals[key] || 0;
      const localActive = localExpires > now;

      if (localActive) {
        triggerFlash(key);
        removeLocalSignal(key);
        setCounts((prev) => ({
          ...prev,
          [key]: Math.max((Number(prev[key]) || 1) - 1, 0),
        }));
        setDisabledMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setSentMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setStatus("ready");
        setSubmitError("");
        return;
      }

      if (!dataUrl || !parkId) {
        setSubmitError("⚠️ Could not submit update.");
        return;
      }

      triggerFlash(key);
      setDisabledMap((prev) => ({ ...prev, [key]: true }));
      setCounts((prev) => ({
        ...prev,
        [key]: (Number(prev[key]) || 0) + 1,
      }));
      setSubmitError("");

      try {
        setStatus("loading");
        let targetUrl = dataUrl;
        try {
          const url = new URL(dataUrl);
          url.searchParams.set("parkId", String(parkId));
          targetUrl = url.toString();
        } catch (err) {
          console.warn("LiveReportSection URL parse fallback", err);
        }

        const payloadForm = new URLSearchParams({
          parkId: String(parkId),
          signalType: "feedback",
          value: payload,
          type: payload,
        });

        await safeFetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: payloadForm.toString(),
        });

        const expiresAt = Date.now() + PERSIST_MS;
        setLocalSignals((prev) => {
          const next = { ...prev, [key]: expiresAt };
          persistSignals(next);
          return next;
        });
        scheduleLocalExpiry(key, expiresAt);
        markCooldown(key);
        setSentMap((prev) => ({ ...prev, [key]: true }));
        setStatus("ready");
        refreshCrowdSense().catch(() => {});
      } catch (err) {
        console.error("LiveReportSection submit failed", err);
        setSubmitError("⚠️ Could not submit update.");
        setStatus("error");
        setCounts((prev) => ({
          ...prev,
          [key]: Math.max((Number(prev[key]) || 1) - 1, 0),
        }));
        setDisabledMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setSentMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [dataUrl, parkId, localSignals, triggerFlash, persistSignals, scheduleLocalExpiry, markCooldown, removeLocalSignal]
  );

  useEffect(() => {
    if (!submitError) return undefined;
    const timer = window.setTimeout(() => setSubmitError(""), 4000);
    return () => window.clearTimeout(timer);
  }, [submitError]);

  const headingNote = status === "loading"
    ? "Sending your update…"
    : status === "error"
    ? "Live reporting temporarily offline"
    : statusLabel || "";

  const showCta = orderedStatusBanners.length === 0;

  return (
    <section className="rounded-2xl border border-yellow-100 bg-white/95 p-4 md:p-6 shadow-sm flex flex-col gap-5">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h3 className="text-sm font-semibold text-[#0a2540] uppercase tracking-wide">
          Live Reporting — Family Updates
        </h3>
        {headingNote && <span className="text-[11px] text-gray-500">{headingNote}</span>}
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {BUTTONS.map(({ key, icon, label, payload, legend }) => {
          const serverCount = Number(counts[key]) || 0;
          const localExpires = localSignals[key] || 0;
          const localActive = localExpires > Date.now();
          const countValue = Math.max(serverCount, localActive ? 1 : 0);
          const cooldownActive = Boolean(disabledMap[key]);
            const disabled = !dataUrl || cooldownActive;

            const baseClasses = countValue > 0 && BUTTON_ACTIVE_STYLES[key]
              ? `${BUTTON_ACTIVE_STYLES[key].background} ${BUTTON_ACTIVE_STYLES[key].border} ${BUTTON_ACTIVE_STYLES[key].text}`
              : "bg-[#f1f5ff] border-[#dbeafe] text-[#0a2540]";
            const glowClass = cooldownActive
              ? "ring-2 ring-[#facc15] ring-offset-2 ring-offset-white"
              : localActive
              ? "ring-2 ring-[#38bdf8] ring-offset-2 ring-offset-white"
              : "";
            const flashClass = flashKey === key ? "animate-pulse" : "";

            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => handleReport({ key, payload })}
                className={`flex flex-col items-center justify-between gap-1 rounded-xl px-3 py-3 text-sm shadow-sm transition disabled:cursor-not-allowed disabled:opacity-80 ${baseClasses} ${glowClass} ${flashClass}`}
              >
                <span className="text-lg leading-none">{icon}</span>
                <span className="font-semibold">{label}</span>
                <span className={`text-[11px] tabular-nums ${countValue > 0 ? "text-current" : "text-gray-600"}`}>
                  {countValue}
                </span>
                {sentMap[key] && (
                  <span className="text-[11px] text-emerald-600 font-medium">✅ Sent!</span>
                )}
                {(sentMap[key] || localActive) && (
                  <span className="text-[10px] text-[#0a2540]/70">Tap again to undo</span>
                )}
              </button>
            );
          })}
        </div>

      <p className="text-[10px] text-gray-500">
        Clean = litter-free · Wet Ground = surfaces are wet · Crowded = busy now · Concerns = safety alerts · Closed =
        not open · Ice Cream = treat truck spotted.
      </p>

      <div>
        {showCta ? (
          <p className="text-[11px] text-slate-600">
            No updates yet. Add the first report so families know what to expect.
          </p>
        ) : (
          <p className="text-[11px] text-slate-600">
            Live look from local families — {totalReports} update{totalReports === 1 ? "" : "s"} today.
          </p>
        )}
      </div>

      {hasReports && (
        <div className="flex flex-col gap-3">
          {statusHighlights.map(({ key, label, legend, count, icon, localOnly }) => {
            const palette = BUTTON_ACTIVE_STYLES[key];
            const paletteClasses = palette
              ? `${palette.background} ${palette.border} ${palette.text}`
              : "bg-[#f8fafc] border-[#e2e8f0] text-[#0a2540]";

            return (
              <div
                key={key}
                className={`rounded-xl border px-3 py-3 shadow-sm flex items-center gap-3 ${paletteClasses}`}
              >
                <span className="text-2xl leading-none">{icon}</span>
                <div className="flex-1">
                  <div className="flex items-baseline gap-1 text-current">
                    <span className="text-lg font-extrabold tabular-nums">{count}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                      {count === 1 ? "family" : "families"}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-current">{label}</p>
                  <p className="text-[11px] leading-snug opacity-90">
                    {localOnly ? "You shared this report." : legend}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {submitError && <p className="text-xs text-red-600 font-medium">{submitError}</p>}
    </section>
  );
}

async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (res.ok) return res;
    throw new Error(`Fetch failed with status ${res.status}`);
  } catch (err) {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, options);
    if (res.ok) return res;
    throw err;
  }
}

function normalizeCounts(source = {}) {
  const tallies = { ...EMPTY_COUNTS };
  Object.entries(source).forEach(([key, value]) => {
    const target = mapKey(key);
    if (target) {
      tallies[target] = Number(value) || 0;
    }
  });
  return tallies;
}

function mapKey(key) {
  const lower = String(key || "").toLowerCase();
  switch (lower) {
    case "clean":
      return "clean";
    case "wetground":
    case "wet_ground":
    case "wet":
    case "conditions":
      return "wetGround";
    case "crowded":
    case "busy":
      return "crowded";
    case "concerns":
    case "concern":
      return "concerns";
    case "closed":
      return "closed";
    case "icecream":
    case "ice_cream":
    case "ice":
    case "treat":
      return "iceCream";
    default:
      return null;
  }
}
