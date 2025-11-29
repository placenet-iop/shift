<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { translate, locale, formatDateTime as formatDateTimeStore } from '$lib/i18n';

	// Make translation function reactive
	let t = $derived.by(() => $translate);
	
	// Make formatDateTime reactive
	let formatDateTimeI18n = $derived.by(() => $formatDateTimeStore);

	// Initialize token as reactive state
	let token = $state('');
	let tokenChecked = $state(false); // Track if we've checked for token
	let tokenTransitioning = $state(false); // Track if we're transitioning between tokens
	let previousToken = $state(''); // Track previous token to detect transitions
	
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

	onMount(() => {
		if (browser) {
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

	async function loadStatus() {
		try {
			loading = true;
			error = '';

			// Decode token to check if user is admin and get user info
			const payload = decodeToken(token);
			if (payload) {
				isAdmin = payload.role === 'admin' || payload.domain_tags?.includes('admin') || payload.domain_tags?.includes('shift_admin');
				user = {
					name: payload.name || payload.avatar_name || 'User',
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
				error = data.error || t('messages.failedToLoadStatus');
			}
		} catch (e) {
			error = t('common.connectionError');
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
</script>

<main>
	<div class="container">
		<header>
			<h1>{t('common.appName')}</h1>
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
			<div class="login-section">
				<h2>{t('auth.restrictedAccess')}</h2>
				<p>{t('auth.restrictedMessage')}</p>
				<p class="info-text">
					{t('auth.restrictedInfo')}
				</p>
				<div class="dev-notice">
					<strong>{t('auth.devNotice')}</strong>
					<p>{t('auth.devInfo')}</p>
					<a href="/dev" class="dev-link">{t('auth.devLink')}</a>
					<p style="margin-top: 1rem; font-size: 0.875rem;">{t('auth.devManual')}</p>
					<code>window.__authToken = '{t('auth.tokenPlaceholder')}'; location.reload();</code>
				</div>
			</div>
		{:else}
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
					<h2>{t('status.currentStatus')}</h2>
					<div class="status-indicator">
						<span class="status-dot" style="background-color: {getStatusColor(status)}"></span>
						<span class="status-text">{getStatusText(status)}</span>
					</div>
					{#if latestEvent}
						<p class="last-event">
							{t('status.lastRecord')} {formatDateTime(latestEvent.ts)}
						</p>
					{/if}
				</div>

				<div class="actions">
					<h3>{t('common.actions')}</h3>
					<div class="button-grid">
						{#if status === 'clocked_out'}
							<button class="btn-primary" onclick={() => clockAction('in')} disabled={loading}>
								{t('buttons.clockIn')}
							</button>
						{:else if status === 'clocked_in'}
							<button class="btn-warning" onclick={() => clockAction('pause_start')} disabled={loading}>
								{t('buttons.startBreak')}
							</button>
							<button class="btn-danger" onclick={() => clockAction('out')} disabled={loading}>
								{t('buttons.clockOut')}
							</button>
						{:else if status === 'on_pause'}
							<button class="btn-success" onclick={() => clockAction('pause_end')} disabled={loading}>
								{t('buttons.resumeWork')}
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
					<a href="/history">{t('buttons.viewHistory')}</a>
					{#if isAdmin}
						<a href="/admin" class="admin-link">{t('buttons.adminPanel')}</a>
					{/if}
				</div>

				<div class="legal-footer">
					<a href="/privacy" class="legal-link">{t('legal.privacyPolicy')}</a>
					<span class="separator">•</span>
					<a href="/legal" class="legal-link">{t('legal.legalNotice')}</a>
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

	.dev-link {
		display: inline-block;
		margin-top: 0.75rem;
		padding: 0.75rem 1.5rem;
		background: #2563eb;
		color: white;
		text-decoration: none;
		border-radius: 6px;
		font-weight: 500;
		transition: background 0.2s;
	}

	.dev-link:hover {
		background: #1d4ed8;
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

	.loading-spinner {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 2rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #e5e7eb;
		border-top-color: #667eea;
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
