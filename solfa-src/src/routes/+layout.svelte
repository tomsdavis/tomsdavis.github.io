<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { swUpdateState } from '$lib/stores/sw-update-state.svelte';
	import UpdateToast from '$lib/components/UpdateToast.svelte';

	let { children } = $props();

	onMount(() => {
		swUpdateState.init();
	});
</script>

<div class="app-shell">
	{@render children()}
</div>
<UpdateToast />

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
	}
</style>
