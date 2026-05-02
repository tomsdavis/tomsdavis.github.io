import { AudioEngine } from '$lib/audio/engine.js';
import type { PitchSpecification } from '$lib/types/note.js';

class AudioState {
	engine = new AudioEngine();
	ready: boolean = $state(false);
	playingVoices: Set<string> = $state(new Set());

	/**
	 * Synchronous: must be called from a user gesture handler with no
	 * await/.then() between the gesture and this call. On first invocation
	 * it constructs the AudioContext and pumps a silent warmup buffer
	 * through it (the iOS unlock dance); on every invocation it kicks the
	 * context toward 'running' without awaiting, so the next playNote can
	 * fire on the same synchronous tick.
	 */
	ensureReady(): void {
		if (!this.ready) {
			this.engine.init();
			this.engine.warmup();
			this.ready = this.engine.ready;
		}
		this.engine.resumeIfNeeded();
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
