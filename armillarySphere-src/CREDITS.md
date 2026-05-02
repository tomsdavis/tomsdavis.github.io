# Credits and Attributions

## Earth textures

Both textures live in `public/textures/`.

### `earth-day.jpg` — Blue Marble: Land Surface, Shallow Water, and Shaded Topography

- Source: NASA Earth Observatory / Visible Earth, image record 57752
  - <https://visibleearth.nasa.gov/images/57752/land-surface-shallow-water-and-shaded-topography>
- Direct file (this build):
  - <https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_2048.jpg>
- Original dimensions: 2048×1024 equirectangular, JPEG.
- This build: re-encoded at JPEG quality 85, EXIF stripped. Same dimensions.
- License: Public domain (NASA imagery). Credit suggested: "NASA / Reto Stöckli, Robert Simmon, MODIS Land Group."

### `earth-night.jpg` — Earth's City Lights (Reto Stöckli, 2000)

- Source: NASA Earth Observatory / Visible Earth, image record 55167
  - <https://visibleearth.nasa.gov/images/55167/earths-city-lights>
- Direct file (this build):
  - <https://eoimages.gsfc.nasa.gov/images/imagerecords/55000/55167/earth_lights_lrg.jpg>
- Original dimensions: 2400×1200 equirectangular, JPEG.
- This build: resized to 2048×1024, JPEG quality 85, EXIF stripped.
- License: Public domain (NASA imagery). Credit: "NASA / Goddard Space Flight Center / Reto Stöckli."

## Spec deviation note

Spec §6.3 specifies 4096×2048 with target sizes ~2 MB (day) and ~1.5 MB (night).
This build ships 2048×1024 at ~265 KB and ~296 KB respectively. The smaller
textures are appropriate at the render distances we use (camera 1.05–5 scene
units from a unit-radius Earth) and leave headroom in the precache budget.
A future pass can upgrade to 4096×2048 if visible aliasing becomes an issue.
