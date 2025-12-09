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
	let fromDate = $state(''); // Sin filtro inicial - mostrar todos los datos
	let toDate = $state(''); // Sin filtro inicial - mostrar todos los datos
	let currentTab = $state<'users' | 'timeline'>('users');
	let usersViewMode = $state<'summary' | 'daily'>('summary');
	let searchQuery = $state('');
	let sortField = $state<'name' | 'status' | 'lastEvent'>('name');
	let sortDirection = $state<'asc' | 'desc'>('asc');
	let selectedUserForModal = $state<number | null>(null);
	let userModalEvents = $state<any[]>([]);
	let eventTypeFilter = $state('');
	let domainFilter = $state('');
	let userTimelineId = $state<number | null>(null);
	// Modal-specific filters and view
	let modalFromDate = $state('');
	let modalToDate = $state('');
	let modalViewType = $state<'timeline' | 'daily'>('daily');
	let decodedToken = $state<any>(null);
	let showExportMenu = $state(false);
	let showGeneralExportMenu = $state(false);

	onMount(async () => {
		if (browser) {
			console.log('[Admin] onMount started');

			// Wait a bit for the layout to set the token
			await new Promise(resolve => setTimeout(resolve, 100));

			token = (window as any).__authToken || '';
			console.log('[Admin] Token available:', !!token);

			if (!token) {
				console.error('[Admin] No token found, redirecting to home');
				window.location.href = '/';
				return;
			}

			// Load all data initially and wait for completion
			try {
				loading = true;
				console.log('[Admin] Starting to load data...');

				await Promise.all([
					loadUsers(),
					loadEvents(),
					loadUserStatuses()
				]);

				console.log('[Admin] Data loaded:', {
					users: users.length,
					events: events.length,
					statuses: Object.keys(userStatuses).length
				});
			} catch (e) {
				console.error('[Admin] Error loading initial data:', e);
				error = 'Error al cargar datos iniciales';
			} finally {
				loading = false;
			}

			// Auto-refresh user statuses every 5 seconds
			statusRefreshInterval = setInterval(loadUserStatuses, 5000);

			return () => {
				if (statusRefreshInterval) {
					clearInterval(statusRefreshInterval);
				}
			};
		}
	});

	function handleFromDateChange(value: string) {
		if (value && toDate && value > toDate) {
			fromDate = toDate;
		} else {
			fromDate = value || '';
		}
	}

	function handleToDateChange(value: string) {
		if (value && fromDate && value < fromDate) {
			toDate = fromDate;
		} else {
			toDate = value || '';
		}
	}

	async function loadUsers() {
		try {
			const response = await fetch('/api/admin/users');

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
	let userStatuses = $state<Record<number, { status: string; latestEvent: any }>>({});
	let statusRefreshInterval: ReturnType<typeof setInterval> | null = null;

	async function loadUserStats() {
		// Get last 1 month stats for each user
		const to = new Date();
		const from = new Date();
		from.setMonth(from.getMonth() - 1);

		for (const user of users) {
			try {
				const response = await fetch(
					`/api/admin/events?from=${from.toISOString()}&to=${to.toISOString()}&user_id=${user.id}`
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

	async function loadUserStatuses() {
		try {
			const response = await fetch('/api/admin/status');

			if (!response.ok) {
				console.error('[Admin] Failed to load user statuses');
				return;
			}

			const data = await response.json();

			if (data.success) {
				const statusMap: Record<number, { status: string; latestEvent: any }> = {};
				data.statuses.forEach((item: any) => {
					statusMap[item.user_id] = {
						status: item.status,
						latestEvent: item.latest_event
					};
				});
				userStatuses = statusMap;
			}
		} catch (e) {
			console.error('[Admin] Error loading user statuses:', e);
		}
	}

	async function loadEvents() {
		try {
			error = '';

			let url = '/api/admin/events';
			const params = new URLSearchParams();

			if (fromDate) params.append('from', new Date(fromDate).toISOString());
			if (toDate) params.append('to', new Date(toDate + 'T23:59:59').toISOString());
			if (selectedUserId) params.append('user_id', selectedUserId);

			if (params.toString()) url += '?' + params.toString();

			const response = await fetch(url);

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
				console.log(`[Admin] Loaded ${events.length} events`);
			} else {
				error = data.error || t('messages.failedToLoadEvents');
				if (error.includes('Admin role required') || error.includes('Unauthorized')) {
					alert(t('messages.noAdminPermissions'));
					window.location.href = '/';
				}
			}
		} catch (e) {
			console.error('[Admin] Error loading events:', e);
			error = t('common.connectionError');
		}
	}

	async function refreshData() {
		try {
			loading = true;
			await Promise.all([
				loadUsers(),
				loadEvents(),
				loadUserStatuses()
			]);
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

			const response = await fetch(url);

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

	function exportDailyBreakdown(format: 'csv' | 'json') {
		if (userDailyBreakdown.length === 0) {
			error = t('admin.report.noDataToExport');
			return;
		}

		const filename = `desglose_diario_${Date.now()}.${format}`;

		if (format === 'csv') {
			// Create CSV
			const headers = [
				t('admin.users.tableHeaders.user'),
				t('admin.users.tableHeaders.avatarId'),
				t('admin.users.tableHeaders.domain'),
				t('admin.users.tableHeaders.domainId'),
				t('admin.users.tableHeaders.date'),
				t('admin.users.tableHeaders.firstEntry'),
				t('admin.users.tableHeaders.lastExit'),
				t('admin.users.tableHeaders.hoursWorked'),
				t('admin.users.tableHeaders.breakTime') + ' (h)',
				t('admin.users.tableHeaders.total') + ' (h)',
				t('admin.summary.numRecords')
			];

			const rows = userDailyBreakdown.map(record => [
				record.userName,
				record.userAvatarId,
				record.domainName || '',
				record.domainId || '',
				record.date,
				record.firstIn ? new Date(record.firstIn).toLocaleString('es-ES') : '',
				record.lastOut ? new Date(record.lastOut).toLocaleString('es-ES') : '',
				record.hoursWorked.toFixed(2),
				record.breakTime.toFixed(2),
				record.totalTime.toFixed(2),
				record.eventsCount.toString()
			]);

			const csv = [
				headers.join(','),
				...rows.map(row => row.map(cell => `"${cell}"`).join(','))
			].join('\n');

			const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
			const downloadUrl = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = downloadUrl;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(downloadUrl);
		} else if (format === 'json') {
			// Create JSON
			const jsonData = {
				exported_at: new Date().toISOString(),
				date_range: {
					from: fromDate || null,
					to: toDate || null
				},
				records: userDailyBreakdown.map(record => ({
					user_id: record.userId,
					user_name: record.userName,
					userAvatarId: record.userAvatarId,
					domain_name: record.domainName,
					domain_id: record.domainId,
					date: record.date,
					first_in: record.firstIn,
					last_out: record.lastOut,
					hours_worked: record.hoursWorked,
					break_time: record.breakTime,
					total_time: record.totalTime,
					events_count: record.eventsCount
				}))
			};

			const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
			const downloadUrl = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = downloadUrl;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(downloadUrl);
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
	let uniqueDomains = $derived(
		Array.from(new Set(events.map((e) => e.domain_name).filter(Boolean)))
	);

	// Computed: Filter events by type and domain
	let filteredEvents = $derived(
		events.filter((event) => {
			if (eventTypeFilter && event.event_type !== eventTypeFilter) return false;
			if (domainFilter && event.domain_name !== domainFilter) return false;
			return true;
		})
	);

	let weeklySummaries = $derived(calculateWeeklySummaries(events));
	let userTimelineEvents = $derived(
		userTimelineId ? events.filter((event) => event.user_id === userTimelineId) : []
	);
	let userTimelineSummaries = $derived(calculateWeeklySummaries(userTimelineEvents));
	let selectedTimelineUser = $derived(
		userTimelineId ? users.find((user) => user.id === userTimelineId) : null
	);

	function formatWeekRange(summary: WeeklySummary): string {
		const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
		const start = new Date(summary.weekStart);
		const end = new Date(summary.weekEnd);
		return `${start.toLocaleDateString(localeCode, options)} – ${end.toLocaleDateString(localeCode, options)}`;
	}

	function toggleUserTimeline(userId: number) {
		userTimelineId = userTimelineId === userId ? null : userId;
	}

	// Derived: Group users by status
	let usersInProgress = $derived(
		users.filter((u) => userStatuses[u.id]?.status === 'clocked_in')
	);
	let usersOnBreak = $derived(
		users.filter((u) => userStatuses[u.id]?.status === 'on_pause')
	);
	let usersFinished = $derived(
		users.filter((u) => userStatuses[u.id]?.status === 'clocked_out' || !userStatuses[u.id])
	);

	function getStatusLabel(status: string): string {
		const labels: Record<string, string> = {
			clocked_in: t('admin.users.status.inProgress'),
			on_pause: t('admin.users.status.onBreak'),
			clocked_out: t('admin.users.status.finished')
		};
		return labels[status] || t('admin.users.status.noStatus');
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			clocked_in: '#16a34a',
			on_pause: '#ea580c',
			clocked_out: '#6b7280'
		};
		return colors[status] || '#9ca3af';
	}

	function formatElapsedTime(latestEventTs: string): string {
		if (!latestEventTs) return '--:--:--';
		const eventTime = new Date(latestEventTs).getTime();
		const now = Date.now();
		const diff = Math.floor((now - eventTime) / 1000); // seconds
		const hours = Math.floor(diff / 3600);
		const minutes = Math.floor((diff % 3600) / 60);
		const secs = diff % 60;
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	// Calculate working hours for a user in the selected date range
	function calculateTodayHours(userId: number): { worked: number; break: number; total: number } {
		// Use filtered date range if set, otherwise use today
		const startDate = fromDate ? new Date(fromDate) : new Date();
		if (!fromDate) startDate.setHours(0, 0, 0, 0);

		const endDate = toDate ? new Date(toDate + 'T23:59:59') : new Date();
		if (!toDate) endDate.setHours(23, 59, 59, 999);

		const userEvents = events.filter(
			(e) => {
				const eventDate = new Date(e.ts);
				return e.user_id === userId &&
					   eventDate >= startDate &&
					   eventDate <= endDate;
			}
		);

		let workedMs = 0;
		let breakMs = 0;
		let lastInTime: Date | null = null;
		let lastPauseTime: Date | null = null;

		userEvents
			.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
			.forEach((event) => {
				const eventTime = new Date(event.ts);
				if (event.event_type === 'in' || event.event_type === 'pause_end') {
					lastInTime = eventTime;
				} else if (event.event_type === 'out' && lastInTime !== null) {
					workedMs += eventTime.getTime() - lastInTime.getTime();
					lastInTime = null;
				} else if (event.event_type === 'pause_start' && lastInTime !== null) {
					workedMs += eventTime.getTime() - lastInTime.getTime();
					lastPauseTime = eventTime;
					lastInTime = null;
				}
			});

		// If still clocked in, add time until now
		if (lastInTime) {
			const activeTime: Date = lastInTime;
			workedMs += Date.now() - activeTime.getTime();
		}

		return {
			worked: Math.floor(workedMs / 1000 / 60 / 60 * 100) / 100, // hours with 2 decimals
			break: Math.floor(breakMs / 1000 / 60 / 60 * 100) / 100,
			total: Math.floor(workedMs / 1000 / 60 / 60 * 100) / 100
		};
	}

	function getTodayFirstEvent(userId: number) {
		const startDate = fromDate ? new Date(fromDate) : new Date();
		if (!fromDate) startDate.setHours(0, 0, 0, 0);

		const endDate = toDate ? new Date(toDate + 'T23:59:59') : new Date();
		if (!toDate) endDate.setHours(23, 59, 59, 999);

		const userEvents = events.filter(
			(e) => {
				const eventDate = new Date(e.ts);
				return e.user_id === userId &&
					   eventDate >= startDate &&
					   eventDate <= endDate &&
					   e.event_type === 'in';
			}
		).sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

		return userEvents.length > 0 ? userEvents[0] : null;
	}

	function getTodayLastEvent(userId: number) {
		const startDate = fromDate ? new Date(fromDate) : new Date();
		if (!fromDate) startDate.setHours(0, 0, 0, 0);

		const endDate = toDate ? new Date(toDate + 'T23:59:59') : new Date();
		if (!toDate) endDate.setHours(23, 59, 59, 999);

		const userEvents = events.filter(
			(e) => {
				const eventDate = new Date(e.ts);
				return e.user_id === userId &&
					   eventDate >= startDate &&
					   eventDate <= endDate &&
					   e.event_type === 'out';
			}
		).sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

		return userEvents.length > 0 ? userEvents[userEvents.length - 1] : null;
	}

	// Filter and sort users
	let filteredUsers = $derived(() => {
		let filtered = users.filter((user) =>
			user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			user.avatarId.toLowerCase().includes(searchQuery.toLowerCase())
		);

		filtered.sort((a, b) => {
			let aVal: any, bVal: any;

			if (sortField === 'name') {
				aVal = a.name.toLowerCase();
				bVal = b.name.toLowerCase();
			} else if (sortField === 'status') {
				aVal = userStatuses[a.id]?.status || 'clocked_out';
				bVal = userStatuses[b.id]?.status || 'clocked_out';
			} else if (sortField === 'lastEvent') {
				aVal = userStatuses[a.id]?.latestEvent?.ts || '';
				bVal = userStatuses[b.id]?.latestEvent?.ts || '';
			}

			if (sortDirection === 'asc') {
				return aVal > bVal ? 1 : -1;
			} else {
				return aVal < bVal ? 1 : -1;
			}
		});

		return filtered;
	});

	function toggleSort(field: 'name' | 'status' | 'lastEvent') {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	async function openUserModal(userId: number) {
		selectedUserForModal = userId;
		modalFromDate = '';
		modalToDate = '';
		modalViewType = 'daily';

		// Decode JWT to show complete token information
		try {
			if (token) {
				const base64Url = token.split('.')[1];
				const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
				const jsonPayload = decodeURIComponent(
					atob(base64)
						.split('')
						.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
						.join('')
				);
				decodedToken = JSON.parse(jsonPayload);
			}
		} catch (e) {
			console.error('Failed to decode JWT:', e);
			decodedToken = null;
		}

		// Load all events for this user
		try {
			const response = await fetch(`/api/admin/events?user_id=${userId}`);
			const data = await response.json();
			if (data.success) {
				userModalEvents = data.events;
			}
		} catch (e) {
			console.error('Failed to load user events:', e);
		}
	}

	function closeUserModal() {
		selectedUserForModal = null;
		userModalEvents = [];
		modalFromDate = '';
		modalToDate = '';
		decodedToken = null;
	}

	// Filter modal events by date range
	let filteredModalEvents = $derived.by(() => {
		if (!userModalEvents.length) return [];

		let filtered = [...userModalEvents];

		if (modalFromDate) {
			const startDate = new Date(modalFromDate);
			startDate.setHours(0, 0, 0, 0);
			filtered = filtered.filter((e) => new Date(e.ts) >= startDate);
		}

		if (modalToDate) {
			const endDate = new Date(modalToDate);
			endDate.setHours(23, 59, 59, 999);
			filtered = filtered.filter((e) => new Date(e.ts) <= endDate);
		}

		return filtered.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
	});

	// Group events by day and calculate hours
	interface DaySummary {
		date: string;
		dateObj: Date;
		events: any[];
		firstIn: string | null;
		lastOut: string | null;
		hoursWorked: number;
		breakTime: number;
		totalTime: number;
	}

	let dailySummaries = $derived.by((): DaySummary[] => {
		if (!filteredModalEvents.length) return [];

		const dayMap = new Map<string, any[]>();

		// Group events by day
		filteredModalEvents.forEach((event) => {
			const eventDate = new Date(event.ts);
			const dateKey = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD

			if (!dayMap.has(dateKey)) {
				dayMap.set(dateKey, []);
			}
			dayMap.get(dateKey)!.push(event);
		});

		// Calculate hours for each day
		const summaries: DaySummary[] = [];

		dayMap.forEach((dayEvents, dateKey) => {
			const sortedEvents = dayEvents.sort(
				(a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
			);

			let workedMs = 0;
			let breakMs = 0;
			let lastInTime: Date | null = null;
			let lastPauseTime: Date | null = null;
			let firstIn: string | null = null;
			let lastOut: string | null = null;

			sortedEvents.forEach((event) => {
				const eventTime = new Date(event.ts);

				if (event.event_type === 'in') {
					if (!firstIn) firstIn = event.ts;
					lastInTime = eventTime;
				} else if (event.event_type === 'pause_end') {
					if (lastPauseTime) {
						breakMs += eventTime.getTime() - lastPauseTime.getTime();
					}
					lastInTime = eventTime;
					lastPauseTime = null;
				} else if (event.event_type === 'out' && lastInTime !== null) {
					workedMs += eventTime.getTime() - lastInTime.getTime();
					lastOut = event.ts;
					lastInTime = null;
				} else if (event.event_type === 'pause_start' && lastInTime !== null) {
					workedMs += eventTime.getTime() - lastInTime.getTime();
					lastPauseTime = eventTime;
					lastInTime = null;
				}
			});

			// If still clocked in at end of day, count until end of day or now
			if (lastInTime) {
				const endOfDay = new Date(dateKey + 'T23:59:59');
				const now = new Date();
				const endTime = now < endOfDay ? now : endOfDay;
				workedMs += endTime.getTime() - lastInTime.getTime();
			}

			summaries.push({
				date: dateKey,
				dateObj: new Date(dateKey),
				events: sortedEvents,
				firstIn,
				lastOut,
				hoursWorked: Math.floor((workedMs / 1000 / 60 / 60) * 100) / 100,
				breakTime: Math.floor((breakMs / 1000 / 60 / 60) * 100) / 100,
				totalTime: Math.floor((workedMs / 1000 / 60 / 60) * 100) / 100
			});
		});

		return summaries.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
	});

	// Calculate total hours across all days
	let modalTotalHours = $derived.by(() => {
		return dailySummaries.reduce(
			(acc, day) => {
				acc.worked += day.hoursWorked;
				acc.break += day.breakTime;
				acc.total += day.totalTime;
				return acc;
			},
			{ worked: 0, break: 0, total: 0 }
		);
	});

	// Export modal data to CSV
	function exportModalDataCSV() {
		if (!selectedUserForModal) return;

		const modalUser = users.find((u) => u.id === selectedUserForModal);
		if (!modalUser) return;

		// Prepare CSV data
		const csvLines = [];

		// Header with user info
		csvLines.push(`# ${t('admin.report.reportTitle')}`);
		csvLines.push(`# ${t('admin.users.tableHeaders.user')}: ${modalUser.name}`);
		csvLines.push(`# ${t('admin.users.tableHeaders.avatarId')}: ${modalUser.avatarId}`);
		csvLines.push(`# ID: ${modalUser.id}`);
		csvLines.push(`# ${t('admin.users.tableHeaders.domain')}: ${modalUser.domain_name || 'N/A'} (${modalUser.domain_id || 'N/A'})`);
		csvLines.push(`# ${t('admin.report.generationDate')}: ${new Date().toLocaleString(localeCode)}`);

		if (modalFromDate || modalToDate) {
			csvLines.push(
				`# ${t('admin.report.period')}: ${modalFromDate || t('admin.report.start')} a ${modalToDate || t('admin.report.present')}`
			);
		}
		csvLines.push('');

		// Summary section
		csvLines.push(`# ${t('admin.summary.generalSummary')}`);
		csvLines.push(`${t('admin.summary.daysWorked')},${t('admin.summary.totalHours')},${t('admin.summary.breakTime')},${t('admin.summary.totalTime')}`);
		csvLines.push(
			`${dailySummaries.length},${modalTotalHours.worked.toFixed(2)},${modalTotalHours.break.toFixed(2)},${modalTotalHours.total.toFixed(2)}`
		);
		csvLines.push('');

		// Daily breakdown
		csvLines.push(`# ${t('admin.summary.dailyBreakdown').toUpperCase()}`);
		csvLines.push(`${t('admin.users.tableHeaders.date')},${t('admin.users.tableHeaders.day')},${t('admin.users.tableHeaders.firstEntry')},${t('admin.users.tableHeaders.lastExit')},${t('admin.users.tableHeaders.hoursWorked')},${t('admin.users.tableHeaders.breakTime')},${t('admin.users.tableHeaders.total')},${t('admin.summary.numRecords')}`);

		dailySummaries.forEach((day) => {
			const dayName = day.dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
			const formattedDate = day.dateObj.toLocaleDateString('es-ES');
			csvLines.push(
				`${formattedDate},${dayName},${day.firstIn ? new Date(day.firstIn).toLocaleTimeString('es-ES') : 'N/A'},${day.lastOut ? new Date(day.lastOut).toLocaleTimeString('es-ES') : 'N/A'},${day.hoursWorked.toFixed(2)},${day.breakTime.toFixed(2)},${day.totalTime.toFixed(2)},${day.events.length}`
			);
		});

		csvLines.push('');
		csvLines.push(`# ${t('admin.summary.detailedRecords').toUpperCase()}`);
		csvLines.push(`${t('admin.users.tableHeaders.date')},${t('admin.users.tableHeaders.time')},${t('admin.report.eventType')},${t('admin.report.source')},${t('admin.report.ip')},${t('admin.report.userAgent')}`);

		filteredModalEvents.forEach((event) => {
			const eventDate = new Date(event.ts);
			csvLines.push(
				`${eventDate.toLocaleDateString('es-ES')},${eventDate.toLocaleTimeString('es-ES')},${getEventLabel(event.event_type)},${event.source || 'N/A'},"${event.ip || 'N/A'}","${event.user_agent || 'N/A'}"`
			);
		});

		// Create and download file
		const csvContent = csvLines.join('\n');
		const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `registro_${modalUser.name.replace(/\s+/g, '_')}_${Date.now()}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		window.URL.revokeObjectURL(url);
		showExportMenu = false;
	}

	// Export modal data to Excel (XLSX)
	function exportModalDataExcel() {
		if (!selectedUserForModal) return;

		const modalUser = users.find((u) => u.id === selectedUserForModal);
		if (!modalUser) return;

		// Create workbook with multiple sheets
		const workbook = {
			SheetNames: [t('admin.summary.summary'), t('admin.summary.daily'), t('admin.summary.detailedRecords')],
			Sheets: {} as any
		};

		// Sheet 1: Summary
		const summaryData = [
			[t('admin.report.reportTitle').toUpperCase()],
			[''],
			[`${t('admin.users.tableHeaders.user')}:`, modalUser.name],
			[`${t('admin.users.tableHeaders.avatarId')}:`, modalUser.avatarId],
			['ID:', modalUser.id],
			[`${t('admin.users.tableHeaders.domain')}:`, `${modalUser.domain_name || 'N/A'} (${modalUser.domain_id || 'N/A'})`],
			[`${t('admin.report.generationDate')}:`, new Date().toLocaleString(localeCode)],
			[`${t('admin.report.period')}:`, `${modalFromDate || t('admin.report.start')} a ${modalToDate || t('admin.report.present')}`],
			[''],
			[t('admin.summary.generalSummary')],
			[t('admin.summary.daysWorked'), t('admin.summary.totalHours'), t('admin.summary.breakTime'), t('admin.summary.totalTime')],
			[
				dailySummaries.length,
				modalTotalHours.worked.toFixed(2),
				modalTotalHours.break.toFixed(2),
				modalTotalHours.total.toFixed(2)
			]
		];
		workbook.Sheets[t('admin.summary.summary')] = arrayToSheet(summaryData);

		// Sheet 2: Daily breakdown
		const dailyData = [
			[t('admin.users.tableHeaders.date'), t('admin.users.tableHeaders.day'), t('admin.users.tableHeaders.firstEntry'), t('admin.users.tableHeaders.lastExit'), t('admin.users.tableHeaders.hoursWorked'), t('admin.users.tableHeaders.breakTime'), t('admin.users.tableHeaders.total'), t('admin.summary.numRecords')]
		];
		dailySummaries.forEach((day) => {
			const dayName = day.dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
			const formattedDate = day.dateObj.toLocaleDateString('es-ES');
			dailyData.push([
				formattedDate,
				dayName,
				day.firstIn ? new Date(day.firstIn).toLocaleTimeString('es-ES') : 'N/A',
				day.lastOut ? new Date(day.lastOut).toLocaleTimeString('es-ES') : 'N/A',
				day.hoursWorked.toFixed(2),
				day.breakTime.toFixed(2),
				day.totalTime.toFixed(2),
				day.events.length.toString()
			]);
		});
		dailyData.push([
			'TOTAL',
			'',
			'',
			'',
			modalTotalHours.worked.toFixed(2),
			modalTotalHours.break.toFixed(2),
			modalTotalHours.total.toFixed(2),
			filteredModalEvents.length.toString()
		]);
		workbook.Sheets[t('admin.summary.daily')] = arrayToSheet(dailyData);

		// Sheet 3: Detailed records
		const detailedData = [
			[t('admin.users.tableHeaders.date'), t('admin.users.tableHeaders.time'), t('admin.report.eventType'), t('admin.report.source'), t('admin.report.ip'), t('admin.report.userAgent')]
		];
		filteredModalEvents.forEach((event) => {
			const eventDate = new Date(event.ts);
			detailedData.push([
				eventDate.toLocaleDateString('es-ES'),
				eventDate.toLocaleTimeString('es-ES'),
				getEventLabel(event.event_type),
				event.source || 'N/A',
				event.ip || 'N/A',
				event.user_agent || 'N/A'
			]);
		});
		workbook.Sheets['Registros Detallados'] = arrayToSheet(detailedData);

		// Convert to XLSX and download
		const xlsxContent = workbookToXLSX(workbook);
		const blob = new Blob([xlsxContent], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		});
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `registro_${modalUser.name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		window.URL.revokeObjectURL(url);
		showExportMenu = false;
	}

	// Helper function to convert array to sheet structure
	function arrayToSheet(data: any[][]): any {
		const sheet: any = {};
		const range = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };

		for (let R = 0; R < data.length; ++R) {
			for (let C = 0; C < data[R].length; ++C) {
				if (range.s.r > R) range.s.r = R;
				if (range.s.c > C) range.s.c = C;
				if (range.e.r < R) range.e.r = R;
				if (range.e.c < C) range.e.c = C;

				const cell: any = { v: data[R][C] };

				if (cell.v == null) continue;

				const cell_ref = encodeCell({ c: C, r: R });

				if (typeof cell.v === 'number') cell.t = 'n';
				else if (typeof cell.v === 'boolean') cell.t = 'b';
				else cell.t = 's';

				sheet[cell_ref] = cell;
			}
		}
		sheet['!ref'] = encodeRange(range);
		return sheet;
	}

	function encodeCell(cell: { c: number; r: number }): string {
		return String.fromCharCode(65 + cell.c) + (cell.r + 1);
	}

	function encodeRange(range: any): string {
		return encodeCell(range.s) + ':' + encodeCell(range.e);
	}

	// Simplified XLSX writer
	function workbookToXLSX(workbook: any): ArrayBuffer {
		// This is a simplified version - for production use a library like xlsx
		const csv = [];
		for (const sheetName of workbook.SheetNames) {
			csv.push(`Sheet: ${sheetName}`);
			csv.push('');
			const sheet = workbook.Sheets[sheetName];
			// Convert sheet to CSV-like format
			// For now, fallback to CSV export
		}
		// Return as buffer - simplified for now
		return new TextEncoder().encode(csv.join('\n')).buffer;
	}

	// Export modal data to JSON
	function exportModalDataJSON() {
		if (!selectedUserForModal) return;

		const modalUser = users.find((u) => u.id === selectedUserForModal);
		if (!modalUser) return;

		const exportData = {
			metadata: {
				usuario: modalUser.name,
				avatarId: modalUser.avatarId,
				id: modalUser.id,
				domain_name: modalUser.domain_name || null,
				domain_id: modalUser.domain_id || null,
				fecha_generacion: new Date().toISOString(),
				periodo: {
					desde: modalFromDate || null,
					hasta: modalToDate || null
				}
			},
			resumen: {
				dias_trabajados: dailySummaries.length,
				horas_totales: parseFloat(modalTotalHours.total.toFixed(2)),
				horas_trabajadas: parseFloat(modalTotalHours.worked.toFixed(2)),
				tiempo_descanso: parseFloat(modalTotalHours.break.toFixed(2))
			},
			por_dias: dailySummaries.map((day) => ({
				fecha: day.date,
				dia_semana: day.dateObj.toLocaleDateString('es-ES', { weekday: 'long' }),
				primera_entrada: day.firstIn,
				ultima_salida: day.lastOut,
				horas_trabajadas: parseFloat(day.hoursWorked.toFixed(2)),
				tiempo_descanso: parseFloat(day.breakTime.toFixed(2)),
				total: parseFloat(day.totalTime.toFixed(2)),
				num_registros: day.events.length
			})),
			registros_detallados: filteredModalEvents.map((event) => ({
				id: event.id,
				fecha_hora: event.ts,
				tipo_evento: event.event_type,
				origen: event.source,
				ip: event.ip,
				user_agent: event.user_agent
			}))
		};

		const jsonContent = JSON.stringify(exportData, null, 2);
		const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `registro_${modalUser.name.replace(/\s+/g, '_')}_${Date.now()}.json`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		window.URL.revokeObjectURL(url);
		showExportMenu = false;
	}

	// Export general data (all users in current view)
	function exportGeneralData(format: 'csv' | 'json') {
		if (format === 'csv') {
			const csvLines = [];

			// Header
			csvLines.push(`# ${t('admin.report.generalReportTitle')}`);
			csvLines.push(`# ${t('admin.report.generationDate')}: ${new Date().toLocaleString(localeCode)}`);
			if (fromDate || toDate) {
				csvLines.push(`# ${t('admin.report.period')}: ${fromDate || t('admin.report.start')} a ${toDate || t('admin.report.present')}`);
			}
			csvLines.push('');

			// Column headers
			csvLines.push(`${t('admin.users.tableHeaders.user')},${t('admin.users.tableHeaders.domain')},${t('admin.report.userId')},${t('admin.report.domainId')},${t('admin.report.state')},${t('admin.users.tableHeaders.date')},${t('admin.report.entryTime')},${t('admin.report.exitTime')},${t('admin.users.tableHeaders.hoursWorked')},${t('admin.report.breaks')},${t('admin.users.tableHeaders.total')}`);

			// Data for each user
			filteredUsers().forEach((user) => {
				const hours = calculateTodayHours(user.id);
				const firstEvent = getTodayFirstEvent(user.id);
				const lastEvent = getTodayLastEvent(user.id);
				const userStatus = userStatuses[user.id]?.status || 'clocked_out';

				const dateDisplay = fromDate && toDate
					? `${new Date(fromDate).toLocaleDateString('es-ES')} - ${new Date(toDate).toLocaleDateString('es-ES')}`
					: fromDate
						? `Desde ${new Date(fromDate).toLocaleDateString('es-ES')}`
						: toDate
							? `Hasta ${new Date(toDate).toLocaleDateString('es-ES')}`
							: new Date().toLocaleDateString('es-ES');

				csvLines.push(
					`"${user.name}","${user.domain_name || 'N/A'}",${user.id},"${user.domain_id || 'N/A'}",${getStatusLabel(userStatus)},${dateDisplay},${firstEvent ? new Date(firstEvent.ts).toLocaleTimeString('es-ES') : 'N/A'},${lastEvent ? new Date(lastEvent.ts).toLocaleTimeString('es-ES') : 'N/A'},${hours.worked.toFixed(2)},${hours.break.toFixed(2)},${hours.total.toFixed(2)}`
				);
			});

			// Create and download
			const csvContent = csvLines.join('\n');
			const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `informe_general_${Date.now()}.csv`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} else if (format === 'json') {
			const exportData = {
				metadata: {
					fecha_generacion: new Date().toISOString(),
					periodo: {
						desde: fromDate || null,
						hasta: toDate || null
					},
					total_usuarios: filteredUsers().length
				},
				usuarios: filteredUsers().map((user) => {
					const hours = calculateTodayHours(user.id);
					const firstEvent = getTodayFirstEvent(user.id);
					const lastEvent = getTodayLastEvent(user.id);
					const userStatus = userStatuses[user.id]?.status || 'clocked_out';

					return {
						id: user.id,
						nombre: user.name,
						avatarId: user.avatarId,
						domain_name: user.domain_name,
						domain_id: user.domain_id,
						estado: userStatus,
						primera_entrada: firstEvent ? firstEvent.ts : null,
						ultima_salida: lastEvent ? lastEvent.ts : null,
						horas_trabajadas: parseFloat(hours.worked.toFixed(2)),
						tiempo_pausas: parseFloat(hours.break.toFixed(2)),
						total: parseFloat(hours.total.toFixed(2))
					};
				})
			};

			const jsonContent = JSON.stringify(exportData, null, 2);
			const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `informe_general_${Date.now()}.json`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		}
	}

	// Export modal data to PDF
	function exportModalDataPDF() {
		if (!selectedUserForModal) return;

		const modalUser = users.find((u) => u.id === selectedUserForModal);
		if (!modalUser) return;

		// Create HTML content for PDF
		const htmlContent = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>${t('admin.report.reportTitle')} - ${modalUser.name}</title>
	<style>
		body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
		h1 { color: #635fe5; border-bottom: 3px solid #635fe5; padding-bottom: 10px; }
		h2 { color: #4338ca; margin-top: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
		.info-box { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
		.info-row { display: flex; margin: 8px 0; }
		.info-label { font-weight: bold; width: 150px; color: #6b7280; }
		.info-value { color: #111827; }
		table { width: 100%; border-collapse: collapse; margin: 20px 0; }
		th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: bold; color: #374151; border-bottom: 2px solid #e5e7eb; }
		td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
		tr:hover { background: #f9fafb; }
		.totals-row { background: #f3f4f6; font-weight: bold; }
		.summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
		.summary-card { background: white; border: 2px solid #e5e7eb; padding: 20px; border-radius: 8px; text-align: center; }
		.summary-card.highlight { background: #635fe5; color: white; }
		.summary-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
		.summary-value { font-size: 28px; font-weight: bold; }
		.footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
	</style>
</head>
<body>
	<h1>${t('admin.report.reportTitle')}</h1>

	<div class="info-box">
		<div class="info-row"><span class="info-label">${t('admin.users.tableHeaders.user')}:</span><span class="info-value">${modalUser.name}</span></div>
										<div class="info-row"><span class="info-label">${t('admin.users.tableHeaders.avatarId')}:</span><span class="info-value">${modalUser.avatarId}</span></div>
		<div class="info-row"><span class="info-label">ID:</span><span class="info-value">${modalUser.id}</span></div>
		<div class="info-row"><span class="info-label">${t('admin.users.tableHeaders.domain')}:</span><span class="info-value">${modalUser.domain_name || 'N/A'} (${modalUser.domain_id || 'N/A'})</span></div>
		<div class="info-row"><span class="info-label">${t('admin.report.generationDate')}:</span><span class="info-value">${new Date().toLocaleString(localeCode)}</span></div>
		<div class="info-row"><span class="info-label">${t('admin.report.period')}:</span><span class="info-value">${modalFromDate || t('admin.report.start')} a ${modalToDate || t('admin.report.present')}</span></div>
	</div>

	<h2>${t('admin.summary.generalSummaryHeading')}</h2>
	<div class="summary-cards">
		<div class="summary-card">
			<div class="summary-label">${t('admin.summary.daysWorked')}</div>
			<div class="summary-value">${dailySummaries.length}</div>
		</div>
		<div class="summary-card highlight">
			<div class="summary-label">${t('admin.summary.totalHours')}</div>
			<div class="summary-value">${modalTotalHours.total.toFixed(2)} h</div>
		</div>
		<div class="summary-card">
			<div class="summary-label">${t('admin.summary.breakTime')}</div>
			<div class="summary-value">${modalTotalHours.break.toFixed(2)} h</div>
		</div>
	</div>

	<h2>${t('admin.summary.dailyBreakdownHeading')}</h2>
	<table>
		<thead>
			<tr>
				<th>${t('admin.users.tableHeaders.date')}</th>
				<th>${t('admin.users.tableHeaders.day')}</th>
				<th>${t('admin.users.tableHeaders.firstEntry')}</th>
				<th>${t('admin.users.tableHeaders.lastExit')}</th>
				<th>${t('admin.users.tableHeaders.hoursWorked')}</th>
				<th>${t('admin.users.tableHeaders.breakTime')}</th>
				<th>${t('admin.users.tableHeaders.total')}</th>
				<th>${t('admin.users.tableHeaders.records')}</th>
			</tr>
		</thead>
		<tbody>
			${dailySummaries
				.map(
					(day) => `
				<tr>
					<td>${day.dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
					<td>${day.dateObj.toLocaleDateString('es-ES', { weekday: 'long' })}</td>
					<td>${day.firstIn ? new Date(day.firstIn).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
					<td>${day.lastOut ? new Date(day.lastOut).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
					<td>${day.hoursWorked.toFixed(2)} h</td>
					<td>${day.breakTime.toFixed(2)} h</td>
					<td>${day.totalTime.toFixed(2)} h</td>
					<td>${day.events.length}</td>
				</tr>
			`
				)
				.join('')}
		</tbody>
		<tfoot>
			<tr class="totals-row">
				<td colspan="4">TOTAL</td>
				<td>${modalTotalHours.worked.toFixed(2)} h</td>
				<td>${modalTotalHours.break.toFixed(2)} h</td>
				<td>${modalTotalHours.total.toFixed(2)} h</td>
				<td>${filteredModalEvents.length}</td>
			</tr>
		</tfoot>
	</table>

	<div class="footer">
		Generado por Sistema de Control de Horarios | ${new Date().toLocaleDateString('es-ES')}
	</div>
</body>
</html>
		`;

		// Create blob and download as HTML (can be opened and printed as PDF)
		const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `registro_${modalUser.name.replace(/\s+/g, '_')}_${Date.now()}.html`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		window.URL.revokeObjectURL(url);
		showExportMenu = false;

		// Open in new window for printing
		const printWindow = window.open('', '_blank');
		if (printWindow) {
			printWindow.document.write(htmlContent);
			printWindow.document.close();
		}
	}

	// All events for timeline (sorted by time)
	let timelineEvents = $derived(
		[...events].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
	);

	// Calculate daily breakdown for all users
	interface UserDayRecord {
		userId: number;
		userName: string;
		userAvatarId: string;
		domainName: string | null;
		domainId: string | null;
		date: string;
		dateObj: Date;
		firstIn: string | null;
		lastOut: string | null;
		hoursWorked: number;
		breakTime: number;
		totalTime: number;
		eventsCount: number;
	}

	let userDailyBreakdown = $derived.by((): UserDayRecord[] => {
		if (!fromDate && !toDate) return []; // Only show daily breakdown when filtering by date

		const records: UserDayRecord[] = [];

		filteredUsers().forEach((user) => {
			const startDate = fromDate ? new Date(fromDate) : new Date();
			if (!fromDate) startDate.setHours(0, 0, 0, 0);

			const endDate = toDate ? new Date(toDate + 'T23:59:59') : new Date();
			if (!toDate) endDate.setHours(23, 59, 59, 999);

			const userEvents = events.filter((e) => {
				const eventDate = new Date(e.ts);
				return (
					e.user_id === user.id && eventDate >= startDate && eventDate <= endDate
				);
			});

			if (userEvents.length === 0) return;

			// Group events by day
			const dayMap = new Map<string, any[]>();
			userEvents.forEach((event) => {
				const eventDate = new Date(event.ts);
				const dateKey = eventDate.toISOString().split('T')[0];

				if (!dayMap.has(dateKey)) {
					dayMap.set(dateKey, []);
				}
				dayMap.get(dateKey)!.push(event);
			});

			// Calculate hours for each day
			dayMap.forEach((dayEvents, dateKey) => {
				const sortedEvents = dayEvents.sort(
					(a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
				);

				let workedMs = 0;
				let breakMs = 0;
				let lastInTime: Date | null = null;
				let lastPauseTime: Date | null = null;
				let firstIn: string | null = null;
				let lastOut: string | null = null;

				sortedEvents.forEach((event) => {
					const eventTime = new Date(event.ts);

					if (event.event_type === 'in') {
						if (!firstIn) firstIn = event.ts;
						lastInTime = eventTime;
					} else if (event.event_type === 'pause_end') {
						if (lastPauseTime) {
							breakMs += eventTime.getTime() - lastPauseTime.getTime();
						}
						lastInTime = eventTime;
						lastPauseTime = null;
					} else if (event.event_type === 'out' && lastInTime !== null) {
						workedMs += eventTime.getTime() - lastInTime.getTime();
						lastOut = event.ts;
						lastInTime = null;
					} else if (event.event_type === 'pause_start' && lastInTime !== null) {
						workedMs += eventTime.getTime() - lastInTime.getTime();
						lastPauseTime = eventTime;
						lastInTime = null;
					}
				});

				// If still clocked in at end of day
				if (lastInTime) {
					const endOfDay = new Date(dateKey + 'T23:59:59');
					const now = new Date();
					const endTime = now < endOfDay ? now : endOfDay;
					workedMs += endTime.getTime() - lastInTime.getTime();
				}

				records.push({
					userId: user.id,
					userName: user.name,
					userAvatarId: user.avatarId,
					domainName: user.domain_name,
					domainId: user.domain_id,
					date: dateKey,
					dateObj: new Date(dateKey),
					firstIn,
					lastOut,
					hoursWorked: Math.floor((workedMs / 1000 / 60 / 60) * 100) / 100,
					breakTime: Math.floor((breakMs / 1000 / 60 / 60) * 100) / 100,
					totalTime: Math.floor((workedMs / 1000 / 60 / 60) * 100) / 100,
					eventsCount: sortedEvents.length
				});
			});
		});

		return records.sort((a, b) => {
			const dateCompare = b.dateObj.getTime() - a.dateObj.getTime();
			if (dateCompare !== 0) return dateCompare;
			return a.userName.localeCompare(b.userName);
		});
	});
</script>

<main>
	<div class="container">
		<header>
			<div class="header-content">
				<div class="header-text">
					<h1>{t('admin.title')}</h1>
					<p class="subtitle">{t('admin.subtitle')}</p>
				</div>
				<div class="header-actions">
					<button class="btn-refresh" onclick={refreshData} disabled={loading}>
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none" class:spinning={loading}>
							<path d="M17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 5.85786 5.85786 2.5 10 2.5C12.0825 2.5 13.9635 3.36331 15.3033 4.73744M15.3033 4.73744V1.66667M15.3033 4.73744H12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						{loading ? 'Actualizando...' : 'Actualizar'}
					</button>

					<div class="export-menu-container-header">
						<button
							class="btn-export-header"
							onclick={() => showGeneralExportMenu = !showGeneralExportMenu}
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
				{t('admin.export.export')}
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="chevron">
								<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</button>

						{#if showGeneralExportMenu}
							<div class="export-dropdown-header">
								<button class="export-option" onclick={() => { exportGeneralData('csv'); showGeneralExportMenu = false; }}>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
										<polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
									<div class="option-content">
										<div class="option-title">CSV</div>
										<div class="option-desc">Todos los usuarios del período seleccionado</div>
									</div>
								</button>

								<button class="export-option" onclick={() => { exportGeneralData('json'); showGeneralExportMenu = false; }}>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
										<polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
										<path d="M10 12h4M10 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
									</svg>
									<div class="option-content">
										<div class="option-title">JSON</div>
										<div class="option-desc">Datos estructurados para integraciones</div>
									</div>
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>

		</header>

		<div class="tabs">
			<button class="tab" class:active={currentTab === 'users'} onclick={() => (currentTab = 'users')}>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
					<path
						d="M16.25 17.5V15.8333C16.25 14.9493 15.8987 14.1014 15.2736 13.4763C14.6484 12.8512 13.8005 12.5 12.9167 12.5H7.08333C6.19952 12.5 5.35162 12.8512 4.72649 13.4763C4.10137 14.1014 3.75 14.9493 3.75 15.8333V17.5"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M10 9.16667C11.8409 9.16667 13.3333 7.67428 13.3333 5.83333C13.3333 3.99238 11.8409 2.5 10 2.5C8.15905 2.5 6.66667 3.99238 6.66667 5.83333C6.66667 7.67428 8.15905 9.16667 10 9.16667Z"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				{t('admin.tabs.users')}
			</button>
			<button class="tab" class:active={currentTab === 'timeline'} onclick={() => (currentTab = 'timeline')}>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
					<path
						d="M15.8333 3.33334H4.16667C3.24619 3.33334 2.5 4.07953 2.5 5.00001V16.6667C2.5 17.5872 3.24619 18.3333 4.16667 18.3333H15.8333C16.7538 18.3333 17.5 17.5872 17.5 16.6667V5.00001C17.5 4.07953 16.7538 3.33334 15.8333 3.33334Z"
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
				{t('admin.tabs.timelineChrono')}
			</button>
		</div>

		{#if currentTab === 'users'}
			<!-- Search and Export Bar -->
			<div class="toolbar">
				<div class="search-box">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.5" />
						<path d="M14 14l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
					</svg>
					<input
						type="text"
						placeholder={t('admin.users.searchPlaceholder')}
						bind:value={searchQuery}
					/>
				</div>
				<div class="date-filters">
					<div class="date-filter-group">
						<label for="from-date">
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
								<rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/>
								<path d="M5 1v3M11 1v3M2 6h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
							</svg>
							Desde:
						</label>
						<input
							id="from-date"
							type="date"
							value={fromDate}
							onchange={(e) => { handleFromDateChange(e.currentTarget.value); loadEvents(); }}
						/>
					</div>
					<div class="date-filter-group">
						<label for="to-date">
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
								<rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/>
								<path d="M5 1v3M11 1v3M2 6h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
							</svg>
							Hasta:
						</label>
						<input
							id="to-date"
							type="date"
							value={toDate}
							onchange={(e) => { handleToDateChange(e.currentTarget.value); loadEvents(); }}
						/>
					</div>
				</div>
				<button class="btn-export" onclick={() => exportData('csv')}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					{t('admin.export.exportCSV')}
				</button>
			</div>

			<!-- View Mode Toggle -->
			{#if fromDate || toDate}
				<div class="view-mode-toggle">
					<button
						class="view-mode-btn"
						class:active={usersViewMode === 'summary'}
						onclick={() => usersViewMode = 'summary'}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
							<rect x="3" y="3" width="7" height="7" stroke="currentColor" stroke-width="2" rx="1"/>
							<rect x="14" y="3" width="7" height="7" stroke="currentColor" stroke-width="2" rx="1"/>
							<rect x="3" y="14" width="7" height="7" stroke="currentColor" stroke-width="2" rx="1"/>
							<rect x="14" y="14" width="7" height="7" stroke="currentColor" stroke-width="2" rx="1"/>
						</svg>
						{t('admin.summary.summary')}
					</button>
					<button
						class="view-mode-btn"
						class:active={usersViewMode === 'daily'}
						onclick={() => usersViewMode = 'daily'}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
							<rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
							<path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
						</svg>
						{t('admin.viewModes.daily')}
					</button>
				</div>
			{/if}

			<!-- Users Summary Table -->
			{#if usersViewMode === 'summary'}
			<div class="table-container">
				<table class="users-table">
					<thead>
						<tr>
							<th onclick={() => toggleSort('name')} class="sortable">
								{t('admin.users.tableHeaders.user')}
								{#if sortField === 'name'}
									<span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
								{/if}
							</th>
							<th onclick={() => toggleSort('status')} class="sortable">
								{t('admin.users.tableHeaders.state')}
								{#if sortField === 'status'}
									<span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
								{/if}
							</th>
							<th>{t('admin.users.tableHeaders.date')}</th>
							<th>{t('admin.users.tableHeaders.start')}</th>
							<th>{t('admin.report.end')}</th>
							<th>{t('admin.report.hours')}</th>
							<th>{t('admin.report.breaks')}</th>
							<th>{t('admin.users.tableHeaders.total')}</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredUsers() as user (user.id)}
							{@const hours = calculateTodayHours(user.id)}
							{@const firstEvent = getTodayFirstEvent(user.id)}
							{@const lastEvent = getTodayLastEvent(user.id)}
							{@const userStatus = userStatuses[user.id]?.status || 'clocked_out'}
							<tr class="user-row" onclick={() => openUserModal(user.id)}>
								<td>
									<div class="user-cell">
										<div class="user-avatar-table">
											{user.name.charAt(0).toUpperCase()}
										</div>
										<div>
											<div class="user-name">{user.name}</div>
											<div class="user-meta">
												{#if user.domain_name}
													<span class="user-domain-name">{user.domain_name}</span>
												{/if}
												<span class="user-secondary">
													(ID: {user.id}
													{#if user.domain_id}
														• {user.domain_id}
													{/if})
												</span>
											</div>
										</div>
									</div>
								</td>
								<td>
									<div class="status-badge" data-status={userStatus}>
										<span class="status-dot" style="background-color: {getStatusColor(userStatus)}"></span>
										{getStatusLabel(userStatus)}
									</div>
								</td>
								<td class="date-cell">
									{#if fromDate && toDate}
										{new Date(fromDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {new Date(toDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
									{:else if fromDate}
										Desde {new Date(fromDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
									{:else if toDate}
										Hasta {new Date(toDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
									{:else}
										{new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
									{/if}
								</td>
								<td class="time-cell">
									{firstEvent ? formatDateTime(firstEvent.ts, { hour: '2-digit', minute: '2-digit' }) : '-'}
								</td>
								<td class="time-cell">
									{lastEvent ? formatDateTime(lastEvent.ts, { hour: '2-digit', minute: '2-digit' }) : '-'}
								</td>
								<td class="hours-cell">{hours.worked.toFixed(2)}h</td>
								<td class="hours-cell">{hours.break.toFixed(2)}h</td>
								<td class="hours-cell total">{hours.total.toFixed(2)}h</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{:else if usersViewMode === 'daily'}
			<!-- Daily Breakdown Table -->
			<div class="table-container">
				<div class="daily-breakdown-header">
					<h3>{t('admin.summary.dailyBreakdownHeading')}</h3>
					<div class="export-buttons">
						<button class="btn-export-mini" onclick={() => exportDailyBreakdown('csv')}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
							CSV
						</button>
						<button class="btn-export-mini" onclick={() => exportDailyBreakdown('json')}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
							JSON
						</button>
					</div>
				</div>
				<table class="daily-breakdown-table">
					<thead>
						<tr>
							<th>{t('admin.users.tableHeaders.user')}</th>
							<th>{t('admin.users.tableHeaders.avatarId')}</th>
							<th>{t('admin.users.tableHeaders.domain')}</th>
							<th>{t('admin.users.tableHeaders.date')}</th>
							<th>{t('admin.users.tableHeaders.firstEntry')}</th>
							<th>{t('admin.users.tableHeaders.lastExit')}</th>
							<th>{t('admin.users.tableHeaders.hoursWorked')}</th>
							<th>{t('admin.users.tableHeaders.breakTime')}</th>
							<th>{t('admin.users.tableHeaders.total')}</th>
							<th>{t('admin.users.tableHeaders.records')}</th>
						</tr>
					</thead>
					<tbody>
						{#each userDailyBreakdown as record (record.userId + '-' + record.date)}
							<tr>
								<td>
									<div class="user-cell-compact">
										<div class="user-avatar-small">
											{record.userName.charAt(0).toUpperCase()}
										</div>
										<div class="user-name">{record.userName}</div>
									</div>
								</td>
								<td class="email-cell">{record.userAvatarId}</td>
								<td class="domain-cell">
									{#if record.domainName}
										<span class="domain-badge">{record.domainName}</span>
									{:else}
										<span class="text-muted">-</span>
									{/if}
								</td>
								<td class="date-cell">
									{new Date(record.date).toLocaleDateString('es-ES', {
										weekday: 'short',
										day: '2-digit',
										month: '2-digit',
										year: 'numeric'
									})}
								</td>
								<td class="time-cell">
									{record.firstIn ? formatDateTime(record.firstIn, { hour: '2-digit', minute: '2-digit' }) : '-'}
								</td>
								<td class="time-cell">
									{record.lastOut ? formatDateTime(record.lastOut, { hour: '2-digit', minute: '2-digit' }) : '-'}
								</td>
								<td class="hours-cell">{record.hoursWorked.toFixed(2)}h</td>
								<td class="hours-cell">{record.breakTime.toFixed(2)}h</td>
								<td class="hours-cell total">{record.totalTime.toFixed(2)}h</td>
								<td class="count-cell">{record.eventsCount}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if userDailyBreakdown.length === 0}
					<div class="empty-state">
						<p>{t('admin.report.noDataForDateRange')}</p>
					</div>
				{/if}
			</div>
			{/if}
		{:else if currentTab === 'timeline'}
			<!-- Chronological Timeline -->
			<div class="timeline-section">
				<div class="timeline-header">
					<h3>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
							<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						Registro Cronológico de Actividad
					</h3>
					<div class="timeline-controls">
						<div class="date-filters-compact">
							<input
								type="date"
								value={fromDate}
								onchange={(e) => { handleFromDateChange(e.currentTarget.value); loadEvents(); }}
								placeholder="Desde"
							/>
							<span>—</span>
							<input
								type="date"
								value={toDate}
								onchange={(e) => { handleToDateChange(e.currentTarget.value); loadEvents(); }}
								placeholder="Hasta"
							/>
						</div>
						<button class="btn-export" onclick={() => exportData('csv')}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
							Exportar
						</button>
					</div>
				</div>

				<div class="timeline-list">
					{#each timelineEvents.slice(0, 100) as event (event.id)}
						{@const user = users.find(u => u.id === event.user_id)}
						<div class="timeline-item" data-type={event.event_type}>
							<div class="timeline-time">
								{formatDateTime(event.ts, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
							</div>
							<div class="timeline-icon" style="background-color: {getEventColor(event.event_type)}">
								{#if event.event_type === 'in'}
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
										<path d="M12 5v14m7-7H5" stroke="white" stroke-width="2" stroke-linecap="round"/>
									</svg>
								{:else if event.event_type === 'out'}
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
										<rect x="5" y="5" width="14" height="14" stroke="white" stroke-width="2"/>
									</svg>
								{:else if event.event_type === 'pause_start'}
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
										<rect x="6" y="4" width="4" height="16" fill="white"/>
										<rect x="14" y="4" width="4" height="16" fill="white"/>
									</svg>
								{:else}
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
										<polygon points="5 3 19 12 5 21 5 3" fill="white"/>
									</svg>
								{/if}
							</div>
							<div class="timeline-content">
								<div class="timeline-user">
									<span class="user-avatar-tiny">{event.avatar_name?.charAt(0).toUpperCase() || user?.name.charAt(0).toUpperCase() || '?'}</span>
									<div>
										<strong>{event.avatar_name || user?.name || t('admin.report.unknownUser')}</strong>
										<div class="timeline-user-meta">
											<span>(ID: {event.avatarId || user?.id})</span>
											{#if event.domain_id || user?.domain_id}
												<span>• {event.domain_id || user?.domain_id}</span>
											{/if}
										</div>
									</div>
								</div>
								<div class="timeline-action">{getEventLabel(event.event_type)}</div>
								<div class="timeline-date">
									{formatDateTime(event.ts, { day: '2-digit', month: '2-digit', year: 'numeric' })}
								</div>
							</div>
						</div>
					{/each}
				</div>

				{#if timelineEvents.length > 100}
					<div class="timeline-more">
						Mostrando los últimos 100 registros de {timelineEvents.length} totales
					</div>
				{/if}
			</div>
		{/if}

		<!-- User History Modal -->
		{#if selectedUserForModal}
			{@const modalUser = users.find(u => u.id === selectedUserForModal)}
			<div class="modal-overlay" onclick={closeUserModal}>
				<div class="modal-dialog" onclick={(e) => e.stopPropagation()}>
					<div class="modal-header">
						<h3>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
								<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
							{t('admin.users.fullHistory')}: {modalUser?.name || t('admin.users.tableHeaders.user')}
						</h3>
						<button class="btn-close" onclick={closeUserModal}>
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
								<path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							</svg>
						</button>
					</div>
					<div class="modal-body">
						<!-- User Info Section -->
						{#if modalUser}
							<div class="modal-user-info">
								<div class="user-info-grid">
									<div class="info-card">
										<div class="info-label">Nombre</div>
										<div class="info-value">{modalUser.name}</div>
									</div>
									<div class="info-card">
										<div class="info-label">Avatar ID</div>
										<div class="info-value">{modalUser.avatarId}</div>
									</div>
									<div class="info-card">
										<div class="info-label">ID</div>
										<div class="info-value">{modalUser.id}</div>
									</div>
									<div class="info-card">
										<div class="info-label">Rol</div>
										<div class="info-value">{modalUser.role}</div>
									</div>
									<div class="info-card">
										<div class="info-label">Domain Name</div>
										<div class="info-value">{modalUser.domain_name || 'N/A'}</div>
									</div>
									<div class="info-card">
										<div class="info-label">Domain ID</div>
										<div class="info-value">{modalUser.domain_id || 'N/A'}</div>
									</div>
									<div class="info-card">
										<div class="info-label">Estado</div>
										<div class="info-value">{modalUser.active ? 'Activo' : 'Inactivo'}</div>
									</div>
									<div class="info-card">
										<div class="info-label">Creado</div>
										<div class="info-value">{new Date(modalUser.created_at).toLocaleDateString('es-ES')}</div>
									</div>
								</div>

								{#if decodedToken}
									<div class="jwt-info">
										<h4>Información del Token JWT</h4>
										<div class="jwt-grid">
											{#if decodedToken.userId}
												<div class="jwt-field">
													<span class="jwt-label">{t('admin.report.userId')}:</span>
													<span class="jwt-value">{decodedToken.userId}</span>
												</div>
											{/if}
											{#if decodedToken.avatarId}
												<div class="jwt-field">
													<span class="jwt-label">{t('admin.users.tableHeaders.avatarId')}:</span>
													<span class="jwt-value">{decodedToken.avatarId}</span>
												</div>
											{/if}
											{#if decodedToken.role}
												<div class="jwt-field">
													<span class="jwt-label">{t('admin.users.roles.role')}:</span>
													<span class="jwt-value">{decodedToken.role}</span>
												</div>
											{/if}
											{#if decodedToken.iat}
												<div class="jwt-field">
													<span class="jwt-label">Emitido:</span>
													<span class="jwt-value">{new Date(decodedToken.iat * 1000).toLocaleString('es-ES')}</span>
												</div>
											{/if}
											{#if decodedToken.exp}
												<div class="jwt-field">
													<span class="jwt-label">Expira:</span>
													<span class="jwt-value">{new Date(decodedToken.exp * 1000).toLocaleString('es-ES')}</span>
												</div>
											{/if}
										</div>
									</div>
								{/if}
							</div>
						{/if}

						<!-- Date Filters -->
						<div class="modal-filters">
							<div class="filter-group">
								<label for="modal-from">Desde:</label>
								<input
									id="modal-from"
									type="date"
									bind:value={modalFromDate}
									class="filter-input"
								/>
							</div>
							<div class="filter-group">
								<label for="modal-to">Hasta:</label>
								<input
									id="modal-to"
									type="date"
									bind:value={modalToDate}
									class="filter-input"
								/>
							</div>
							<button
								class="btn-clear-filters"
								onclick={() => {
									modalFromDate = '';
									modalToDate = '';
								}}
							>
								Limpiar filtros
							</button>
						</div>

						<!-- View Toggle -->
						<div class="modal-tabs">
							<button
								class="modal-tab"
								class:active={modalViewType === 'daily'}
								onclick={() => (modalViewType = 'daily')}
							>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
									<rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
									<line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="2"/>
									<line x1="9" y1="9" x2="9" y2="22" stroke="currentColor" stroke-width="2"/>
								</svg>
								{t('admin.report.viewDaily')}
							</button>
							<button
								class="modal-tab"
								class:active={modalViewType === 'timeline'}
								onclick={() => (modalViewType = 'timeline')}
							>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
									<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
								Timeline
							</button>
						</div>

						{#if filteredModalEvents.length === 0}
							<div class="empty-state-modal">
								<p>No hay registros para este usuario en el período seleccionado</p>
							</div>
						{:else if modalViewType === 'daily'}
							<!-- Daily Summary View -->
							<div class="modal-totals">
								<div class="total-card">
									<div class="total-label">{t('admin.summary.daysWorked')}</div>
									<div class="total-value">{dailySummaries.length}</div>
								</div>
								<div class="total-card highlight">
									<div class="total-label">{t('admin.summary.totalHours')}</div>
									<div class="total-value">{modalTotalHours.total.toFixed(2)} h</div>
								</div>
								<div class="total-card">
									<div class="total-label">{t('admin.summary.breakTime')}</div>
									<div class="total-value">{modalTotalHours.break.toFixed(2)} h</div>
								</div>
							</div>

							<div class="daily-table-container">
								<table class="daily-table">
									<thead>
										<tr>
											<th>{t('admin.users.tableHeaders.date')}</th>
											<th>{t('admin.users.tableHeaders.day')}</th>
											<th>{t('admin.users.tableHeaders.firstEntry')}</th>
											<th>{t('admin.users.tableHeaders.lastExit')}</th>
											<th>{t('admin.users.tableHeaders.hoursWorked')}</th>
											<th>{t('admin.users.tableHeaders.breakTime')}</th>
											<th>{t('admin.users.tableHeaders.total')}</th>
											<th>{t('admin.users.tableHeaders.records')}</th>
										</tr>
									</thead>
									<tbody>
										{#each dailySummaries as day (day.date)}
											<tr>
												<td>{day.dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
												<td>{day.dateObj.toLocaleDateString('es-ES', { weekday: 'long' })}</td>
												<td>{day.firstIn ? new Date(day.firstIn).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
												<td>{day.lastOut ? new Date(day.lastOut).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
												<td class="hours-cell">{day.hoursWorked.toFixed(2)} h</td>
												<td class="hours-cell">{day.breakTime.toFixed(2)} h</td>
												<td class="hours-cell total">{day.totalTime.toFixed(2)} h</td>
												<td class="center">{day.events.length}</td>
											</tr>
										{/each}
									</tbody>
									<tfoot>
										<tr class="totals-row">
											<td colspan="4"><strong>TOTAL</strong></td>
											<td class="hours-cell"><strong>{modalTotalHours.worked.toFixed(2)} h</strong></td>
											<td class="hours-cell"><strong>{modalTotalHours.break.toFixed(2)} h</strong></td>
											<td class="hours-cell total"><strong>{modalTotalHours.total.toFixed(2)} h</strong></td>
											<td class="center"><strong>{filteredModalEvents.length}</strong></td>
										</tr>
									</tfoot>
								</table>
							</div>
						{:else}
							<!-- Timeline View -->
							<div class="modal-timeline">
								{#each filteredModalEvents as event (event.id)}
									<div class="modal-timeline-item">
										<div class="modal-time">
											{formatDateTime(event.ts)}
										</div>
										<div class="modal-event-icon" style="background-color: {getEventColor(event.event_type)}">
											{#if event.event_type === 'in'}
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
													<path d="M12 5v14m7-7H5" stroke="white" stroke-width="2" stroke-linecap="round"/>
												</svg>
											{:else if event.event_type === 'out'}
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
													<rect x="5" y="5" width="14" height="14" stroke="white" stroke-width="2"/>
												</svg>
											{:else if event.event_type === 'pause_start'}
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
													<rect x="6" y="4" width="4" height="16" fill="white"/>
													<rect x="14" y="4" width="4" height="16" fill="white"/>
												</svg>
											{:else}
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
													<polygon points="5 3 19 12 5 21 5 3" fill="white"/>
												</svg>
											{/if}
										</div>
										<div class="modal-event-label">{getEventLabel(event.event_type)}</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
					<div class="modal-footer">
						<div class="export-menu-container">
							<button
								class="btn-export"
								onclick={() => showExportMenu = !showExportMenu}
							>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
								{t('admin.export.exportReport')}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="chevron">
									<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							</button>

							{#if showExportMenu}
								<div class="export-dropdown">
									<button class="export-option" onclick={exportModalDataCSV}>
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
											<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
											<polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
										<div class="option-content">
											<div class="option-title">CSV</div>
											<div class="option-desc">Compatible con Excel y hojas de cálculo</div>
										</div>
									</button>

									<button class="export-option" onclick={exportModalDataExcel}>
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
											<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
											<polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
											<line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
											<line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
										<div class="option-content">
											<div class="option-title">Excel (XLSX)</div>
											<div class="option-desc">Hojas múltiples con formato profesional</div>
										</div>
									</button>

									<button class="export-option" onclick={exportModalDataJSON}>
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
											<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
											<polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
											<path d="M10 12h4M10 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
										</svg>
										<div class="option-content">
											<div class="option-title">JSON</div>
											<div class="option-desc">Para integraciones y desarrollo</div>
										</div>
									</button>

									<button class="export-option" onclick={exportModalDataPDF}>
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
											<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
											<polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
											<circle cx="12" cy="15" r="3" stroke="currentColor" stroke-width="2"/>
										</svg>
										<div class="option-content">
											<div class="option-title">PDF/HTML</div>
											<div class="option-desc">Formato imprimible para auditorías</div>
										</div>
									</button>
								</div>
							{/if}
						</div>
					</div>
				</div>
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
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
			Cantarell, sans-serif;
		background: #f9fafb;
	}

	main {
		min-height: 100vh;
		padding: 2rem;
	}

	.container {
		max-width: 1400px;
		margin: 0 auto;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2.5rem;
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		width: 100%;
	}

	.btn-refresh {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		color: #374151;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-refresh:hover:not(:disabled) {
		background: #f9fafb;
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.btn-refresh:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-refresh svg.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.header-icon {
		width: 56px;
		height: 56px;
		border-radius: 12px;
		background: linear-gradient(135deg, var(--color-primary, #635fe5) 0%, #4338ca 100%);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(99, 95, 229, 0.3);
	}

	.header-text h1 {
		font-size: 1.75rem;
		color: #111827;
		margin: 0;
		font-weight: 700;
	}

	.subtitle {
		color: #6b7280;
		margin: 0.25rem 0 0 0;
		font-size: 0.95rem;
		font-weight: 500;
	}

	.back-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #6b7280;
		text-decoration: none;
		font-weight: 500;
		padding: 0.625rem 1.25rem;
		border-radius: 8px;
		transition: all 0.2s;
		border: 1px solid #e5e7eb;
	}

	.back-link:hover {
		background: white;
		color: var(--color-primary, #635fe5);
		border-color: var(--color-primary, #635fe5);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.export-menu-container-header {
		position: relative;
	}

	.btn-export-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		background: linear-gradient(135deg, var(--color-primary, #635fe5) 0%, #4338ca 100%);
		color: white;
		border: none;
		border-radius: 8px;
		font-weight: 600;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 2px 8px rgba(99, 95, 229, 0.2);
	}

	.btn-export-header:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(99, 95, 229, 0.3);
	}

	.btn-export-header .chevron {
		margin-left: 0.25rem;
	}

	.export-dropdown-header {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		background: white;
		border-radius: 12px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
		padding: 0.5rem;
		min-width: 300px;
		z-index: 1000;
		animation: slideDown 0.2s ease-out;
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

	.tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 2rem;
		background: white;
		padding: 0.25rem;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.tab {
		flex: 0 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.5rem 0.875rem;
		background: transparent;
		border: none;
		border-radius: 8px;
		color: #6b7280;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.tab svg {
		width: 18px;
		height: 18px;
	}

	.tab.active {
		background: var(--color-primary, #635fe5);
		color: white;
		box-shadow: 0 2px 8px rgba(99, 95, 229, 0.3);
	}

	.filters-section {
		background: white;
		padding: 2rem;
		border-radius: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		margin-bottom: 2rem;
	}

	.filters-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid #f3f4f6;
	}

	.filters-header svg {
		color: var(--color-primary, #635fe5);
	}

	.filters-header h3 {
		font-size: 1.125rem;
		color: #111827;
		margin: 0;
		font-weight: 700;
	}

	.filters-header.secondary {
		margin-top: 2rem;
	}

	.filters-header.secondary h4 {
		font-size: 1rem;
		color: #111827;
		margin: 0;
		font-weight: 600;
	}

	.filters-divider {
		height: 1px;
		background: #e5e7eb;
		margin: 2rem 0;
	}

	.filters {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr auto;
		gap: 1.25rem;
		align-items: flex-end;
	}

	.filters.secondary {
		grid-template-columns: 1fr 1fr auto;
		background: #f9fafb;
		padding: 1.5rem;
		border-radius: 12px;
		border: 1px solid #e5e7eb;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		color: #374151;
		font-size: 0.875rem;
	}

	label svg {
		color: #9ca3af;
		width: 16px;
		height: 16px;
	}

	input[type='date'],
	select {
		padding: 0.75rem 1rem;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 0.95rem;
		background: white;
		color: #111827;
		transition: all 0.2s;
	}

	input[type='date']:focus,
	select:focus {
		outline: none;
		border-color: var(--color-primary, #635fe5);
		box-shadow: 0 0 0 3px rgba(99, 95, 229, 0.1);
	}

	button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-search {
		background: var(--color-primary, #635fe5);
		color: white;
	}

	.btn-search:hover:not(:disabled) {
		filter: brightness(0.95);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(99, 95, 229, 0.3);
	}

	.btn-search:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	.btn-clear {
		background: #ef4444;
		color: white;
	}

	.btn-clear:hover:not(:disabled) {
		filter: brightness(0.95);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
	}

	.export-section {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 2px solid #f3f4f6;
	}

	.export-section svg {
		color: var(--color-primary, #635fe5);
		flex-shrink: 0;
	}

	.export-title {
		font-weight: 600;
		color: #111827;
		font-size: 1rem;
	}

	.export-buttons {
		display: flex;
		gap: 0.75rem;
		margin-left: auto;
	}

	.btn-export {
		padding: 0.625rem 1.25rem;
		font-size: 0.875rem;
	}

	.btn-export.csv {
		background: #059669;
		color: white;
	}

	.btn-export.csv:hover:not(:disabled) {
		filter: brightness(0.95);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
	}

	.btn-export.json {
		background: #7c3aed;
		color: white;
	}

	.btn-export.json:hover:not(:disabled) {
		filter: brightness(0.95);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
	}

	.alert {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		border-radius: 12px;
		margin-bottom: 2rem;
	}

	.alert-error {
		background: #fee2e2;
		color: #991b1b;
		border: 1px solid #fca5a5;
	}

	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		background: white;
		border-radius: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		color: #6b7280;
	}

	.empty-state svg {
		color: #d1d5db;
		margin-bottom: 1.5rem;
	}

	.empty-state p {
		font-size: 1rem;
		margin: 0;
		font-weight: 500;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid #e5e7eb;
		border-top-color: var(--color-primary, #635fe5);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin-bottom: 1.5rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-state p {
		margin: 0;
		font-size: 1rem;
		font-weight: 500;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 1.5rem;
		background: white;
		border-radius: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
		transition: all 0.2s;
	}

	.stat-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.stat-icon {
		width: 56px;
		height: 56px;
		border-radius: 12px;
		background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
		color: var(--color-primary, #635fe5);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.stat-content {
		flex: 1;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 600;
		margin-bottom: 0.5rem;
		display: block;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		color: #111827;
	}

	.weekly-summary {
		background: white;
		padding: 2rem;
		border-radius: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		margin-bottom: 2rem;
	}

	.weekly-summary h3,
	.weekly-summary h4 {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0 0 1.5rem 0;
		font-size: 1.125rem;
		color: #111827;
		font-weight: 700;
	}

	.weekly-summary h4 {
		font-size: 1rem;
		font-weight: 600;
	}

	.weekly-summary.compact {
		margin-bottom: 1.5rem;
		padding: 1.5rem;
	}

	.weekly-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
	}

	.weekly-card {
		background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
		border-radius: 12px;
		padding: 1.25rem;
		border-left: 4px solid var(--color-primary, #635fe5);
		border: 1px solid #e5e7eb;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: all 0.2s;
	}

	.weekly-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.week-range {
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 600;
	}

	.week-hours {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
	}

	.table-card {
		background: white;
		border-radius: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		border: 1px solid #e5e7eb;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		background: #f9fafb;
	}

	th {
		padding: 1rem 1.25rem;
		text-align: left;
		font-weight: 700;
		color: #374151;
		border-bottom: 2px solid #e5e7eb;
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	td {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #f3f4f6;
		color: #111827;
	}

	tbody tr {
		transition: all 0.2s;
	}

	tbody tr:hover {
		background: #f9fafb;
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	.user-cell-simple {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.user-avatar-tiny {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--color-primary, #635fe5) 0%, #4338ca 100%);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.event-badge {
		display: inline-block;
		padding: 0.375rem 0.875rem;
		border-radius: 6px;
		color: white;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.mono {
		font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.text-muted {
		color: #9ca3af;
		font-size: 0.875rem;
	}

	.users-section {
		background: white;
		padding: 2rem;
		border-radius: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
	}

	.users-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 2px solid #f3f4f6;
	}

	.users-header h3 {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0;
		color: #111827;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.users-summary {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.summary-pill {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.75rem 1.25rem;
		background: #f9fafb;
		border-radius: 10px;
		border: 1px solid #e5e7eb;
		transition: all 0.2s;
	}

	.summary-pill:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transform: translateY(-1px);
	}

	.summary-pill svg {
		color: #6b7280;
		flex-shrink: 0;
	}

	.summary-pill.active svg {
		color: #059669;
	}

	.summary-pill.admin svg {
		color: #f59e0b;
	}

	.pill-label {
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 600;
	}

	.pill-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: #111827;
	}

	.users-table tbody tr {
		cursor: pointer;
	}

	.users-table tbody tr.inactive {
		opacity: 0.5;
	}

	.users-table tbody tr.timeline-active {
		background: #eff6ff;
		border-left: 4px solid var(--color-primary, #635fe5);
	}

	.user-cell {
		display: flex;
		align-items: center;
		gap: 0.875rem;
	}

	.user-avatar-small {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--color-primary, #635fe5) 0%, #4338ca 100%);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1.125rem;
		flex-shrink: 0;
	}

	.user-info-cell {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.user-name-cell {
		font-weight: 700;
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
		padding: 0.375rem 0.875rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 700;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.05em;
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
		color: #9ca3af;
	}

	.stats-cell {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.stat-item {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.875rem;
	}

	.stat-item .stat-label {
		color: #6b7280;
	}

	.stat-item .stat-value {
		font-weight: 700;
		color: #111827;
		font-size: 0.875rem;
	}

	.last-event-cell {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.last-event-time {
		font-size: 0.875rem;
		color: #111827;
		font-weight: 600;
		font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
	}

	.event-type-small {
		display: inline-block;
		padding: 0.25rem 0.625rem;
		border-radius: 6px;
		color: white;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.date-cell {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.timeline-panel {
		margin-top: 2rem;
		background: #f9fafb;
		border-radius: 16px;
		padding: 2rem;
		border: 2px solid #e5e7eb;
	}

	.timeline-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.timeline-header h3 {
		margin: 0;
		font-size: 1.25rem;
		color: #111827;
		font-weight: 700;
	}

	.timeline-subtitle {
		margin: 0.375rem 0 0 0;
		color: #6b7280;
		font-size: 0.95rem;
	}

	.btn-close-timeline {
		background: #ef4444;
		color: white;
		padding: 0.625rem 1.25rem;
	}

	.btn-close-timeline:hover {
		filter: brightness(0.95);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
	}

	.timeline-empty {
		margin: 1.5rem 0 0 0;
		color: #6b7280;
		text-align: center;
		font-size: 1rem;
	}

	.timeline-events {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.timeline-item {
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;
		padding: 1.25rem;
		background: white;
		border-radius: 12px;
		border: 1px solid #e5e7eb;
		transition: all 0.2s;
	}

	.timeline-item:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transform: translateY(-1px);
	}

	.timeline-badge {
		min-width: 130px;
		text-align: center;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		color: white;
		font-weight: 700;
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.timeline-details {
		flex: 1;
	}

	.timeline-date {
		font-weight: 700;
		color: #111827;
		margin-bottom: 0.5rem;
		font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
		font-size: 0.95rem;
	}

	.timeline-meta {
		display: flex;
		gap: 1.25rem;
		color: #6b7280;
		font-size: 0.875rem;
		flex-wrap: wrap;
	}

	.timeline-source {
		text-transform: uppercase;
		font-weight: 700;
		font-size: 0.75rem;
		color: #9ca3af;
		letter-spacing: 0.05em;
	}

	.legal-footer {
		margin-top: 3rem;
		padding-top: 2rem;
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
		font-weight: 500;
		transition: all 0.2s;
	}

	.legal-link:hover {
		color: var(--color-primary, #635fe5);
	}

	.separator {
		color: #d1d5db;
	}

	@media (max-width: 1024px) {
		.filters {
			grid-template-columns: 1fr 1fr;
		}

		.filters .btn-search {
			grid-column: 1 / -1;
		}

		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 768px) {
		main {
			padding: 1.5rem;
		}

		.header-content {
			gap: 1rem;
		}

		.header-icon {
			width: 48px;
			height: 48px;
		}

		.header-icon svg {
			width: 24px;
			height: 24px;
		}

		.header-text h1 {
			font-size: 1.5rem;
		}

		.filters {
			grid-template-columns: 1fr;
		}

		.filters.secondary {
			grid-template-columns: 1fr;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}

		.table-card {
			overflow-x: auto;
		}

		table {
			min-width: 800px;
		}

		.users-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1.25rem;
		}

		.users-summary {
			width: 100%;
		}

		.summary-pill {
			flex: 1;
			min-width: 120px;
		}

		.export-section {
			flex-wrap: wrap;
		}

		.export-buttons {
			width: 100%;
			margin-left: 0;
		}

		.btn-export {
			flex: 1;
		}

		.realtime-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.status-groups {
			grid-template-columns: 1fr;
		}

		.user-status-card {
			flex-wrap: wrap;
		}

		.user-status-time {
			width: 100%;
			justify-content: center;
		}
	}

	/* Real-time Status Styles */
	.realtime-section {
		animation: fadeInUp 0.5s ease-out;
	}

	.realtime-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid rgba(0, 0, 0, 0.08);
	}

	.realtime-header h3 {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0;
		color: #111827;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.realtime-header svg {
		color: var(--color-primary);
	}

	.auto-refresh-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
		border-radius: 12px;
		font-size: 0.875rem;
		color: #16a34a;
		font-weight: 600;
	}

	.pulse-dot {
		width: 8px;
		height: 8px;
		background: #16a34a;
		border-radius: 50%;
		animation: pulse-dot 2s infinite;
	}

	@keyframes pulse-dot {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.6;
			transform: scale(1.2);
		}
	}

	.status-groups {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
		gap: 1.5rem;
	}

	.status-group {
		background: white;
		border-radius: 16px;
		overflow: hidden;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
		border: 2px solid transparent;
		transition: all 0.3s;
	}

	.status-group:hover {
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
	}

	.status-group.working {
		border-color: rgba(22, 163, 74, 0.2);
	}

	.status-group.on-break {
		border-color: rgba(234, 88, 12, 0.2);
	}

	.status-group.finished {
		border-color: rgba(107, 114, 128, 0.2);
	}

	.status-group-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem;
		background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.status-group-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		flex-shrink: 0;
	}

	.status-group-header h4 {
		flex: 1;
		margin: 0;
		font-size: 1.125rem;
		font-weight: 700;
		color: #111827;
	}

	.status-count {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		height: 32px;
		padding: 0 0.75rem;
		background: var(--color-primary);
		color: white;
		border-radius: 16px;
		font-weight: 700;
		font-size: 0.875rem;
	}

	.users-list {
		max-height: 600px;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.empty-state {
		padding: 3rem 1.5rem;
		text-align: center;
		color: #9ca3af;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 500;
	}

	.user-status-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		margin-bottom: 0.5rem;
		background: white;
		border: 1px solid rgba(0, 0, 0, 0.06);
		border-radius: 12px;
		transition: all 0.2s;
	}

	.user-status-card:hover {
		background: #f9fafb;
		border-color: var(--color-primary);
		transform: translateX(4px);
	}

	.user-status-avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1.125rem;
		flex-shrink: 0;
	}

	.user-status-info {
		flex: 1;
		min-width: 0;
	}

	.user-status-name {
		font-weight: 600;
		color: #111827;
		font-size: 0.95rem;
		margin-bottom: 0.15rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.user-status-email {
		font-size: 0.8rem;
		color: #6b7280;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.user-status-domain {
		font-size: 0.75rem;
		color: #9ca3af;
		margin-top: 0.15rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.user-status-time {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
		border-radius: 8px;
		color: #16a34a;
		font-weight: 700;
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.user-status-time.last-seen {
		background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
		color: #6b7280;
	}

	.user-status-time svg {
		flex-shrink: 0;
	}

	@media (max-width: 1024px) {
		.status-groups {
			grid-template-columns: 1fr;
		}
	}

	/* New Admin Styles */
	.toolbar {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
		align-items: center;
	}

	.search-box {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
	}

	.search-box svg {
		color: #9ca3af;
		flex-shrink: 0;
	}

	.search-box input {
		flex: 1;
		border: none;
		outline: none;
		font-size: 0.95rem;
		color: #111827;
	}

	.search-box input::placeholder {
		color: #9ca3af;
	}

	.date-filters {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.date-filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.date-filter-group label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: #6b7280;
		font-weight: 600;
	}

	.date-filter-group label svg {
		color: #9ca3af;
	}

	.date-filter-group input[type="date"] {
		padding: 0.625rem 0.875rem;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		font-size: 0.875rem;
		color: #374151;
		background: white;
		cursor: pointer;
		transition: all 0.2s;
	}

	.date-filter-group input[type="date"]:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(99, 95, 229, 0.1);
	}

	.table-container {
		background: white;
		border-radius: 16px;
		overflow: hidden;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
	}

	.users-table {
		width: 100%;
		border-collapse: collapse;
	}

	.users-table thead {
		background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
	}

	.users-table th {
		padding: 1rem 1.25rem;
		text-align: left;
		font-size: 0.75rem;
		font-weight: 700;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		border-bottom: 2px solid #e5e7eb;
	}

	.users-table th.sortable {
		cursor: pointer;
		user-select: none;
		transition: color 0.2s;
	}

	.users-table th.sortable:hover {
		color: var(--color-primary);
	}

	.sort-indicator {
		margin-left: 0.5rem;
		color: var(--color-primary);
	}

	.users-table tbody tr {
		border-bottom: 1px solid #f3f4f6;
		transition: background 0.2s;
	}

	.user-row {
		cursor: pointer;
	}

	.user-row:hover {
		background: #f9fafb;
	}

	.users-table td {
		padding: 1rem 1.25rem;
		font-size: 0.875rem;
		color: #374151;
	}

	.user-cell {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.user-avatar-table {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.user-name {
		font-weight: 600;
		color: #111827;
		margin-bottom: 0.15rem;
	}

	.user-email {
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.user-meta {
		font-size: 0.7rem;
		color: #9ca3af;
		display: flex;
		gap: 0.35rem;
		margin-top: 0.15rem;
	}

	.user-domain-name {
		font-weight: 600;
		color: #635fe5;
		font-size: 0.8125rem;
		margin-right: 0.5rem;
	}

	.user-secondary {
		font-family: 'Courier New', monospace;
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		border-radius: 8px;
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.status-badge[data-status="clocked_in"] {
		background: rgba(22, 163, 74, 0.1);
		color: #16a34a;
	}

	.status-badge[data-status="on_pause"] {
		background: rgba(234, 88, 12, 0.1);
		color: #ea580c;
	}

	.status-badge[data-status="clocked_out"] {
		background: rgba(107, 114, 128, 0.1);
		color: #6b7280;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.date-cell {
		color: #6b7280;
		font-weight: 500;
	}

	.time-cell {
		font-family: 'Courier New', monospace;
		color: #374151;
		font-weight: 500;
	}

	.hours-cell {
		font-family: 'Courier New', monospace;
		font-weight: 600;
		color: #111827;
	}

	.hours-cell.total {
		color: var(--color-primary);
		font-size: 0.9375rem;
	}

	/* Timeline Styles */
	.timeline-section {
		animation: fadeInUp 0.5s ease-out;
	}

	.timeline-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.timeline-header h3 {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0;
		color: #111827;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.timeline-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.date-filters-compact {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
	}

	.date-filters-compact span {
		color: #9ca3af;
		font-weight: 600;
	}

	.date-filters-compact input[type="date"] {
		border: none;
		outline: none;
		font-size: 0.875rem;
		color: #374151;
		background: transparent;
		cursor: pointer;
		width: 140px;
	}

	.date-filters-compact input[type="date"]:focus {
		color: var(--color-primary);
	}

	.timeline-list {
		background: white;
		border-radius: 16px;
		padding: 1rem;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
	}

	.timeline-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid #f3f4f6;
	}

	.timeline-item:last-child {
		border-bottom: none;
	}

	.timeline-time {
		font-family: 'Courier New', monospace;
		font-size: 0.8125rem;
		color: #6b7280;
		font-weight: 600;
		min-width: 90px;
	}

	.timeline-icon {
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
		gap: 1rem;
	}

	.timeline-user {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 200px;
	}

	.user-avatar-tiny {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.timeline-user-meta {
		font-size: 0.7rem;
		color: #9ca3af;
		display: flex;
		gap: 0.35rem;
		margin-top: 0.1rem;
		font-family: 'Courier New', monospace;
	}

	.timeline-action {
		font-weight: 600;
		color: #374151;
		min-width: 140px;
	}

	.timeline-date {
		font-size: 0.8125rem;
		color: #9ca3af;
	}

	.timeline-more {
		text-align: center;
		padding: 1rem;
		color: #9ca3af;
		font-size: 0.875rem;
		margin-top: 1rem;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 3000;
		padding: 1rem;
		animation: fadeIn 0.2s ease-out;
	}

	.modal-dialog {
		background: white;
		border-radius: 20px;
		width: 100%;
		max-width: 1200px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		animation: scaleIn 0.3s ease-out;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-header h3 {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: #111827;
	}

	.btn-close {
		width: 36px;
		height: 36px;
		border-radius: 8px;
		border: none;
		background: #f3f4f6;
		color: #6b7280;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-close:hover {
		background: #e5e7eb;
		color: #111827;
	}

	.modal-body {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}

	.empty-state-modal {
		text-align: center;
		padding: 3rem;
		color: #9ca3af;
	}

	.modal-timeline {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.modal-timeline-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: #f9fafb;
		border-radius: 12px;
	}

	.modal-time {
		font-family: 'Courier New', monospace;
		font-size: 0.8125rem;
		color: #6b7280;
		font-weight: 600;
		min-width: 160px;
	}

	.modal-event-icon {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.modal-event-label {
		flex: 1;
		font-weight: 600;
		color: #374151;
	}

	.modal-footer {
		padding: 1.5rem;
		border-top: 1px solid #e5e7eb;
		display: flex;
		justify-content: flex-end;
	}

	/* User Info Section */
	.modal-user-info {
		margin-bottom: 1.5rem;
		background: #f9fafb;
		padding: 1.5rem;
		border-radius: 12px;
	}

	.user-info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.info-card {
		background: white;
		padding: 1rem;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.info-label {
		font-size: 0.75rem;
		color: #6b7280;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
	}

	.info-value {
		font-size: 1rem;
		color: #111827;
		font-weight: 600;
	}

	/* JWT Info */
	.jwt-info {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		border: 2px solid #e5e7eb;
	}

	.jwt-info h4 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #111827;
		font-weight: 700;
	}

	.jwt-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 0.75rem;
	}

	.jwt-field {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem;
		background: #f9fafb;
		border-radius: 6px;
	}

	.jwt-label {
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 600;
	}

	.jwt-value {
		font-size: 0.875rem;
		color: #111827;
		font-family: 'Courier New', monospace;
	}

	/* Modal Filters */
	.modal-filters {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: white;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
	}

	.filter-group label {
		font-size: 0.875rem;
		color: #374151;
		font-weight: 600;
	}

	.filter-input {
		padding: 0.625rem;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.filter-input:focus {
		outline: none;
		border-color: var(--color-primary, #635fe5);
		box-shadow: 0 0 0 3px rgba(99, 95, 229, 0.1);
	}

	.btn-clear-filters {
		padding: 0.625rem 1rem;
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		color: #374151;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.btn-clear-filters:hover {
		background: #e5e7eb;
		border-color: #9ca3af;
	}

	/* Modal Tabs */
	.modal-tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		background: white;
		padding: 0.5rem;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.modal-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: transparent;
		border: none;
		border-radius: 8px;
		color: #6b7280;
		font-weight: 600;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.modal-tab:hover {
		background: #f9fafb;
		color: #374151;
	}

	.modal-tab.active {
		background: var(--color-primary, #635fe5);
		color: white;
		box-shadow: 0 2px 8px rgba(99, 95, 229, 0.3);
	}

	.modal-tab svg {
		width: 18px;
		height: 18px;
	}

	/* Modal Totals */
	.modal-totals {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.total-card {
		background: white;
		padding: 1.25rem;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		text-align: center;
	}

	.total-card.highlight {
		background: linear-gradient(135deg, var(--color-primary, #635fe5) 0%, #4338ca 100%);
		color: white;
	}

	.total-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
		opacity: 0.8;
	}

	.total-card.highlight .total-label {
		opacity: 1;
	}

	.total-value {
		font-size: 1.75rem;
		font-weight: 700;
	}

	/* Daily Table */
	.daily-table-container {
		background: white;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}

	.daily-table {
		width: 100%;
		border-collapse: collapse;
	}

	.daily-table thead {
		background: #f9fafb;
	}

	.daily-table th {
		padding: 1rem;
		text-align: left;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
		border-bottom: 2px solid #e5e7eb;
	}

	.daily-table tbody tr {
		border-bottom: 1px solid #f3f4f6;
		transition: background 0.2s;
	}

	.daily-table tbody tr:hover {
		background: #f9fafb;
	}

	.daily-table td {
		padding: 1rem;
		font-size: 0.875rem;
		color: #374151;
	}

	.daily-table td.hours-cell {
		font-family: 'Courier New', monospace;
		font-weight: 600;
		color: #111827;
	}

	.daily-table td.hours-cell.total {
		color: var(--color-primary, #635fe5);
	}

	.daily-table td.center {
		text-align: center;
	}

	.daily-table tfoot {
		background: #f3f4f6;
		font-weight: 700;
	}

	.daily-table tfoot td {
		padding: 1rem;
		border-top: 2px solid #e5e7eb;
	}

	.totals-row td {
		color: #111827;
		font-size: 0.9375rem;
	}

	/* Export Menu */
	.export-menu-container {
		position: relative;
	}

	.btn-export {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.875rem 1.5rem;
		background: linear-gradient(135deg, var(--color-primary, #635fe5) 0%, #4338ca 100%);
		color: white;
		border: none;
		border-radius: 12px;
		font-weight: 600;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 4px 12px rgba(99, 95, 229, 0.3);
	}

	.btn-export:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(99, 95, 229, 0.4);
	}

	.btn-export .chevron {
		margin-left: 0.25rem;
		transition: transform 0.2s;
	}

	.export-dropdown {
		position: absolute;
		bottom: calc(100% + 0.5rem);
		right: 0;
		background: white;
		border-radius: 12px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
		padding: 0.5rem;
		min-width: 320px;
		z-index: 1000;
		animation: slideUp 0.2s ease-out;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.export-option {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 100%;
		padding: 1rem;
		background: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
	}

	.export-option:hover {
		background: #f9fafb;
	}

	.export-option svg {
		color: var(--color-primary, #635fe5);
		flex-shrink: 0;
	}

	.option-content {
		flex: 1;
	}

	.option-title {
		font-weight: 700;
		color: #111827;
		font-size: 0.9375rem;
		margin-bottom: 0.25rem;
	}

	.option-desc {
		font-size: 0.8125rem;
		color: #6b7280;
		line-height: 1.3;
	}

	@media (max-width: 768px) {
		.toolbar {
			flex-direction: column;
		}

		.users-table {
			font-size: 0.8125rem;
		}

		.users-table th,
		.users-table td {
			padding: 0.75rem 0.5rem;
		}

		.timeline-content {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.timeline-user,
		.timeline-action,
		.timeline-date {
			min-width: auto;
		}
	}

	/* View Mode Toggle */
	.view-mode-toggle {
		display: flex;
		gap: 0.5rem;
		margin: 1.5rem 0 1rem;
		padding: 0 1.5rem;
	}

	.view-mode-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		background: white;
		border: 1.5px solid #e5e7eb;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.view-mode-btn:hover {
		border-color: #635fe5;
		color: #635fe5;
		background: #f8f7ff;
	}

	.view-mode-btn.active {
		background: #635fe5;
		border-color: #635fe5;
		color: white;
	}

	.view-mode-btn svg {
		width: 18px;
		height: 18px;
	}

	/* Daily Breakdown Table */
	.daily-breakdown-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		background: linear-gradient(135deg, #635fe5 0%, #4f4cd1 100%);
		border-radius: 12px 12px 0 0;
		margin: 0 1.5rem;
	}

	.daily-breakdown-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: white;
	}

	.export-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.btn-export-mini {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.875rem;
		background: rgba(255, 255, 255, 0.15);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 6px;
		font-size: 0.8125rem;
		font-weight: 500;
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-export-mini:hover {
		background: rgba(255, 255, 255, 0.25);
		border-color: rgba(255, 255, 255, 0.5);
	}

	.btn-export-mini svg {
		width: 16px;
		height: 16px;
	}

	.daily-breakdown-table {
		width: 100%;
		border-collapse: collapse;
		background: white;
	}

	.daily-breakdown-table thead {
		background: #f9fafb;
		border-bottom: 2px solid #e5e7eb;
	}

	.daily-breakdown-table th {
		padding: 1rem;
		text-align: left;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #374151;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.daily-breakdown-table td {
		padding: 1rem;
		font-size: 0.875rem;
		color: #1f2937;
		border-bottom: 1px solid #f3f4f6;
	}

	.daily-breakdown-table tbody tr {
		transition: background-color 0.15s ease;
	}

	.daily-breakdown-table tbody tr:hover {
		background: #f9fafb;
	}

	.user-cell-compact {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.user-avatar-small {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, #635fe5 0%, #4f4cd1 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 0.875rem;
		color: white;
		flex-shrink: 0;
	}

	.email-cell {
		color: #6b7280;
		font-size: 0.8125rem;
	}

	.domain-badge {
		display: inline-block;
		padding: 0.25rem 0.625rem;
		background: #eff6ff;
		color: #1e40af;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.text-muted {
		color: #9ca3af;
	}

	.count-cell {
		text-align: center;
		font-weight: 500;
		color: #6b7280;
	}

	.empty-state {
		padding: 3rem 1.5rem;
		text-align: center;
		color: #6b7280;
		background: white;
		border-radius: 0 0 12px 12px;
		margin: 0 1.5rem;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.9375rem;
	}
</style>
