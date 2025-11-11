<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let token = '';
	let events: any[] = [];
	let loading = false;
	let error = '';
	let fromDate = '';
	let toDate = '';

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

			loadEvents();
		}
	});

	async function loadEvents() {
		try {
			loading = true;
			error = '';

			let url = '/api/time/events';
			const params = new URLSearchParams();

			if (fromDate) params.append('from', new Date(fromDate).toISOString());
			if (toDate) params.append('to', new Date(toDate + 'T23:59:59').toISOString());

			if (params.toString()) url += '?' + params.toString();

			const response = await fetch(url, {
				headers: { Authorization: `Bearer ${token}` }
			});

			const data = await response.json();

			if (data.success) {
				events = data.events;
			} else {
				error = data.error || 'Failed to load events';
			}
		} catch (e) {
			error = 'Connection error';
		} finally {
			loading = false;
		}
	}

	function formatDateTime(isoDate: string): string {
		const date = new Date(isoDate);
		return date.toLocaleString('es-ES', {
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

	function groupEventsByDate(evts: any[]): Record<string, any[]> {
		const grouped: Record<string, any[]> = {};
		evts.forEach((event) => {
			const date = event.ts.split('T')[0];
			if (!grouped[date]) grouped[date] = [];
			grouped[date].push(event);
		});
		return grouped;
	}

	$: groupedEvents = groupEventsByDate(events);
	$: sortedDates = Object.keys(groupedEvents).sort().reverse();
</script>

<main>
	<div class="container">
		<header>
			<h1>Historial de Fichajes</h1>
			<a href="/" class="back-link">← Volver al inicio</a>
		</header>

		<div class="filters">
			<div class="filter-group">
				<label for="from">Desde:</label>
				<input type="date" id="from" bind:value={fromDate} />
			</div>
			<div class="filter-group">
				<label for="to">Hasta:</label>
				<input type="date" id="to" bind:value={toDate} />
			</div>
			<button on:click={loadEvents} disabled={loading}>
				{loading ? 'Cargando...' : 'Buscar'}
			</button>
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
				<div class="summary-info">
					<p>Total de registros: <strong>{events.length}</strong></p>
					{#if events.length > 0 && events[0].user_name}
						<p>Trabajador: <strong>{events[0].user_name}</strong></p>
					{/if}
					{#if events.length > 0 && events[0].domain_name}
						<p>Dominio: <strong>{events[0].domain_name}</strong> ({events[0].domain_id || '-'})</p>
					{/if}
				</div>
			</div>

			<div class="events-list">
				{#each sortedDates as date}
					<div class="date-group">
						<h3 class="date-header">
							{new Date(date).toLocaleDateString('es-ES', {
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
											{new Date(event.ts).toLocaleTimeString('es-ES', {
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

	input[type='date'] {
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
