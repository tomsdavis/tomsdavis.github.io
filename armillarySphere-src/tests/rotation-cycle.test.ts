import { describe, it, expect } from 'vitest';
import { nextRotationMode } from '../src/ui/rotation-cycle';
import type { RotationMode } from '../src/state';

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
