<script lang="ts">
	let email = 'test@example.com';
	let name = 'Test User';
	let role: 'worker' | 'admin' = 'worker';
	let token = '';
	let loading = false;
	let error = '';

	async function generateToken() {
		try {
			loading = true;
			error = '';
			token = '';

			const response = await fetch('/api/dev/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, name, role })
			});

			const data = await response.json();

			if (data.success) {
				token = data.token;
			} else {
				error = data.error || 'Failed to generate token';
			}
		} catch (e) {
			error = 'Connection error';
		} finally {
			loading = false;
		}
	}

	function copyToken() {
		navigator.clipboard.writeText(token);
		alert('Token copiado al portapapeles');
	}

	function goWithToken() {
		window.location.href = `/?token=${token}`;
	}
</script>

<main>
	<div class="container">
		<h1>🔧 Token Generator - Development Only</h1>
		<p class="subtitle">Genera tokens JWT para testing local</p>

		<div class="warning">
			⚠️ Este endpoint solo está disponible en desarrollo y será deshabilitado en producción.
		</div>

		<div class="form">
			<div class="form-group">
				<label for="email">Email:</label>
				<input type="email" id="email" bind:value={email} placeholder="usuario@ejemplo.com" />
			</div>

			<div class="form-group">
				<label for="name">Nombre:</label>
				<input type="text" id="name" bind:value={name} placeholder="Nombre Completo" />
			</div>

			<div class="form-group">
				<label for="role">Rol:</label>
				<select id="role" bind:value={role}>
					<option value="worker">Trabajador</option>
					<option value="admin">Administrador</option>
				</select>
			</div>

			<button class="btn-primary" on:click={generateToken} disabled={loading}>
				{loading ? 'Generando...' : 'Generar Token'}
			</button>
		</div>

		{#if error}
			<div class="alert alert-error">{error}</div>
		{/if}

		{#if token}
			<div class="result">
				<h3>Token Generado:</h3>
				<div class="token-box">
					<code>{token}</code>
				</div>
				<div class="actions">
					<button class="btn-secondary" on:click={copyToken}>📋 Copiar Token</button>
					<button class="btn-success" on:click={goWithToken}>▶️ Ir a la App</button>
				</div>

				<div class="quick-links">
					<h4>Links Rápidos:</h4>
					<ul>
						<li>
							<a href="/api/dev/token?email=worker@test.com&name=Trabajador Test&role=worker">
								Generar Worker
							</a>
						</li>
						<li>
							<a href="/api/dev/token?email=admin@test.com&name=Admin Test&role=admin">
								Generar Admin
							</a>
						</li>
					</ul>
				</div>
			</div>
		{/if}

		<div class="info">
			<h3>Uso desde consola:</h3>
			<pre><code>// Generar token
const res = await fetch('/api/dev/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    name: 'Test User',
    role: 'worker'
  })
});
const data = await res.json();
console.log(data.token);

// O simplemente:
localStorage.setItem('token', 'TU_TOKEN_AQUI');
window.location.reload();</code></pre>
		</div>

		<a href="/" class="back-link">← Volver a la app</a>
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
			sans-serif;
		background: #f3f4f6;
	}

	main {
		min-height: 100vh;
		padding: 2rem;
	}

	.container {
		max-width: 800px;
		margin: 0 auto;
		background: white;
		padding: 2rem;
		border-radius: 12px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	h1 {
		margin: 0 0 0.5rem 0;
		color: #111827;
	}

	.subtitle {
		color: #6b7280;
		margin: 0 0 2rem 0;
	}

	.warning {
		padding: 1rem;
		background: #fef3c7;
		border-left: 4px solid #f59e0b;
		border-radius: 4px;
		color: #92400e;
		margin-bottom: 2rem;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		font-weight: 600;
		color: #374151;
	}

	input,
	select {
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 1rem;
	}

	button {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: #2563eb;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.btn-secondary {
		background: #6b7280;
		color: white;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #4b5563;
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
		margin-bottom: 1rem;
	}

	.alert-error {
		background: #fee2e2;
		color: #991b1b;
		border: 1px solid #fecaca;
	}

	.result {
		margin-top: 2rem;
		padding: 1.5rem;
		background: #f9fafb;
		border-radius: 8px;
	}

	.result h3 {
		margin: 0 0 1rem 0;
		color: #111827;
	}

	.token-box {
		background: white;
		padding: 1rem;
		border-radius: 6px;
		border: 1px solid #d1d5db;
		margin-bottom: 1rem;
		overflow-x: auto;
	}

	.token-box code {
		font-size: 0.875rem;
		color: #1f2937;
		word-break: break-all;
	}

	.actions {
		display: flex;
		gap: 1rem;
	}

	.quick-links {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e5e7eb;
	}

	.quick-links h4 {
		margin: 0 0 0.75rem 0;
		color: #374151;
	}

	.quick-links ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.quick-links li {
		margin-bottom: 0.5rem;
	}

	.quick-links a {
		color: #2563eb;
		text-decoration: none;
	}

	.quick-links a:hover {
		text-decoration: underline;
	}

	.info {
		margin-top: 2rem;
		padding: 1.5rem;
		background: #f9fafb;
		border-radius: 8px;
	}

	.info h3 {
		margin: 0 0 1rem 0;
		color: #374151;
	}

	.info pre {
		background: #1f2937;
		color: #f3f4f6;
		padding: 1rem;
		border-radius: 6px;
		overflow-x: auto;
		margin: 0;
	}

	.info code {
		font-size: 0.875rem;
	}

	.back-link {
		display: inline-block;
		margin-top: 2rem;
		color: #2563eb;
		text-decoration: none;
		font-weight: 500;
	}

	.back-link:hover {
		text-decoration: underline;
	}
</style>
