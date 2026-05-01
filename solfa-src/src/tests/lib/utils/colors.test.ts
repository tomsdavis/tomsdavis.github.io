import { describe, it, expect } from 'vitest';
import { noteColor, NOTE_COLORS } from '$lib/utils/colors';

describe('colors', () => {
	it('NOTE_COLORS has 12 entries', () => {
		expect(NOTE_COLORS.length).toBe(12);
	});

	it('each color is a valid CSS color string', () => {
		for (const color of NOTE_COLORS) {
			expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
		}
	});

	it('all colors are unique', () => {
		const unique = new Set(NOTE_COLORS);
		expect(unique.size).toBe(12);
	});

	it('noteColor returns correct color for semitone index', () => {
		expect(noteColor(0)).toBe(NOTE_COLORS[0]);
		expect(noteColor(11)).toBe(NOTE_COLORS[11]);
	});

	it('noteColor wraps around for values >= 12', () => {
		expect(noteColor(12)).toBe(NOTE_COLORS[0]);
		expect(noteColor(14)).toBe(NOTE_COLORS[2]);
	});
});
