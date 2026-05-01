import type { AppMode } from '$lib/types/app.js';

class AppState {
	mode: AppMode = $state('composition');

	toggleMode() {
		this.mode = this.mode === 'composition' ? 'playback' : 'composition';
	}
}

export const appState = new AppState();
