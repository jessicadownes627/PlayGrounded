// fetchParkTipsFromSheet.js
export async function fetchParkTipsFromSheet(parkName) {
  try {
    const response = await fetch(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vRT_TDB9umNVXH0bKUFlxzVFKcrFzJFNqKP68OUDKcxoU52JGOWfBPQCYDiwaDCRkFf5LF4UWMLKzkN/pub?output=csv"
    );
    const text = await response.text();

    const rows = text
      .split("\n")
      .map((row) => row.split(","))
      .filter((r) => r.length >= 2);

    const headers = rows[0];
    const parkIndex = headers.indexOf("ParkName");
    const tipIndex = headers.indexOf("Tip");

    if (parkIndex === -1 || tipIndex === -1) {
      console.error("Missing expected columns in sheet");
      return [];
    }

    const parkTips = rows
      .slice(1)
      .filter((r) => r[parkIndex]?.trim().toLowerCase() === parkName.toLowerCase())
      .map((r) => ({
        parkName: r[parkIndex],
        tip: r[tipIndex],
      }));

    // return up to 2 most recent tips (bottom rows are newest)
    return parkTips.slice(-2).reverse();
  } catch (error) {
    console.error("Error fetching park tips:", error);
    return [];
  }
}
