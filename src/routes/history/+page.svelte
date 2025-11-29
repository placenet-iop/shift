<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { translate, formatDateTime as formatDateTimeStore, locale } from '$lib/i18n';
	import { calculateWeeklySummaries, type WeeklySummary } from '$lib/utils/time';

	// Make translation function reactive
	let t = $derived.by(() => $translate);
	
	// Make formatDateTime reactive
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
	const defaultFromDate = formatInputDate(new Date(now.getFullYear(), now.getMonth(), 1));

	let token = $state('');
	let events = $state<any[]>([]);
	let loading = $state(false);
	let error = $state('');
	let fromDate = $state(defaultFromDate);
	let toDate = $state(defaultToDate);
	let isAdmin = $state(false);
	let users = $state<any[]>([]);
	let selectedUserId = $state('');

	onMount(() => {
		if (browser) {
			token = (window as any).__authToken || '';
			if (!token) {
				window.location.href = '/';
				return;
			}

			// Decode token to check if user is admin
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
				isAdmin = payload.role === 'admin' || payload.domain_tags?.includes('admin') || payload.domain_tags?.includes('shift_admin');
			} catch (e) {
				console.error('Failed to decode token:', e);
			}

			// If admin, load users list
			if (isAdmin) {
				loadUsers();
			}

			loadEvents();
		}
	});

	function clampToToday(value: string): string {
		if (!value) return defaultToDate;
		return value > defaultToDate ? defaultToDate : value;
	}

	function handleFromDateChange(value: string) {
		const nextValue = value || defaultFromDate;
		fromDate = nextValue > toDate ? toDate : nextValue;
	}

	function handleToDateChange(value: string) {
		const nextValue = clampToToday(value || defaultToDate);
		toDate = nextValue;
		if (fromDate > nextValue) {
			fromDate = nextValue;
		}
	}

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

			// Use admin endpoint if admin, otherwise use regular endpoint
			let url = isAdmin ? '/api/admin/events' : '/api/time/events';
			const params = new URLSearchParams();

			if (fromDate) params.append('from', new Date(fromDate).toISOString());
			if (toDate) params.append('to', new Date(toDate + 'T23:59:59').toISOString());
			
			// If admin and a user is selected, filter by that user
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

	function formatDateTimeLocal(isoDate: string): string {
		return formatDateTime(isoDate, {
			weekday: 'short',
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
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

	function getEventColor(type: string): string {
		const colors: Record<string, string> = {
			in: '#16a34a',
			out: '#dc2626',
			pause_start: '#ea580c',
			pause_end: '#2563eb'
		};
		return colors[type] || '#6b7280';
	}

	function groupEventsByDate(evts: any[]): Record<string, any[]> {
		const grouped: Record<string, any[]> = {};
		evts.forEach((event) => {
			const date = event.ts.split('T')[0];
			if (!grouped[date]) grouped[date] = [];
			grouped[date].push(event);
		});
		return grouped;
	}

	let sortedEvents = $derived([...events].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()));
	let groupedEvents = $derived(groupEventsByDate(sortedEvents));
	let sortedDates = $derived(Object.keys(groupedEvents).sort().reverse());
	let weeklySummaries = $derived(calculateWeeklySummaries(events));

	function formatWeekRange(summary: WeeklySummary): string {
		const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
		const start = new Date(summary.weekStart);
		const end = new Date(summary.weekEnd);
		return `${start.toLocaleDateString(localeCode, options)} – ${end.toLocaleDateString(localeCode, options)}`;
	}
</script>

<main>
	<div class="container">
		<header>
			<h1>{t('history.title')}</h1>
			<a href="/" class="back-link">{t('common.backToHome')}</a>
		</header>

		<div class="filters">
			{#if isAdmin}
				<div class="filter-group">
					<label for="worker">{t('admin.filters.user')}</label>
					<select id="worker" bind:value={selectedUserId} onchange={() => loadEvents()}>
						<option value="">{t('admin.filters.allUsers')}</option>
						{#each users as user}
							<option value={user.id}>{user.name} ({user.email})</option>
						{/each}
					</select>
				</div>
			{/if}
			<div class="filter-group">
				<label for="from">{t('history.from')}</label>
				<input
					type="date"
					id="from"
					bind:value={fromDate}
					max={toDate}
					onchange={(event) => handleFromDateChange(event.currentTarget.value)}
				/>
			</div>
			<div class="filter-group">
				<label for="to">{t('history.to')}</label>
				<input
					type="date"
					id="to"
					bind:value={toDate}
					max={defaultToDate}
					onchange={(event) => handleToDateChange(event.currentTarget.value)}
				/>
			</div>
			<button onclick={loadEvents} disabled={loading}>
				{loading ? t('common.loading') : t('buttons.search')}
			</button>
		</div>

		{#if error}
			<div class="alert alert-error">{error}</div>
		{/if}

		{#if loading}
			<div class="loading">{t('history.loadingRecords')}</div>
		{:else if events.length === 0}
			<div class="empty">
				<p>{t('history.noRecords')}</p>
			</div>
		{:else}
			<div class="summary">
				<div class="summary-info">
					<p>{t('history.totalRecords')} <strong>{events.length}</strong></p>
					{#if events.length > 0 && events[0].user_name}
						<p>{t('history.worker')} <strong>{events[0].user_name}</strong></p>
					{/if}
					{#if events.length > 0 && events[0].domain_name}
						<p>{t('history.domain')} <strong>{events[0].domain_name}</strong> ({events[0].domain_id || '-'})</p>
					{/if}
				</div>
			</div>

			{#if weeklySummaries.length > 0}
				<div class="weekly-summary">
					<h3>{t('history.weeklySummary')}</h3>
					<div class="weekly-grid">
						{#each weeklySummaries as summary}
							<div class="weekly-card">
								<div class="week-range">{formatWeekRange(summary)}</div>
								<div class="week-hours">{summary.totalHours.toFixed(2)}h</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="events-list">
				{#each sortedDates as date}
					<div class="date-group">
						<h3 class="date-header">
							{new Date(date).toLocaleDateString($locale === 'es' ? 'es-ES' : 'en-US', {
								weekday: 'long',
								day: 'numeric',
								month: 'long',
								year: 'numeric'
							})}
						</h3>
						<div class="events">
							{#each groupedEvents[date] as event}
								<div class="event-card">
									<div
										class="event-type"
										style="background-color: {getEventColor(event.event_type)}"
									>
										{getEventLabel(event.event_type)}
									</div>
									<div class="event-details">
										<div class="event-time">
											{new Date(event.ts).toLocaleTimeString($locale === 'es' ? 'es-ES' : 'en-US', {
												hour: '2-digit',
												minute: '2-digit',
												second: '2-digit'
											})}
										</div>
										<div class="event-meta">
											{#if event.domain_name}
												<span class="domain-badge">
													<strong>{event.domain_name}</strong>
													{#if event.domain_id}
														<span class="domain-id">({event.domain_id})</span>
													{/if}
												</span>
											{/if}
											<span class="source-badge">{event.source}</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="legal-footer">
			<a href="/privacy" class="legal-link">{t('legal.privacyPolicy')}</a>
			<span class="separator">•</span>
			<a href="/legal" class="legal-link">{t('legal.legalNotice')}</a>
		</div>
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: #f3f4f6;
	}

	main {
		min-height: 100vh;
		padding: 2rem;
	}

	.container {
		max-width: 900px;
		margin: 0 auto;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 2rem;
		color: #111827;
		margin: 0;
	}

	.back-link {
		color: #2563eb;
		text-decoration: none;
		font-weight: 500;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.filters {
		background: white;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		margin-bottom: 2rem;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
	}

	label {
		font-weight: 500;
		color: #374151;
		font-size: 0.875rem;
	}

	input[type='date'],
	select {
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 1rem;
		background: white;
	}

	button {
		padding: 0.5rem 1.5rem;
		border: none;
		border-radius: 6px;
		background: #2563eb;
		color: white;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	button:hover:not(:disabled) {
		background: #1d4ed8;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.alert {
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 2rem;
	}

	.alert-error {
		background: #fee2e2;
		color: #991b1b;
		border: 1px solid #fecaca;
	}

	.loading {
		text-align: center;
		padding: 3rem;
		color: #6b7280;
		font-size: 1.125rem;
	}

	.empty {
		text-align: center;
		padding: 3rem;
		background: white;
		border-radius: 12px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.empty p {
		color: #6b7280;
		font-size: 1.125rem;
		margin: 0;
	}

	.summary {
		background: white;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
	}

	.summary-info {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.summary p {
		margin: 0;
		color: #374151;
		padding: 0.5rem;
		background: #f9fafb;
		border-radius: 6px;
	}

	.weekly-summary {
		background: white;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
	}

	.weekly-summary h3 {
		margin: 0 0 1rem 0;
		color: #111827;
		font-size: 1.1rem;
	}

	.weekly-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1rem;
	}

	.weekly-card {
		background: #f9fafb;
		border-radius: 10px;
		padding: 1rem;
		border-left: 4px solid #667eea;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.week-range {
		font-size: 0.95rem;
		color: #4b5563;
		font-weight: 600;
	}

	.week-hours {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
	}

	.events-list {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.date-group {
		background: white;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.date-header {
		margin: 0 0 1rem 0;
		color: #111827;
		font-size: 1.25rem;
		text-transform: capitalize;
		border-bottom: 2px solid #e5e7eb;
		padding-bottom: 0.5rem;
	}

	.events {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.event-card {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 8px;
		align-items: center;
	}

	.event-type {
		padding: 0.5rem 1rem;
		border-radius: 6px;
		color: white;
		font-weight: 600;
		font-size: 0.875rem;
		min-width: 120px;
		text-align: center;
	}

	.event-details {
		flex: 1;
	}

	.event-time {
		font-size: 1.25rem;
		font-weight: 600;
		color: #111827;
		margin-bottom: 0.25rem;
	}

	.event-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
		color: #6b7280;
		align-items: center;
		flex-wrap: wrap;
	}

	.domain-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.75rem;
		background: #dbeafe;
		color: #1e40af;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.domain-id {
		opacity: 0.7;
		font-weight: normal;
	}

	.source-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background: #f3f4f6;
		color: #4b5563;
		border-radius: 4px;
		font-size: 0.75rem;
		text-transform: uppercase;
		font-weight: 600;
	}

	.legal-footer {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e5e7eb;
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
	}

	.legal-link {
		color: #6b7280;
		text-decoration: none;
		font-weight: 400;
	}

	.legal-link:hover {
		color: #667eea;
		text-decoration: underline;
	}

	.separator {
		color: #d1d5db;
	}

	@media (max-width: 640px) {
		.filters {
			flex-direction: column;
			align-items: stretch;
		}

		.event-card {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
