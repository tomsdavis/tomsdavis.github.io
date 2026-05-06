import { describe, it, expect } from 'vitest';
import {
  formatYear,
  yearOutsidePickerRange,
  shouldShowYearReadout,
} from '../src/ui/year-readout-logic';

// Helper: build a UTC Date at Jan 1 of the requested astronomical year.
// Date#setUTCFullYear handles negative + four-digit-overflow years natively.
function dateAtYear(y: number): Date {
  const d = new Date(Date.UTC(2000, 0, 1));
  d.setUTCFullYear(y);
  return d;
}

describe('formatYear', () => {
  it('formats CE years as "Year N"', () => {
    expect(formatYear(dateAtYear(2026))).toBe('Year 2026');
    expect(formatYear(dateAtYear(1))).toBe('Year 1');
    expect(formatYear(dateAtYear(15026))).toBe('Year 15026');
  });

  it('formats BCE years using astronomical-to-BCE conversion (year 0 = 1 BCE)', () => {
    expect(formatYear(dateAtYear(0))).toBe('Year 1 BCE');
    expect(formatYear(dateAtYear(-1))).toBe('Year 2 BCE');
    expect(formatYear(dateAtYear(-10974))).toBe('Year 10975 BCE');
  });

  it('omits thousands separators at any scale', () => {
    expect(formatYear(dateAtYear(15026))).not.toContain(',');
    expect(formatYear(dateAtYear(-10974))).not.toContain(',');
  });
});

describe('yearOutsidePickerRange', () => {
  it('treats years inside 0001–9999 as in-range', () => {
    expect(yearOutsidePickerRange(dateAtYear(2026))).toBe(false);
    expect(yearOutsidePickerRange(dateAtYear(1))).toBe(false);
    expect(yearOutsidePickerRange(dateAtYear(9999))).toBe(false);
  });

  it('treats years outside 0001–9999 as out-of-range', () => {
    expect(yearOutsidePickerRange(dateAtYear(0))).toBe(true);
    expect(yearOutsidePickerRange(dateAtYear(10000))).toBe(true);
    expect(yearOutsidePickerRange(dateAtYear(-10974))).toBe(true);
  });
});

describe('shouldShowYearReadout', () => {
  it('hides for everyday case: in-range year, normal rotation mode', () => {
    expect(shouldShowYearReadout({ instant: dateAtYear(2026), rotationMode: 'rotating-earth' })).toBe(false);
    expect(shouldShowYearReadout({ instant: dateAtYear(2026), rotationMode: 'fixed-earth' })).toBe(false);
  });

  it('shows when sidereal-lock is engaged, even for an in-range year', () => {
    expect(shouldShowYearReadout({ instant: dateAtYear(2026), rotationMode: 'sidereal-lock' })).toBe(true);
  });

  it('shows for out-of-range years regardless of rotation mode', () => {
    expect(shouldShowYearReadout({ instant: dateAtYear(15026), rotationMode: 'rotating-earth' })).toBe(true);
    expect(shouldShowYearReadout({ instant: dateAtYear(15026), rotationMode: 'fixed-earth' })).toBe(true);
  });

  it('shows when both conditions hold (no double-flicker, just OR)', () => {
    expect(shouldShowYearReadout({ instant: dateAtYear(15026), rotationMode: 'sidereal-lock' })).toBe(true);
  });
});
