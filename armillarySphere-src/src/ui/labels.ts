// Spec §4.4: HTML overlay for proper-name labels of bright stars (mag ≤ ~2.0).
// Anchors are world-space astronomical coordinates: per-frame we transform
// each catalogue position by the celestial-sphere root's matrixWorld and
// project the result through the camera, then position an absolutely-placed
// span at the resulting CSS-pixel coordinates.
//
// Each label respects two gates: state.layers.starLabels (the toggle) and
// state.magnitudeLimit (so a label doesn't hover next to a star the shader
// has discarded). Occlusion by Earth is deferred — at this label cap there
// are ~46 names spread around the whole sky, and the few that pass behind
// Earth at any moment are tolerable while the labels stay readable.

import * as THREE from 'three';
import type { Catalogue } from '../astronomy/catalogue-loader';
import { R_CS, raDecToVec3, isOccludedByEarth } from '../scene/celestial-sphere';
import type { PlanetsHandle } from '../scene/planets';
import type { CentroidEntry } from '../scene/constellations';
import { BODY_NAMES, type BodyName } from '../astronomy/ephemeris';
import type { RaUnits } from '../state';

export interface LabelsHandle {
  /** Reposition every visible label after a camera/state update. */
  update(camera: THREE.Camera, parent: THREE.Object3D): void;
  setSize(width: number, height: number): void;
  setVisible(on: boolean): void;
  setMagnitudeLimit(limit: number): void;
  dispose(): void;
}

interface Entry {
  hr: number;
  name: string;
  mag: number;
  /** Star position in the celestial-sphere local frame (scaled by R_CS). */
  localPos: THREE.Vector3;
  el: HTMLSpanElement;
  /** True when the gate (visibility + mag limit + frustum) currently allows display. */
  shown: boolean;
}

export function attachLabels(opts: {
  catalogue: Catalogue;
  names: Record<string, string>;
  container: HTMLElement;
}): LabelsHandle {
  const { catalogue, names, container } = opts;

  const wrapper = document.createElement('div');
  wrapper.id = 'star-labels';
  container.appendChild(wrapper);

  const hrToIndex = new Map<number, number>();
  for (let i = 0; i < catalogue.count; i++) hrToIndex.set(catalogue.hr[i]!, i);

  const entries: Entry[] = [];
  for (const [hrStr, name] of Object.entries(names)) {
    const hr = Number(hrStr);
    const idx = hrToIndex.get(hr);
    if (idx === undefined) continue;

    const el = document.createElement('span');
    el.textContent = name;
    el.style.display = 'none';
    wrapper.appendChild(el);

    entries.push({
      hr,
      name,
      mag: catalogue.magnitudes[idx]!,
      localPos: new THREE.Vector3(
        catalogue.positions[idx * 3 + 0]! * R_CS,
        catalogue.positions[idx * 3 + 1]! * R_CS,
        catalogue.positions[idx * 3 + 2]! * R_CS,
      ),
      el,
      shown: false,
    });
  }

  let layerEnabled = true;
  let magLimit = Infinity;
  let viewportW = 0;
  let viewportH = 0;
  const tmp = new THREE.Vector3();

  const worldTmp = new THREE.Vector3();

  const updateOne = (entry: Entry, camera: THREE.Camera, parent: THREE.Object3D): void => {
    if (!layerEnabled || entry.mag > magLimit) {
      if (entry.shown) {
        entry.el.style.display = 'none';
        entry.shown = false;
      }
      return;
    }

    worldTmp.copy(entry.localPos).applyMatrix4(parent.matrixWorld);
    if (isOccludedByEarth(camera.position, worldTmp)) {
      if (entry.shown) {
        entry.el.style.display = 'none';
        entry.shown = false;
      }
      return;
    }

    tmp.copy(worldTmp).project(camera);

    if (tmp.z < -1 || tmp.z > 1) {
      if (entry.shown) {
        entry.el.style.display = 'none';
        entry.shown = false;
      }
      return;
    }

    const x = (tmp.x + 1) * 0.5 * viewportW;
    const y = (1 - tmp.y) * 0.5 * viewportH;

    if (!entry.shown) {
      entry.el.style.display = '';
      entry.shown = true;
    }
    // Offset the label up-and-right of the star so it doesn't sit on top of
    // the point itself.
    entry.el.style.transform = `translate(${(x + 6).toFixed(1)}px, ${(y - 12).toFixed(1)}px)`;
  };

  return {
    update(camera, parent) {
      if (viewportW === 0 || viewportH === 0) return;
      for (const e of entries) updateOne(e, camera, parent);
    },
    setSize(width, height) {
      viewportW = width;
      viewportH = height;
    },
    setVisible(on) {
      layerEnabled = on;
      if (!on) {
        for (const e of entries) {
          if (e.shown) {
            e.el.style.display = 'none';
            e.shown = false;
          }
        }
      }
    },
    setMagnitudeLimit(limit) {
      magLimit = limit;
    },
    dispose() {
      wrapper.remove();
    },
  };
}

