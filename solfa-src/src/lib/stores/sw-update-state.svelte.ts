class SwUpdateState {
	updateAvailable: boolean = $state(false);
	private initialised = false;

	init() {
		if (this.initialised) return;
		this.initialised = true;

		if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
		if (import.meta.env.DEV) return;

		let reloading = false;
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (reloading) return;
			reloading = true;
			location.reload();
		});

		navigator.serviceWorker.ready.then((registration) => {
			registration.addEventListener('updatefound', () => {
				const next = registration.installing;
				if (!next) return;
				next.addEventListener('statechange', () => {
					if (next.state === 'installed' && navigator.serviceWorker.controller) {
						this.updateAvailable = true;
					}
				});
			});
		});
	}

	applyUpdate() {
		navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
	}
}

export const swUpdateState = new SwUpdateState();
