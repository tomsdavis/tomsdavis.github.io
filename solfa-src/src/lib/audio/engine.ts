import type { AudioVoice } from '$lib/types/audio.js';
import type { PitchSpecification } from '$lib/types/note.js';
import { pitchToMidi } from './pitch.js';
import { createVoice, stopVoice } from './voice.js';

export class AudioEngine {
	private ctx: AudioContext | null = null;
	private masterGain: GainNode | null = null;
	private wave: PeriodicWave | null = null;
	private voices = new Map<string, AudioVoice>();
	private _ready = false;

	get ready(): boolean {
		return this._ready;
	}

	/**
	 * Initialize the audio context and build the organ waveform.
	 * Must be called from a user gesture handler.
	 */
	async init(): Promise<void> {
		if (this.ctx) return;

		this.ctx = new AudioContext();
		this.masterGain = this.ctx.createGain();
		this.masterGain.gain.value = 0.8;
		this.masterGain.connect(this.ctx.destination);

		// Organ-like additive waveform: fundamental + harmonics at declining amplitudes.
		// Index n = nth harmonic (0 = DC, 1 = fundamental, 2 = octave, …).
		const real = new Float32Array([0, 1, 0.6, 0.3, 0.2, 0.15, 0.08]);
		const imag = new Float32Array(real.length);
		this.wave = this.ctx.createPeriodicWave(real, imag);

		this._ready = true;
	}

	/**
	 * Resume audio context if suspended (required after user gesture on some browsers).
	 */
	async resume(): Promise<void> {
		if (this.ctx?.state === 'suspended') {
			await this.ctx.resume();
		}
	}

	/**
	 * Start playing a note from a MIDI number directly. Returns a voice ID.
	 */
	playNoteByMidi(midi: number): string | null {
		if (!this.ctx || !this.masterGain || !this.wave) return null;

		const voice = createVoice(this.ctx, midi, this.masterGain, this.wave);
		this.voices.set(voice.id, voice);
		return voice.id;
	}

	/**
	 * Start playing a note. Returns a voice ID for stopping later.
	 */
	playNote(pitch: PitchSpecification, refMidi: number): string | null {
		return this.playNoteByMidi(pitchToMidi(pitch, refMidi));
	}

	/**
	 * Stop a playing voice by ID.
	 */
	stopNote(voiceId: string): void {
		const voice = this.voices.get(voiceId);
		if (voice) {
			stopVoice(voice);
			this.voices.delete(voiceId);
		}
	}

	/**
	 * Stop all playing voices.
	 */
	stopAll(): void {
		for (const voice of this.voices.values()) {
			stopVoice(voice);
		}
		this.voices.clear();
	}
}
