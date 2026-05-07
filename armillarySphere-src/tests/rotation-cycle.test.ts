import { describe, it, expect } from 'vitest';
import { nextRotationMode, transitionRotationMode } from '../src/ui/rotation-cycle';
import { rotationFor } from '../src/scene/rotation';
import { defaultState, type AppState, type RotationMode } from '../src/state';

describe('nextRotationMode', () => {
  it('cycles rotating-earth → fixed-earth', () => {
    expect(nextRotationMode('rotating-earth')).toBe('fixed-earth');
  });

  it('cycles fixed-earth → sidereal-lock', () => {
    expect(nextRotationMode('fixed-earth')).toBe('sidereal-lock');
  });

  it('cycles sidereal-lock → rotating-earth', () => {
    expect(nextRotationMode('sidereal-lock')).toBe('rotating-earth');
  });

  it('closes the cycle after three clicks', () => {
    let m: RotationMode = 'rotating-earth';
    for (let i = 0; i < 3; i++) m = nextRotationMode(m);
    expect(m).toBe('rotating-earth');
  });
});

describe('transitionRotationMode', () => {
  // The user-visible criterion: the celestial sphere stays put on screen
  // across every transition, and Earth too whenever physics allows. We
  // verify it by checking the screen-azimuth invariant
  //   screenAz(world θ) = θ − cameraAzimuth
  // holds for both Earth's "Greenwich" anchor (earthY) and the celestial-
  // sphere anchor (celestialY) before and after the patch.

  function withMode(mode: RotationMode, extra: Partial<AppState> = {}): AppState {
    return { ...defaultState(), rotationMode: mode, ...extra };
  }

  function appliedAngles(s: AppState, gast: number) {
    return rotationFor(s.rotationMode, gast, s.siderealLock);
  }

  it('re → fe: preserves both Earth and sky on screen (uniform rotation)', () => {
    const g = 1.5; // some non-trivial GAST
    const s = withMode('rotating-earth');
    const before = appliedAngles(s, g);
    const screenE_before = before.earthY - s.camera.azimuth;
    const screenC_before = before.celestialY - s.camera.azimuth;

    const patch = transitionRotationMode(s, g);
    const next = { ...s, ...patch } as AppState;
    expect(next.rotationMode).toBe('fixed-earth');
    expect(next.siderealLock).toBeNull();

    const after = appliedAngles(next, g);
    const screenE_after = after.earthY - next.camera.azimuth;
    const screenC_after = after.celestialY - next.camera.azimuth;

    expect(screenE_after).toBeCloseTo(screenE_before, 9);
    expect(screenC_after).toBeCloseTo(screenC_before, 9);
  });

  it('fe → sl: captures lock at fe angles and preserves view exactly', () => {
    const g = 1.5;
    const s = withMode('fixed-earth');
    const before = appliedAngles(s, g);
    const azBefore = s.camera.azimuth;

    const patch = transitionRotationMode(s, g);
    const next = { ...s, ...patch } as AppState;
    expect(next.rotationMode).toBe('sidereal-lock');
    expect(next.siderealLock).toEqual({ earthY: 0, celestialY: -1.5 });
    // Lock-at-entry means no scene-frame rotation, so camera stays put.
    expect(next.camera.azimuth).toBeCloseTo(azBefore, 9);

    const after = appliedAngles(next, g);
    expect(after.earthY).toBeCloseTo(before.earthY, 9);
    expect(after.celestialY).toBeCloseTo(before.celestialY, 9);
  });

  it('re → sl: captures lock at re angles and preserves view exactly', () => {
    // Not reachable through the re→fe→sl→re cycle, but the helper handles
    // any starting mode (e.g. URL-set 'rotating-earth' before clicking
    // through to sl via two presses).
    const g = 1.5;
    const s = withMode('rotating-earth');

    // First click: re → fe
    const p1 = transitionRotationMode(s, g);
    const after1 = { ...s, ...p1 } as AppState;
    expect(after1.rotationMode).toBe('fixed-earth');

    // Second click: fe → sl. Verified above.
    const p2 = transitionRotationMode(after1, g);
    const after2 = { ...after1, ...p2 } as AppState;
    expect(after2.rotationMode).toBe('sidereal-lock');
    expect(after2.siderealLock).toEqual({ earthY: 0, celestialY: -1.5 });

    // Round trip: sl → re. With t unchanged, lock value g_lock == gast(t_now),
    // so camera azimuth bumps by +g_lock and the original re screen geometry
    // is recovered.
    const p3 = transitionRotationMode(after2, g);
    const after3 = { ...after2, ...p3 } as AppState;
    expect(after3.rotationMode).toBe('rotating-earth');
    expect(after3.siderealLock).toBeNull();

    const beforeOriginal = appliedAngles(s, g);
    const screenE0 = beforeOriginal.earthY - s.camera.azimuth;
    const screenC0 = beforeOriginal.celestialY - s.camera.azimuth;

    const final = appliedAngles(after3, g);
    const screenE3 = final.earthY - after3.camera.azimuth;
    const screenC3 = final.celestialY - after3.camera.azimuth;

    expect(screenE3).toBeCloseTo(screenE0, 9);
    expect(screenC3).toBeCloseTo(screenC0, 9);
  });

  it('sl → re after time advances: keeps sky fixed; Earth jumps by the diurnal advance', () => {
    // Enter sl from fe at gast = g_lock, then exit at gast = g_now > g_lock.
    const g_lock = 1.5;
    const g_now = 2.5;
    const fe = withMode('fixed-earth');

    const enterPatch = transitionRotationMode(fe, g_lock);
    const inSl = { ...fe, ...enterPatch } as AppState;
    expect(inSl.siderealLock).toEqual({ earthY: 0, celestialY: -g_lock });

    const inSlAngles = appliedAngles(inSl, g_now);
    const screenC_before = inSlAngles.celestialY - inSl.camera.azimuth;
    const screenE_before = inSlAngles.earthY - inSl.camera.azimuth;

    const exitPatch = transitionRotationMode(inSl, g_now);
    const out = { ...inSl, ...exitPatch } as AppState;
    expect(out.rotationMode).toBe('rotating-earth');
    expect(out.siderealLock).toBeNull();

    const outAngles = appliedAngles(out, g_now);
    const screenC_after = outAngles.celestialY - out.camera.azimuth;
    const screenE_after = outAngles.earthY - out.camera.azimuth;

    // Sky preserved.
    expect(screenC_after).toBeCloseTo(screenC_before, 9);
    // Earth jumps by exactly (g_now − g_lock) — the diurnal angle that
    // didn't apply during sl.
    expect(screenE_after - screenE_before).toBeCloseTo(g_now - g_lock, 9);
  });

});
