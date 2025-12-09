<script lang="ts">
	import { browser } from '$app/environment';
	import { translate, formatDateTime as formatDateTimeStore, locale } from '$lib/i18n';

	let t = $derived.by(() => $translate);
	let formatDateTime = $derived.by(() => $formatDateTimeStore);
	const localeCode = $derived.by(() => ($locale === 'es' ? 'es-ES' : 'en-US'));

	interface Props {
		show: boolean;
		onClose: () => void;
	}

	let { show = $bindable(), onClose }: Props = $props();

	function handleClose() {
		show = false;
		if (onClose) {
			onClose();
		}
	}

	function formatInputDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	const now = new Date();
	let selectedDate = $state(now);
	let currentMonth = $state(now.getMonth());
	let currentYear = $state(now.getFullYear());

	let token = $state('');
	let events = $state<any[]>([]);
	let loading = $state(false);
	let error = $state('');
	let isAdmin = $state(false);
	let users = $state<any[]>([]);
	let selectedUserId = $state('');
	let showUserFilter = $state(false);

	interface DailyStats {
		totalWorked: number;
		totalBreak: number;
	}

	let dailyStats = $derived.by(() => {
		if (events.length === 0) return null;

		const stats: DailyStats = {
			totalWorked: 0,
			totalBreak: 0
		};

		let lastIn: string | null = null;
		let lastPauseStart: string | null = null;

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
				lastIn = null;
			} else if (event.event_type === 'pause_start' && lastIn) {
				const duration =
					(new Date(event.ts).getTime() - new Date(lastIn).getTime()) / (1000 * 60);
				stats.totalWorked += duration;
				lastPauseStart = event.ts;
				lastIn = null;
			} else if (event.event_type === 'pause_end' && lastPauseStart) {
				const duration =
					(new Date(event.ts).getTime() - new Date(lastPauseStart).getTime()) / (1000 * 60);
				stats.totalBreak += duration;
				lastIn = event.ts;
				lastPauseStart = null;
			}
		}

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

	// Calendar functions
	function getDaysInMonth(month: number, year: number): number {
		return new Date(year, month + 1, 0).getDate();
	}

	function getFirstDayOfMonth(month: number, year: number): number {
		return new Date(year, month, 1).getDay();
	}

	function isSameDay(date1: Date, date2: Date): boolean {
		return (
			date1.getFullYear() === date2.getFullYear() &&
			date1.getMonth() === date2.getMonth() &&
			date1.getDate() === date2.getDate()
		);
	}

	function isToday(date: Date): boolean {
		return isSameDay(date, now);
	}

	function selectDate(day: number) {
		selectedDate = new Date(currentYear, currentMonth, day);
		loadEvents();
	}

	function previousMonth() {
		if (currentMonth === 0) {
			currentMonth = 11;
			currentYear--;
		} else {
			currentMonth--;
		}
	}

	function nextMonth() {
		if (currentMonth === 11) {
			currentMonth = 0;
			currentYear++;
		} else {
			currentMonth++;
		}
	}

	function goToToday() {
		currentMonth = now.getMonth();
		currentYear = now.getFullYear();
		selectedDate = now;
		loadEvents();
	}

	const monthNames = $derived(t('history.months'));
	const dayNames = $derived(t('history.days'));

	$effect(() => {
		if (show && browser) {
			token = (window as any).__authToken || '';
			if (token) {
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

					if (isAdmin) {
						loadUsers();
					}
				} catch (e) {
					console.error('Failed to decode token:', e);
				}
				loadEvents();
			}
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

			// Load events for the selected day
			const startOfDay = new Date(selectedDate);
			startOfDay.setHours(0, 0, 0, 0);
			const endOfDay = new Date(selectedDate);
			endOfDay.setHours(23, 59, 59, 999);

			params.append('from', startOfDay.toISOString());
			params.append('to', endOfDay.toISOString());

			if (isAdmin && selectedUserId) {
				params.append('user_id', selectedUserId);
			}

			if (params.toString()) url += '?' + params.toString();

			const response = await fetch(url);
			const data = await response.json();

			if (data.success) {
				events = data.events;
			} else {
				error = data.error || 'Error al cargar registros';
			}
		} catch (e) {
			error = 'Error de conexión';
		} finally {
			loading = false;
		}
	}

	function getEventIcon(type: string): string {
		const icons: Record<string, string> = {
			in: 'clock-in',
			out: 'clock-out',
			pause_start: 'pause',
			pause_end: 'play'
		};
		return icons[type] || 'circle';
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
</script>

{#if show}
	<div class="modal-overlay" onclick={handleClose}>
		<div class="modal-container" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>{t('history.modalTitle')}</h2>
				<button class="close-btn" onclick={handleClose}>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path
							d="M15 5L5 15M5 5L15 15"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg>
				</button>
			</div>

			<div class="modal-body">
				<div class="content-grid">
					<!-- Calendar Section -->
					<div class="calendar-section">
						<div class="calendar-header">
							<button class="month-nav" onclick={previousMonth}>
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<path
										d="M10 12L6 8L10 4"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</button>
							<div class="month-year">
								<span class="month-name">{monthNames[currentMonth]}</span>
								<span class="year-name">{currentYear}</span>
							</div>
							<button class="month-nav" onclick={nextMonth}>
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<path
										d="M6 4L10 8L6 12"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</button>
						</div>

						<button class="today-btn" onclick={goToToday}>{t('history.today')}</button>

						<div class="calendar-grid">
							{#each dayNames as day}
								<div class="day-name">{day}</div>
							{/each}

							{#each Array(getFirstDayOfMonth(currentMonth, currentYear)) as _}
								<div class="calendar-day empty"></div>
							{/each}

							{#each Array(getDaysInMonth(currentMonth, currentYear)) as _, i}
								{@const day = i + 1}
								{@const date = new Date(currentYear, currentMonth, day)}
								{@const selected = isSameDay(date, selectedDate)}
								{@const today = isToday(date)}
								<button
									class="calendar-day"
									class:selected
									class:today
									onclick={() => selectDate(day)}
								>
									{day}
								</button>
							{/each}
						</div>

						{#if isAdmin}
							<div class="user-filter-section">
								<button class="user-filter-btn" onclick={() => (showUserFilter = !showUserFilter)}>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
										<path
											d="M13 14V12.6667C13 11.9594 12.719 11.2811 12.219 10.781C11.7189 10.281 11.0406 10 10.3333 10H5.66667C4.95942 10 4.28115 10.281 3.78105 10.781C3.28095 11.2811 3 11.9594 3 12.6667V14"
											stroke="currentColor"
											stroke-width="1.5"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
										<path
											d="M8 7.33333C9.47276 7.33333 10.6667 6.13943 10.6667 4.66667C10.6667 3.19391 9.47276 2 8 2C6.52724 2 5.33333 3.19391 5.33333 4.66667C5.33333 6.13943 6.52724 7.33333 8 7.33333Z"
											stroke="currentColor"
											stroke-width="1.5"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
									Filtrar por usuario
								</button>

								{#if showUserFilter}
									<select bind:value={selectedUserId} onchange={() => loadEvents()}>
										<option value="">Todos los usuarios</option>
										{#each users as user}
											<option value={user.id}>{user.name}</option>
										{/each}
									</select>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Events Section -->
					<div class="events-section">
						<div class="selected-date">
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
								<path
									d="M15.8333 3.33334H4.16667C3.24619 3.33334 2.5 4.07953 2.5 5.00001V16.6667C2.5 17.5872 3.24619 18.3333 4.16667 18.3333H15.8333C16.7538 18.3333 17.5 17.5872 17.5 16.6667V5.00001C17.5 4.07953 16.7538 3.33334 15.8333 3.33334Z"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<path
									d="M13.3333 1.66666V5"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<path
									d="M6.66667 1.66666V5"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<path
									d="M2.5 8.33334H17.5"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
							<span
								>{selectedDate.toLocaleDateString(localeCode, {
									weekday: 'long',
									year: 'numeric',
									month: 'long',
									day: 'numeric'
								})}</span
							>
						</div>

						{#if error}
							<div class="alert alert-error">
								<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
									<path
										d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
										stroke="currentColor"
										stroke-width="1.5"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<path
										d="M10 6V10"
										stroke="currentColor"
										stroke-width="1.5"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<path
										d="M10 14H10.01"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
								{error}
							</div>
						{/if}

						{#if loading}
							<div class="loading-state">
								<div class="spinner"></div>
								<p>{t('history.loadingRecords')}</p>
							</div>
						{:else if events.length === 0}
							<div class="empty-state">
								<svg width="48" height="48" viewBox="0 0 48 48" fill="none">
									<path
										d="M38 8H10C8.89543 8 8 8.89543 8 10V38C8 39.1046 8.89543 40 10 40H38C39.1046 40 40 39.1046 40 38V10C40 8.89543 39.1046 8 38 8Z"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<path
										d="M32 4V12"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<path
										d="M16 4V12"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<path
										d="M8 20H40"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
								<p>{t('history.noRecordsForDate')}</p>
							</div>
						{:else}
							<!-- Summary -->
							{#if dailyStats}
								<div class="stats-summary">
									<div class="stat-card">
										<div class="stat-icon work">
											<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
												<path
													d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
													stroke="currentColor"
													stroke-width="1.5"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
												<path
													d="M10 5V10L13 12"
													stroke="currentColor"
													stroke-width="1.5"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
											</svg>
										</div>
										<div class="stat-info">
											<div class="stat-label">{t('history.timeWorked')}</div>
											<div class="stat-value">{formatMinutes(dailyStats.totalWorked)}</div>
										</div>
									</div>

									<div class="stat-card">
										<div class="stat-icon break">
											<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
												<path
													d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10C4 6.68629 6.68629 4 10 4"
													stroke="currentColor"
													stroke-width="1.5"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
												<path
													d="M10 4V10H16"
													stroke="currentColor"
													stroke-width="1.5"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
											</svg>
										</div>
										<div class="stat-info">
											<div class="stat-label">{t('history.breakTime')}</div>
											<div class="stat-value">{formatMinutes(dailyStats.totalBreak)}</div>
										</div>
									</div>
								</div>
							{/if}

							<!-- Events Timeline -->
							<div class="timeline">
								{#each [...events].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()) as event, index}
									<div class="timeline-item">
										<div class="timeline-dot" style="background-color: {getEventColor(event.event_type)}">
											{#if event.event_type === 'in'}
												<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
													<path
														d="M6 11C8.76142 11 11 8.76142 11 6C11 3.23858 8.76142 1 6 1C3.23858 1 1 3.23858 1 6C1 8.76142 3.23858 11 6 11Z"
														stroke="white"
														stroke-width="1.5"
													/>
													<path d="M6 3V6L8 7" stroke="white" stroke-width="1.5" stroke-linecap="round" />
												</svg>
											{:else if event.event_type === 'out'}
												<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
													<path
														d="M6 11C8.76142 11 11 8.76142 11 6C11 3.23858 8.76142 1 6 1C3.23858 1 1 3.23858 1 6C1 8.76142 3.23858 11 6 11Z"
														stroke="white"
														stroke-width="1.5"
													/>
													<path d="M4 6H8" stroke="white" stroke-width="1.5" stroke-linecap="round" />
												</svg>
											{:else if event.event_type === 'pause_start'}
												<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
													<path d="M4 2H5V10H4V2Z" fill="white" />
													<path d="M7 2H8V10H7V2Z" fill="white" />
												</svg>
											{:else if event.event_type === 'pause_end'}
												<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
													<path d="M3 2L10 6L3 10V2Z" fill="white" />
												</svg>
											{/if}
										</div>
										<div class="timeline-content">
											<div class="event-header">
												<span class="event-label">{getEventLabel(event.event_type)}</span>
												<span class="event-time">
													{new Date(event.ts).toLocaleTimeString(localeCode, {
														hour: '2-digit',
														minute: '2-digit',
														second: '2-digit'
													})}
												</span>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 3000;
		animation: fadeIn 0.2s ease-out;
		padding: 1rem;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.modal-container {
		background: white;
		border-radius: 16px;
		max-width: 900px;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		animation: slideUp 0.3s ease-out;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #111827;
		font-weight: 600;
	}

	.close-btn {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: #6b7280;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: #f3f4f6;
		color: #111827;
	}

	.modal-body {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem 2rem;
	}

	.content-grid {
		display: grid;
		grid-template-columns: 320px 1fr;
		gap: 2rem;
	}

	/* Calendar Section */
	.calendar-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.calendar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.month-nav {
		width: 32px;
		height: 32px;
		border-radius: 6px;
		border: none;
		background: #f9fafb;
		color: #374151;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.month-nav:hover {
		background: #f3f4f6;
	}

	.month-year {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
	}

	.month-name {
		font-size: 0.95rem;
		font-weight: 600;
		color: #111827;
	}

	.year-name {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.today-btn {
		padding: 0.5rem 1rem;
		background: var(--color-primary, #635fe5);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.today-btn:hover {
		filter: brightness(0.95);
	}

	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 0.25rem;
	}

	.day-name {
		text-align: center;
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		padding: 0.5rem 0;
	}

	.calendar-day {
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: #374151;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
		font-weight: 500;
	}

	.calendar-day:not(.empty):hover {
		background: #f3f4f6;
	}

	.calendar-day.today {
		background: #e0e7ff;
		color: #4338ca;
		font-weight: 600;
	}

	.calendar-day.selected {
		background: var(--color-primary, #635fe5);
		color: white;
		font-weight: 600;
	}

	.calendar-day.empty {
		cursor: default;
	}

	.user-filter-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-top: 1rem;
		border-top: 1px solid #e5e7eb;
	}

	.user-filter-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		color: #374151;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.user-filter-btn:hover {
		background: #f3f4f6;
	}

	.user-filter-section select {
		padding: 0.625rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		background: white;
		color: #374151;
	}

	/* Events Section */
	.events-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.selected-date {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		background: #f9fafb;
		border-radius: 8px;
		color: #374151;
		font-size: 0.95rem;
		font-weight: 500;
	}

	.selected-date svg {
		color: #6b7280;
	}

	.stats-summary {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.stat-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
	}

	.stat-icon {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.stat-icon.work {
		background: #dcfce7;
		color: #16a34a;
	}

	.stat-icon.break {
		background: #fef3c7;
		color: #ea580c;
	}

	.stat-info {
		flex: 1;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #6b7280;
		font-weight: 500;
		margin-bottom: 0.25rem;
	}

	.stat-value {
		font-size: 1.125rem;
		font-weight: 700;
		color: #111827;
	}

	/* Timeline */
	.timeline {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		position: relative;
	}

	.timeline-item {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		transition: all 0.2s;
	}

	.timeline-item:hover {
		border-color: #d1d5db;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.timeline-dot {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.timeline-content {
		flex: 1;
		display: flex;
		align-items: center;
	}

	.event-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
	}

	.event-label {
		font-weight: 600;
		color: #111827;
		font-size: 0.9rem;
	}

	.event-time {
		font-size: 0.875rem;
		color: #6b7280;
		font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
		font-weight: 500;
	}

	/* Loading & Empty States */
	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		color: #6b7280;
	}

	.empty-state svg {
		color: #d1d5db;
		margin-bottom: 1rem;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.95rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #e5e7eb;
		border-top-color: var(--color-primary, #635fe5);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-state p {
		margin: 0;
		font-size: 0.95rem;
	}

	.alert {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		border-radius: 8px;
	}

	.alert-error {
		background: #fee2e2;
		color: #991b1b;
		border: 1px solid #fca5a5;
	}

	@media (max-width: 768px) {
		.content-grid {
			grid-template-columns: 1fr;
		}

		.modal-header {
			padding: 1.25rem 1.5rem;
		}

		.modal-body {
			padding: 1.25rem 1.5rem;
		}

		.stats-summary {
			grid-template-columns: 1fr;
		}
	}
</style>
