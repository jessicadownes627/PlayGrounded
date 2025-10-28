// src/hooks/useCrowdSense.js
import { useEffect, useMemo, useState } from "react";

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwfk-5FhIJxcowwUCMAd27KIVKTCct-9Hx-ym4Io3H_3STz6E3QgQrDKtkAxu9bo8vS/exec";

const POLL_INTERVAL_MS = 30_000;

let pollStarted = false;
let pollTimer = null;
let inflight = null;
let latestPayload = null;
let latestError = null;

const subscribers = new Set();

const baseCounts = {
  clean: 0,
  conditions: 0,
  crowded: 0,
  concerns: 0,
  closed: 0,
  icecream: 0,
};

const normaliseId = (value) => String(value ?? "").trim();

const extractRows = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const findEntry = (payload, parkId) => {
  if (!parkId) return null;
  const rows = extractRows(payload);
  const target = normaliseId(parkId);
  return rows.find((row) => normaliseId(row?.id) === target) ?? null;
};

const notify = (event) => {
  subscribers.forEach((cb) => {
    try {
      cb(event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("CrowdSense subscriber error", err);
    }
  });
};

const fetchCrowdFeed = async () => {
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const response = await fetch(SCRIPT_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`CrowdSense fetch failed: ${response.status}`);

      const json = await response.json();
      latestPayload = json;
      latestError = null;
      notify({ type: "data", payload: latestPayload, receivedAt: Date.now() });
      return json;
    } catch (err) {
      latestError = err;
      notify({ type: "error", error: err });
      throw err;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
};

const ensurePolling = () => {
  if (pollStarted) return;
  pollStarted = true;
  if (typeof window !== "undefined") {
    fetchCrowdFeed().catch(() => {});
    pollTimer = window.setInterval(() => {
      fetchCrowdFeed().catch(() => {});
    }, POLL_INTERVAL_MS);
  }
};

export const refreshCrowdSense = () => fetchCrowdFeed();

export function useCrowdSense(parkId) {
  const [status, setStatus] = useState(() => {
    if (!parkId) return "idle";
    if (latestPayload) return "ready";
    if (latestError) return "error";
    return "loading";
  });
  const [entry, setEntry] = useState(() => findEntry(latestPayload, parkId));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!parkId) return undefined;

    ensurePolling();

    // Sync with latest payload immediately
    setEntry(findEntry(latestPayload, parkId));
    if (latestError) setStatus("error");
    else if (latestPayload) setStatus("ready");
    else setStatus("loading");

    const listener = (event) => {
      if (event.type === "data") {
        setEntry(findEntry(event.payload, parkId));
        setStatus("ready");
      } else if (event.type === "error") {
        setStatus("error");
      }
    };

    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }, [parkId]);

  useEffect(
    () => () => {
      if (pollTimer && subscribers.size === 0 && typeof window !== "undefined") {
        window.clearInterval(pollTimer);
        pollTimer = null;
        pollStarted = false;
      }
    },
    []
  );

  const counts = useMemo(() => {
    const rawCounts = entry?.counts ?? entry ?? {};
    return {
      clean: Number(rawCounts.clean ?? baseCounts.clean) || 0,
      conditions: Number(rawCounts.conditions ?? baseCounts.conditions) || 0,
      crowded: Number(rawCounts.crowded ?? rawCounts.busy ?? baseCounts.crowded) || 0,
      concerns: Number(rawCounts.concerns ?? baseCounts.concerns) || 0,
      closed: Number(rawCounts.closed ?? baseCounts.closed) || 0,
      icecream: Number(rawCounts.icecream ?? rawCounts.ice ?? baseCounts.icecream) || 0,
    };
  }, [entry]);

  const vote = async (value) => {
    if (!parkId || !value) return;
    setIsSubmitting(true);
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parkId,
          signalType: "feedback",
          value,
        }),
      });
      await refreshCrowdSense();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("CrowdSense vote failed", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    status: isSubmitting ? "updating" : status,
    counts,
    record: entry,
    vote,
    isSubmitting,
  };
}