// Spec §4.5: labels for the seven solar-system bodies. Mirrors the star-label
// projection path but reads each body's *current* world position from the
// planets handle every frame (positions change with state.instant and the
// celestial-sphere root rotation). Gated by state.layers.planets so the
// label visibility tracks the sprite visibility.

export interface BodyLabelsHandle {
  update(camera: THREE.Camera): void;
  setSize(width: number, height: number): void;
  setVisible(on: boolean): void;
  dispose(): void;
}

interface BodyEntry {
  body: BodyName;
  el: HTMLSpanElement;
  shown: boolean;
}

export function attachBodyLabels(opts: {
  planets: PlanetsHandle;
  container: HTMLElement;
}): BodyLabelsHandle {
  const { planets, container } = opts;

  const wrapper = document.createElement('div');
  wrapper.id = 'body-labels';
  container.appendChild(wrapper);

  const entries: BodyEntry[] = BODY_NAMES.map((body) => {
    const el = document.createElement('span');
    el.textContent = body;
    el.style.display = 'none';
    wrapper.appendChild(el);
    return { body, el, shown: false };
  });

  let layerEnabled = true;
  let viewportW = 0;
  let viewportH = 0;
  const tmp = new THREE.Vector3();

  const updateOne = (entry: BodyEntry, camera: THREE.Camera): void => {
    if (!layerEnabled) {
      if (entry.shown) {
        entry.el.style.display = 'none';
        entry.shown = false;
      }
      return;
    }

    planets.getWorldPosition(entry.body, tmp);
    if (isOccludedByEarth(camera.position, tmp)) {
      if (entry.shown) {
        entry.el.style.display = 'none';
        entry.shown = false;
      }
      return;
    }
    tmp.project(camera);

    if (tmp.z < -1 || tmp.z > 1) {
      if (entry.shown) {
        entry.el.style.display = 'none';
        entry.shown = false;
      }
      return;
    }

    const x = (tmp.x + 1) * 0.5 * viewportW;
    const y = (1 - tmp.y) * 0.5 * viewportH;

    if (!entry.shown) {
      entry.el.style.display = '';
      entry.shown = true;
    }
    entry.el.style.transform = `translate(${(x + 8).toFixed(1)}px, ${(y - 14).toFixed(1)}px)`;
  };

  return {
    update(camera) {
      if (viewportW === 0 || viewportH === 0) return;
      for (const e of entries) updateOne(e, camera);
    },
    setSize(width, height) {
      viewportW = width;
      viewportH = height;
    },
    setVisible(on) {
      layerEnabled = on;
      if (!on) {
        for (const e of entries) {
          if (e.shown) {
            e.el.style.display = 'none';
            e.shown = false;
          }
        }
      }
    },
    dispose() {
      wrapper.remove();
    },
  };
}

// Spec §4.6: RA labels at every hour-tick (15°) along the celestial equator.
// Visibility is tied to the celestialEquator layer; format ("0h" vs "0°")
// switches with state.raUnits. Anchored just north of the equator line so
// the text sits clearly above the tick mark on the projected great circle.

export interface RaLabelsHandle {
  update(camera: THREE.Camera, parent: THREE.Object3D): void;
  setSize(width: number, height: number): void;
  setVisible(on: boolean): void;
  setUnits(units: RaUnits): void;
  dispose(): void;
}

interface RaEntry {
  /** Hour bucket 0..23 — multiplied by 15° to recover RA. */
  hour: number;
  localPos: THREE.Vector3;
  el: HTMLSpanElement;
  shown: boolean;
}

const RA_LABEL_DEC = (3 * Math.PI) / 180;

function raLabelText(hour: number, units: RaUnits): string {
  return units === 'hours' ? `${hour}h` : `${hour * 15}°`;
}

