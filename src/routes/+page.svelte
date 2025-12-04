<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { translate, locale, formatDateTime as formatDateTimeStore } from '$lib/i18n';
	import HistoryModal from '$lib/components/HistoryModal.svelte';

	// Make translation function reactive
	let t = $derived.by(() => $translate);

	// Make formatDateTime reactive
	let formatDateTimeI18n = $derived.by(() => $formatDateTimeStore);

	// Initialize token as reactive state
	let token = $state('');
	let tokenChecked = $state(false); // Track if we've checked for token
	let tokenTransitioning = $state(false); // Track if we're transitioning between tokens
	let previousToken = $state(''); // Track previous token to detect transitions

	// Theme colors from JWT/config
	let themeColors = $state({
		primary: '#635FE5', // Default color
		success: '#16a34a',
		warning: '#ea580c',
		danger: '#dc2626'
	});

	// Tenant branding (client logo)
	let tenantLogo = $state<string | null>(null);

	// User avatar
	let userAvatar = $state<string | null>(null);
	let userInitials = $state<string>('U');
	
	if (browser) {
		// Check URL first (in case layout hasn't processed it yet)
		const urlToken = new URLSearchParams(window.location.search).get('token');
		if (urlToken) {
			token = urlToken;
			previousToken = urlToken;
			(window as any).__authToken = urlToken;
			tokenChecked = true;
		} else {
			// Fall back to window.__authToken (set by +layout.svelte)
			const existingToken = (window as any).__authToken || '';
			if (existingToken) {
				token = existingToken;
				previousToken = existingToken;
				tokenChecked = true;
			} else {
				// Start with tokenChecked = false to show loading, not error
				// Will be set to true after checking
			}
		}
	}

	let user: any = $state(null);
	let isAdmin = $state(false);
	let status: 'clocked_out' | 'clocked_in' | 'on_pause' = $state('clocked_out');
	let latestEvent: any = $state(null);
	let loading = $state(false);
	let error = $state('');
	let success = $state('');
	let showPrivacyNotice = $state(false);
	let showConfirmDialog = $state(false);
	let pendingAction = $state<{ type: string; label: string } | null>(null);
	let showHistoryModal = $state(false);

	onMount(() => {
		if (browser) {
			// Load theme colors
			loadTheme();

			// Function to check and update token
			const checkToken = () => {
				const currentToken = (window as any).__authToken || '';
				// Also check URL as fallback
				const urlToken = new URLSearchParams(window.location.search).get('token');
				const tokenToUse = currentToken || urlToken || '';
				
				if (tokenToUse !== token) {
					// If we had a token before and now we don't, it might be a transition
					if (token && !tokenToUse) {
						// Token was removed - might be switching users
						// Set transitioning flag to show loading instead of error
						tokenTransitioning = true;
						previousToken = token;
						token = '';
						// Give a small delay to see if new token arrives
						setTimeout(() => {
							const recheckToken = (window as any).__authToken || '';
							if (!recheckToken) {
								tokenTransitioning = false;
								tokenChecked = true;
							} else {
								token = recheckToken;
								previousToken = recheckToken;
								tokenTransitioning = false;
								tokenChecked = true;
								loadStatus();
							}
						}, 300);
					} else if (!token && tokenToUse) {
						// Token was just set (initial load or new token arrived)
						token = tokenToUse;
						previousToken = tokenToUse;
						tokenTransitioning = false;
						tokenChecked = true;
						// Update window.__authToken if we got it from URL
						if (urlToken && !currentToken) {
							(window as any).__authToken = urlToken;
						}
						loadStatus();
					} else if (token && tokenToUse && token !== tokenToUse) {
						// Token changed to a different one (user switch)
						previousToken = token;
						token = tokenToUse;
						tokenTransitioning = false;
						tokenChecked = true;
						loadStatus();
					}
				} else if (!tokenChecked) {
					// Mark as checked even if no token found (to prevent flicker)
					// But only after we've given time for postMessage
					if (token) {
						tokenChecked = true;
					} else {
						// Wait a bit longer for initial token check
						// Don't set tokenChecked immediately - wait for postMessage
						setTimeout(() => {
							const finalCheck = (window as any).__authToken || '';
							if (finalCheck) {
								// Token arrived during wait
								token = finalCheck;
								previousToken = finalCheck;
								tokenChecked = true;
								loadStatus();
							} else {
								// No token found after waiting
								tokenChecked = true;
							}
						}, 500);
					}
				}
			};

			// Check immediately
			checkToken();

			// Listen for token updates from +layout.svelte (postMessage)
			const tokenInterval = setInterval(checkToken, 100);

			// Also listen for postMessage events directly
			const handleMessage = (event: MessageEvent) => {
				if (event.data?.type === 'auth' && event.data.token) {
					(window as any).__authToken = event.data.token;
					// If we're transitioning or haven't checked yet, keep loading state
					if (tokenTransitioning || !tokenChecked) {
						// Token is arriving - update immediately
						token = event.data.token;
						previousToken = event.data.token;
						tokenTransitioning = false;
						tokenChecked = true;
						loadStatus();
					} else {
						// Normal token update
						checkToken();
					}
				}
			};

			window.addEventListener('message', handleMessage);

			// If we have a token, load status immediately
			if (token) {
				loadStatus();
			}

			// Check if user has seen privacy notice (still use localStorage for this preference)
			const hasSeenPrivacyNotice = localStorage.getItem('privacy_notice_seen');
			if (!hasSeenPrivacyNotice && token) {
				showPrivacyNotice = true;
			}

			return () => {
				clearInterval(tokenInterval);
				window.removeEventListener('message', handleMessage);
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

	async function loadTheme() {
		try {
			const response = await fetch('/api/config/theme');
			const data = await response.json();
			if (data.success && data.theme) {
				themeColors = {
					primary: data.theme.primary_color || '#635FE5',
					success: data.theme.success_color || '#16a34a',
					warning: data.theme.warning_color || '#ea580c',
					danger: data.theme.danger_color || '#dc2626'
				};
				updateCSSVariables();
			}
		} catch (e) {
			console.error('Failed to load theme:', e);
		}
	}

	function getInitials(name: string): string {
		if (!name) return 'U';
		const parts = name.split(' ').filter(p => p.length > 0);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		}
		return name.substring(0, 2).toUpperCase();
	}

	function updateCSSVariables() {
		if (browser) {
			document.documentElement.style.setProperty('--color-primary', themeColors.primary);
			document.documentElement.style.setProperty('--color-success', themeColors.success);
			document.documentElement.style.setProperty('--color-warning', themeColors.warning);
			document.documentElement.style.setProperty('--color-danger', themeColors.danger);
		}
	}

	function extractTenantInfo(payload: any) {
		if (payload) {
			// Extract user avatar
			if (payload.avatar_image) {
				userAvatar = payload.avatar_image;
			}

			// Extract user initials
			const name = payload.name || payload.avatar_name || 'User';
			userInitials = getInitials(name);

			// Read from JWT ui object
			if (payload.ui) {
				// Read color from ui.color
				if (payload.ui.color) {
					themeColors.primary = payload.ui.color;
					updateCSSVariables();
				}

				// Read tenant logo from ui.logo (future implementation)
				if (payload.ui.logo) {
					tenantLogo = payload.ui.logo;
				}
			}
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
					name: payload.name || 'User',
					avatarId: payload.avatarId || '',
					domainId: payload.domainId,
					domain_name: payload.domain_name
				};

				// Extract tenant branding and user avatar info
				extractTenantInfo(payload);
			}

			const response = await fetch('/api/time/status');

			const data = await response.json();

			if (data.success) {
				status = data.status;
				latestEvent = data.latestEvent;
			} else {
				error = data.error || t('messages.failedToLoadStatus');
			}
		} catch (e) {
			error = t('common.connectionError');
		} finally {
			loading = false;
		}
	}

	function requestClockAction(eventType: 'in' | 'out' | 'pause_start' | 'pause_end') {
		const labels: Record<string, string> = {
			in: t('buttons.clockIn'),
			out: t('buttons.clockOut'),
			pause_start: t('buttons.startBreak'),
			pause_end: t('buttons.resumeWork')
		};

		pendingAction = { type: eventType, label: labels[eventType] || eventType };
		showConfirmDialog = true;
	}

	function cancelAction() {
		showConfirmDialog = false;
		pendingAction = null;
	}

	async function confirmAction() {
		if (!pendingAction) return;

		showConfirmDialog = false;
		const eventType = pendingAction.type as 'in' | 'out' | 'pause_start' | 'pause_end';
		pendingAction = null;

		await clockAction(eventType);
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
				success = t('messages.timeRecorded');
				await loadStatus();
			} else {
				error = data.error || t('messages.failedToClock');
			}
		} catch (e) {
			error = t('common.connectionError');
		} finally {
			loading = false;
		}
	}

	function getStatusText(s: string): string {
		const texts: Record<string, string> = {
			clocked_out: t('status.clockedOut'),
			clocked_in: t('status.clockedIn'),
			on_pause: t('status.onBreak')
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
		return formatDateTimeI18n(isoDate, {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	// Real-time counter logic
	let elapsedTime = $state(0); // in seconds
	let counterInterval: ReturnType<typeof setInterval> | null = null;

	function updateCounter() {
		if (!latestEvent) {
			elapsedTime = 0;
			return;
		}

		const eventTime = new Date(latestEvent.ts).getTime();
		const now = Date.now();
		const diff = Math.floor((now - eventTime) / 1000); // seconds
		elapsedTime = diff;
	}

	function formatElapsedTime(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	$effect(() => {
		// Start or stop counter based on status
		if (counterInterval) {
			clearInterval(counterInterval);
			counterInterval = null;
		}

		if (status === 'clocked_in' || status === 'on_pause') {
			updateCounter();
			counterInterval = setInterval(updateCounter, 1000);
		} else {
			elapsedTime = 0;
		}

		return () => {
			if (counterInterval) {
				clearInterval(counterInterval);
			}
		};
	});
</script>

<main>
	<div class="container">
		<header>
			<div class="tenant-logo-container">
				{#if tenantLogo}
					<img src={tenantLogo} alt="Client Logo" class="tenant-logo" />
				{:else}
					<img src="/Bourgeois-Fincas.png" alt="Bourgeois Fincas" class="tenant-logo" />
				{/if}
			</div>
			<p class="subtitle">{t('common.subtitle')}</p>
		</header>

		{#if !tokenChecked || tokenTransitioning}
			<!-- Show loading state while checking for token to prevent flicker -->
			<div class="login-section">
				<div class="loading-spinner">
					<div class="spinner"></div>
					<p>{t('common.loading')}</p>
				</div>
			</div>
		{:else if !token}
			<div class="loading-screen">
				<div class="loading-content">
					<div class="loading-spinner">
						<div class="spinner-ring"></div>
						<div class="spinner-ring"></div>
						<div class="spinner-ring"></div>
					</div>
					<h2 class="loading-title">{t('common.loading') || 'Cargando'}</h2>
					<p class="loading-text">Esperando autenticación desde el sistema...</p>
				</div>
			</div>
		{:else}
			<!-- Confirmation Dialog -->
			{#if showConfirmDialog && pendingAction}
				<div class="confirm-overlay" onclick={cancelAction}>
					<div class="confirm-dialog" onclick={(e) => e.stopPropagation()}>
						<h3>Confirmar Acción</h3>
						<p>¿Estás seguro de que deseas <strong>{pendingAction.label}</strong>?</p>
						<div class="confirm-actions">
							<button class="btn-cancel" onclick={cancelAction}>Cancelar</button>
							<button class="btn-confirm" data-action-type={pendingAction.type} onclick={confirmAction}>Confirmar</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Privacy Notice Modal -->
			{#if showPrivacyNotice}
				<div class="modal-overlay">
					<div class="modal-content">
						<h2>{t('privacy.title')}</h2>
						<div class="modal-body">
							<p>
								{t('privacy.welcome')}
							</p>

							<h3>{t('privacy.whatData')}</h3>
							<ul>
								<li>{t('privacy.dataList.identification')}</li>
								<li>{t('privacy.dataList.timeRecords')}</li>
								<li>{t('privacy.dataList.technical')}</li>
							</ul>

							<h3>{t('privacy.whatFor')}</h3>
							<p>
								{t('privacy.whatForText')}
							</p>

							<h3>{t('privacy.yourRights')}</h3>
							<p>{t('privacy.rightsText')}</p>
							<ul>
								<li><strong>{t('privacy.rightsList.access')}</strong></li>
								<li><strong>{t('privacy.rightsList.rectification')}</strong></li>
								<li><strong>{t('privacy.rightsList.portability')}</strong></li>
							</ul>

							<p class="important-note">
								{t('privacy.importantNote')}
							</p>

							<div class="modal-footer">
								<a href="/privacy" target="_blank" class="link-privacy">{t('privacy.viewFullPolicy')}</a>
								<button class="btn-accept" onclick={acceptPrivacyNotice}>
									{t('privacy.readAndUnderstand')}
								</button>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<div class="status-section">
				<!-- Top Section: Counter and User Badge (Same Row) -->
				<div class="top-info-bar">
					<!-- Left: Clock/Counter -->
					<div class="counter-display">
						<div class="counter-icon">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<circle cx="12" cy="12" r="10"></circle>
								<polyline points="12 6 12 12 16 14"></polyline>
							</svg>
						</div>
						<div class="counter-info">
							{#if status === 'clocked_in' || status === 'on_pause'}
								<div class="counter-time">{formatElapsedTime(elapsedTime)}</div>
								<div class="counter-label">
									{#if status === 'clocked_in'}
										{t('status.working')}
									{:else}
										{t('status.onBreak')}
									{/if}
								</div>
							{:else}
								<div class="counter-time">--:--:--</div>
								<div class="counter-label">{t('status.inactive')}</div>
							{/if}
						</div>
					</div>

					<!-- Right: User Badge (Discrete) -->
					{#if user}
						<div class="user-badge-compact">
							<div class="user-badge-avatar-small">
								{userInitials}
							</div>
							<div class="user-badge-name-small">{user.name || '-'}</div>
						</div>
					{/if}
				</div>

				<!-- Status Card (Clear Visual Distinction) -->
				<div class="status-display-card">
					<div class="status-label">Estado actual</div>
					<div class="status-value" style="color: {getStatusColor(status)}">
						<span class="status-dot-large" style="background-color: {getStatusColor(status)}"></span>
						{getStatusText(status)}
					</div>
					{#if latestEvent}
						<div class="status-time-info">
							Último registro: {formatDateTime(latestEvent.ts)}
						</div>
					{/if}
				</div>

				<!-- Action Buttons -->
				<div class="actions">
					<div class="button-grid">
						{#if status === 'clocked_out'}
							<button class="btn-primary btn-large" onclick={() => requestClockAction('in')} disabled={loading}>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M12 2v20M2 12h20" />
								</svg>
								{t('buttons.clockIn')}
							</button>
						{:else if status === 'clocked_in'}
							<button class="btn-warning" onclick={() => requestClockAction('pause_start')} disabled={loading}>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="6" y="4" width="4" height="16"></rect>
									<rect x="14" y="4" width="4" height="16"></rect>
								</svg>
								{t('buttons.startBreak')}
							</button>
							<button class="btn-danger" onclick={() => requestClockAction('out')} disabled={loading}>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
								</svg>
								{t('buttons.clockOut')}
							</button>
						{:else if status === 'on_pause'}
							<button class="btn-success" onclick={() => requestClockAction('pause_end')} disabled={loading}>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polygon points="5 3 19 12 5 21 5 3"></polygon>
								</svg>
								{t('buttons.resumeWork')}
							</button>
							<button class="btn-danger" onclick={() => requestClockAction('out')} disabled={loading}>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
								</svg>
								{t('buttons.clockOut')}
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

				<!-- History and Admin Links -->
				<div class="footer-actions">
					<button class="history-btn" onclick={() => (showHistoryModal = true)}>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
							<line x1="16" y1="2" x2="16" y2="6"></line>
							<line x1="8" y1="2" x2="8" y2="6"></line>
							<line x1="3" y1="10" x2="21" y2="10"></line>
						</svg>
						{t('buttons.viewHistory')}
					</button>
					{#if isAdmin}
						<a href="/admin" class="admin-link">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M12 2L2 7l10 5 10-5-10-5z"></path>
								<path d="M2 17l10 5 10-5"></path>
								<path d="M2 12l10 5 10-5"></path>
							</svg>
							{t('buttons.adminPanel')}
						</a>
					{/if}
				</div>

				<div class="legal-footer">
					<a href="/privacy" class="legal-link">{t('legal.privacyPolicy')}</a>
					<span class="separator">•</span>
					<a href="/legal" class="legal-link">{t('legal.legalNotice')}</a>
				</div>
			</div>
		{/if}

		<!-- History Modal -->
		<HistoryModal bind:show={showHistoryModal} onClose={() => (showHistoryModal = false)} />
	</div>
</main>

<style>
	:global(:root) {
		--color-primary: #667eea;
		--color-success: #16a34a;
		--color-warning: #ea580c;
		--color-danger: #dc2626;
	}

	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: #ffffff;
		min-height: 100vh;
	}

	main {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.container {
		max-width: 480px;
		width: 100%;
	}

	header {
		text-align: center;
		margin-bottom: 2.5rem;
		animation: fadeInDown 0.6s ease-out;
	}

	.tenant-logo-container {
		display: flex;
		justify-content: center;
		align-items: center;
		margin-bottom: 1.5rem;
		margin-top: 1.5rem;
	}

	.tenant-logo {
		max-width: 180px;
		max-height: 60px;
		object-fit: contain;
		animation: fadeIn 0.6s ease-out;
	}

	.logo-placeholder {
		animation: fadeIn 0.6s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	h1 {
		font-size: 2rem;
		color: var(--color-primary);
		margin: 0 0 0.5rem 0;
		font-weight: 700;
		letter-spacing: -0.5px;
	}

	.subtitle {
		color: #6b7280;
		margin: 0;
		font-size: 0.95rem;
		font-weight: 500;
	}

	@keyframes fadeInDown {
		from {
			opacity: 0;
			transform: translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes scaleIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.login-section {
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(20px);
		padding: 2.5rem;
		border-radius: 24px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
		text-align: center;
		animation: scaleIn 0.5s ease-out;
	}

	.login-section h2 {
		margin-top: 0;
		color: #111827;
		font-weight: 700;
		font-size: 1.75rem;
	}

	.info-text {
		color: #6b7280;
		margin: 1rem 0;
		font-weight: 500;
	}

	.dev-notice {
		margin-top: 2rem;
		padding: 1.5rem;
		background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
		border-left: 4px solid #f59e0b;
		border-radius: 16px;
		text-align: left;
		box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
	}

	.dev-notice strong {
		color: #92400e;
		font-size: 1.1rem;
	}

	.dev-notice p {
		font-size: 0.9rem;
		color: #78350f;
		margin: 0.5rem 0;
		font-weight: 500;
	}

	.dev-notice code {
		display: block;
		margin-top: 0.75rem;
		padding: 0.75rem;
		background: white;
		border-radius: 8px;
		font-size: 0.8rem;
		color: #1f2937;
		overflow-x: auto;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}

	.dev-link {
		display: inline-block;
		margin-top: 1rem;
		padding: 0.9rem 1.75rem;
		background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
		color: white;
		text-decoration: none;
		border-radius: 12px;
		font-weight: 600;
		transition: all 0.3s;
		box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
	}

	.dev-link:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
	}

	.status-section {
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(20px);
		padding: 2rem;
		border-radius: 24px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 1px rgba(255, 255, 255, 0.5) inset;
		animation: scaleIn 0.5s ease-out;
		animation-delay: 0.2s;
		animation-fill-mode: backwards;
	}

	.top-info-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
		animation: fadeInUp 0.6s ease-out;
		animation-delay: 0.3s;
		animation-fill-mode: backwards;
	}

	.counter-display {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1.25rem 1.5rem;
		background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
		border-radius: 16px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
		flex: 1;
	}

	.counter-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: var(--color-primary);
		border-radius: 12px;
		color: white;
		flex-shrink: 0;
	}

	.counter-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.counter-time {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
		letter-spacing: -0.5px;
		line-height: 1;
	}

	.counter-label {
		font-size: 0.75rem;
		color: #6b7280;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.user-badge-compact {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(0, 0, 0, 0.03);
		border-radius: 12px;
		flex-shrink: 0;
	}

	.user-badge-avatar-small {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: #e5e7eb;
		color: #6b7280;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		font-weight: 600;
		flex-shrink: 0;
	}

	.user-badge-name-small {
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.status-display-card {
		padding: 1.25rem 1.5rem;
		background: linear-gradient(135deg, #fafafa 0%, #ffffff 100%);
		border-radius: 16px;
		margin-bottom: 1.5rem;
		border: 2px solid rgba(0, 0, 0, 0.06);
		animation: fadeInUp 0.6s ease-out;
		animation-delay: 0.4s;
		animation-fill-mode: backwards;
	}

	.status-label {
		font-size: 0.75rem;
		color: #9ca3af;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 0.5rem;
	}

	.status-value {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
	}

	.status-dot-large {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		flex-shrink: 0;
		box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.08);
	}

	.status-time-info {
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 500;
	}

	.user-info-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: var(--color-primary);
		border-radius: 16px;
		margin-bottom: 1.5rem;
		color: white;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
		animation: fadeInUp 0.6s ease-out;
		animation-delay: 0.3s;
		animation-fill-mode: backwards;
	}

	.user-avatar-container {
		flex-shrink: 0;
	}

	.user-avatar-img {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	.user-avatar-initials {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.25);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
		font-weight: 700;
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	.user-details-compact {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.user-name-display {
		display: flex;
		align-items: center;
	}

	.user-domain {
		display: flex;
		align-items: center;
	}

	.value-name {
		font-size: 1rem;
		font-weight: 700;
	}

	.value-domain {
		font-size: 0.85rem;
		opacity: 0.9;
		font-weight: 500;
	}

	.status-card {
		padding: 1.25rem;
		background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
		border-radius: 16px;
		margin-bottom: 1.5rem;
		border: 1px solid rgba(0, 0, 0, 0.05);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
		animation: fadeInUp 0.6s ease-out;
		animation-delay: 0.4s;
		animation-fill-mode: backwards;
	}

	.status-card h2 {
		margin: 0 0 1rem 0;
		font-size: 0.8rem;
		color: #6b7280;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.status-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		animation: pulse 2s infinite;
		flex-shrink: 0;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		position: relative;
	}

	.status-dot::before {
		content: '';
		position: absolute;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: inherit;
		opacity: 0.3;
		animation: ripple 2s infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.9;
			transform: scale(1.05);
		}
	}

	@keyframes ripple {
		0% {
			transform: scale(1);
			opacity: 0.3;
		}
		100% {
			transform: scale(1.8);
			opacity: 0;
		}
	}

	.status-text {
		font-size: 1.1rem;
		font-weight: 700;
		color: #111827;
		letter-spacing: -0.3px;
		flex: 1;
	}

	.last-event {
		color: #6b7280;
		font-size: 0.8rem;
		margin: 0;
		font-weight: 500;
	}

	.actions h3 {
		margin: 0 0 1.5rem 0;
		color: #374151;
		font-size: 0.95rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.button-grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		animation: fadeInUp 0.6s ease-out;
		animation-delay: 0.5s;
		animation-fill-mode: backwards;
	}

	button {
		padding: 1rem 1.5rem;
		border: none;
		border-radius: 16px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		overflow: hidden;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
		letter-spacing: 0.3px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	button svg {
		flex-shrink: 0;
	}

	.btn-large {
		grid-column: 1 / -1;
		padding: 1.25rem 2rem;
		font-size: 1.1rem;
	}

	button::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0;
		height: 0;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.3);
		transform: translate(-50%, -50%);
		transition: width 0.6s, height 0.6s;
	}

	button:active::before {
		width: 300px;
		height: 300px;
	}

	button:hover:not(:disabled) {
		transform: translateY(-3px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
	}

	button:active:not(:disabled) {
		transform: translateY(-1px);
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none !important;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		filter: brightness(0.9);
	}

	.btn-warning {
		background: var(--color-warning);
		color: white;
	}

	.btn-warning:hover:not(:disabled) {
		filter: brightness(0.9);
	}

	.btn-danger {
		background: var(--color-danger);
		color: white;
	}

	.btn-danger:hover:not(:disabled) {
		filter: brightness(0.9);
	}

	.btn-success {
		background: var(--color-success);
		color: white;
	}

	.btn-success:hover:not(:disabled) {
		filter: brightness(0.9);
	}

	.alert {
		padding: 1.25rem;
		border-radius: 16px;
		margin-top: 1.5rem;
		font-weight: 500;
		animation: fadeInUp 0.4s ease-out;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}

	.alert-error {
		background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
		color: #991b1b;
		border: 1px solid #fca5a5;
	}

	.alert-success {
		background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
		color: #065f46;
		border: 1px solid #6ee7b7;
	}

	.footer-actions {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		display: flex;
		gap: 1.5rem;
		align-items: center;
		justify-content: center;
		animation: fadeInUp 0.6s ease-out;
		animation-delay: 0.6s;
		animation-fill-mode: backwards;
	}

	.footer-actions a,
	.footer-actions .history-btn {
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
		transition: all 0.2s;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		background: transparent;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.footer-actions a:hover,
	.footer-actions .history-btn:hover {
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		transform: translateY(-1px);
	}

	.footer-actions svg {
		flex-shrink: 0;
	}

	.admin-link {
		color: var(--color-warning) !important;
		font-weight: 600 !important;
	}

	.admin-link:hover {
		background: color-mix(in srgb, var(--color-warning) 10%, transparent) !important;
	}

	.legal-footer {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(0, 0, 0, 0.06);
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		animation: fadeInUp 0.6s ease-out;
		animation-delay: 0.7s;
		animation-fill-mode: backwards;
	}

	.legal-link {
		color: #9ca3af;
		text-decoration: none;
		font-weight: 500;
		transition: all 0.2s;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.legal-link:hover {
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.separator {
		color: #d1d5db;
	}

	/* Confirmation Dialog */
	.confirm-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
		animation: fadeIn 0.2s ease-out;
	}

	.confirm-dialog {
		background: white;
		border-radius: 20px;
		padding: 2rem;
		max-width: 400px;
		width: 90%;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		animation: scaleIn 0.3s ease-out;
	}

	.confirm-dialog h3 {
		margin: 0 0 1rem 0;
		color: #111827;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.confirm-dialog p {
		margin: 0 0 2rem 0;
		color: #4b5563;
		font-size: 1rem;
		line-height: 1.6;
	}

	.confirm-dialog strong {
		color: var(--color-primary);
		font-weight: 700;
	}

	.confirm-actions {
		display: flex;
		gap: 1rem;
	}

	.btn-cancel {
		flex: 1;
		padding: 0.75rem 1.5rem;
		background: #f3f4f6;
		color: #374151;
		border: none;
		border-radius: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-cancel:hover {
		background: #e5e7eb;
	}

	.btn-confirm {
		flex: 1;
		padding: 0.75rem 1.5rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	/* Colores específicos según tipo de acción */
	.btn-confirm[data-action-type="in"],
	.btn-confirm[data-action-type="pause_end"] {
		background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
		box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
	}

	.btn-confirm[data-action-type="out"] {
		background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
		box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
	}

	.btn-confirm[data-action-type="pause_start"] {
		background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
		box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3);
	}

	.btn-confirm:hover {
		filter: brightness(1.1);
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}

	.btn-confirm:active {
		transform: translateY(0);
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
		background: var(--color-primary);
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
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 500;
		font-size: 0.875rem;
	}

	.link-privacy:hover {
		text-decoration: underline;
	}

	.btn-accept {
		background: var(--color-primary);
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
		filter: brightness(0.9);
	}

	.loading-spinner {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		padding: 3rem 2rem;
	}

	.spinner {
		width: 50px;
		height: 50px;
		border: 4px solid #e5e7eb;
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-spinner p {
		color: #6b7280;
		margin: 0;
		font-size: 1rem;
		font-weight: 500;
	}

	@media (max-width: 640px) {
		main {
			padding: 1rem;
		}

		.container {
			max-width: 100%;
		}

		h1 {
			font-size: 1.75rem;
		}

		.subtitle {
			font-size: 0.9rem;
		}

		.status-section {
			padding: 1.5rem;
			border-radius: 20px;
		}

		.top-info-bar {
			flex-wrap: wrap;
		}

		.counter-display {
			flex: 1;
			min-width: 200px;
		}

		.user-badge-compact {
			flex: 0 1 auto;
		}

		.user-badge-name-small {
			max-width: 100px;
		}

		.counter-time {
			font-size: 1.25rem;
		}

		.button-grid {
			grid-template-columns: 1fr;
		}

		button {
			padding: 1.1rem 1.5rem;
			font-size: 1.05rem;
		}

		.footer-actions {
			flex-direction: column;
			gap: 0.75rem;
		}

		.modal-footer {
			flex-direction: column;
			align-items: stretch;
		}

		.btn-accept {
			width: 100%;
		}

		.login-section {
			padding: 2rem;
		}
	}

	@media (max-width: 380px) {
		.status-section {
			padding: 1.25rem;
		}

		.counter-display {
			padding: 0.75rem 1rem;
		}

		.user-badge {
			padding: 0.75rem;
		}
	}

	/* Loading Screen */
	.loading-screen {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: #f9fafb;
		padding: 2rem;
	}

	.loading-content {
		text-align: center;
		max-width: 200px;
	}

	.loading-spinner {
		position: relative;
		width: 32px;
		height: 32px;
		margin: 0 auto 0.75rem;
	}

	.spinner-ring {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		border: 2px solid transparent;
		border-top-color: #635fe5;
		transform: translate(-50%, -50%);
		animation: spin 1s linear infinite;
	}

	.spinner-ring:nth-child(2) {
		width: 75%;
		height: 75%;
		border-top-color: rgba(99, 95, 229, 0.6);
		animation-delay: -0.33s;
	}

	.spinner-ring:nth-child(3) {
		width: 50%;
		height: 50%;
		border-top-color: rgba(99, 95, 229, 0.3);
		animation-delay: -0.66s;
	}

	@keyframes spin {
		0% {
			transform: translate(-50%, -50%) rotate(0deg);
		}
		100% {
			transform: translate(-50%, -50%) rotate(360deg);
		}
	}

	.loading-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
		color: #374151;
	}

	.loading-text {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0;
	}
</style>
