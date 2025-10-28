// src/data/fetchIndoorPlayplaces.js
export async function fetchIndoorPlayplaces() {
  const SHEET_URL =
    "https://script.google.com/macros/s/AKfycbynw3LZHmHrVEQPmJTgw0ykgVhiR9kd0_fW3pq7OFd-aPZeOqP0cZQAQ3ebf-UyDegT/exec";

  try {
    const response = await fetch(SHEET_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid data format from Apps Script");

    const cleaned = data
      .filter((p) => p.name && p.lat && p.lng)
      .map((p) => {
        const lat = parseFloat(p.lat);
        const lng = parseFloat(p.lng);

        // Extract image URL if it's wrapped in =IMAGE("...")
        let imageUrl = "";
        if (typeof p.imageUrl === "string") {
          const match = p.imageUrl.match(/https?:\/\/[^\s")]+/);
          imageUrl = match ? match[0] : p.imageUrl;
        }

        return {
          id: String(p.id ?? `${lat},${lng}`),
          name: p.name ?? "Unnamed Indoor Play Space",
          address: p.address ?? "",
          lat,
          lng,

          // Base info
          city: p.city ?? "",
          state: p.state ?? "",
          description: p.description ?? "",

          // Practical info
          ageRange: p.ageRange ?? "",
          admissionFee: p.admissionFee ?? "",
          admissionNotes: p.admissionNotes ?? "",
          foodAvailable: p.foodAvailable ?? "",
          bathrooms: p.bathrooms ?? "",
          parking: p.parking ?? "",
          adaptiveEquipment: p.adaptiveEquipment ?? "",
          hours: p.hours ?? "",
          contact: p.contact ?? "",
          website: p.website ?? "",
          instagram: p.instagram ?? "",
          facebook: p.facebook ?? "",

          // Specials + live data
          liveAnnouncement: p.liveAnnouncement ?? "",
          specialEvents: p.specialEvents ?? "",
          perk: p.perk ?? "",
          notes: p.notes ?? "",

          // Media
          imageUrl,
          imageUrlRaw: p.imageUrlRaw ?? "",

          // Optional vibe helpers
          crowdHint: p.crowdHint ?? "",
          crowdScoreBias: p.crowdScoreBias ?? "",

          // Required for logic
          indoorPlayArea: "yes",
        };
      });

    // Helpful for debugging in browser console
    window.lastIndoor = cleaned;
    console.log(`🏠 Indoor playplaces loaded: ${cleaned.length}`);
    console.log("Example:", cleaned[0]);

    return cleaned;
  } catch (err) {
    console.error("❌ Error fetching indoor playplaces:", err);
    return [];
  }
}
