import { describe, it, expect } from 'vitest';
import { isDestructiveTransition } from '$lib/utils/palette-transitions';

describe('isDestructiveTransition', () => {
	describe('no-op transitions (same config)', () => {
		it('returns false for identical config', () => {
			expect(isDestructiveTransition('relative', 'chromatic', 'relative', 'chromatic')).toBe(false);
			expect(isDestructiveTransition('absolute', 'diatonic', 'absolute', 'diatonic')).toBe(false);
			expect(isDestructiveTransition('relative', 'microtonal', 'relative', 'microtonal')).toBe(false);
		});
	});

	describe('safe transitions (chromatic <-> diatonic, same system)', () => {
		it('relative chromatic -> relative diatonic is safe', () => {
			expect(isDestructiveTransition('relative', 'chromatic', 'relative', 'diatonic')).toBe(false);
		});

		it('relative diatonic -> relative chromatic is safe', () => {
			expect(isDestructiveTransition('relative', 'diatonic', 'relative', 'chromatic')).toBe(false);
		});

		it('absolute chromatic -> absolute diatonic is safe', () => {
			expect(isDestructiveTransition('absolute', 'chromatic', 'absolute', 'diatonic')).toBe(false);
		});

		it('absolute diatonic -> absolute chromatic is safe', () => {
			expect(isDestructiveTransition('absolute', 'diatonic', 'absolute', 'chromatic')).toBe(false);
		});
	});

	describe('destructive: system changes', () => {
		it('relative -> absolute is destructive', () => {
			expect(isDestructiveTransition('relative', 'chromatic', 'absolute', 'chromatic')).toBe(true);
		});

		it('absolute -> relative is destructive', () => {
			expect(isDestructiveTransition('absolute', 'chromatic', 'relative', 'chromatic')).toBe(true);
		});

		it('relative diatonic -> absolute chromatic is destructive', () => {
			expect(isDestructiveTransition('relative', 'diatonic', 'absolute', 'chromatic')).toBe(true);
		});
	});

	describe('destructive: microtonal involvement', () => {
		it('chromatic -> microtonal is destructive', () => {
			expect(isDestructiveTransition('relative', 'chromatic', 'relative', 'microtonal')).toBe(true);
		});

		it('diatonic -> microtonal is destructive', () => {
			expect(isDestructiveTransition('relative', 'diatonic', 'relative', 'microtonal')).toBe(true);
		});

		it('microtonal -> chromatic is destructive', () => {
			expect(isDestructiveTransition('relative', 'microtonal', 'relative', 'chromatic')).toBe(true);
		});

		it('microtonal -> diatonic is destructive', () => {
			expect(isDestructiveTransition('relative', 'microtonal', 'relative', 'diatonic')).toBe(true);
		});
	});
});
