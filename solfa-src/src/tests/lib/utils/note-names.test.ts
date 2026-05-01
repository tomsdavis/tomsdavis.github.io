import { describe, it, expect } from 'vitest';
import {
	chromaticName,
	solfegeName,
	noteNameWithOctave,
	semitoneToNoteName,
	chromaticSolfegeName,
	subscriptDigit,
	gridLabel,
	majorScaleNoteNames,
	majorScaleSemitones,
	keyRootSemitone,
	ALL_KEY_NAMES
} from '$lib/utils/note-names';

describe('note-names', () => {
	describe('chromaticName', () => {
		it('returns correct name for each semitone within an octave', () => {
			expect(chromaticName(0)).toBe('C');
			expect(chromaticName(1)).toBe('C#');
			expect(chromaticName(2)).toBe('D');
			expect(chromaticName(3)).toBe('D#');
			expect(chromaticName(4)).toBe('E');
			expect(chromaticName(5)).toBe('F');
			expect(chromaticName(6)).toBe('F#');
			expect(chromaticName(7)).toBe('G');
			expect(chromaticName(8)).toBe('G#');
			expect(chromaticName(9)).toBe('A');
			expect(chromaticName(10)).toBe('A#');
			expect(chromaticName(11)).toBe('B');
		});

		it('wraps around for values >= 12', () => {
			expect(chromaticName(12)).toBe('C');
			expect(chromaticName(14)).toBe('D');
		});
	});

	describe('solfegeName', () => {
		it('returns correct solfege name for each semitone', () => {
			expect(solfegeName(0)).toBe('Do');
			expect(solfegeName(2)).toBe('Re');
			expect(solfegeName(4)).toBe('Mi');
			expect(solfegeName(5)).toBe('Fa');
			expect(solfegeName(7)).toBe('So');
			expect(solfegeName(9)).toBe('La');
			expect(solfegeName(11)).toBe('Ti');
		});

		it('returns chromatic name for accidentals', () => {
			expect(solfegeName(1)).toBe('C#');
			expect(solfegeName(3)).toBe('D#');
			expect(solfegeName(6)).toBe('F#');
			expect(solfegeName(8)).toBe('G#');
			expect(solfegeName(10)).toBe('A#');
		});
	});

	describe('noteNameWithOctave', () => {
		it('formats note name with octave number', () => {
			expect(noteNameWithOctave('C', 4)).toBe('C4');
			expect(noteNameWithOctave('A', 0)).toBe('A0');
			expect(noteNameWithOctave('F#', 6)).toBe('F#6');
		});
	});

	describe('chromaticSolfegeName', () => {
		it('returns solfege name for each chromatic semitone', () => {
			expect(chromaticSolfegeName(0)).toBe('Do');
			expect(chromaticSolfegeName(1)).toBe('Ku');
			expect(chromaticSolfegeName(2)).toBe('Re');
			expect(chromaticSolfegeName(3)).toBe('Na');
			expect(chromaticSolfegeName(4)).toBe('Mi');
			expect(chromaticSolfegeName(5)).toBe('Fa');
			expect(chromaticSolfegeName(6)).toBe('Ci');
			expect(chromaticSolfegeName(7)).toBe('So');
			expect(chromaticSolfegeName(8)).toBe('Pe');
			expect(chromaticSolfegeName(9)).toBe('La');
			expect(chromaticSolfegeName(10)).toBe('Vu');
			expect(chromaticSolfegeName(11)).toBe('Ti');
		});

		it('wraps around for values >= 12', () => {
			expect(chromaticSolfegeName(12)).toBe('Do');
			expect(chromaticSolfegeName(14)).toBe('Re');
		});

		it('handles negative values', () => {
			expect(chromaticSolfegeName(-1)).toBe('Ti');
		});
	});

	describe('subscriptDigit', () => {
		it('converts single digits to subscript', () => {
			expect(subscriptDigit(0)).toBe('₀');
			expect(subscriptDigit(4)).toBe('₄');
			expect(subscriptDigit(9)).toBe('₉');
		});

		it('converts multi-digit numbers', () => {
			expect(subscriptDigit(10)).toBe('₁₀');
		});

		it('handles negative numbers', () => {
			expect(subscriptDigit(-1)).toBe('₋₁');
		});
	});

	describe('gridLabel', () => {
		it('generates diatonic solfege label with octave', () => {
			const pitch = { kind: 'semitone' as const, semitones: 0 };
			expect(gridLabel(pitch, 60, 'diatonic', 'Do')).toBe('Do₄');
		});

		it('generates absolute chromatic label with octave', () => {
			const pitch = { kind: 'semitone' as const, semitones: 0 };
			expect(gridLabel(pitch, 60, 'chromatic', 'C', 'absolute')).toBe('C4');
		});

		it('generates absolute chromatic label for sharp notes', () => {
			const pitch = { kind: 'semitone' as const, semitones: 1 };
			expect(gridLabel(pitch, 61, 'chromatic', 'C#', 'absolute')).toBe('C#4');
		});

		it('generates cents label with octave subscript', () => {
			const pitch = { kind: 'cents' as const, cents: 204 };
			expect(gridLabel(pitch, 62.04, 'microtonal', '2')).toBe('204¢₄');
		});

		it('generates mille label with octave subscript', () => {
			const pitch = { kind: 'mille' as const, mille: 585 };
			expect(gridLabel(pitch, 67.02, 'microtonal', '5')).toBe('585‰₄');
		});

		it('relative chromatic uses subscript octave', () => {
			const pitch = { kind: 'semitone' as const, semitones: 7 };
			expect(gridLabel(pitch, 67, 'chromatic', 'So', 'relative')).toBe('So₄');
		});

		it('absolute chromatic uses plain octave digit', () => {
			const pitch = { kind: 'semitone' as const, semitones: 7 };
			expect(gridLabel(pitch, 67, 'chromatic', 'G', 'absolute')).toBe('G4');
		});

		it('handles octave 0', () => {
			const pitch = { kind: 'semitone' as const, semitones: 0 };
			expect(gridLabel(pitch, 12, 'diatonic', 'Do')).toBe('Do₀');
		});

		it('absolute diatonic uses baseName + octave (preserves enharmonic)', () => {
			const pitch = { kind: 'semitone' as const, semitones: 0 };
			// Absolute diatonic uses baseName from palette (e.g. "C" not re-derived)
			expect(gridLabel(pitch, 60, 'diatonic', 'C', 'absolute')).toBe('C4');
		});

		it('absolute mode with sharp note', () => {
			const pitch = { kind: 'semitone' as const, semitones: 1 };
			expect(gridLabel(pitch, 61, 'chromatic', 'C#', 'absolute')).toBe('C#4');
		});

		it('relative mode uses baseName (default)', () => {
			const pitch = { kind: 'semitone' as const, semitones: 0 };
			// Explicitly passing 'relative' should behave same as default
			expect(gridLabel(pitch, 60, 'diatonic', 'Do', 'relative')).toBe('Do₄');
		});

		it('relative mode with baseMidiOffset=0 shows octave 0', () => {
			const pitch = { kind: 'semitone' as const, semitones: 0 };
			expect(gridLabel(pitch, 60, 'diatonic', 'Do', 'relative', 0)).toBe('Do₀');
		});

		it('relative mode with baseMidiOffset=12 shows octave 1', () => {
			const pitch = { kind: 'semitone' as const, semitones: 0 };
			expect(gridLabel(pitch, 72, 'diatonic', 'Do', 'relative', 12)).toBe('Do₁');
		});

		it('relative mode with baseMidiOffset=-12 shows octave -1', () => {
			const pitch = { kind: 'semitone' as const, semitones: 0 };
			expect(gridLabel(pitch, 48, 'diatonic', 'Do', 'relative', -12)).toBe('Do₋₁');
		});

		it('absolute mode ignores baseMidiOffset', () => {
			const pitch = { kind: 'semitone' as const, semitones: 0 };
			// Even with baseMidiOffset, absolute mode derives octave from midiNote
			expect(gridLabel(pitch, 60, 'diatonic', 'C', 'absolute', 0)).toBe('C4');
		});
	});

	describe('majorScaleNoteNames', () => {
		it('returns 7 note names for key of C', () => {
			expect(majorScaleNoteNames('C')).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
		});

		it('returns correct names for key of G (one sharp)', () => {
			expect(majorScaleNoteNames('G')).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F#']);
		});

		it('returns correct names for key of F (one flat)', () => {
			expect(majorScaleNoteNames('F')).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
		});

		it('returns correct names for key of Db (five flats)', () => {
			expect(majorScaleNoteNames('Db')).toEqual(['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C']);
		});

		it('returns correct names for key of F# (six sharps)', () => {
			expect(majorScaleNoteNames('F#')).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);
		});

		it('returns correct names for key of Cb (seven flats)', () => {
			expect(majorScaleNoteNames('Cb')).toEqual(['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb']);
		});

		it('returns correct names for key of C# (seven sharps)', () => {
			expect(majorScaleNoteNames('C#')).toEqual(['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#']);
		});

		it('D# aliases to Eb', () => {
			expect(majorScaleNoteNames('D#')).toEqual(majorScaleNoteNames('Eb'));
		});

		it('G# aliases to Ab', () => {
			expect(majorScaleNoteNames('G#')).toEqual(majorScaleNoteNames('Ab'));
		});

		it('A# aliases to Bb', () => {
			expect(majorScaleNoteNames('A#')).toEqual(majorScaleNoteNames('Bb'));
		});
	});

	describe('majorScaleSemitones', () => {
		it('returns [0,2,4,5,7,9,11] for key of C', () => {
			expect(majorScaleSemitones('C')).toEqual([0, 2, 4, 5, 7, 9, 11]);
		});

		it('returns semitones starting from root for key of G', () => {
			// G=7, A=9, B=11, C=0, D=2, E=4, F#=6
			expect(majorScaleSemitones('G')).toEqual([7, 9, 11, 0, 2, 4, 6]);
		});

		it('returns semitones for key of F', () => {
			// F=5, G=7, A=9, Bb=10, C=0, D=2, E=4
			expect(majorScaleSemitones('F')).toEqual([5, 7, 9, 10, 0, 2, 4]);
		});
	});

	describe('keyRootSemitone', () => {
		it('C = 0', () => expect(keyRootSemitone('C')).toBe(0));
		it('C# = 1', () => expect(keyRootSemitone('C#')).toBe(1));
		it('Db = 1', () => expect(keyRootSemitone('Db')).toBe(1));
		it('D = 2', () => expect(keyRootSemitone('D')).toBe(2));
		it('G = 7', () => expect(keyRootSemitone('G')).toBe(7));
		it('B = 11', () => expect(keyRootSemitone('B')).toBe(11));
		it('Cb = 11', () => expect(keyRootSemitone('Cb')).toBe(11));
	});

	describe('ALL_KEY_NAMES', () => {
		it('has 17 entries', () => {
			expect(ALL_KEY_NAMES).toHaveLength(17);
		});

		it('includes all natural notes', () => {
			for (const n of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
				expect(ALL_KEY_NAMES).toContain(n);
			}
		});

		it('includes sharps and flats', () => {
			for (const n of ['C#', 'Db', 'D#', 'Eb', 'F#', 'Gb', 'G#', 'Ab', 'A#', 'Bb']) {
				expect(ALL_KEY_NAMES).toContain(n);
			}
		});
	});

	describe('gridLabel — absolute diatonic', () => {
		it('uses baseName + octave for absolute diatonic (preserves enharmonic)', () => {
			const pitch = { kind: 'semitone' as const, semitones: 10 };
			// Bb4 — baseName is "Bb" from palette, should NOT become A#
			expect(gridLabel(pitch, 70, 'diatonic', 'Bb', 'absolute')).toBe('Bb4');
		});

		it('uses baseName for F# in absolute diatonic', () => {
			const pitch = { kind: 'semitone' as const, semitones: 6 };
			expect(gridLabel(pitch, 66, 'diatonic', 'F#', 'absolute')).toBe('F#4');
		});

		it('uses baseName for Gb in absolute diatonic', () => {
			const pitch = { kind: 'semitone' as const, semitones: 6 };
			expect(gridLabel(pitch, 66, 'diatonic', 'Gb', 'absolute')).toBe('Gb4');
		});

		it('natural note in absolute diatonic', () => {
			const pitch = { kind: 'semitone' as const, semitones: 0 };
			expect(gridLabel(pitch, 60, 'diatonic', 'C', 'absolute')).toBe('C4');
		});
	});

	describe('semitoneToNoteName', () => {
		it('converts absolute semitones from C0 to note name with octave', () => {
			expect(semitoneToNoteName(0)).toBe('C0');
			expect(semitoneToNoteName(12)).toBe('C1');
			expect(semitoneToNoteName(48)).toBe('C4');
			expect(semitoneToNoteName(57)).toBe('A4');
			expect(semitoneToNoteName(60)).toBe('C5');
		});

		it('handles accidentals', () => {
			expect(semitoneToNoteName(1)).toBe('C#0');
			expect(semitoneToNoteName(49)).toBe('C#4');
		});
	});
});
