import {
  dateToJD, dateObjectToJD, gmst, era, localSiderealTime,
  hourAngle, altAz, precess,
  formatHM, formatGMST, formatDeg, formatJD,
  STARS, PLANETS,
} from './astronomy.js';

// ============= DOM Elements =============

const latInput = document.getElementById('lat');
const lonInput = document.getElementById('lon');
const dateInput = document.getElementById('date-input');
const timeInput = document.getElementById('time-input');
const nowBtn = document.getElementById('now-btn');
const refreshBtn = document.getElementById('refresh-btn');
const gmstEl = document.getElementById('gmst-val');
const eraEl = document.getElementById('era-val');
const jdEl = document.getElementById('jd-val');
const apiStatusEl = document.getElementById('api-status');
const starsBody = document.getElementById('stars-body');
const planetsBody = document.getElementById('planets-body');

// ============= State =============

const CACHE_KEY = 'ephemerides_cache';
const LOCATION_KEY = 'ephemerides_location';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in ms
const HORIZONS_URL = 'https://horizons-proxy.tom-davis7.workers.dev/';

// ============= Location Persistence =============

function loadLocation() {
  const defaults = { lat: 51.5, lon: -0.1 };
  try {
    const saved = JSON.parse(localStorage.getItem(LOCATION_KEY));
    const loc = saved || defaults;
    latInput.value = loc.lat;
    lonInput.value = loc.lon;
  } catch (_) {
    latInput.value = defaults.lat;
    lonInput.value = defaults.lon;
  }
}

function saveLocation() {
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  if (!isNaN(lat) && !isNaN(lon)) {
    localStorage.setItem(LOCATION_KEY, JSON.stringify({ lat, lon }));
  }
}

// ============= Date/Time Helpers =============

function setNow() {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  dateInput.value = `${y}-${mo}-${d}`;
  timeInput.value = `${h}:${mi}:${s}`;
}

function getSelectedDate() {
  const d = dateInput.value;
  const t = timeInput.value;
  if (d && t) return new Date(`${d}T${t}`);
  if (d) return new Date(`${d}T00:00:00`);
  return new Date();
}

// ============= API Cache =============

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch (_) {
    return {};
  }
}

function saveCache(cache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function isCacheStale(cache) {
  if (!cache.timestamp) return true;
  return (Date.now() - cache.timestamp) > CACHE_MAX_AGE;
}

function formatCacheTime(timestamp) {
  if (!timestamp) return 'no data';
  return new Date(timestamp).toLocaleString();
}

// ============= Horizons API =============

function buildHorizonsUrl(command, jd) {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500'",
    TLIST: jd.toString(),
    QUANTITIES: "'1'",
    ANG_FORMAT: "'DEG'",
    CSV_FORMAT: "'YES'",
  });
  return `${HORIZONS_URL}?${params}`;
}

function parseHorizonsResponse(text) {
  const soeIdx = text.indexOf('$$SOE');
  const eoeIdx = text.indexOf('$$EOE');
  if (soeIdx === -1 || eoeIdx === -1) return null;

  const dataBlock = text.substring(soeIdx + 5, eoeIdx).trim();
  const lines = dataBlock.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return null;

  // CSV format: date, (empty), (empty), RA(deg), DEC(deg), ...
  const parts = lines[0].split(',').map((s) => s.trim());
  const numbers = parts.filter((p) => /^-?\d+\.?\d*$/.test(p));
  if (numbers.length < 2) return null;

  return {
    ra: parseFloat(numbers[0]),
    dec: parseFloat(numbers[1]),
  };
}

async function fetchPlanet(planet, jd) {
  const url = buildHorizonsUrl(planet.command, jd);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!data.result) throw new Error('No result in response');
  const coords = parseHorizonsResponse(data.result);
  if (!coords) throw new Error('Could not parse RA/Dec from response');
  return coords;
}

const RETRY_DELAYS_MS = [1000, 3000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPlanetWithRetry(planet, jd) {
  const attempts = RETRY_DELAYS_MS.length + 1;
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchPlanet(planet, jd);
    } catch (e) {
      lastError = e;
      console.warn(`fetch ${planet.name} attempt ${i + 1}/${attempts} failed:`, e.message);
      if (i < attempts - 1) await sleep(RETRY_DELAYS_MS[i]);
    }
  }
  throw lastError;
}

// ============= Computation =============

function computeBody(raDeg, decDeg, jd, lat, lon) {
  const gmstDeg = gmst(jd);
  const lst = localSiderealTime(gmstDeg, lon);
  const ha = hourAngle(lst, raDeg);
  const { alt, az } = altAz(lat, decDeg, ha);
  return { ra: raDeg, dec: decDeg, alt, az };
}

