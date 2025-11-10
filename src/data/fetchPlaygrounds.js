// src/data/fetchPlaygrounds.js
import Papa from "papaparse";
import local from "./playgrounds.local.json";

async function parseSheetResponse(response) {
  try {
    const jsonAttempt = await response.clone().json();
    return jsonAttempt;
  } catch (jsonErr) {
    // Not JSON, fall back to CSV/text parsing
  }

  const text = await response.text();
  if (!text || !text.trim()) return [];

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors?.length) {
    console.warn("⚠️ CSV parse warnings:", parsed.errors);
  }
  return Array.isArray(parsed.data) ? parsed.data : [];
}

async function fetchFromSource(url) {
  const attempt = async (endpoint, label) => {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`${label} fetch failed ${res.status}`);
    }
    return parseSheetResponse(res);
  };

  try {
    return await attempt(url, "Direct");
  } catch (directErr) {
    console.warn(`⚠️ Direct fetch failed for ${url}, trying proxy:`, directErr);
    const proxyUrl = `https://corsproxy.io/?${url}`;
    return await attempt(proxyUrl, "Proxy");
  }
}

export async function fetchPlaygrounds() {
  const primaryUrl = import.meta.env.VITE_SHEET_JSON_URL;
  const fallbackCsvUrl = import.meta.env.VITE_SHEET_CSV_URL;
  const sources = [primaryUrl, fallbackCsvUrl].filter(Boolean);

  if (!sources.length) {
    console.warn("⚠️ No sheet URLs configured — using local data.");
    return local;
  }

  try {
    let json = null;
    let lastError = null;

    for (const source of sources) {
      try {
        console.log("🌐 Fetching playgrounds from:", source);
        json = await fetchFromSource(source);
        break;
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ Failed to load from ${source}:`, err);
      }
    }

    if (!json) {
      throw lastError || new Error("No sheet sources succeeded");
    }

    console.log("🧠 Raw sheet payload:", json);

    const data = Array.isArray(json)
      ? json
      : Array.isArray(json.data)
      ? json.data
      : [];

 if (typeof window !== "undefined") {
  window.lastPlaygrounds = data;
  console.log("🪄 window.lastPlaygrounds now holds", data.length, "entries");
}


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
        const overrideUrlCandidate =
          (typeof p.photoOverride === "string" && p.photoOverride.trim()) ||
          (typeof p.photo_override === "string" && p.photo_override.trim()) ||
          (typeof p.photoOverric === "string" && p.photoOverric.trim()) ||
          (typeof p.photoOverrideUrl === "string" && p.photoOverrideUrl.trim()) ||
          (typeof p.photo_override_url === "string" && p.photo_override_url.trim()) ||
          (typeof p["photo override"] === "string" && p["photo override"].trim()) ||
          (typeof p["Photo Override"] === "string" && p["Photo Override"].trim()) ||
          "";
        const overrideUrl =
          overrideUrlCandidate && overrideUrlCandidate.match(/^https?:\/\//i)
            ? overrideUrlCandidate
            : "";
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
        const photoReference =
          typeof photoRefCandidate === "string" ? photoRefCandidate.trim() : "";

        let imageUrl = "";
        let imageUrlRaw = cleanedLink;
        if (overrideUrl) {
          imageUrl = overrideUrl;
          imageUrlRaw = overrideUrl;
        } else if (typeof cleanedLink === "string" && cleanedLink.startsWith("http")) {
          imageUrl = cleanedLink;
          imageUrlRaw = cleanedLink;
        } else if (
          typeof photoRefCandidate === "string" &&
          photoRefCandidate.trim().length > 45
        ) {
          if (hasApiKey) {
            imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRefCandidate
              .trim()
              .replace(/\s+/g, "")}&key=${apiKey}`;
            imageUrlRaw = photoRefCandidate.trim();
          }
        }
        // Fall back to any direct URL if the ref lookup failed.
        if (!imageUrl && cleanedLink && cleanedLink.startsWith("http")) {
          imageUrl = cleanedLink;
          imageUrlRaw = cleanedLink;
        }

        const altNameRaw =
          p.aka ||
          p.AKA ||
          p.altName ||
          p.alt_name ||
          p.alternateName ||
          p.alternate_name ||
          p.alternativeName ||
          p.alsoKnownAs ||
          p.also_known_as ||
          p.nickname ||
          p.nickName ||
          "";

        const tipText =
          (typeof p.tipText === "string" && p.tipText) ||
          (typeof p.tip_text === "string" && p.tip_text) ||
          (typeof p.parentTip === "string" && p.parentTip) ||
          "";
        const tipSource =
          (typeof p.tipSource === "string" && p.tipSource) ||
          (typeof p.tip_source === "string" && p.tip_source) ||
          (typeof p.source === "string" && p.source) ||
          "";

        const normalizedAka =
          typeof altNameRaw === "string" ? altNameRaw.trim() : "";

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
          photoOverride: overrideUrl,
          photoCredit:
            typeof p.photoCredit === "string"
              ? p.photoCredit.trim()
            : typeof p.photo_credit === "string"
            ? p.photo_credit.trim()
            : "",
          imageUrlRaw,
          // 👇 here's the fix
          imageUrl,
          photoReference,
          tipText,
          tipSource,
          akaName: normalizedAka,
          aka: normalizedAka,
        };
      })
      .filter(Boolean);

    console.log(`✅ Loaded parks: ${cleaned.length}`);
    return cleaned;
  } catch (e) {
    console.error("🚨 fetchPlaygrounds failed:", e);
    console.warn("⚠️ Falling back to local data.");
    if (Array.isArray(local)) return local;
    if (Array.isArray(local?.data)) return local.data;
    if (local && typeof local === "object") return [local];
    return [];
  }
}
