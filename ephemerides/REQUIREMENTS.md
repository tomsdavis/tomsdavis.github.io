# Ephemerides Calculator — Requirements

## Purpose
Calculate and display positional astronomy data (celestial and horizontal coordinates) for a set of fixed stars and solar system bodies, given a user-specified location and time.

## Celestial Bodies

### Fixed Stars (16)
RA/Dec from J2000 catalog, with precession correction applied.

| Star | Constellation |
|------|--------------|
| Polaris | Ursa Minor |
| Hamal | Aries |
| Aldebaran | Taurus |
| Capella | Auriga |
| Rigel | Orion |
| Betelgeuse | Orion |
| Sirius | Canis Major |
| Pollux | Gemini |
| Regulus | Leo |
| Spica | Virgo |
| Arcturus | Bootes |
| Antares | Scorpius |
| Vega | Lyra |
| Altair | Aquila |
| Deneb | Cygnus |
| Fomalhaut | Piscis Austrinus |

### Solar System Bodies (7)
RA/Dec obtained from JPL Horizons REST API.

- Sun
- Moon
- Mercury
- Venus
- Mars
- Jupiter
- Saturn

## Displayed Data

### Per Body (column order as displayed)
| Field | Format | Source |
|-------|--------|--------|
| Declination (Dec) | degrees | Catalog (stars) or Horizons API (planets) |
| Right Ascension (RA) | degrees and HH:MM | Catalog (stars) or Horizons API (planets) |
| Altitude (Alt) | degrees | Calculated from RA/Dec + observer location + time |
| Azimuth (Az) | degrees | Calculated from RA/Dec + observer location + time |

### Global
| Field | Format |
|-------|--------|
| Greenwich Mean Sidereal Time (GMST) | HH:MM:SS |
| Earth Rotation Angle (ERA) | degrees |
| Last API refresh | datetime string |

## User Inputs

### Observer Location
- Manual entry of latitude and longitude (decimal degrees)
- Defaults to 51.5, -0.1 (London) on first use
- Stored in localStorage so it persists between sessions
- No geolocation API or city lookup needed

### Date/Time
- Defaults to current date and time (local)
- User can override via separate date and time inputs
- Input in local time; internally converted to UTC for calculations

## API Integration — JPL Horizons

### Endpoint
`https://ssd.jpl.nasa.gov/api/horizons.api` (REST/CGI), proxied via a Cloudflare Worker
(`https://horizons-proxy.tom-davis7.workers.dev/`) to add CORS headers, since the
JPL API does not provide them.

### Request Parameters
- `format`: json
- `COMMAND`: body ID (e.g., `'10'` for Sun, `'301'` for Moon, `'199'`/`'299'`/`'499'`/`'599'`/`'699'` for planets)
- `OBJ_DATA`: NO
- `MAKE_EPHEM`: YES
- `EPHEM_TYPE`: OBSERVER
- `CENTER`: `'500'` (geocentric — Earth center)
- `TLIST`: single epoch (Julian Date of requested time)
- `QUANTITIES`: `'1'` (Astrometric RA & Dec)
- `ANG_FORMAT`: DEG (decimal degrees output)
- `CSV_FORMAT`: YES (comma-separated for easier parsing)

Note: We use geocentric rather than topocentric coordinates. This introduces up to ~1 degree error for the Moon due to parallax, but is negligible for all other bodies. The benefit is simpler API calls and location-independent caching.

### Response Parsing
The JSON response contains a `result` text field. RA and Dec are extracted from between
`$$SOE` and `$$EOE` markers. With CSV format, the data line contains: calendar date,
empty fields, RA (degrees), Dec (degrees). The first two numeric values are RA and Dec.

### Caching Strategy
- Cache API responses in localStorage, keyed by body name
- Each cache entry stores: response data + timestamp of last successful fetch
- On load or time change:
  - If cached data exists and is < 24 hours old, use it
  - If cached data is > 24 hours old (or missing) and online, refresh from API
  - If offline, use cached data regardless of age (graceful degradation)
- "Refresh Now" button: forces re-fetch for all bodies, ignoring cache age
- Display datetime of last successful API call in the UI

## Calculations

All calculations done client-side in JavaScript.

### Julian Date
Convert calendar date/time (UTC) to Julian Date for Horizons API and sidereal time.

### Greenwich Mean Sidereal Time (GMST)
From Julian Date, using IAU formula.

### Earth Rotation Angle (ERA)
ERA = 2*pi*(0.7790572732640 + 1.00273781191135448 * Du)
where Du = JD - 2451545.0

### Local Sidereal Time (LST)
LST = GMST + observer longitude (east positive)
(Used internally for hour angle; GMST displayed to user.)

### Hour Angle
HA = LST - RA

### Altitude
sin(alt) = sin(lat)*sin(dec) + cos(lat)*cos(dec)*cos(HA)

### Azimuth
tan(az) = -sin(HA) / (cos(lat)*tan(dec) - sin(lat)*cos(HA))
(Measured from North, clockwise 0-360)

### Precession (Fixed Stars)
Apply simplified precession from J2000 epoch to date of observation.
- RA_corrected = RA_J2000 + (precession_rate_RA * years_since_J2000)
- Dec_corrected = Dec_J2000 + (precession_rate_Dec * years_since_J2000)

General precession rate ~50.3"/year in ecliptic longitude; per-star rates from catalog preferred for accuracy.

## UI Layout

### Structure
1. **Header**: Title, GMST, ERA, last API refresh time
2. **Settings bar**: Latitude/longitude inputs, separate date and time inputs, "Now" and "Refresh API" buttons
3. **Stars table**: One row per fixed star, columns: Name, Dec, RA (deg), RA (HH:MM), Alt, Az
4. **Planets table**: One row per solar system body, same columns as stars table (fixed-width columns aligned across both tables)

### Styling
- Simple, clean, mobile-friendly (primarily used on iPhone)
- Dark theme preferred (easier on eyes for nighttime astronomy use)
- Responsive table that works on small screens
- Minimal CSS, no framework

## PWA Requirements

### Service Worker (`sw.js`)
- Cache app shell (HTML, CSS, JS) for offline use
- Serve cached assets when offline
- Update cache when new versions are deployed

### Manifest (`manifest.json`)
- App name: "Ephemerides"
- Standalone display mode
- Appropriate icon (simple/generated is fine)
- Theme color matching dark theme

### Offline Behaviour
- App loads and functions offline using cached static assets
- Stale API data used when offline (with visual indicator of data age)
- Full functionality restored when back online

## Testing

### What to Test (pure functions)
- Julian Date conversion
- GMST calculation
- ERA calculation
- Local Sidereal Time
- Hour Angle calculation
- Altitude calculation
- Azimuth calculation
- Precession correction
- RA format conversion (degrees to HH:MM)
- Mod (angle wrapping)

### Test Approach
- Custom in-browser test runner (no dependencies)
- Also runnable headless via Deno: `deno run --allow-read ephemerides/tests.js`
- Compare against known reference values (e.g., from USNO or almanac data)
- `tests.html` loads `tests.js` and displays pass/fail results
- 37 tests across 10 test groups

## Non-Requirements (out of scope)
- No rise/set times
- No twilight calculations
- No star charts or graphical sky display
- No geolocation API
- No timezone selector (just local + UTC)
- No proper motion correction (precession only)
