import { describe, it, expect } from 'vitest';
import { pitchToMidi, midiToHz, hzToMidi, resolvePlaybackMidi } from '$lib/audio/pitch';
import type { Note } from '$lib/types/note';

describe('pitch', () => {
	describe('pitchToMidi', () => {
		it('converts semitone pitch relative to refMidi', () => {
			// 0 semitones above C4 (60) = C4 = MIDI 60
			expect(pitchToMidi({ kind: 'semitone', semitones: 0 }, 60)).toBeCloseTo(60);
			// 7 semitones above C4 (60) = G4 = MIDI 67
			expect(pitchToMidi({ kind: 'semitone', semitones: 7 }, 60)).toBeCloseTo(67);
			// negative: -12 semitones above C4 = C3 = MIDI 48
			expect(pitchToMidi({ kind: 'semitone', semitones: -12 }, 60)).toBeCloseTo(48);
		});

		it('converts cents pitch relative to refMidi', () => {
			// 0 cents above A4 (69) = MIDI 69
			expect(pitchToMidi({ kind: 'cents', cents: 0 }, 69)).toBeCloseTo(69);
			// 1200 cents above A4 = A5 = MIDI 81
			expect(pitchToMidi({ kind: 'cents', cents: 1200 }, 69)).toBeCloseTo(81);
			// 100 cents = 1 semitone above C4 = C#4 = MIDI 61
			expect(pitchToMidi({ kind: 'cents', cents: 100 }, 60)).toBeCloseTo(61);
		});

		it('converts mille pitch relative to refMidi', () => {
			// 0 mille above A4 (69) = MIDI 69
			expect(pitchToMidi({ kind: 'mille', mille: 0 }, 69)).toBeCloseTo(69);
			// 1000 mille = one octave above A4 = A5 = MIDI 81
			expect(pitchToMidi({ kind: 'mille', mille: 1000 }, 69)).toBeCloseTo(81);
		});
	});

	describe('midiToHz', () => {
		it('converts MIDI note to Hz', () => {
			expect(midiToHz(69)).toBeCloseTo(440);
			expect(midiToHz(60)).toBeCloseTo(261.626, 1);
			expect(midiToHz(81)).toBeCloseTo(880);
		});
	});

	describe('resolvePlaybackMidi', () => {
		function makeNote(midiNote: number, baseMidiOffset?: number): Note {
			return {
				id: 'test',
				pitch: { kind: 'semitone', semitones: 0 },
				midiNote,
				label: 'X',
				color: '#000',
				baseMidiOffset
			};
		}

		it('returns baseMidiOffset + refMidi when baseMidiOffset is set', () => {
			// offset 0 + refMidi 60 = 60
			expect(resolvePlaybackMidi(makeNote(60, 0), 60)).toBe(60);
			// offset 12 + refMidi 60 = 72
			expect(resolvePlaybackMidi(makeNote(72, 12), 60)).toBe(72);
			// offset 0 + refMidi 62 (D4) = 62 — transposition shifts playback
			expect(resolvePlaybackMidi(makeNote(60, 0), 62)).toBe(62);
		});

		it('returns midiNote when baseMidiOffset is undefined', () => {
			expect(resolvePlaybackMidi(makeNote(60), 62)).toBe(60);
			expect(resolvePlaybackMidi(makeNote(72), 48)).toBe(72);
		});

		it('baseMidiOffset takes precedence even when both fields are set', () => {
			// baseMidiOffset=7, refMidi=60 → 67, regardless of midiNote=99
			expect(resolvePlaybackMidi(makeNote(99, 7), 60)).toBe(67);
		});

		it('handles negative baseMidiOffset', () => {
			expect(resolvePlaybackMidi(makeNote(48, -12), 60)).toBe(48);
		});
	});

	describe('hzToMidi', () => {
		it('converts Hz to MIDI note number', () => {
			expect(hzToMidi(440)).toBeCloseTo(69);
			expect(hzToMidi(880)).toBeCloseTo(81);
			expect(hzToMidi(261.626)).toBeCloseTo(60, 0);
		});

		it('round-trips with midiToHz', () => {
			for (const midi of [36, 48, 60, 69, 72, 84]) {
				expect(hzToMidi(midiToHz(midi))).toBeCloseTo(midi, 5);
			}
		});
	});
});
