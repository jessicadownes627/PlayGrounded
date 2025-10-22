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

    const data = Array.isArray(json)
      ? json
      : Array.isArray(json.data)
      ? json.data
      : [];

    console.log("📦 Parsed playgrounds array:", data);
    window.lastPlaygrounds = data; // for debugging

    // ✅ Normalize data and include adaptiveEquipment + imageUrl
    const cleaned = data
      .map((p) => {
        const lat =
          parseFloat(p.lat) ||
          parseFloat(p.Lat) ||
          parseFloat(p.latitude) ||
          parseFloat(p.Latitude);
        const lng =
          parseFloat(p.lng) ||
          parseFloat(p.Lng) ||
          parseFloat(p.longitude) ||
          parseFloat(p.Longitude);

        if (!isFinite(lat) || !isFinite(lng)) return null;

        // ✅ normalize imageUrl — handle embedded IMAGE() formulas
        let imageUrl = "";
        if (typeof p.imageUrl === "string") {
          // If it looks like =IMAGE("https://...")
          const match = p.imageUrl.match(/https?:\/\/[^\s")]+/);
          if (match) imageUrl = match[0];
          else imageUrl = p.imageUrl;
        }

        return {
          id: String(p.id ?? `${lat},${lng}`),
          name: String(p.name ?? "Untitled playground"),
          address: String(p.address ?? ""),
          lat,
          lng,
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
          adaptiveEquipment: p.adaptiveEquipment ?? "",
          notes: p.notes ?? "",
          city: p.city ?? "",
          state: p.state ?? "",
          // 👇 here's the fix
          imageUrl,
        };
      })
      .filter(Boolean);

    console.log(`✅ Loaded parks: ${cleaned.length}`);
    return cleaned;
  } catch (e) {
    console.error("🚨 fetchPlaygrounds failed:", e);
    console.warn("⚠️ Falling back to local data.");
    return local;
  }
}
