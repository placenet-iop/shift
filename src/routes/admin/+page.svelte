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
	let users = $state<any[]>([]);
	let events = $state<any[]>([]);
	let selectedUserId = $state('');
	let loading = $state(false);
	let error = $state('');
	let fromDate = $state(defaultFromDate);
	let toDate = $state(defaultToDate);
	let currentTab = $state<'events' | 'users'>('events');
	let eventTypeFilter = $state('');
	let domainFilter = $state('');
	let userTimelineId = $state<number | null>(null);

	onMount(() => {
		if (browser) {
			token = (window as any).__authToken || '';
			if (!token) {
				window.location.href = '/';
				return;
			}

			loadUsers();
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
			const response = await fetch('/api/admin/users', {
				headers: {
					'X-Auth-Token': token
				}
			});

			if (!response.ok) {
				if (response.status === 401) {
					console.error('[Admin] Unauthorized - token may be invalid or user not found');
					error = 'Unauthorized. Please check your authentication token.';
					return;
				}
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			if (data.success) {
				users = data.users;
				// Load stats for each user
				await loadUserStats();
			} else {
				error = data.error || t('messages.failedToLoadUsers');
			}
		} catch (e) {
			console.error('[Admin] Error loading users:', e);
			error = t('common.connectionError');
		}
	}

let userStats = $state<Record<number, any>>({});

	async function loadUserStats() {
		// Get last 1 month stats for each user
		const to = new Date();
		const from = new Date();
		from.setMonth(from.getMonth() - 1);

		for (const user of users) {
			try {
			const response = await fetch(
				`/api/admin/events?from=${from.toISOString()}&to=${to.toISOString()}&user_id=${user.id}`,
				{
					headers: {
						'X-Auth-Token': token
					}
				}
			);
				const data = await response.json();

				if (data.success) {
					const events = data.events;
					const lastEvent = events.length > 0 ? events[0] : null;

					userStats[user.id] = {
						totalEvents: events.length,
						lastEvent: lastEvent?.ts,
						lastEventType: lastEvent?.event_type,
						entriesCount: events.filter((e: any) => e.event_type === 'in').length,
						exitsCount: events.filter((e: any) => e.event_type === 'out').length
					};
				}
			} catch (e) {
				console.error(`Failed to load stats for user ${user.id}:`, e);
			}
		}
		userStats = { ...userStats }; // Trigger reactivity
	}

	async function loadEvents() {
		try {
			loading = true;
			error = '';

			let url = '/api/admin/events';
			const params = new URLSearchParams();

			if (fromDate) params.append('from', new Date(fromDate).toISOString());
			if (toDate) params.append('to', new Date(toDate + 'T23:59:59').toISOString());
			if (selectedUserId) params.append('user_id', selectedUserId);

			if (params.toString()) url += '?' + params.toString();

			const response = await fetch(url, {
				headers: {
					'X-Auth-Token': token
				}
			});

			if (!response.ok) {
				if (response.status === 401) {
					console.error('[Admin] Unauthorized - token may be invalid or user not found');
					error = 'Unauthorized. Please check your authentication token.';
					const errorData = await response.json().catch(() => ({}));
					if (errorData.error) {
						error = errorData.error;
					}
					return;
				}
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			if (data.success) {
				events = data.events;
			} else {
				error = data.error || t('messages.failedToLoadEvents');
				if (error.includes('Admin role required') || error.includes('Unauthorized')) {
					alert(t('messages.noAdminPermissions'));
					window.location.href = '/';
				}
			}
		} catch (e) {
			error = t('common.connectionError');
		} finally {
			loading = false;
		}
	}

	async function exportData(format: 'csv' | 'json') {
		try {
			loading = true;
			error = '';

			let url = `/api/admin/export?format=${format}`;
			const params = new URLSearchParams();

			if (fromDate) params.append('from', new Date(fromDate).toISOString());
			if (toDate) params.append('to', new Date(toDate + 'T23:59:59').toISOString());
			if (selectedUserId) params.append('user_id', selectedUserId);

			if (params.toString()) url += '&' + params.toString();

			const response = await fetch(url, {
				headers: {
					'X-Auth-Token': token
				}
			});

			if (response.ok) {
				const blob = await response.blob();
				const downloadUrl = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = downloadUrl;
				a.download = `shift_records_${Date.now()}.${format}`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				window.URL.revokeObjectURL(downloadUrl);
			} else {
				error = t('messages.exportFailed');
			}
		} catch (e) {
			error = t('messages.exportError');
		} finally {
			loading = false;
		}
	}

	function formatDateTimeLocal(isoDate: string): string {
		return formatDateTime(isoDate, {
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

	function getUserName(userId: number): string {
		const user = users.find((u) => u.id === userId);
		return user ? user.name : `User ${userId}`;
	}

	// Computed: Get unique domains from events
	let uniqueDomains = $derived(Array.from(new Set(events.map(e => e.domain_name).filter(Boolean))));

	// Computed: Filter events by type and domain
	let filteredEvents = $derived(events.filter(event => {
		if (eventTypeFilter && event.event_type !== eventTypeFilter) return false;
		if (domainFilter && event.domain_name !== domainFilter) return false;
		return true;
	}));

	let weeklySummaries = $derived(calculateWeeklySummaries(events));
	let userTimelineEvents = $derived(userTimelineId ? events.filter((event) => event.user_id === userTimelineId) : []);
	let userTimelineSummaries = $derived(calculateWeeklySummaries(userTimelineEvents));
	let selectedTimelineUser = $derived(userTimelineId ? users.find((user) => user.id === userTimelineId) : null);

	function formatWeekRange(summary: WeeklySummary): string {
		const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
		const start = new Date(summary.weekStart);
		const end = new Date(summary.weekEnd);
		return `${start.toLocaleDateString(localeCode, options)} – ${end.toLocaleDateString(localeCode, options)}`;
	}

	function toggleUserTimeline(userId: number) {
		userTimelineId = userTimelineId === userId ? null : userId;
	}
</script>

<main>
	<div class="container">
		<header>
			<div>
				<h1>{t('admin.title')}</h1>
				<p class="subtitle">{t('admin.subtitle')}</p>
			</div>
			<a href="/" class="back-link">{t('common.backToHome')}</a>
		</header>

		<div class="tabs">
			<button
				class="tab"
				class:active={currentTab === 'events'}
				onclick={() => (currentTab = 'events')}
			>
				{t('admin.tabs.timeRecords')}
			</button>
			<button
				class="tab"
				class:active={currentTab === 'users'}
				onclick={() => (currentTab = 'users')}
			>
				{t('admin.tabs.users')}
			</button>
		</div>

		{#if currentTab === 'events'}
			<div class="filters-section">
				<h3 class="filters-title">{t('admin.filters.searchFilters')}</h3>
				<div class="filters">
					<div class="filter-group">
						<label for="user">{t('admin.filters.user')}</label>
						<select id="user" bind:value={selectedUserId}>
							<option value="">{t('admin.filters.allUsers')}</option>
							{#each users as user}
								<option value={user.id}>{user.name} ({user.email})</option>
							{/each}
						</select>
					</div>
					<div class="filter-group">
						<label for="from">{t('admin.filters.from')}</label>
						<input
							type="date"
							id="from"
							bind:value={fromDate}
							max={toDate}
							onchange={(event) => handleFromDateChange(event.currentTarget.value)}
						/>
					</div>
					<div class="filter-group">
						<label for="to">{t('admin.filters.to')}</label>
						<input
							type="date"
							id="to"
							bind:value={toDate}
							max={defaultToDate}
							onchange={(event) => handleToDateChange(event.currentTarget.value)}
						/>
					</div>
					<button onclick={loadEvents} disabled={loading}>{t('buttons.search')}</button>
				</div>

				<h3 class="filters-title">{t('admin.filters.viewFilters')}</h3>
				<div class="filters secondary">
					<div class="filter-group">
						<label for="eventType">{t('admin.filters.eventType')}</label>
						<select id="eventType" bind:value={eventTypeFilter}>
							<option value="">{t('admin.filters.allEvents')}</option>
							<option value="in">{t('events.clockIn')}</option>
							<option value="out">{t('events.clockOut')}</option>
							<option value="pause_start">{t('events.breakStart')}</option>
							<option value="pause_end">{t('events.breakEnd')}</option>
						</select>
					</div>
					<div class="filter-group">
						<label for="domain">{t('admin.filters.domain')}</label>
						<select id="domain" bind:value={domainFilter}>
							<option value="">{t('admin.filters.allDomains')}</option>
							{#each uniqueDomains as domain}
								<option value={domain}>{domain}</option>
							{/each}
						</select>
					</div>
						{#if eventTypeFilter || domainFilter}
							<button class="btn-clear" onclick={() => { eventTypeFilter = ''; domainFilter = ''; }}>
							{t('common.clearFilters')}
						</button>
					{/if}
				</div>

				<div class="export-buttons">
					<button class="btn-export" onclick={() => exportData('csv')} disabled={loading}>
						{t('buttons.exportCSV')}
					</button>
					<button class="btn-export" onclick={() => exportData('json')} disabled={loading}>
						{t('buttons.exportJSON')}
					</button>
				</div>
			</div>

			{#if error}
				<div class="alert alert-error">{error}</div>
			{/if}

			{#if loading}
				<div class="loading">{t('admin.events.loadingRecords')}</div>
			{:else if events.length === 0}
				<div class="empty">
					<p>{t('admin.events.noRecords')}</p>
				</div>
			{:else}
				<div class="summary">
					<div class="summary-grid">
						<div class="summary-card">
							<span class="summary-label">{t('admin.events.totalRecords')}</span>
							<span class="summary-value">{events.length}</span>
						</div>
						<div class="summary-card">
							<span class="summary-label">{t('admin.events.showing')}</span>
							<span class="summary-value">{filteredEvents.length}</span>
						</div>
						<div class="summary-card">
							<span class="summary-label">{t('admin.events.users')}</span>
							<span class="summary-value">{new Set(events.map(e => e.user_id)).size}</span>
						</div>
						<div class="summary-card">
							<span class="summary-label">{t('admin.events.domains')}</span>
							<span class="summary-value">{uniqueDomains.length}</span>
						</div>
					</div>
				</div>

				{#if weeklySummaries.length}
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

				<div class="table-container">
					<table>
						<thead>
							<tr>
								<th>{t('admin.events.tableHeaders.worker')}</th>
								<th>{t('admin.events.tableHeaders.type')}</th>
								<th>{t('admin.events.tableHeaders.dateTime')}</th>
								<th>{t('admin.events.tableHeaders.domainId')}</th>
								<th>{t('admin.events.tableHeaders.domain')}</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredEvents as event}
								<tr>
									<td>{event.user_name || getUserName(event.user_id)}</td>
									<td>
										<span
											class="event-badge"
											style="background-color: {getEventColor(event.event_type)}"
										>
											{getEventLabel(event.event_type)}
										</span>
									</td>
									<td>{formatDateTimeLocal(event.ts)}</td>
									<td>{event.domain_id || '-'}</td>
									<td>{event.domain_name || '-'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{:else}
			<div class="users-section">
				<div class="users-header">
					<h3>{t('admin.users.title')}</h3>
					<div class="users-summary">
						<div class="summary-pill">
							<span class="pill-label">{t('admin.users.total')}</span>
							<span class="pill-value">{users.length}</span>
						</div>
						<div class="summary-pill">
							<span class="pill-label">{t('admin.users.active')}</span>
							<span class="pill-value">{users.filter(u => u.active).length}</span>
						</div>
						<div class="summary-pill">
							<span class="pill-label">{t('admin.users.admins')}</span>
							<span class="pill-value">{users.filter(u => u.role === 'admin').length}</span>
						</div>
					</div>
				</div>

				<div class="users-table-container">
					<table class="users-table">
						<thead>
							<tr>
								<th>{t('admin.users.tableHeaders.user')}</th>
								<th>{t('admin.users.tableHeaders.roleStatus')}</th>
								<th>{t('admin.users.tableHeaders.domain')}</th>
								<th>{t('admin.users.tableHeaders.activity')}</th>
								<th>{t('admin.users.tableHeaders.lastRecord')}</th>
								<th>{t('admin.users.tableHeaders.registered')}</th>
							</tr>
						</thead>
						<tbody>
							{#each users as user}
								<tr
									class:inactive={!user.active}
									class:timeline-active={userTimelineId === user.id}
									onclick={() => toggleUserTimeline(user.id)}
								>
									<td>
										<div class="user-cell">
											<div class="user-avatar-small">
												{user.name.charAt(0).toUpperCase()}
											</div>
											<div class="user-info-cell">
												<div class="user-name-cell">{user.name}</div>
												<div class="user-email-cell">{user.email}</div>
											</div>
										</div>
									</td>
									<td>
										<div class="badges-cell">
											<span class="role-badge" class:admin={user.role === 'admin'}>
												{user.role === 'admin' ? t('admin.users.roles.admin') : t('admin.users.roles.worker')}
											</span>
											<span class="status-badge" class:active={user.active}>
												{user.active ? t('admin.users.status.active') : t('admin.users.status.inactive')}
											</span>
										</div>
									</td>
									<td>
										{#if user.domain_name}
											<div class="domain-cell">
												<div class="domain-name-cell">{user.domain_name}</div>
												<div class="domain-id-cell">{user.domain_id || '-'}</div>
											</div>
										{:else}
											<span class="text-muted">-</span>
										{/if}
									</td>
									<td>
										{#if userStats[user.id]}
											<div class="stats-cell">
												<div class="stat-item">
													<span class="stat-label">{t('admin.users.stats.total')}</span>
													<span class="stat-value">{userStats[user.id].totalEvents}</span>
												</div>
												<div class="stat-item">
													<span class="stat-label">{t('admin.users.stats.clockIns')}</span>
													<span class="stat-value">{userStats[user.id].entriesCount}</span>
												</div>
												<div class="stat-item">
													<span class="stat-label">{t('admin.users.stats.clockOuts')}</span>
													<span class="stat-value">{userStats[user.id].exitsCount}</span>
												</div>
											</div>
										{:else}
											<span class="text-muted">{t('admin.users.loading')}</span>
										{/if}
									</td>
									<td>
										{#if userStats[user.id]?.lastEvent}
											<div class="last-event-cell">
												<div class="last-event-time">
													{formatDateTimeLocal(userStats[user.id].lastEvent)}
												</div>
												<span class="event-type-small" style="background-color: {getEventColor(userStats[user.id].lastEventType)}">
													{getEventLabel(userStats[user.id].lastEventType)}
												</span>
											</div>
										{:else}
											<span class="text-muted">{t('admin.users.noRecords')}</span>
										{/if}
									</td>
									<td>
										<div class="date-cell">
											{new Date(user.created_at).toLocaleDateString($locale === 'es' ? 'es-ES' : 'en-US')}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if userTimelineId}
					<div class="timeline-panel">
						<div class="timeline-header">
							<div>
								<h3>{selectedTimelineUser?.name || t('admin.users.title')}</h3>
								{#if selectedTimelineUser?.email}
									<p class="timeline-subtitle">{selectedTimelineUser.email}</p>
								{/if}
							</div>
							<button class="btn-clear-timeline" onclick={() => (userTimelineId = null)}>
								{t('common.close')}
							</button>
						</div>

						{#if userTimelineEvents.length === 0}
							<p class="timeline-empty">{t('history.noRecords')}</p>
						{:else}
							{#if userTimelineSummaries.length}
								<div class="weekly-summary compact">
									<h4>{t('history.weeklySummary')}</h4>
									<div class="weekly-grid">
										{#each userTimelineSummaries as summary}
											<div class="weekly-card">
												<div class="week-range">{formatWeekRange(summary)}</div>
												<div class="week-hours">{summary.totalHours.toFixed(2)}h</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<div class="timeline-events">
								{#each userTimelineEvents as event}
									<div class="timeline-item">
										<div
											class="timeline-badge"
											style="background-color: {getEventColor(event.event_type)}"
										>
											{getEventLabel(event.event_type)}
										</div>
										<div class="timeline-details">
											<div class="timeline-date">{formatDateTimeLocal(event.ts)}</div>
											<div class="timeline-meta">
												<span>{event.domain_name || '-'}</span>
												<span class="timeline-source">{event.source}</span>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
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
		max-width: 1200px;
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

	.subtitle {
		color: #6b7280;
		margin: 0.25rem 0 0 0;
		font-size: 1rem;
	}

	.back-link {
		color: #2563eb;
		text-decoration: none;
		font-weight: 500;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 2rem;
		border-bottom: 2px solid #e5e7eb;
	}

	.tab {
		padding: 0.75rem 1.5rem;
		background: none;
		border: none;
		border-bottom: 3px solid transparent;
		color: #6b7280;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.tab.active {
		color: #2563eb;
		border-bottom-color: #2563eb;
	}

	.filters-section {
		background: white;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 2rem;
	}

	.filters-title {
		font-size: 1rem;
		color: #111827;
		margin: 0 0 1rem 0;
		font-weight: 600;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid #e5e7eb;
	}

	.filters {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr auto;
		gap: 1rem;
		align-items: flex-end;
		margin-bottom: 1.5rem;
	}

	.filters.secondary {
		grid-template-columns: 1fr 1fr auto;
		background: #f9fafb;
		padding: 1rem;
		border-radius: 8px;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
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

	.export-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.btn-export {
		background: #16a34a;
	}

	.btn-export:hover:not(:disabled) {
		background: #15803d;
	}

	.btn-clear {
		background: #ef4444;
	}

	.btn-clear:hover:not(:disabled) {
		background: #dc2626;
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

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
	}

	.summary-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 8px;
		border-left: 4px solid #2563eb;
	}

	.summary-label {
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 500;
	}

	.summary-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: #111827;
	}

	.weekly-summary {
		background: white;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
	}

	.weekly-summary h3,
	.weekly-summary h4 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
		color: #111827;
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
		gap: 0.4rem;
	}

	.week-range {
		font-size: 0.9rem;
		color: #4b5563;
		font-weight: 600;
	}

	.week-hours {
		font-size: 1.4rem;
		font-weight: 700;
		color: #111827;
	}

	.weekly-summary.compact {
		margin-bottom: 1rem;
	}

	.table-container {
		background: white;
		border-radius: 12px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		background: #f9fafb;
	}

	th {
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		color: #374151;
		border-bottom: 2px solid #e5e7eb;
	}

	td {
		padding: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	tr:last-child td {
		border-bottom: none;
	}

	.event-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		color: white;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.users-section {
		background: white;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.users-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid #e5e7eb;
	}

	.users-header h3 {
		margin: 0;
		color: #111827;
		font-size: 1.25rem;
	}

	.users-summary {
		display: flex;
		gap: 1rem;
	}

	.summary-pill {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: #f9fafb;
		border-radius: 6px;
		border: 1px solid #e5e7eb;
	}

	.pill-label {
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 500;
	}

	.pill-value {
		font-size: 1.125rem;
		font-weight: 700;
		color: #2563eb;
	}

	.users-table-container {
		overflow-x: auto;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.users-table {
		width: 100%;
		border-collapse: collapse;
	}

	.users-table thead {
		background: #f9fafb;
	}

	.users-table th {
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		color: #374151;
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 2px solid #e5e7eb;
	}

	.users-table tbody tr {
		border-bottom: 1px solid #e5e7eb;
		transition: background 0.2s;
		cursor: pointer;
	}

	.users-table tbody tr:hover {
		background: #f9fafb;
	}

	.users-table tbody tr.inactive {
		opacity: 0.6;
	}

	.users-table tbody tr.timeline-active {
		border-left: 4px solid #667eea;
		background: #eef2ff;
	}

	.users-table td {
		padding: 1rem;
	}

	.user-cell {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.user-avatar-small {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1rem;
		flex-shrink: 0;
	}

	.user-info-cell {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.user-name-cell {
		font-weight: 600;
		color: #111827;
	}

	.user-email-cell {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.badges-cell {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.role-badge,
	.status-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		text-align: center;
		text-transform: uppercase;
	}

	.role-badge {
		background: #dbeafe;
		color: #1e40af;
	}

	.role-badge.admin {
		background: #fef3c7;
		color: #92400e;
	}

	.status-badge {
		background: #f3f4f6;
		color: #6b7280;
	}

	.status-badge.active {
		background: #d1fae5;
		color: #065f46;
	}

	.domain-cell {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.domain-name-cell {
		font-weight: 600;
		color: #111827;
		font-size: 0.875rem;
	}

	.domain-id-cell {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.stats-cell {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-item {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.stat-label {
		color: #6b7280;
	}

	.stat-value {
		font-weight: 600;
		color: #111827;
	}

	.last-event-cell {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.last-event-time {
		font-size: 0.875rem;
		color: #111827;
		font-weight: 500;
	}

	.event-type-small {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		color: white;
		font-size: 0.75rem;
		font-weight: 600;
		text-align: center;
	}

	.date-cell {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.timeline-panel {
		margin-top: 1.5rem;
		background: white;
		border-radius: 12px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		padding: 1.5rem;
	}

	.timeline-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.timeline-header h3 {
		margin: 0;
		font-size: 1.25rem;
		color: #111827;
	}

	.timeline-subtitle {
		margin: 0.25rem 0 0 0;
		color: #6b7280;
		font-size: 0.9rem;
	}

	.btn-clear-timeline {
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 6px;
		padding: 0.4rem 0.75rem;
		cursor: pointer;
		font-weight: 600;
	}

	.btn-clear-timeline:hover {
		background: #dc2626;
	}

	.timeline-empty {
		margin: 1rem 0 0 0;
		color: #6b7280;
	}

	.timeline-events {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.timeline-item {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 10px;
	}

	.timeline-badge {
		min-width: 130px;
		text-align: center;
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		color: white;
		font-weight: 600;
		font-size: 0.85rem;
	}

	.timeline-details {
		flex: 1;
	}

	.timeline-date {
		font-weight: 600;
		color: #111827;
		margin-bottom: 0.25rem;
	}

	.timeline-meta {
		display: flex;
		gap: 1rem;
		color: #6b7280;
		font-size: 0.85rem;
		flex-wrap: wrap;
	}

	.timeline-source {
		text-transform: uppercase;
		font-weight: 600;
		font-size: 0.75rem;
	}

	.text-muted {
		color: #9ca3af;
		font-size: 0.875rem;
		font-style: italic;
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

	@media (max-width: 768px) {
		.filters {
			grid-template-columns: 1fr;
		}

		.table-container {
			overflow-x: auto;
		}

		table {
			min-width: 600px;
		}

		.users-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.users-summary {
			flex-wrap: wrap;
			width: 100%;
		}

		.summary-pill {
			flex: 1;
			min-width: 100px;
		}

		.users-table-container {
			overflow-x: auto;
		}

		.users-table {
			min-width: 900px;
		}
	}
</style>
