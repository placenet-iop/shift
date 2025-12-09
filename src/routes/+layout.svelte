<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import LanguageSelector from '$lib/components/LanguageSelector.svelte';

	let { children } = $props();

	function handleMessage(event: MessageEvent) {
		if (event.data.type === 'auth') {
			window.__authToken = event.data.token;
			
			// Dispatch custom event so page component knows token is ready
			window.dispatchEvent(new CustomEvent('tokenReady'));
			
			if (event.data.goto) {
				goto(event.data.goto);
			}
		}
		if (event.data.type === 'goto') {
			goto(event.data.path);
		}
	}

	onMount(() => {
		// Fetch override for automatic token injection
		const originalFetch = window.fetch;
		window.fetch = function (input: RequestInfo | URL, init: RequestInit = {}) {
			if (window.__authToken) {
				const url = typeof input === 'string' ? input : (input as Request).url;
				if (new URL(url, window.location.origin).origin === window.location.origin) {
					const headers = new Headers(init.headers);
					headers.set('x-auth-token', window.__authToken);
					init = { ...init, headers };
				}
			}
			return originalFetch(input, init);
		};

		// Check for token in URL
		const urlToken = new URLSearchParams(window.location.search).get('token');
		if (urlToken) {
			window.__authToken = urlToken;
			window.history.replaceState({}, '', window.location.pathname);
			// Dispatch event so page knows token is ready
			window.dispatchEvent(new CustomEvent('tokenReady'));
		} else {
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
