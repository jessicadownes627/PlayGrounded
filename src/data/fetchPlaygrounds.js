// src/data/fetchPlaygrounds.js
import local from "./playgrounds.local.json";

export async function fetchPlaygrounds() {
  const url = import.meta.env.VITE_SHEET_JSON_URL;

  if (!url) {
    console.warn("⚠️ No VITE_SHEET_JSON_URL found — using local data.");
    return local;
  }

  try {
    // ✅ Use a working CORS-safe proxy (Cloudflare mirror of AllOrigins)
    const proxyUrl = `https://api.allorigins.workers.dev/get?url=${encodeURIComponent(url)}`;

    let json;
    try {
      const proxyRes = await fetch(proxyUrl);
      if (!proxyRes.ok) throw new Error(`Proxy fetch failed ${proxyRes.status}`);

      const proxyJson = await proxyRes.json();
      json = JSON.parse(proxyJson.contents);
    } catch (err) {
      console.warn("⚠️ Proxy failed, falling back to direct fetch:", err);
      const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, {
        cache: "no-store",
      });

      json = await res.json();
    }

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
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        const hasApiKey = typeof apiKey === "string" && apiKey.trim().length > 0;
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

        // ✅ normalise any photo inputs coming from the sheet / Apps Script
        const rawImageFields = [
          p.imageUrl,
          p.image,
          p.photo,
          p.photoUrl,
          p.photo_url,
        ].find((value) => typeof value === "string" && value.trim().length > 0);
        const cleanedLink =
          typeof rawImageFields === "string"
            ? rawImageFields.match(/https?:\/\/[^\s")]+/i)?.[0] ?? rawImageFields
            : "";
        const photoRefCandidate =
          p.imageUrlRaw ||
          p.photoReference ||
          p.photo_reference ||
          p.photoRef ||
          p.placePhotoRef;

        let imageUrl = "";
        if (typeof cleanedLink === "string" && cleanedLink.startsWith("http")) {
          imageUrl = cleanedLink;
        } else if (
          typeof photoRefCandidate === "string" &&
          photoRefCandidate.trim().length > 45
        ) {
          if (hasApiKey) {
            imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRefCandidate
              .trim()
              .replace(/\s+/g, "")}&key=${apiKey}`;
          }
        }
        // Fall back to any direct URL if the ref lookup failed.
        if (!imageUrl && cleanedLink && cleanedLink.startsWith("http")) {
          imageUrl = cleanedLink;
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
          seating: p.seating ?? "",
          packList: p.packList ?? p.pack_list ?? p.pack_items ?? "",
          parentTip: p.parentTip ?? p.parent_tip ?? "",
          imageUrlRaw:
            typeof photoRefCandidate === "string" && photoRefCandidate.trim()
              ? photoRefCandidate.trim()
              : cleanedLink,
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
