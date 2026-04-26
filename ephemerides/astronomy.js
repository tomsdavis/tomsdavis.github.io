// astronomy.js - Pure astronomical calculation functions (ES module)

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const J2000 = 2451545.0;

// Precession constants (arcseconds per year)
const PRECESSION_M = 46.1244; // in RA (arcsec/yr)
const PRECESSION_N = 20.0431; // obliquity component (arcsec/yr)

// ============= Star Catalog (J2000 Epoch) =============
// RA and Dec in decimal degrees

const STARS = [
  { name: 'Polaris',    ra:  37.9546, dec:  89.2642 },
  { name: 'Hamal',      ra:  31.7934, dec:  23.4624 },
  { name: 'Aldebaran',  ra:  68.9802, dec:  16.5093 },
  { name: 'Capella',    ra:  79.1723, dec:  45.9980 },
  { name: 'Rigel',      ra:  78.6345, dec:  -8.2016 },
  { name: 'Betelgeuse', ra:  88.7930, dec:   7.4071 },
  { name: 'Sirius',     ra: 101.2872, dec: -16.7161 },
  { name: 'Pollux',     ra: 116.3290, dec:  28.0262 },
  { name: 'Regulus',    ra: 152.0930, dec:  11.9672 },
  { name: 'Spica',      ra: 201.2983, dec: -11.1613 },
  { name: 'Arcturus',   ra: 213.9153, dec:  19.1824 },
  { name: 'Antares',    ra: 247.3519, dec: -26.4320 },
  { name: 'Vega',       ra: 279.2348, dec:  38.7837 },
  { name: 'Altair',     ra: 297.6958, dec:   8.8683 },
  { name: 'Deneb',      ra: 310.3579, dec:  45.2803 },
  { name: 'Fomalhaut',  ra: 344.4127, dec: -29.6222 },
];

// Planet definitions for Horizons API
const PLANETS = [
  { name: 'Sun',     command: '10'  },
  { name: 'Moon',    command: '301' },
  { name: 'Mercury', command: '199' },
  { name: 'Venus',   command: '299' },
  { name: 'Mars',    command: '499' },
  { name: 'Jupiter', command: '599' },
  { name: 'Saturn',  command: '699' },
];

// ============= Julian Date =============

function dateToJD(year, month, day, hour = 0, minute = 0, second = 0) {
  const dayFraction = day + (hour + minute / 60 + second / 3600) / 24;
  let y = year;
  let m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) +
         Math.floor(30.6001 * (m + 1)) +
         dayFraction + B - 1524.5;
}

function dateObjectToJD(date) {
  return dateToJD(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
}

// ============= Sidereal Time & Earth Rotation Angle =============

function gmst(jd) {
  const T = (jd - J2000) / 36525.0;
  const du = jd - J2000;
  let theta = 280.46061837 +
              360.98564736629 * du +
              0.000387933 * T * T -
              T * T * T / 38710000.0;
  return mod(theta, 360);
}

function era(jd) {
  const du = jd - J2000;
  const angle = 0.7790572732640 + 1.00273781191135448 * du;
  return mod(angle * 360, 360);
}

function localSiderealTime(gmstDeg, longitudeDeg) {
  return mod(gmstDeg + longitudeDeg, 360);
}

// ============= Coordinate Transforms =============

function hourAngle(lstDeg, raDeg) {
  return mod(lstDeg - raDeg, 360);
}

function altAz(latDeg, decDeg, haDeg) {
  const lat = latDeg * DEG;
  const dec = decDeg * DEG;
  const ha = haDeg * DEG;

  const sinAlt = Math.sin(lat) * Math.sin(dec) +
                 Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const alt = Math.asin(clamp(sinAlt, -1, 1));

  const x = Math.sin(dec) * Math.cos(lat) -
            Math.cos(dec) * Math.sin(lat) * Math.cos(ha);
  const y = -Math.cos(dec) * Math.sin(ha);

  let az = Math.atan2(y, x) * RAD;
  if (az < 0) az += 360;

  return { alt: alt * RAD, az };
}

// ============= Precession (J2000 to date) =============

function precess(raDeg, decDeg, jd) {
  const years = (jd - J2000) / 365.25;
  if (Math.abs(years) < 0.001) return { ra: raDeg, dec: decDeg };

  const raRad = raDeg * DEG;
  const decRad = decDeg * DEG;

  const mDeg = PRECESSION_M / 3600; // degrees per year
  const nDeg = PRECESSION_N / 3600; // degrees per year

  const dRA = mDeg + nDeg * Math.sin(raRad) * Math.tan(decRad);
  const dDec = nDeg * Math.cos(raRad);

  return {
    ra: mod(raDeg + dRA * years, 360),
    dec: decDeg + dDec * years,
  };
}

// ============= Formatting =============

function degToHMS(deg) {
  const totalHours = mod(deg, 360) / 15;
  const h = Math.floor(totalHours);
  const m = Math.floor((totalHours - h) * 60);
  const s = ((totalHours - h) * 60 - m) * 60;
  return { h, m, s };
}

function formatHMS(deg) {
  const { h, m, s } = degToHMS(deg);
  return `${pad(h)}h ${pad(m)}m ${pad(Math.round(s))}s`;
}

function formatHM(deg) {
  const { h, m } = degToHMS(deg);
  return `${pad(h)}h ${pad(m)}m`;
}

function formatGMST(deg) {
  const { h, m, s } = degToHMS(deg);
  return `${pad(h)}:${pad(m)}:${pad(Math.round(s))}`;
}

function formatDeg(deg, decimals = 1) {
  return deg.toFixed(decimals) + '\u00B0';
}

function sha(raDeg) {
  return mod(360 - raDeg, 360);
}

// ============= Helpers =============

function mod(x, m) {
  return ((x % m) + m) % m;
}

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// ============= Exports =============

export {
  DEG, RAD, J2000,
  STARS, PLANETS,
  dateToJD, dateObjectToJD,
  gmst, era, localSiderealTime,
  hourAngle, altAz,
  precess,
  degToHMS, formatHMS, formatHM, formatGMST, formatDeg,
  sha, mod, clamp, pad,
};
