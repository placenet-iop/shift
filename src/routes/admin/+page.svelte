<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let token = '';
	let users: any[] = [];
	let events: any[] = [];
	let selectedUserId = '';
	let loading = false;
	let error = '';
	let fromDate = '';
	let toDate = '';
	let currentTab: 'events' | 'users' = 'events';
	let eventTypeFilter = '';
	let domainFilter = '';

	onMount(() => {
		if (browser) {
			token = localStorage.getItem('token') || '';
			if (!token) {
				window.location.href = '/';
				return;
			}

			// Set default dates: last 30 days
			const to = new Date();
			const from = new Date();
			from.setDate(from.getDate() - 30);

			toDate = to.toISOString().split('T')[0];
			fromDate = from.toISOString().split('T')[0];

			loadUsers();
			loadEvents();
		}
	});

	async function loadUsers() {
		try {
			const response = await fetch('/api/admin/users', {
				headers: { Authorization: `Bearer ${token}` }
			});

			const data = await response.json();

			if (data.success) {
				users = data.users;
				// Load stats for each user
				await loadUserStats();
			} else {
				error = data.error || 'Failed to load users';
			}
		} catch (e) {
			error = 'Connection error';
		}
	}

	let userStats: Record<number, any> = {};

	async function loadUserStats() {
		// Get last 30 days stats for each user
		const to = new Date();
		const from = new Date();
		from.setDate(from.getDate() - 30);

		for (const user of users) {
			try {
				const response = await fetch(
					`/api/admin/events?from=${from.toISOString()}&to=${to.toISOString()}&user_id=${user.id}`,
					{ headers: { Authorization: `Bearer ${token}` } }
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
				headers: { Authorization: `Bearer ${token}` }
			});

			const data = await response.json();

			if (data.success) {
				events = data.events;
			} else {
				error = data.error || 'Failed to load events';
				if (error.includes('Admin role required') || error.includes('Unauthorized')) {
					alert('No tienes permisos de administrador');
					window.location.href = '/';
				}
			}
		} catch (e) {
			error = 'Connection error';
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
				headers: { Authorization: `Bearer ${token}` }
			});

			if (response.ok) {
				const blob = await response.blob();
				const downloadUrl = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = downloadUrl;
				a.download = `control_horario_${Date.now()}.${format}`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				window.URL.revokeObjectURL(downloadUrl);
			} else {
				error = 'Export failed';
			}
		} catch (e) {
			error = 'Export error';
		} finally {
			loading = false;
		}
	}

	function formatDateTime(isoDate: string): string {
		const date = new Date(isoDate);
		return date.toLocaleString('es-ES', {
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
			in: 'Entrada',
			out: 'Salida',
			pause_start: 'Inicio Pausa',
			pause_end: 'Fin Pausa'
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
		return user ? user.name : `Usuario ${userId}`;
	}

	// Computed: Get unique domains from events
	$: uniqueDomains = Array.from(new Set(events.map(e => e.domain_name).filter(Boolean)));

	// Computed: Filter events by type and domain
	$: filteredEvents = events.filter(event => {
		if (eventTypeFilter && event.event_type !== eventTypeFilter) return false;
		if (domainFilter && event.domain_name !== domainFilter) return false;
		return true;
	});
</script>

<main>
	<div class="container">
		<header>
			<div>
				<h1>Panel de Administración</h1>
				<p class="subtitle">Control Horario - Vista de Administrador</p>
			</div>
			<a href="/" class="back-link">← Volver al inicio</a>
		</header>

		<div class="tabs">
			<button
				class="tab"
				class:active={currentTab === 'events'}
				on:click={() => (currentTab = 'events')}
			>
				Registros de Fichajes
			</button>
			<button
				class="tab"
				class:active={currentTab === 'users'}
				on:click={() => (currentTab = 'users')}
			>
				Usuarios
			</button>
		</div>

		{#if currentTab === 'events'}
			<div class="filters-section">
				<h3 class="filters-title">Filtros de Búsqueda</h3>
				<div class="filters">
					<div class="filter-group">
						<label for="user">Usuario:</label>
						<select id="user" bind:value={selectedUserId}>
							<option value="">Todos los usuarios</option>
							{#each users as user}
								<option value={user.id}>{user.name} ({user.email})</option>
							{/each}
						</select>
					</div>
					<div class="filter-group">
						<label for="from">Desde:</label>
						<input type="date" id="from" bind:value={fromDate} />
					</div>
					<div class="filter-group">
						<label for="to">Hasta:</label>
						<input type="date" id="to" bind:value={toDate} />
					</div>
					<button on:click={loadEvents} disabled={loading}> Buscar </button>
				</div>

				<h3 class="filters-title">Filtros de Vista</h3>
				<div class="filters secondary">
					<div class="filter-group">
						<label for="eventType">Tipo de Evento:</label>
						<select id="eventType" bind:value={eventTypeFilter}>
							<option value="">Todos los eventos</option>
							<option value="in">Entrada</option>
							<option value="out">Salida</option>
							<option value="pause_start">Inicio Pausa</option>
							<option value="pause_end">Fin Pausa</option>
						</select>
					</div>
					<div class="filter-group">
						<label for="domain">Dominio:</label>
						<select id="domain" bind:value={domainFilter}>
							<option value="">Todos los dominios</option>
							{#each uniqueDomains as domain}
								<option value={domain}>{domain}</option>
							{/each}
						</select>
					</div>
					{#if eventTypeFilter || domainFilter}
						<button class="btn-clear" on:click={() => { eventTypeFilter = ''; domainFilter = ''; }}>
							Limpiar Filtros
						</button>
					{/if}
				</div>

				<div class="export-buttons">
					<button class="btn-export" on:click={() => exportData('csv')} disabled={loading}>
						Exportar CSV
					</button>
					<button class="btn-export" on:click={() => exportData('json')} disabled={loading}>
						Exportar JSON
					</button>
				</div>
			</div>

			{#if error}
				<div class="alert alert-error">{error}</div>
			{/if}

			{#if loading}
				<div class="loading">Cargando registros...</div>
			{:else if events.length === 0}
				<div class="empty">
					<p>No hay registros en el período seleccionado</p>
				</div>
			{:else}
				<div class="summary">
					<div class="summary-grid">
						<div class="summary-card">
							<span class="summary-label">Total de registros</span>
							<span class="summary-value">{events.length}</span>
						</div>
						<div class="summary-card">
							<span class="summary-label">Mostrando</span>
							<span class="summary-value">{filteredEvents.length}</span>
						</div>
						<div class="summary-card">
							<span class="summary-label">Usuarios</span>
							<span class="summary-value">{new Set(events.map(e => e.user_id)).size}</span>
						</div>
						<div class="summary-card">
							<span class="summary-label">Dominios</span>
							<span class="summary-value">{uniqueDomains.length}</span>
						</div>
					</div>
				</div>

				<div class="table-container">
					<table>
						<thead>
							<tr>
								<th>Trabajador</th>
								<th>Tipo</th>
								<th>Fecha y Hora</th>
								<th>Dominio ID</th>
								<th>Dominio</th>
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
									<td>{formatDateTime(event.ts)}</td>
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
					<h3>Gestión de Usuarios</h3>
					<div class="users-summary">
						<div class="summary-pill">
							<span class="pill-label">Total:</span>
							<span class="pill-value">{users.length}</span>
						</div>
						<div class="summary-pill">
							<span class="pill-label">Activos:</span>
							<span class="pill-value">{users.filter(u => u.active).length}</span>
						</div>
						<div class="summary-pill">
							<span class="pill-label">Admins:</span>
							<span class="pill-value">{users.filter(u => u.role === 'admin').length}</span>
						</div>
					</div>
				</div>

				<div class="users-table-container">
					<table class="users-table">
						<thead>
							<tr>
								<th>Usuario</th>
								<th>Rol / Estado</th>
								<th>Dominio</th>
								<th>Actividad (30 días)</th>
								<th>Último Fichaje</th>
								<th>Registro</th>
							</tr>
						</thead>
						<tbody>
							{#each users as user}
								<tr class:inactive={!user.active}>
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
												{user.role === 'admin' ? 'Admin' : 'Trabajador'}
											</span>
											<span class="status-badge" class:active={user.active}>
												{user.active ? 'Activo' : 'Inactivo'}
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
													<span class="stat-label">Total:</span>
													<span class="stat-value">{userStats[user.id].totalEvents}</span>
												</div>
												<div class="stat-item">
													<span class="stat-label">Entradas:</span>
													<span class="stat-value">{userStats[user.id].entriesCount}</span>
												</div>
												<div class="stat-item">
													<span class="stat-label">Salidas:</span>
													<span class="stat-value">{userStats[user.id].exitsCount}</span>
												</div>
											</div>
										{:else}
											<span class="text-muted">Cargando...</span>
										{/if}
									</td>
									<td>
										{#if userStats[user.id]?.lastEvent}
											<div class="last-event-cell">
												<div class="last-event-time">
													{formatDateTime(userStats[user.id].lastEvent)}
												</div>
												<span class="event-type-small" style="background-color: {getEventColor(userStats[user.id].lastEventType)}">
													{getEventLabel(userStats[user.id].lastEventType)}
												</span>
											</div>
										{:else}
											<span class="text-muted">Sin fichajes</span>
										{/if}
									</td>
									<td>
										<div class="date-cell">
											{new Date(user.created_at).toLocaleDateString('es-ES')}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<div class="legal-footer">
			<a href="/privacy" class="legal-link">Política de Privacidad</a>
			<span class="separator">•</span>
			<a href="/legal" class="legal-link">Aviso Legal</a>
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
	}

	.users-table tbody tr:hover {
		background: #f9fafb;
	}

	.users-table tbody tr.inactive {
		opacity: 0.6;
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
