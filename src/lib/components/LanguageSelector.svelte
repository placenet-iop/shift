<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { locale, setLocale, type Locale, translate } from '$lib/i18n';

	let isOpen = $state(false);
	let currentLocale = $derived.by(() => $locale);
	let t = $derived.by(() => $translate);

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function selectLanguage(loc: Locale) {
		setLocale(loc);
		isOpen = false;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.language-selector')) {
			isOpen = false;
		}
	}

	onMount(() => {
		if (browser) {
			document.addEventListener('click', handleClickOutside);
			return () => {
				document.removeEventListener('click', handleClickOutside);
			};
		}
	});

	let languages = $derived([
		{ code: 'en' as Locale, name: t('language.english'), flag: '🇬🇧' },
		{ code: 'es' as Locale, name: t('language.spanish'), flag: '🇪🇸' }
	]);
</script>

<div class="language-selector">
	<button class="language-button" onclick={toggleDropdown} type="button" aria-label={t('language.selectLanguage')}>
		<span class="flag">{currentLocale === 'en' ? '🇬🇧' : '🇪🇸'}</span>
	</button>

	{#if isOpen}
		<div class="dropdown">
			{#each languages as lang}
				<button
					class="dropdown-item"
					class:active={currentLocale === lang.code}
					onclick={() => selectLanguage(lang.code)}
					type="button"
				>
					<span class="flag">{lang.flag}</span>
					<span class="name">{lang.name}</span>
					{#if currentLocale === lang.code}
						<span class="check">✓</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.language-selector {
		position: relative;
		display: inline-block;
	}

	.language-button {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: 2px solid #e5e7eb;
		background: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		padding: 0;
	}

	.language-button:hover {
		border-color: #667eea;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
		transform: translateY(-2px);
	}

	.language-button:active {
		transform: translateY(0);
	}

	.flag {
		font-size: 24px;
		line-height: 1;
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		background: white;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 180px;
		overflow: hidden;
		z-index: 1000;
		border: 1px solid #e5e7eb;
	}

	.dropdown-item {
		width: 100%;
		padding: 0.75rem 1rem;
		background: white;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		transition: background 0.2s;
		text-align: left;
		font-size: 0.9375rem;
		color: #374151;
	}

	.dropdown-item:hover {
		background: #f9fafb;
	}

	.dropdown-item.active {
		background: #eff6ff;
		color: #1e40af;
		font-weight: 600;
	}

	.dropdown-item .flag {
		font-size: 20px;
		line-height: 1;
	}

	.dropdown-item .name {
		flex: 1;
	}

	.dropdown-item .check {
		color: #2563eb;
		font-weight: 700;
		font-size: 1rem;
	}

	.dropdown-item:not(:last-child) {
		border-bottom: 1px solid #e5e7eb;
	}
</style>

