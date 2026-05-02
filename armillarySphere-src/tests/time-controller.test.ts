import { describe, it, expect } from 'vitest';
import { advance, RATES } from '../src/controls/time-controller';

describe('time-controller', () => {
  it('exposes the spec-defined rate ladder', () => {
    expect(RATES).toEqual([1, 60, 3600, 86400, 31_557_600]);
  });

  it('advance() at ×1 = real time', () => {
    const t0 = new Date('2026-05-02T00:00:00Z');
    const t1 = advance(t0, 1, 0.5);
    expect(t1.getTime() - t0.getTime()).toBe(500);
  });

  it('advance() at ×60 maps 1 wall-clock second to 1 minute of sim time', () => {
    const t0 = new Date('2026-05-02T00:00:00Z');
    const t1 = advance(t0, 60, 1);
    expect(t1.getTime() - t0.getTime()).toBe(60_000);
  });

  it('advance() at ×31_557_600 maps 1 wall-clock second to one Julian year', () => {
    const t0 = new Date('2026-05-02T00:00:00Z');
    const t1 = advance(t0, 31_557_600, 1);
    expect(t1.getTime() - t0.getTime()).toBe(31_557_600_000);
  });

  it('does not mutate the input Date', () => {
    const t0 = new Date('2026-05-02T00:00:00Z');
    const before = t0.getTime();
    advance(t0, 3600, 5);
    expect(t0.getTime()).toBe(before);
  });

  it('handles negative rate (rewind) and negative dt symmetrically', () => {
    const t0 = new Date('2026-05-02T00:00:00Z');
    expect(advance(t0, -60, 1).getTime() - t0.getTime()).toBe(-60_000);
    expect(advance(t0, 60, -1).getTime() - t0.getTime()).toBe(-60_000);
  });
});