export function attachRaLabels(opts: { container: HTMLElement }): RaLabelsHandle {
  const wrapper = document.createElement('div');
  wrapper.id = 'ra-labels';
  opts.container.appendChild(wrapper);

  let units: RaUnits = 'hours';
  const entries: RaEntry[] = [];
  for (let h = 0; h < 24; h++) {
    const ra = (h * 15 * Math.PI) / 180;
    const el = document.createElement('span');
    el.textContent = raLabelText(h, units);
    el.style.display = 'none';
    wrapper.appendChild(el);
    entries.push({
      hour: h,
      localPos: raDecToVec3(ra, RA_LABEL_DEC, R_CS + 0.001),
      el,
      shown: false,
    });
  }

  let layerEnabled = true;
  let viewportW = 0;
  let viewportH = 0;
  const tmp = new THREE.Vector3();
  const worldTmp = new THREE.Vector3();

  const updateOne = (entry: RaEntry, camera: THREE.Camera, parent: THREE.Object3D): void => {
    if (!layerEnabled) {
      if (entry.shown) {
        entry.el.style.display = 'none';
        entry.shown = false;
      }
      return;
    }

    worldTmp.copy(entry.localPos).applyMatrix4(parent.matrixWorld);
    if (isOccludedByEarth(camera.position, worldTmp)) {
      if (entry.shown) {
        entry.el.style.display = 'none';
        entry.shown = false;
      }
      return;
    }

    tmp.copy(worldTmp).project(camera);
    if (tmp.z < -1 || tmp.z > 1) {
      if (entry.shown) {
        entry.el.style.display = 'none';
        entry.shown = false;
      }
      return;
    }

    const x = (tmp.x + 1) * 0.5 * viewportW;
    const y = (1 - tmp.y) * 0.5 * viewportH;

    if (!entry.shown) {
      entry.el.style.display = '';
      entry.shown = true;
    }
    entry.el.style.transform = `translate(${(x - 8).toFixed(1)}px, ${(y - 16).toFixed(1)}px)`;
  };

  return {
    update(camera, parent) {
      if (viewportW === 0 || viewportH === 0) return;
      for (const e of entries) updateOne(e, camera, parent);
    },
    setSize(width, height) {
      viewportW = width;
      viewportH = height;
    },
    setVisible(on) {
      layerEnabled = on;
      if (!on) {
        for (const e of entries) {
          if (e.shown) {
            e.el.style.display = 'none';
            e.shown = false;
          }
        }
      }
    },
    setUnits(next) {
      if (next === units) return;
      units = next;
      for (const e of entries) e.el.textContent = raLabelText(e.hour, units);
    },
    dispose() {
      wrapper.remove();
    },
  };
}

// Spec §4.7: Latin-name labels at constellation-region centroids. Anchors are
// the centroids exposed by createConstellations (already × R_CS); rotated
// with celestialRoot just like star labels. Visibility tracks
// state.layers.constellationLabels.

export interface ConstellationLabelsHandle {
  update(camera: THREE.Camera, parent: THREE.Object3D): void;
  setSize(width: number, height: number): void;
  setVisible(on: boolean): void;
  dispose(): void;
}

interface ConstellationEntry {
  abbr: string;
  name: string;
  localPos: THREE.Vector3;
  el: HTMLSpanElement;
  shown: boolean;
}

export function attachConstellationLabels(opts: {
  centroids: ReadonlyArray<CentroidEntry>;
  container: HTMLElement;
}): ConstellationLabelsHandle {
  const wrapper = document.createElement('div');
  wrapper.id = 'constellation-labels';
  opts.container.appendChild(wrapper);

  const entries: ConstellationEntry[] = opts.centroids.map((c) => {
    const el = document.createElement('span');
    el.textContent = c.name;
    el.style.display = 'none';
    wrapper.appendChild(el);
    return { abbr: c.abbr, name: c.name, localPos: c.localPos.clone(), el, shown: false };
  });

  let layerEnabled = true;
  let viewportW = 0;
  let viewportH = 0;
  const tmp = new THREE.Vector3();
  const worldTmp = new THREE.Vector3();

  const updateOne = (entry: ConstellationEntry, camera: THREE.Camera, parent: THREE.Object3D): void => {
    if (!layerEnabled) {
      if (entry.shown) {
        entry.el.style.display = 'none';
        entry.shown = false;
      }
      return;
    }

    worldTmp.copy(entry.localPos).applyMatrix4(parent.matrixWorld);
    if (isOccludedByEarth(camera.position, worldTmp)) {
      if (entry.shown) {
        entry.el.style.display = 'none';
        entry.shown = false;
      }
      return;
    }

    tmp.copy(worldTmp).project(camera);
    if (tmp.z < -1 || tmp.z > 1) {
      if (entry.shown) {
        entry.el.style.display = 'none';
        entry.shown = false;
      }
      return;
    }

    const x = (tmp.x + 1) * 0.5 * viewportW;
    const y = (1 - tmp.y) * 0.5 * viewportH;

    if (!entry.shown) {
      entry.el.style.display = '';
      entry.shown = true;
    }
    // Centred on the centroid: shift left by half label width via CSS
    // translate-X(-50%) handled in style.css for #constellation-labels span.
    entry.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
  };

  return {
    update(camera, parent) {
      if (viewportW === 0 || viewportH === 0) return;
      for (const e of entries) updateOne(e, camera, parent);
    },
    setSize(width, height) {
      viewportW = width;
      viewportH = height;
    },
    setVisible(on) {
      layerEnabled = on;
      if (!on) {
        for (const e of entries) {
          if (e.shown) {
            e.el.style.display = 'none';
            e.shown = false;
          }
        }
      }
    },
    dispose() {
      wrapper.remove();
    },
  };
}
