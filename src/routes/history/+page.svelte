<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { translate, formatDateTime as formatDateTimeStore, locale } from '$lib/i18n';

	let t = $derived.by(() => $translate);
	let formatDateTime = $derived.by(() => $formatDateTimeStore);
	const localeCode = $derived.by(() => ($locale === 'es' ? 'es-ES' : 'en-US'));

	function formatInputDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	const now = new Date();
	const defaultToDate = formatInputDate(now);
	const defaultFromDate = formatInputDate(now); // Default to today

	let token = $state('');
	let events = $state<any[]>([]);
	let loading = $state(false);
	let error = $state('');
	let fromDate = $state(defaultFromDate);
	let toDate = $state(defaultToDate);
	let showFilters = $state(false);
	let isAdmin = $state(false);
	let users = $state<any[]>([]);
	let selectedUserId = $state('');

	// Calculate daily totals
	interface DailyStats {
		totalWorked: number; // in minutes
		totalBreak: number; // in minutes
		periods: Array<{ start: string; end: string; type: 'work' | 'break' }>;
	}

	let dailyStats = $derived.by(() => {
		if (events.length === 0) return null;

		const stats: DailyStats = {
			totalWorked: 0,
			totalBreak: 0,
			periods: []
		};

		let lastIn: string | null = null;
		let lastPauseStart: string | null = null;

		// Sort events by time
		const sortedEvents = [...events].sort(
			(a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
		);

		for (const event of sortedEvents) {
			if (event.event_type === 'in') {
				lastIn = event.ts;
			} else if (event.event_type === 'out' && lastIn) {
				const duration =
					(new Date(event.ts).getTime() - new Date(lastIn).getTime()) / (1000 * 60);
				stats.totalWorked += duration;
				stats.periods.push({ start: lastIn, end: event.ts, type: 'work' });
				lastIn = null;
			} else if (event.event_type === 'pause_start' && lastIn) {
				const duration =
					(new Date(event.ts).getTime() - new Date(lastIn).getTime()) / (1000 * 60);
				stats.totalWorked += duration;
				stats.periods.push({ start: lastIn, end: event.ts, type: 'work' });
				lastPauseStart = event.ts;
				lastIn = null;
			} else if (event.event_type === 'pause_end' && lastPauseStart) {
				const duration =
					(new Date(event.ts).getTime() - new Date(lastPauseStart).getTime()) / (1000 * 60);
				stats.totalBreak += duration;
				stats.periods.push({ start: lastPauseStart, end: event.ts, type: 'break' });
				lastIn = event.ts;
				lastPauseStart = null;
			}
		}

		// If still clocked in, calculate up to now
		if (lastIn) {
			const duration = (new Date().getTime() - new Date(lastIn).getTime()) / (1000 * 60);
			stats.totalWorked += duration;
		}

		return stats;
	});

	function formatMinutes(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = Math.round(minutes % 60);
		return `${hours}h ${mins}m`;
	}

	onMount(() => {
		if (browser) {
			token = (window as any).__authToken || '';
			if (!token) {
				window.location.href = '/';
				return;
			}

			// Decode token
			try {
				const base64Url = token.split('.')[1];
				const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
				const jsonPayload = decodeURIComponent(
					atob(base64)
						.split('')
						.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
						.join('')
				);
				const payload = JSON.parse(jsonPayload);
				isAdmin =
					payload.role === 'admin' ||
					payload.domain_tags?.includes('admin') ||
					payload.domain_tags?.includes('shift_admin');
			} catch (e) {
				console.error('Failed to decode token:', e);
			}

			if (isAdmin) {
				loadUsers();
			}

			loadEvents();
		}
	});

	async function loadUsers() {
		try {
			const response = await fetch('/api/admin/users');
			const data = await response.json();
			if (data.success) {
				users = data.users;
			}
		} catch (e) {
			console.error('Failed to load users:', e);
		}
	}

	async function loadEvents() {
		try {
			loading = true;
			error = '';

			let url = isAdmin ? '/api/admin/events' : '/api/time/events';
			const params = new URLSearchParams();

			if (fromDate) params.append('from', new Date(fromDate).toISOString());
			if (toDate) params.append('to', new Date(toDate + 'T23:59:59').toISOString());

			if (isAdmin && selectedUserId) {
				params.append('user_id', selectedUserId);
			}

			if (params.toString()) url += '?' + params.toString();

			const response = await fetch(url);
			const data = await response.json();

			if (data.success) {
				events = data.events;
			} else {
				error = data.error || t('messages.failedToLoadEvents');
			}
		} catch (e) {
			error = t('common.connectionError');
		} finally {
			loading = false;
		}
	}

	function getEventIcon(type: string): string {
		const icons: Record<string, string> = {
			in: '🟢',
			out: '🔴',
			pause_start: '⏸️',
			pause_end: '▶️'
		};
		return icons[type] || '⚪';
	}

	function getEventLabel(type: string): string {
		const labels: Record<string, string> = {
			in: t('events.clockIn'),
			out: t('events.clockOut'),
			pause_start: t('events.breakStart'),
			pause_end: t('events.breakEnd')
		};
		return labels[type] || type;
	}
</script>

<main>
	<div class="container">
		<header>
			<h1>📊 {t('history.title')}</h1>
			<a href="/" class="back-link">← {t('common.backToHome')}</a>
		</header>

		<!-- Filter Toggle Button -->
		<div class="filter-toggle-container">
			<button class="filter-toggle-btn" onclick={() => (showFilters = !showFilters)}>
				<span>🔍 Filtros</span>
				<span class="toggle-icon">{showFilters ? '▼' : '▶'}</span>
			</button>
		</div>

		<!-- Collapsible Filters -->
		{#if showFilters}
			<div class="filters-panel">
				{#if isAdmin}
					<div class="filter-group">
						<label for="worker">{t('admin.filters.user')}</label>
						<select id="worker" bind:value={selectedUserId} onchange={() => loadEvents()}>
							<option value="">{t('admin.filters.allUsers')}</option>
							{#each users as user}
								<option value={user.id}>{user.name} ({user.avatarId})</option>
							{/each}
						</select>
					</div>
				{/if}
				<div class="filter-group">
					<label for="from">{t('history.from')}</label>
					<input type="date" id="from" bind:value={fromDate} max={toDate} />
				</div>
				<div class="filter-group">
					<label for="to">{t('history.to')}</label>
					<input type="date" id="to" bind:value={toDate} max={formatInputDate(now)} />
				</div>
				<button class="btn-apply" onclick={loadEvents} disabled={loading}>
					{loading ? t('common.loading') : 'Aplicar Filtros'}
				</button>
			</div>
		{/if}

		{#if error}
			<div class="alert alert-error">{error}</div>
		{/if}

		{#if loading}
			<div class="loading">{t('history.loadingRecords')}</div>
		{:else if events.length === 0}
			<div class="empty">
				<p>📭 {t('history.noRecords')}</p>
			</div>
		{:else}
			<!-- Daily Summary Card -->
			{#if dailyStats}
				<div class="summary-card">
					<h2>Resumen del Período</h2>
					<div class="stats-grid">
						<div class="stat-item">
							<div class="stat-icon">⏱️</div>
							<div class="stat-content">
								<div class="stat-label">Tiempo Trabajado</div>
								<div class="stat-value">{formatMinutes(dailyStats.totalWorked)}</div>
							</div>
						</div>
						<div class="stat-item">
							<div class="stat-icon">☕</div>
							<div class="stat-content">
								<div class="stat-label">Tiempo Descanso</div>
								<div class="stat-value">{formatMinutes(dailyStats.totalBreak)}</div>
							</div>
						</div>
						<div class="stat-item">
							<div class="stat-icon">📝</div>
							<div class="stat-content">
								<div class="stat-label">Total Registros</div>
								<div class="stat-value">{events.length}</div>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Event List -->
			<div class="events-container">
				<h3>Registros</h3>
				<div class="events-list">
					{#each events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()) as event}
						<div class="event-row">
							<div class="event-icon">{getEventIcon(event.event_type)}</div>
							<div class="event-info">
								<div class="event-label">{getEventLabel(event.event_type)}</div>
								<div class="event-time">
									{new Date(event.ts).toLocaleTimeString(localeCode, {
										hour: '2-digit',
										minute: '2-digit'
									})}
								</div>
							</div>
							<div class="event-date">
								{new Date(event.ts).toLocaleDateString(localeCode, {
									day: 'numeric',
									month: 'short'
								})}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #f9fafb;
	}

	main {
		min-height: 100vh;
		padding: 1.5rem;
	}

	.container {
		max-width: 600px;
		margin: 0 auto;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	h1 {
		font-size: 1.75rem;
		color: #111827;
		margin: 0;
		font-weight: 700;
	}

	.back-link {
		color: #6b7280;
		text-decoration: none;
		font-weight: 500;
		font-size: 0.9rem;
	}

	.back-link:hover {
		color: #111827;
	}

	/* Filter Toggle */
	.filter-toggle-container {
		margin-bottom: 1rem;
	}

	.filter-toggle-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		font-weight: 600;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s;
	}

	.filter-toggle-btn:hover {
		background: #f9fafb;
		border-color: #d1d5db;
	}

	.toggle-icon {
		font-size: 0.75rem;
		transition: transform 0.2s;
	}

	/* Filters Panel */
	.filters-panel {
		background: white;
		padding: 1.5rem;
		border-radius: 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		margin-bottom: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		animation: slideDown 0.3s ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		font-weight: 600;
		color: #374151;
		font-size: 0.875rem;
	}

	input[type='date'],
	select {
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 1rem;
	}

	.btn-apply {
		padding: 0.75rem;
		background: var(--color-primary, #635FE5);
		color: white;
		border: none;
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-apply:hover:not(:disabled) {
		filter: brightness(0.9);
	}

	.btn-apply:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Summary Card */
	.summary-card {
		background: white;
		padding: 1.5rem;
		border-radius: 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		margin-bottom: 1.5rem;
	}

	.summary-card h2 {
		margin: 0 0 1.25rem 0;
		font-size: 1.1rem;
		color: #111827;
		font-weight: 700;
	}

	.stats-grid {
		display: grid;
		gap: 1rem;
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 12px;
	}

	.stat-icon {
		font-size: 2rem;
	}

	.stat-content {
		flex: 1;
	}

	.stat-label {
		font-size: 0.8rem;
		color: #6b7280;
		font-weight: 500;
		margin-bottom: 0.25rem;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
	}

	/* Events */
	.events-container {
		background: white;
		padding: 1.5rem;
		border-radius: 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.events-container h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #111827;
		font-weight: 700;
	}

	.events-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.event-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.875rem;
		background: #f9fafb;
		border-radius: 10px;
	}

	.event-icon {
		font-size: 1.5rem;
	}

	.event-info {
		flex: 1;
	}

	.event-label {
		font-weight: 600;
		color: #111827;
		font-size: 0.95rem;
	}

	.event-time {
		font-size: 0.875rem;
		color: #6b7280;
		font-family: 'Courier New', monospace;
	}

	.event-date {
		font-size: 0.8rem;
		color: #9ca3af;
		font-weight: 500;
	}

	.alert {
		padding: 1rem;
		border-radius: 12px;
		margin-bottom: 1rem;
	}

	.alert-error {
		background: #fee2e2;
		color: #991b1b;
		border: 1px solid #fca5a5;
	}

	.loading,
	.empty {
		text-align: center;
		padding: 3rem;
		color: #6b7280;
	}

	.empty p {
		font-size: 1.1rem;
		margin: 0;
	}
</style>
