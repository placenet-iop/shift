<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import LanguageSelector from '$lib/components/LanguageSelector.svelte';

	let { children } = $props();

	// Set token synchronously before render to avoid timing issues
	if (browser) {
		const urlToken = new URLSearchParams(window.location.search).get('token');
		if (urlToken) {
			window.__authToken = urlToken;
		}
	}

	function handleMessage(event: MessageEvent) {
		if (event.data.type === 'auth') {
			window.__authToken = event.data.token;
			if (event.data.goto) {
				goto(event.data.goto);
			}
		}
		if (event.data.type === 'goto') {
			goto(event.data.path);
		}
	}

	onMount(() => {
		if (!browser) return;

		// Fetch override for automatic token injection
		const originalFetch = window.fetch;
		window.fetch = function (input: RequestInfo | URL, init: RequestInit = {}) {
			if (window.__authToken) {
				const url = typeof input === 'string' ? input : (input as Request).url;
				if (new URL(url, window.location.origin).origin === window.location.origin) {
					init.headers = { ...init.headers, 'X-Auth-Token': window.__authToken };
				}
			}
			return originalFetch(input, init);
		};

		// Check for token in URL (in case it wasn't set synchronously)
		const urlToken = new URLSearchParams(window.location.search).get('token');
		if (urlToken && !window.__authToken) {
			window.__authToken = urlToken;
		}

		// Remove token from URL if present (do this after a small delay to avoid navigation issues)
		if (urlToken) {
			setTimeout(() => {
				goto(window.location.pathname, { replaceState: true, noScroll: true });
			}, 10);
		} else if (!window.__authToken) {
			// Only send READY if we don't have a token
			window.parent.postMessage('READY', '*');
		}

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="layout-wrapper">
	<div class="language-selector-wrapper">
		<LanguageSelector />
	</div>
	{@render children()}
</div>

<style>
	.layout-wrapper {
		position: relative;
		min-height: 100vh;
	}

	.language-selector-wrapper {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 1000;
	}

	@media (max-width: 640px) {
		.language-selector-wrapper {
			top: 0.5rem;
			right: 0.5rem;
		}
	}
</style>
