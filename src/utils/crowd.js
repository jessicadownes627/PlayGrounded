export async function sendFeedback(parkId, value) {
  try {
    await fetch(import.meta.env.VITE_SHEET_JSON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parkId, signalType: 'feedback', value })
    });
  } catch (e) { console.error(e); }
}

export async function sendPresence(parkId, cell) {
  try {
    await fetch(import.meta.env.VITE_SHEET_JSON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parkId, signalType: 'presence', cell })
    });
  } catch (e) { console.error(e); }
}

// Optional: coarse location cell for privacy (≈250m)
export function toCell(lat, lng, meters = 250) {
  const latMeters = 111320;
  const lngMeters = 111320 * Math.cos(lat * Math.PI / 180);
  const y = Math.round((lat * latMeters) / meters) * meters;
  const x = Math.round((lng * lngMeters) / meters) * meters;
  return `${Math.round(y)}:${Math.round(x)}:${meters}`;
}
