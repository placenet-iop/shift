<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

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

		// Check for token in URL
		const urlToken = new URLSearchParams(window.location.search).get('token');
		if (urlToken) {
			window.__authToken = urlToken;
			window.history.replaceState({}, '', window.location.pathname);
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

{@render children()}
