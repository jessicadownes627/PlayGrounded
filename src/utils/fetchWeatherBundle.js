// src/utils/fetchWeatherBundle.js
// Fetch forecast, air quality, and pollen data for a given lat/lon via Open-Meteo services.

const TIMEZONE = "America/New_York";
const cache = new Map();

export async function fetchWeatherBundle(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("fetchWeatherBundle requires numeric latitude and longitude");
  }

  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (cache.has(key)) {
    return cache.get(key);
  }

  const promise = fetchBundle(lat, lon)
    .then((result) => {
      cache.set(key, result);
      return result;
    })
    .catch((err) => {
      cache.delete(key);
      throw err;
    });

  cache.set(key, promise);
  return promise;
}

async function fetchBundle(lat, lon) {
  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", lat);
  forecastUrl.searchParams.set("longitude", lon);
  forecastUrl.searchParams.set(
    "hourly",
    "temperature_2m,wind_speed_10m,precipitation_probability"
  );
  forecastUrl.searchParams.set("daily", "sunrise,sunset");
  forecastUrl.searchParams.set("timezone", TIMEZONE);

  const airUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  airUrl.searchParams.set("latitude", lat);
  airUrl.searchParams.set("longitude", lon);
  airUrl.searchParams.set("hourly", "us_aqi,pm10,pm2_5,ozone");
  airUrl.searchParams.set("timezone", TIMEZONE);

  const pollenUrl = new URL("https://pollen-api.open-meteo.com/v1/forecast");
  pollenUrl.searchParams.set("latitude", lat);
  pollenUrl.searchParams.set("longitude", lon);
  pollenUrl.searchParams.set("daily", "grass_pollen,tree_pollen,weed_pollen");
  pollenUrl.searchParams.set("timezone", TIMEZONE);

  const [forecastResult, airResult, pollenResult] = await Promise.allSettled([
    fetchJson(forecastUrl),
    fetchJson(airUrl),
    fetchJson(pollenUrl),
  ]);

  if (forecastResult.status !== "fulfilled") {
    throw forecastResult.reason ?? new Error("Forecast API failed");
  }

  const forecastJson = forecastResult.value;
  const airJson = airResult.status === "fulfilled" ? airResult.value : null;
  const pollenJson = pollenResult.status === "fulfilled" ? pollenResult.value : null;

  const now = Date.now();
  const forecastIndex = findClosestIndex(forecastJson?.hourly?.time ?? [], now);
  const airIndex = findClosestIndex(airJson?.hourly?.time ?? [], now);

  const temperatureC = readValue(forecastJson?.hourly?.temperature_2m, forecastIndex);
  const windKmH = readValue(forecastJson?.hourly?.wind_speed_10m, forecastIndex);
  const precipProb = readValue(
    forecastJson?.hourly?.precipitation_probability,
    forecastIndex
  );

  const sunrise = forecastJson?.daily?.sunrise?.[0] ?? null;
  const sunset = forecastJson?.daily?.sunset?.[0] ?? null;

  const usAqi = readValue(airJson?.hourly?.us_aqi, airIndex);
  const pm10 = readValue(airJson?.hourly?.pm10, airIndex);
  const pm25 = readValue(airJson?.hourly?.pm2_5, airIndex);
  const ozone = readValue(airJson?.hourly?.ozone, airIndex);

  const grass = pollenJson?.daily?.grass_pollen?.[0] ?? null;
  const tree = pollenJson?.daily?.tree_pollen?.[0] ?? null;
  const weed = pollenJson?.daily?.weed_pollen?.[0] ?? null;

  return {
    forecast: forecastJson,
    airQuality: airJson,
    pollen: pollenJson,
    current: {
      temperatureC,
      temperatureF: temperatureC != null ? cToF(temperatureC) : null,
      windKmH,
      windMph: windKmH != null ? kmhToMph(windKmH) : null,
      precipitationProbability: precipProb,
      sunrise,
      sunset,
      airQuality: {
        usAqi,
        pm10,
        pm2_5: pm25,
        ozone,
      },
      pollen: {
        grass,
        tree,
        weed,
        average: average([grass, tree, weed]),
      },
    },
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return response.json();
}

function readValue(list, index) {
  if (!Array.isArray(list) || index < 0 || index >= list.length) return null;
  const value = list[index];
  return typeof value === "number" ? value : Number(value) || null;
}

function findClosestIndex(times, nowMs) {
  if (!Array.isArray(times) || times.length === 0) return 0;
  let bestIdx = 0;
  let bestDiff = Infinity;
  times.forEach((iso, idx) => {
    const diff = Math.abs(new Date(iso).getTime() - nowMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

function average(values) {
  const valid = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

const cToF = (c) => Math.round((c * 9) / 5 + 32);
const kmhToMph = (kmh) => Math.round(kmh * 0.621371);
