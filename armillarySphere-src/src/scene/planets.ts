// Spec §4.5: Sun, Moon, and the five classical naked-eye planets as labelled
// markers at geocentric apparent RA/Dec for the current instant.
//
// Two render styles share one parented group:
//   - Flat sprites (Sun, Mars, Jupiter, Saturn): THREE.Sprite + SpriteMaterial.
//   - Phased billboards (Moon, Mercury, Venus): unit quads with a custom
//     ShaderMaterial that lights the Earth-facing hemisphere. Spec §4.5 says
//     "Planet phases are not depicted at this level of detail" — Mercury and
//     Venus are an explicit deviation, taken because the shader generalises
//     for free and the inferior planets show meaningful phases (half at
//     greatest elongation, crescent near inferior conjunction).
//
// All bodies parent to celestialRoot, so they ride along in fixed-Earth mode.
// Sprite/quad scale is constant in scene units; Sun and Moon are rendered at
// SUN_MOON_SCALE_FACTOR × the planet scale per agreed visual policy.

import * as THREE from 'three';
import phasedVert from '../shaders/phased.vert.glsl?raw';
import phasedFrag from '../shaders/phased.frag.glsl?raw';
import { R_CS, raDecToVec3 } from './celestial-sphere';
import {
  bodyDirection,
  bodyToSunSceneDir,
  bodyPhaseCos,
  type BodyName,
  BODY_NAMES,
} from '../astronomy/ephemeris';

const PLANET_SPRITE_SCALE = 0.045;
const SUN_MOON_SCALE_FACTOR = 1.5;
const TEXTURE_BASE_URL = 'textures/planets/';

const PHASED: ReadonlySet<BodyName> = new Set(['Moon', 'Mercury', 'Venus']);

interface BodySlot {
  /** Either a Sprite (flat) or a Mesh (phased). Both extend Object3D so the
   *  group/labels code can treat them uniformly. */
  object: THREE.Object3D;
  /** Set on phased bodies — the per-body ShaderMaterial whose
   *  uBodyToSunLocal uniform we update each instant. */
  phasedMaterial?: THREE.ShaderMaterial;
  /** Texture handle so dispose() can free it. */
  texture: THREE.Texture;
  /** Material handle so dispose() can free it. */
  material: THREE.Material;
  /** Quad geometry — only set on phased bodies (sprites use built-in). */
  geometry?: THREE.BufferGeometry;
}

export interface PlanetsHandle {
  group: THREE.Group;
  setPositions(date: Date): void;
  setVisible(on: boolean): void;
  getWorldPosition(body: BodyName, out: THREE.Vector3): THREE.Vector3;
  dispose(): void;
}

export async function createPlanets(): Promise<PlanetsHandle> {
  const loader = new THREE.TextureLoader();
  const textures = await Promise.all(
    BODY_NAMES.map((name) => loadTexture(loader, `${TEXTURE_BASE_URL}${name.toLowerCase()}.png`)),
  );

  const group = new THREE.Group();
  group.name = 'planets';

  // Single PlaneGeometry shared across all phased bodies — the vertex shader
  // does the billboard math, so each body just needs its own material/texture.
  const phasedGeometry = new THREE.PlaneGeometry(1, 1);

  const slots = {} as Record<BodyName, BodySlot>;

  BODY_NAMES.forEach((name, i) => {
    const tex = textures[i]!;
    const scale = PLANET_SPRITE_SCALE
      * (name === 'Sun' || name === 'Moon' ? SUN_MOON_SCALE_FACTOR : 1);

    if (PHASED.has(name)) {
      const material = new THREE.ShaderMaterial({
        vertexShader: phasedVert,
        fragmentShader: phasedFrag,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        uniforms: {
          uTexture: { value: tex },
          uScale: { value: scale },
          uBodyToSunLocal: { value: new THREE.Vector3(1, 0, 0) },
          uPhaseCos: { value: 1.0 },
        },
      });
      const mesh = new THREE.Mesh(phasedGeometry, material);
      mesh.name = name;
      // The vertex shader handles the billboard rotation, but Three.js still
      // needs a frustum-cull bounding sphere wide enough that the quad isn't
      // culled when the centre is near the edge of the camera frustum.
      mesh.frustumCulled = false;
      // Render after the celestial-sphere shell (0) and reference lines (1)
      // so opacity hides Earth and lines pass behind, without occluding the
      // planets that sit on R_CS.
      mesh.renderOrder = 2;
      group.add(mesh);
      slots[name] = { object: mesh, phasedMaterial: material, texture: tex, material, geometry: phasedGeometry };
    } else {
      const material = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: true,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(scale, scale, 1);
      sprite.name = name;
      sprite.renderOrder = 2;
      group.add(sprite);
      slots[name] = { object: sprite, texture: tex, material };
    }
  });

  const tmpL = new THREE.Vector3();

  return {
    group,
    setPositions(date) {
      for (const name of BODY_NAMES) {
        const { ra, dec } = bodyDirection(name, date);
        const local = raDecToVec3(ra, dec, R_CS);
        slots[name].object.position.copy(local);

        const slot = slots[name];
        if (slot.phasedMaterial) {
          const dir = bodyToSunSceneDir(name, date);
          tmpL.set(dir.x, dir.y, dir.z);
          (slot.phasedMaterial.uniforms.uBodyToSunLocal!.value as THREE.Vector3).copy(tmpL);
          slot.phasedMaterial.uniforms.uPhaseCos!.value = bodyPhaseCos(name, date);
        }
      }
    },
    setVisible(on) {
      group.visible = on;
    },
    getWorldPosition(body, out) {
      return slots[body].object.getWorldPosition(out);
    },
    dispose() {
      for (const name of BODY_NAMES) {
        const slot = slots[name];
        slot.texture.dispose();
        slot.material.dispose();
      }
      // Phased geometry is shared; dispose once.
      phasedGeometry.dispose();
    },
  };
}

function loadTexture(loader: THREE.TextureLoader, url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        resolve(tex);
      },
      undefined,
      (err) => reject(err),
    );
  });
}
