/** A currently playing audio voice */
export interface AudioVoice {
	/** Unique identifier for this voice */
	id: string;
	/** The oscillator node */
	oscillator: OscillatorNode;
	/** Per-voice gain node */
	gain: GainNode;
}
