import {
  dateToJD, gmst, era, localSiderealTime,
  hourAngle, altAz, precess,
  degToHMS, sha, mod, formatHMS, formatGMST, formatJD,
  J2000, STARS,
} from './astronomy.js';

// ============= Test Framework =============

const groups = [];
let currentGroup = null;

function describe(name, fn) {
  currentGroup = { name, tests: [], passed: 0, failed: 0 };
  groups.push(currentGroup);
  fn();
  currentGroup = null;
}

function test(name, fn) {
  try {
    fn();
    currentGroup.tests.push({ name, pass: true });
    currentGroup.passed++;
  } catch (e) {
    currentGroup.tests.push({ name, pass: false, error: e.message });
    currentGroup.failed++;
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg} Expected ${expected}, got ${actual}`);
  }
}

function assertAlmostEqual(actual, expected, tolerance, msg = '') {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `${msg} Expected ${expected} ±${tolerance}, got ${actual} (diff: ${Math.abs(actual - expected).toExponential(3)})`
    );
  }
}

// ============= Tests =============

describe('Julian Date', () => {
  test('J2000.0 epoch (2000-01-01 12:00 UTC)', () => {
    assertAlmostEqual(dateToJD(2000, 1, 1, 12, 0, 0), 2451545.0, 0.0001);
  });

  test('1999-01-01 00:00 UTC', () => {
    assertAlmostEqual(dateToJD(1999, 1, 1, 0, 0, 0), 2451179.5, 0.0001);
  });

  test('2024-01-01 00:00 UTC', () => {
    assertAlmostEqual(dateToJD(2024, 1, 1, 0, 0, 0), 2460310.5, 0.0001);
  });

  test('1957-10-04 19:28 UTC (Sputnik launch)', () => {
    assertAlmostEqual(dateToJD(1957, 10, 4, 19, 28, 0), 2436116.311, 0.001);
  });

  test('2000-03-01 00:00 UTC (leap year boundary)', () => {
    assertAlmostEqual(dateToJD(2000, 3, 1, 0, 0, 0), 2451604.5, 0.0001);
  });
});

describe('Greenwich Mean Sidereal Time', () => {
  test('GMST at J2000.0 epoch', () => {
    const g = gmst(J2000);
    assertAlmostEqual(g, 280.4606, 0.001, 'GMST at J2000');
  });

  test('GMST increases ~0.986 degrees per day (mod 360)', () => {
    const g1 = gmst(J2000);
    const g2 = gmst(J2000 + 1);
    const diff = mod(g2 - g1, 360);
    // GMST gains ~3m56s per day over solar time = ~0.9856 degrees mod 360
    assertAlmostEqual(diff, 0.9856, 0.01, 'Daily GMST gain over solar time');
  });

  test('GMST is between 0 and 360', () => {
    const g = gmst(dateToJD(2024, 6, 15, 3, 30, 0));
    if (g < 0 || g >= 360) throw new Error(`GMST out of range: ${g}`);
  });
});

describe('Earth Rotation Angle', () => {
  test('ERA at J2000.0 epoch', () => {
    const e = era(J2000);
    assertAlmostEqual(e, 280.4606, 0.01, 'ERA at J2000');
  });

  test('ERA increases ~0.986 degrees per day (mod 360)', () => {
    const e1 = era(J2000);
    const e2 = era(J2000 + 1);
    const diff = mod(e2 - e1, 360);
    assertAlmostEqual(diff, 0.9856, 0.01, 'Daily ERA gain over solar time');
  });
});

describe('Local Sidereal Time', () => {
  test('LST equals GMST at Greenwich (lon=0)', () => {
    const g = gmst(J2000);
    assertAlmostEqual(localSiderealTime(g, 0), g, 0.0001);
  });

  test('LST is GMST + longitude (east positive)', () => {
    const g = gmst(J2000);
    assertAlmostEqual(localSiderealTime(g, 45), mod(g + 45, 360), 0.0001);
  });

  test('LST wraps correctly for western longitudes', () => {
    const lst = localSiderealTime(10, -20);
    assertAlmostEqual(lst, 350, 0.0001);
  });
});

describe('Hour Angle', () => {
  test('HA = 0 when LST equals RA (star on meridian)', () => {
    assertAlmostEqual(hourAngle(100, 100), 0, 0.0001);
  });

  test('HA = 90 when star is 6h west', () => {
    assertAlmostEqual(hourAngle(190, 100), 90, 0.0001);
  });

  test('HA wraps for negative values', () => {
    assertAlmostEqual(hourAngle(10, 100), 270, 0.0001);
  });
});

describe('Altitude and Azimuth', () => {
  test('Star on south meridian: lat=45, dec=20, HA=0', () => {
    const { alt, az } = altAz(45, 20, 0);
    assertAlmostEqual(alt, 65.0, 0.1, 'Altitude');
    assertAlmostEqual(az, 180.0, 0.1, 'Azimuth (south)');
  });

  test('Star on north meridian: lat=45, dec=80, HA=0', () => {
    const { alt, az } = altAz(45, 80, 0);
    assertAlmostEqual(alt, 55.0, 0.1, 'Altitude');
    assertAlmostEqual(az, 0.0, 0.1, 'Azimuth (north)');
  });

  test('Star at zenith: lat=45, dec=45, HA=0', () => {
    const { alt } = altAz(45, 45, 0);
    assertAlmostEqual(alt, 90.0, 0.1, 'Altitude at zenith');
  });

  test('Star 6h west: lat=45, dec=20, HA=90', () => {
    const { alt, az } = altAz(45, 20, 90);
    assertAlmostEqual(alt, 14.0, 0.5, 'Altitude');
    // Should be in the west (az between 180 and 360)
    if (az < 180 || az > 360) throw new Error(`Expected western az, got ${az}`);
  });

  test('Circumpolar star below pole: lat=45, dec=80, HA=180', () => {
    const { alt } = altAz(45, 80, 180);
    // Should still be above horizon
    if (alt < 0) throw new Error(`Expected positive alt for circumpolar star, got ${alt}`);
  });

  test('Star at south celestial pole from equator: lat=0, dec=-90, HA=0', () => {
    const { alt, az } = altAz(0, -90, 0);
    assertAlmostEqual(alt, 0.0, 0.1, 'Altitude');
    assertAlmostEqual(az, 180.0, 0.1, 'Azimuth');
  });
});

describe('Precession', () => {
  test('No precession at J2000.0', () => {
    const { ra, dec } = precess(100, 30, J2000);
    assertAlmostEqual(ra, 100, 0.0001, 'RA unchanged');
    assertAlmostEqual(dec, 30, 0.0001, 'Dec unchanged');
  });

  test('Precession changes RA after 10 years', () => {
    const jd10 = J2000 + 10 * 365.25;
    const { ra } = precess(100, 30, jd10);
    // RA should increase (general precession moves RA eastward)
    if (Math.abs(ra - 100) < 0.01) throw new Error('RA should change after 10 years');
  });

  test('Precession changes Dec after 10 years', () => {
    const jd10 = J2000 + 10 * 365.25;
    const { dec } = precess(100, 30, jd10);
    if (Math.abs(dec - 30) < 0.001) throw new Error('Dec should change after 10 years');
  });

  test('Precession magnitude is reasonable (~50 arcsec/yr total)', () => {
    const jd1 = J2000 + 365.25; // 1 year
    const { ra, dec } = precess(0, 0, jd1);
    const totalShift = Math.sqrt((ra * 3600) ** 2 + ((dec) * 3600) ** 2);
    // Should be roughly 50 arcsec for a star near equinox on equator
    assertAlmostEqual(totalShift, 50, 10, 'Total annual precession');
  });
});

describe('Sidereal Hour Angle', () => {
  test('SHA = 360 - RA', () => {
    assertAlmostEqual(sha(101.2872), 258.7128, 0.001);
  });

  test('SHA of 0 RA = 360 (wraps to 0)', () => {
    assertAlmostEqual(sha(0), 0, 0.001);
  });

  test('SHA of Polaris', () => {
    const polaris = STARS.find(s => s.name === 'Polaris');
    assertAlmostEqual(sha(polaris.ra), 360 - polaris.ra, 0.001);
  });
});

describe('Degree to HMS conversion', () => {
  test('0 degrees = 0h 0m', () => {
    const { h, m } = degToHMS(0);
    assertEqual(h, 0);
    assertEqual(m, 0);
  });

  test('180 degrees = 12h 0m', () => {
    const { h, m } = degToHMS(180);
    assertEqual(h, 12);
    assertEqual(m, 0);
  });

  test('Sirius RA ≈ 6h 45m', () => {
    const { h, m } = degToHMS(101.2872);
    assertEqual(h, 6, 'Hours');
    assertEqual(m, 45, 'Minutes');
  });

  test('Vega RA ≈ 18h 37m', () => {
    const { h, m } = degToHMS(279.2348);
    assertEqual(h, 18, 'Hours');
    assertEqual(m, 36, 'Minutes');
  });
});

describe('Julian Date formatting', () => {
  test('J2000.0 formatted with space thousands separator', () => {
    assertEqual(formatJD(2451545.0), '2 451 545.00');
  });

  test('Two decimal places preserved', () => {
    assertEqual(formatJD(2461161.5), '2 461 161.50');
  });

  test('Rounds to two decimals', () => {
    assertEqual(formatJD(2451545.678), '2 451 545.68');
  });

  test('Small value with no thousands', () => {
    assertEqual(formatJD(123), '123.00');
  });

  test('Four-digit value gets one space', () => {
    assertEqual(formatJD(1234), '1 234.00');
  });

  test('Zero', () => {
    assertEqual(formatJD(0), '0.00');
  });
});

describe('Mod function', () => {
  test('Positive values', () => {
    assertAlmostEqual(mod(370, 360), 10, 0.0001);
  });

  test('Negative values', () => {
    assertAlmostEqual(mod(-10, 360), 350, 0.0001);
  });

  test('Zero', () => {
    assertAlmostEqual(mod(0, 360), 0, 0.0001);
  });

  test('Exact multiple', () => {
    assertAlmostEqual(mod(360, 360), 0, 0.0001);
  });
});

// ============= Run & Render =============

function summary() {
  let totalPass = 0;
  let totalFail = 0;
  for (const group of groups) {
    totalPass += group.passed;
    totalFail += group.failed;
  }
  return { totalPass, totalFail, total: totalPass + totalFail };
}

function renderHTML() {
  const resultsEl = document.getElementById('results');
  const summaryEl = document.getElementById('summary');

  let html = '';
  for (const group of groups) {
    const status = group.failed === 0 ? 'pass' : 'fail';
    html += `<div class="test-group">`;
    html += `<h2 class="${status}">${group.name} (${group.passed}/${group.tests.length})</h2>`;
    for (const t of group.tests) {
      const cls = t.pass ? 'pass' : 'fail';
      const icon = t.pass ? '\u2713' : '\u2717';
      html += `<div class="test-result ${cls}">${icon} ${t.name}</div>`;
      if (!t.pass) {
        html += `<div class="error-detail">${t.error}</div>`;
      }
    }
    html += `</div>`;
  }

  resultsEl.innerHTML = html;

  const { totalPass, total, totalFail } = summary();
  const cls = totalFail === 0 ? 'pass' : 'fail';
  summaryEl.innerHTML = `<span class="${cls}">${totalPass}/${total} tests passed</span>`;
}

function renderConsole() {
  for (const group of groups) {
    const status = group.failed === 0 ? 'PASS' : 'FAIL';
    console.log(`${status} ${group.name} (${group.passed}/${group.tests.length})`);
    for (const t of group.tests) {
      if (!t.pass) console.log(`  FAIL: ${t.name} — ${t.error}`);
    }
  }
  const { totalPass, total, totalFail } = summary();
  console.log(`\n${totalPass}/${total} tests passed${totalFail > 0 ? ` (${totalFail} FAILED)` : ''}`);
}

if (typeof document !== 'undefined') {
  renderHTML();
} else {
  renderConsole();
}
