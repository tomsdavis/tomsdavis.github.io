import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: '../solfa',
			assets: '../solfa',
			fallback: 'index.html'
		}),
		paths: {
			base: '/solfa'
		}
	}
};

export default config;
