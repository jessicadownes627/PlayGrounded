// src/data/fetchPlaygrounds.js
import local from "./playgrounds.local.json";

export async function fetchPlaygrounds() {
  const url = import.meta.env.VITE_SHEET_JSON_URL;

  if (!url) {
    console.warn("⚠️ No VITE_SHEET_JSON_URL found — using local data.");
    return local;
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Sheet fetch failed ${res.status}`);

    const json = await res.json();
    console.log("🧠 Raw JSON from Apps Script:", json);

    // ✅ Works whether your script returns {ok:true,data:[…]} or just […]
    const data = Array.isArray(json)
      ? json
      : Array.isArray(json.data)
      ? json.data
      : [];

    console.log("📦 Parsed playgrounds array:", data);

    return data
      .filter((p) => p.lat || p.Lat)
      .map((p) => ({
        id: String(p.id ?? `${p.Lat},${p.Lng}`),
        name: String(p.name ?? "Untitled playground"),
        address: String(p.address ?? ""),
        lat: Number(p.lat ?? p.Lat),
        lng: Number(p.lng ?? p.Lng),
        fenced:
          p.fenced === true ||
          p.fenced === "TRUE" ||
          String(p.fenced).toLowerCase() === "yes",
        dogsAllowed:
          p.dogsAllowed === true ||
          p.dogsAllowed === "TRUE" ||
          String(p.dogsAllowed).toLowerCase() === "yes",
        bathrooms:
          p.bathrooms === true ||
          p.bathrooms === "TRUE" ||
          String(p.bathrooms).toLowerCase() === "yes",
        shade: p.shade ?? "",
        parking: p.parking ?? "",
        lighting: p.lighting ?? "",
        notes: p.notes ?? "",
        city: p.city ?? "",
        state: p.state ?? "",
      }));
  } catch (e) {
    console.error("🚨 fetchPlaygrounds failed:", e);
    console.warn("⚠️ Falling back to local data.");
    return local;
  }
}
