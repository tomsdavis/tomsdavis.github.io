import type { AudioVoice } from '$lib/types/audio.js';
import { midiToHz } from './pitch.js';

let voiceCounter = 0;

/**
 * Create a new synthesised voice at a given MIDI pitch.
 * Uses a PeriodicWave (organ-like harmonics) with a short attack envelope.
 */
export function createVoice(
	ctx: AudioContext,
	midiNote: number,
	masterGain: GainNode,
	wave: PeriodicWave
): AudioVoice {
	const oscillator = ctx.createOscillator();
	oscillator.setPeriodicWave(wave);
	oscillator.frequency.value = midiToHz(midiNote);

	const gain = ctx.createGain();
	gain.gain.value = 0; // immediate — avoids full-volume pop before scheduled automation takes effect
	const now = ctx.currentTime;
	gain.gain.setValueAtTime(0, now);
	gain.gain.linearRampToValueAtTime(1.0, now + 0.01); // 10ms attack

	oscillator.connect(gain);
	gain.connect(masterGain);
	oscillator.start();

	return {
		id: `voice-${++voiceCounter}`,
		oscillator,
		gain
	};
}

/**
 * Stop and disconnect a voice with a short release envelope to avoid clicks.
 */
export function stopVoice(voice: AudioVoice): void {
	const now = voice.oscillator.context.currentTime;
	voice.gain.gain.setTargetAtTime(0, now, 0.02); // ~60ms exponential decay
	try {
		voice.oscillator.stop(now + 0.1);
	} catch {
		// Already stopped
	}
	voice.oscillator.onended = () => {
		voice.oscillator.disconnect();
		voice.gain.disconnect();
	};
}