// ============= Rendering =============

function renderRow(name, data, belowHorizon) {
  const cls = belowHorizon ? ' class="below-horizon"' : '';
  return `<tr>
    <td class="name">${name}</td>
    <td${cls}>${data.dec.toFixed(1)}</td>
    <td${cls}>${data.ra.toFixed(1)}</td>
    <td${cls}>${formatHM(data.ra)}</td>
    <td${cls}>${data.alt.toFixed(1)}</td>
    <td${cls}>${data.az.toFixed(1)}</td>
  </tr>`;
}

function update(planetCache) {
  const date = getSelectedDate();
  const jd = dateObjectToJD(date);
  const lat = parseFloat(latInput.value) || 0;
  const lon = parseFloat(lonInput.value) || 0;

  // Global values
  const gmstDeg = gmst(jd);
  const eraDeg = era(jd);
  gmstEl.textContent = formatGMST(gmstDeg);
  eraEl.textContent = formatDeg(eraDeg);
  jdEl.textContent = formatJD(jd);

  // Stars
  let starsHTML = '';
  for (const star of STARS) {
    const { ra, dec } = precess(star.ra, star.dec, jd);
    const data = computeBody(ra, dec, jd, lat, lon);
    starsHTML += renderRow(star.name, data, data.alt < 0);
  }
  starsBody.innerHTML = starsHTML;

  // Planets
  let planetsHTML = '';
  const cacheData = planetCache.data || {};
  for (const planet of PLANETS) {
    const cached = cacheData[planet.name];
    const pending = pendingPlanets.has(planet.name);
    if (cached) {
      const data = computeBody(cached.ra, cached.dec, jd, lat, lon);
      planetsHTML += renderRow(planet.name, data, data.alt < 0);
    } else if (pending) {
      planetsHTML += `<tr>
        <td class="name">${planet.name}</td>
        <td colspan="5" style="color:#888">loading…</td>
      </tr>`;
    } else {
      planetsHTML += `<tr>
        <td class="name">${planet.name}</td>
        <td colspan="5" style="color:#666">No data</td>
      </tr>`;
    }
  }
  planetsBody.innerHTML = planetsHTML;

  refreshBtn.textContent = pendingPlanets.size > 0 ? 'Refreshing…' : 'Refresh API';

  // API status
  updateApiStatus(planetCache);
}

function updateApiStatus(cache) {
  const timestamp = cache.timestamp;
  if (!timestamp) {
    apiStatusEl.textContent = 'API: no data';
    apiStatusEl.className = 'status';
    return;
  }
  const age = Date.now() - timestamp;
  const stale = age > CACHE_MAX_AGE;
  const timeStr = formatCacheTime(timestamp);
  apiStatusEl.textContent = `API: ${timeStr}${stale ? ' (stale)' : ''}`;
  apiStatusEl.className = stale ? 'status stale' : 'status';
}

// ============= Streaming Refresh =============

const pendingPlanets = new Set();
let currentCache = loadCache();

function refreshPlanets(jd, forceRefresh = false) {
  if (!forceRefresh && !isCacheStale(currentCache)) {
    update(currentCache);
    return;
  }

  PLANETS.forEach((p) => pendingPlanets.add(p.name));
  update(currentCache);

  const newData = { ...(currentCache.data || {}) };
  let firstSuccessTimestamp = null;

  PLANETS.forEach(async (planet) => {
    try {
      const coords = await fetchPlanetWithRetry(planet, jd);
      newData[planet.name] = coords;
      if (firstSuccessTimestamp === null) firstSuccessTimestamp = Date.now();
      currentCache = { data: newData, timestamp: firstSuccessTimestamp };
      saveCache(currentCache);
    } catch (e) {
      console.warn(`Failed to fetch ${planet.name} after retries:`, e.message);
    }
    pendingPlanets.delete(planet.name);
    update(currentCache);
  });
}

// ============= Event Handlers =============

function onInputChange() {
  saveLocation();
  update(currentCache);
}

latInput.addEventListener('change', onInputChange);
lonInput.addEventListener('change', onInputChange);
dateInput.addEventListener('input', () => update(currentCache));
timeInput.addEventListener('input', () => update(currentCache));

nowBtn.addEventListener('click', () => {
  setNow();
  update(currentCache);
});

refreshBtn.addEventListener('click', () => {
  const jd = dateObjectToJD(getSelectedDate());
  refreshPlanets(jd, true);
});

// ============= Init =============

function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((e) =>
      console.warn('SW registration failed:', e)
    );
  }

  loadLocation();
  setNow();
  update(currentCache);

  const jd = dateObjectToJD(getSelectedDate());
  refreshPlanets(jd, false);
}

init();
