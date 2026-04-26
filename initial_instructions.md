We are going to build a GitHub pages site, containing several independent tools/calculators set up as progressive web apps. The home page simply links to them.

The entire site should be vanilla HTML + CSS + javascript. Avoid frameworks wherever possible. Also favour functional-programming-style javascript where possible. Build in red-green test driven development where possible.



The first calculator will be an ephemerides calculator. For a set of fixed stars and moving planets, together with a position on earth (set by the user and stored) and time (defaulting to the time of running, but also inputtable by the user) the program will calculate and show:
- Declination in degrees
- Right ascension / sidereal hour angle in both degrees and hours+minutes
- Altitude in degrees
- Azimuth in degrees

In addition we will also display the sidereal time & Earth Rotation Angle.

For the planets (mercury, venus, mars, jupiter, saturn) plus the sun and moon the RA and Dec should be obtained from the Horizons API https://ssd-api.jpl.nasa.gov/doc/horizons.html  Only the celestial co-ordinates should be obtained from these, alt-azimuth should be calculated by the app. To avoid creating too many requests, the results of API calls should be cached and only refreshed if >24 hours has elapsed since the last call (that degree of accuracy is fine) unless actually requested by the user (e.g. a button saying 'refresh now')
