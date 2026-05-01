import { AudioEngine } from '$lib/audio/engine.js';
import type { PitchSpecification } from '$lib/types/note.js';

class AudioState {
	engine = new AudioEngine();
	ready: boolean = $state(false);
	playingVoices: Set<string> = $state(new Set());

	async init(): Promise<void> {
		await this.engine.init();
		this.ready = this.engine.ready;
	}

	async ensureReady(): Promise<void> {
		if (!this.ready) {
			await this.init();
		}
		await this.engine.resume();
	}

	playNoteByMidi(midi: number): string | null {
		const voiceId = this.engine.playNoteByMidi(midi);
		if (voiceId) {
			this.playingVoices = new Set([...this.playingVoices, voiceId]);
		}
		return voiceId;
	}

	playNote(pitch: PitchSpecification, refMidi: number): string | null {
		const voiceId = this.engine.playNote(pitch, refMidi);
		if (voiceId) {
			this.playingVoices = new Set([...this.playingVoices, voiceId]);
		}
		return voiceId;
	}

	stopNote(voiceId: string): void {
		this.engine.stopNote(voiceId);
		this.playingVoices = new Set([...this.playingVoices].filter((id) => id !== voiceId));
	}

	stopAll(): void {
		this.engine.stopAll();
		this.playingVoices = new Set();
	}
}

export const audioState = new AudioState();
