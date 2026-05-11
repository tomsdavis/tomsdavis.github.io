import {
  dateToJD, dateObjectToJD, gmst, era, localSiderealTime,
  hourAngle, altAz, precess,
  formatHM, formatGMST, formatDeg, formatJD,
  STARS, PLANET_NAMES, planetDirection,
} from './astronomy.js';

// ============= DOM Elements =============

const latInput = document.getElementById('lat');
const lonInput = document.getElementById('lon');
const dateInput = document.getElementById('date-input');
const timeInput = document.getElementById('time-input');
const nowBtn = document.getElementById('now-btn');
const gmstEl = document.getElementById('gmst-val');
const gmstNoonEl = document.getElementById('gmst-noon-val');
const eraEl = document.getElementById('era-val');
const jdEl = document.getElementById('jd-val');
const starsBody = document.getElementById('stars-body');
const planetsBody = document.getElementById('planets-body');

// ============= Location Persistence =============

const LOCATION_KEY = 'ephemerides_location';

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
    <td${cls}>${formatHM(data.ra)}</td>
    <td${cls}>${data.ra.toFixed(1)}</td>
    <td${cls}>${data.dec.toFixed(1)}</td>
    <td${cls}>${data.alt.toFixed(1)}</td>
    <td${cls}>${data.az.toFixed(1)}</td>
  </tr>`;
}

function update() {
  const date = getSelectedDate();
  const jd = dateObjectToJD(date);
  const lat = parseFloat(latInput.value) || 0;
  const lon = parseFloat(lonInput.value) || 0;

  // Global values
  const gmstDeg = gmst(jd);
  const gmstNoonDeg = gmst(Math.floor(jd));
  const eraDeg = era(jd);
  gmstEl.textContent = formatGMST(gmstDeg);
  gmstNoonEl.textContent = formatGMST(gmstNoonDeg);
  eraEl.textContent = formatDeg(eraDeg);
  jdEl.textContent = formatJD(jd);

  // Stars — sort by post-precession RA ascending
  const starRows = STARS
    .map((star) => {
      const { ra, dec } = precess(star.ra, star.dec, jd);
      return { name: star.name, data: computeBody(ra, dec, jd, lat, lon) };
    })
    .sort((a, b) => a.data.ra - b.data.ra);
  starsBody.innerHTML = starRows
    .map(({ name, data }) => renderRow(name, data, data.alt < 0))
    .join('');

  // Planets — computed synchronously, sorted by RA ascending
  const planetRows = PLANET_NAMES
    .map((name) => {
      const { ra, dec } = planetDirection(name, date);
      return { name, data: computeBody(ra, dec, jd, lat, lon) };
    })
    .sort((a, b) => a.data.ra - b.data.ra);
  planetsBody.innerHTML = planetRows
    .map(({ name, data }) => renderRow(name, data, data.alt < 0))
    .join('');
}

// ============= Event Handlers =============

latInput.addEventListener('change', () => { saveLocation(); update(); });
lonInput.addEventListener('change', () => { saveLocation(); update(); });
dateInput.addEventListener('input', update);
timeInput.addEventListener('input', update);
nowBtn.addEventListener('click', () => { setNow(); update(); });

// ============= Init =============

function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((e) =>
      console.warn('SW registration failed:', e)
    );
  }

  loadLocation();
  setNow();
  update();
}

init();
