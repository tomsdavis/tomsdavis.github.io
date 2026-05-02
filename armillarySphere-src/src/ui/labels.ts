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
import { R_CS } from '../scene/celestial-sphere';

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

  const updateOne = (entry: Entry, camera: THREE.Camera, parent: THREE.Object3D): void => {
    if (!layerEnabled || entry.mag > magLimit) {
      if (entry.shown) {
        entry.el.style.display = 'none';
        entry.shown = false;
      }
      return;
    }

    tmp.copy(entry.localPos).applyMatrix4(parent.matrixWorld).project(camera);

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
