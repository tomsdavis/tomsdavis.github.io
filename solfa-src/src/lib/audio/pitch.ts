import type { Note, PitchSpecification } from '$lib/types/note.js';
import { A4_HZ, A4_MIDI } from '$lib/constants.js';

/**
 * Convert a frequency in Hz to a (possibly fractional) MIDI note number.
 * A4 = 440 Hz = MIDI 69
 */
export function hzToMidi(hz: number): number {
	return A4_MIDI + 12 * Math.log2(hz / A4_HZ);
}

/**
 * Convert a MIDI note number to frequency in Hz.
 */
export function midiToHz(midi: number): number {
	return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * Convert any PitchSpecification to a (possibly fractional) MIDI note number.
 * All pitch kinds are relative intervals above refMidi.
 */
export function pitchToMidi(pitch: PitchSpecification, refMidi: number): number {
	switch (pitch.kind) {
		case 'semitone':
			return refMidi + pitch.semitones;
		case 'cents':
			return refMidi + pitch.cents / 100;
		case 'mille':
			return refMidi + (pitch.mille / 1000) * 12;
	}
}

/**
 * Resolve the MIDI note to play for a grid note.
 * If the note has a baseMidiOffset (relative mode), playback MIDI = baseMidiOffset + refMidi.
 * Otherwise, use the baked midiNote (absolute mode or legacy notes).
 */
export function resolvePlaybackMidi(note: Note, refMidi: number): number {
	if (note.baseMidiOffset !== undefined) {
		return note.baseMidiOffset + refMidi;
	}
	return note.midiNote;
}
