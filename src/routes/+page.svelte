<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let token = '';
	let user: any = null;
	let isAdmin = false;
	let status: 'clocked_out' | 'clocked_in' | 'on_pause' = 'clocked_out';
	let latestEvent: any = null;
	let loading = false;
	let error = '';
	let success = '';
	let showPrivacyNotice = false;

	onMount(() => {
		if (browser) {
			// Load token from window.__authToken (set by +layout.svelte)
			token = (window as any).__authToken || '';

			// Listen for token updates from +layout.svelte
			const checkToken = () => {
				const currentToken = (window as any).__authToken || '';
				if (currentToken !== token) {
					token = currentToken;
					if (token) {
						loadStatus();
					}
				}
			};

			// Check token periodically (in case it's set after mount)
			const tokenInterval = setInterval(checkToken, 100);

			// Also check immediately
			checkToken();

			// Check if user has seen privacy notice (still use localStorage for this preference)
			const hasSeenPrivacyNotice = localStorage.getItem('privacy_notice_seen');
			if (!hasSeenPrivacyNotice && token) {
				showPrivacyNotice = true;
			}

			return () => {
				clearInterval(tokenInterval);
			};
		}
	});

	function acceptPrivacyNotice() {
		if (browser) {
			localStorage.setItem('privacy_notice_seen', 'true');
			showPrivacyNotice = false;
		}
	}

	function decodeToken(token: string) {
		try {
			const base64Url = token.split('.')[1];
			const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
			const jsonPayload = decodeURIComponent(
				atob(base64)
					.split('')
					.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
					.join('')
			);
			return JSON.parse(jsonPayload);
		} catch {
			return null;
		}
	}

	async function loadStatus() {
		try {
			loading = true;
			error = '';

			// Decode token to check if user is admin and get user info
			const payload = decodeToken(token);
			if (payload) {
				isAdmin = payload.role === 'admin' || payload.domain_tags?.includes('admin') || payload.domain_tags?.includes('shift_admin');
				user = {
					name: payload.name || payload.avatar_name || 'Usuario',
					email: payload.email || payload.avatar_email || '',
					domain_id: payload.domain_id,
					domain_name: payload.domain_name
				};
			}

			const response = await fetch('/api/time/status');

			const data = await response.json();

			if (data.success) {
				status = data.status;
				latestEvent = data.latestEvent;
			} else {
				error = data.error || 'Failed to load status';
			}
		} catch (e) {
			error = 'Connection error';
		} finally {
			loading = false;
		}
	}

	async function clockAction(eventType: 'in' | 'out' | 'pause_start' | 'pause_end') {
		try {
			loading = true;
			error = '';
			success = '';

			const response = await fetch('/api/time/clock', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ event_type: eventType })
			});

			const data = await response.json();

			if (data.success) {
				success = 'Fichaje registrado correctamente';
				await loadStatus();
			} else {
				error = data.error || 'Failed to clock';
			}
		} catch (e) {
			error = 'Connection error';
		} finally {
			loading = false;
		}
	}

	function getStatusText(s: string): string {
		const texts: Record<string, string> = {
			clocked_out: 'Fichado de Salida',
			clocked_in: 'Fichado de Entrada',
			on_pause: 'En Pausa'
		};
		return texts[s] || s;
	}

	function getStatusColor(s: string): string {
		const colors: Record<string, string> = {
			clocked_out: '#dc2626',
			clocked_in: '#16a34a',
			on_pause: '#ea580c'
		};
		return colors[s] || '#6b7280';
	}

	function formatDateTime(isoDate: string): string {
		if (!isoDate) return '';
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
</script>

<main>
	<div class="container">
		<header>
			<h1>Shift</h1>
			<p class="subtitle">Sistema de Registro de Jornada Laboral</p>
		</header>

		{#if !token}
			<div class="login-section">
				<h2>Acceso Restringido</h2>
				<p>Esta aplicación solo es accesible desde Placenet.</p>
				<p class="info-text">
					Si estás viendo este mensaje, necesitas acceder a través de tu cuenta de Placenet.
				</p>
				<div class="dev-notice">
					<strong>Desarrollo/Testing:</strong>
					<p>Para testing local, puedes añadir un token manualmente en la consola:</p>
					<code>window.__authToken = 'TU_TOKEN_JWT'; location.reload();</code>
				</div>
			</div>
		{:else}
			<!-- Privacy Notice Modal -->
			{#if showPrivacyNotice}
				<div class="modal-overlay">
					<div class="modal-content">
						<h2>Información sobre Protección de Datos</h2>
						<div class="modal-body">
							<p>
								Bienvenido/a al sistema de Control Horario Digital. Conforme al Reglamento General
								de Protección de Datos (RGPD), te informamos sobre el tratamiento de tus datos personales:
							</p>

							<h3>¿Qué datos recogemos?</h3>
							<ul>
								<li>Identificación: nombre y email</li>
								<li>Registros de jornada: entrada, salida y pausas con fecha/hora exacta</li>
								<li>Información técnica: dispositivo e IP de acceso</li>
							</ul>

							<h3>¿Para qué?</h3>
							<p>
								Para cumplir con la obligación legal de registro de jornada (Real Decreto-ley 8/2019).
								No se requiere tu consentimiento por tratarse de una obligación legal.
							</p>

							<h3>Tus derechos</h3>
							<p>Puedes ejercer tus derechos de:</p>
							<ul>
								<li><strong>Acceso:</strong> Consultar tus fichajes en "Ver Historial"</li>
								<li><strong>Rectificación:</strong> Solicitar corrección de datos inexactos</li>
								<li><strong>Portabilidad:</strong> Obtener copia de tus datos</li>
							</ul>

							<p class="important-note">
								Los registros se conservan durante 4 años y son inalterables para garantizar la
								transparencia y cumplimiento legal.
							</p>

							<div class="modal-footer">
								<a href="/privacy" target="_blank" class="link-privacy">Ver Política Completa</a>
								<button class="btn-accept" on:click={acceptPrivacyNotice}>
									He leído y entiendo
								</button>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<div class="status-section">
				{#if user}
					<div class="user-info-card">
						<div class="user-avatar">
							{user.name.charAt(0).toUpperCase()}
						</div>
						<div class="user-details">
							<h3>{user.name}</h3>
							{#if user.email}
								<p class="user-email">{user.email}</p>
							{/if}
							{#if user.domain_name}
								<div class="domain-info">
									<span class="domain-badge-main">
										{user.domain_name}
										{#if user.domain_id}
											<span class="domain-id-small">({user.domain_id})</span>
										{/if}
									</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<div class="status-card" style="border-left: 5px solid {getStatusColor(status)}">
					<h2>Estado Actual</h2>
					<div class="status-indicator">
						<span class="status-dot" style="background-color: {getStatusColor(status)}"></span>
						<span class="status-text">{getStatusText(status)}</span>
					</div>
					{#if latestEvent}
						<p class="last-event">
							Último fichaje: {formatDateTime(latestEvent.ts)}
						</p>
					{/if}
				</div>

				<div class="actions">
					<h3>Acciones</h3>
					<div class="button-grid">
						{#if status === 'clocked_out'}
							<button class="btn-primary" on:click={() => clockAction('in')} disabled={loading}>
								Fichar Entrada
							</button>
						{:else if status === 'clocked_in'}
							<button class="btn-warning" on:click={() => clockAction('pause_start')} disabled={loading}>
								Iniciar Pausa
							</button>
							<button class="btn-danger" on:click={() => clockAction('out')} disabled={loading}>
								Fichar Salida
							</button>
						{:else if status === 'on_pause'}
							<button class="btn-success" on:click={() => clockAction('pause_end')} disabled={loading}>
								Reanudar Trabajo
							</button>
						{/if}
					</div>
				</div>

				{#if error}
					<div class="alert alert-error">{error}</div>
				{/if}

				{#if success}
					<div class="alert alert-success">{success}</div>
				{/if}

				<div class="footer-actions">
					<a href="/history">Ver Historial</a>
					{#if isAdmin}
						<a href="/admin" class="admin-link">Panel de Administración</a>
					{/if}
				</div>

				<div class="legal-footer">
					<a href="/privacy" class="legal-link">Política de Privacidad</a>
					<span class="separator">•</span>
					<a href="/legal" class="legal-link">Aviso Legal</a>
				</div>
			</div>
		{/if}
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
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.container {
		max-width: 600px;
		width: 100%;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 2.5rem;
		color: #111827;
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		color: #6b7280;
		margin: 0;
	}

	.login-section {
		background: white;
		padding: 2rem;
		border-radius: 12px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		text-align: center;
	}

	.login-section h2 {
		margin-top: 0;
	}

	.info-text {
		color: #6b7280;
		margin: 1rem 0;
	}

	.dev-notice {
		margin-top: 2rem;
		padding: 1rem;
		background: #fef3c7;
		border-left: 4px solid #f59e0b;
		border-radius: 4px;
		text-align: left;
	}

	.dev-notice strong {
		color: #92400e;
	}

	.dev-notice p {
		font-size: 0.875rem;
		color: #78350f;
		margin: 0.5rem 0;
	}

	.dev-notice code {
		display: block;
		margin-top: 0.5rem;
		padding: 0.5rem;
		background: white;
		border-radius: 4px;
		font-size: 0.75rem;
		color: #1f2937;
		overflow-x: auto;
	}

	.status-section {
		background: white;
		padding: 2rem;
		border-radius: 12px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.user-info-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.5rem;
		background:  #667eea;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		color: white;
	}

	.user-avatar {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.75rem;
		font-weight: 700;
		border: 3px solid rgba(255, 255, 255, 0.3);
	}

	.user-details {
		flex: 1;
	}

	.user-details h3 {
		margin: 0 0 0.25rem 0;
		font-size: 1.5rem;
		color: white;
	}

	.user-email {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		opacity: 0.9;
	}

	.domain-info {
		margin-top: 0.5rem;
	}

	.domain-badge-main {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.75rem;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 600;
		backdrop-filter: blur(10px);
	}

	.domain-id-small {
		opacity: 0.8;
		font-weight: normal;
	}

	.status-card {
		padding: 1.5rem;
		background: #f9fafb;
		border-radius: 8px;
		margin-bottom: 2rem;
	}

	.status-card h2 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: #374151;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.status-dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.status-text {
		font-size: 1.5rem;
		font-weight: 600;
		color: #111827;
	}

	.last-event {
		color: #6b7280;
		font-size: 0.875rem;
		margin: 0;
	}

	.actions h3 {
		margin: 0 0 1rem 0;
		color: #374151;
	}

	.button-grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	}

	button {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	button:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: #667eea;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #667eea;
	}

	.btn-warning {
		background: #ea580c;
		color: white;
	}

	.btn-warning:hover:not(:disabled) {
		background: #c2410c;
	}

	.btn-danger {
		background: #dc2626;
		color: white;
	}

	.btn-danger:hover:not(:disabled) {
		background: #b91c1c;
	}

	.btn-success {
		background: #16a34a;
		color: white;
	}

	.btn-success:hover:not(:disabled) {
		background: #15803d;
	}

	.alert {
		padding: 1rem;
		border-radius: 8px;
		margin-top: 1rem;
	}

	.alert-error {
		background: #fee2e2;
		color: #991b1b;
		border: 1px solid #fecaca;
	}

	.alert-success {
		background: #dcfce7;
		color: #166534;
		border: 1px solid #bbf7d0;
	}

	.footer-actions {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e5e7eb;
		display: flex;
		gap: 1.5rem;
		align-items: center;
		justify-content: center;
	}

	.footer-actions a {
		color: #667eea;
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s;
	}

	.footer-actions a:hover {
		color: #5568d3;
		text-decoration: underline;
	}

	.admin-link {
		color: #ea580c !important;
		font-weight: 600 !important;
	}

	.admin-link:hover {
		color: #c2410c !important;
	}

	.legal-footer {
		margin-top: 1.5rem;
		padding-top: 1rem;
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

	/* Privacy Notice Modal */
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
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		background: white;
		border-radius: 12px;
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.modal-content h2 {
		background: #667eea;
		color: white;
		margin: 0;
		padding: 1.5rem;
		border-radius: 12px 12px 0 0;
		font-size: 1.5rem;
	}

	.modal-content h3 {
		color: #1f2937;
		font-size: 1.125rem;
		margin: 1.5rem 0 0.75rem 0;
	}

	.modal-body {
		padding: 1.5rem;
	}

	.modal-body p {
		color: #374151;
		line-height: 1.6;
		margin: 0 0 1rem 0;
	}

	.modal-body ul {
		margin: 0 0 1rem 0;
		padding-left: 1.5rem;
		color: #374151;
	}

	.modal-body li {
		margin-bottom: 0.5rem;
		line-height: 1.6;
	}

	.important-note {
		background: #fef3c7;
		border-left: 4px solid #f59e0b;
		padding: 1rem;
		border-radius: 4px;
		margin: 1.5rem 0;
		font-size: 0.875rem;
	}

	.modal-footer {
		display: flex;
		gap: 1rem;
		justify-content: space-between;
		align-items: center;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e5e7eb;
	}

	.link-privacy {
		color: #667eea;
		text-decoration: none;
		font-weight: 500;
		font-size: 0.875rem;
	}

	.link-privacy:hover {
		text-decoration: underline;
	}

	.btn-accept {
		background: #667eea;
		color: white;
		padding: 0.75rem 2rem;
		border: none;
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
		font-size: 1rem;
	}

	.btn-accept:hover {
		background: #5568d3;
	}

	@media (max-width: 640px) {
		.modal-footer {
			flex-direction: column;
			align-items: stretch;
		}

		.btn-accept {
			width: 100%;
		}
	}
</style>
