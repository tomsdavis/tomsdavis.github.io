/** Pitch specified as semitones above the global reference pitch */
export interface SemitonePitch {
	kind: 'semitone';
	/** Semitones above global reference pitch */
	semitones: number;
}

/** Pitch specified as cents above the global reference pitch */
export interface CentsPitch {
	kind: 'cents';
	/** Cents above global reference pitch (100 cents = 1 semitone) */
	cents: number;
}

/** Pitch specified as mille above the global reference pitch */
export interface MillePitch {
	kind: 'mille';
	/** Mille above global reference pitch (1000 mille = 1 octave = 12 semitones) */
	mille: number;
}

/** Discriminated union of all pitch specification types */
export type PitchSpecification = SemitonePitch | CentsPitch | MillePitch;

/** A note placed on the grid */
export interface Note {
	/** Unique identifier */
	id: string;
	/** Pitch specification (relative interval) */
	pitch: PitchSpecification;
	/** Resolved MIDI note number at placement time */
	midiNote: number;
	/** Display label (e.g. "C4", "Do₄") */
	label: string;
	/** CSS colour string */
	color: string;
	/** Relative-mode offset: pitchToMidi(pitch, paletteOctave*12). When set, playback MIDI = baseMidiOffset + refMidi */
	baseMidiOffset?: number;
}
