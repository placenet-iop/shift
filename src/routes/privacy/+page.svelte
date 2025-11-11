<script lang="ts">
	import { browser } from '$app/environment';

	let lastUpdate = '2025-01-11';
</script>

<main>
	<div class="container">
		<header>
			<h1>Política de Privacidad</h1>
			<p class="last-update">Última actualización: {lastUpdate}</p>
		</header>

		<div class="content">
			<section>
				<h2>1. Responsable del Tratamiento</h2>
				<p>
					El responsable del tratamiento de los datos personales recogidos a través del sistema de
					Control Horario (en adelante, "Shift") es la empresa empleadora, que actúa conforme a
					la obligación legal establecida en el Real Decreto-ley 8/2019.
				</p>
			</section>

			<section>
				<h2>2. Finalidad del Tratamiento</h2>
				<p>Los datos personales se recogen exclusivamente para:</p>
				<ul>
					<li>Cumplir con la obligación legal de registro de jornada laboral (RD-ley 8/2019)</li>
					<li>Gestionar el control horario de los trabajadores</li>
					<li>Facilitar información a la Inspección de Trabajo cuando sea requerido</li>
					<li>Garantizar los derechos laborales de los trabajadores</li>
				</ul>
			</section>

			<section>
				<h2>3. Legitimación</h2>
				<p>
					El tratamiento de datos se basa en el <strong>cumplimiento de una obligación legal</strong>
					(artículo 6.1.c del RGPD), específicamente el artículo 34.9 del Estatuto de los Trabajadores,
					modificado por el Real Decreto-ley 8/2019.
				</p>
				<p>
					Por tratarse de una obligación legal, <strong>no se requiere consentimiento</strong> del
					trabajador para este tratamiento.
				</p>
			</section>

			<section>
				<h2>4. Datos Recogidos</h2>
				<p>El sistema recoge únicamente los datos necesarios para el registro de jornada:</p>
				<ul>
					<li><strong>Identificación:</strong> Nombre, email (procedente de Placenet)</li>
					<li><strong>Dominio/Empresa:</strong> Domain ID, nombre del dominio</li>
					<li><strong>Eventos de fichaje:</strong> Tipo (entrada/salida/pausa), fecha y hora exacta (UTC)</li>
					<li><strong>Información técnica:</strong> Dirección IP, dispositivo utilizado (web/móvil), navegador</li>
				</ul>
				<p class="note">
					<strong>Nota:</strong> NO se recogen datos biométricos ni información sensible adicional.
				</p>
			</section>

			<section>
				<h2>5. Conservación de Datos</h2>
				<p>
					Los registros de jornada se conservan durante un mínimo de <strong>4 años</strong>,
					conforme a lo establecido en el artículo 34.9 del Estatuto de los Trabajadores.
				</p>
				<p>
					Transcurrido este período, los datos podrán conservarse durante el tiempo necesario
					para atender posibles responsabilidades legales.
				</p>
			</section>

			<section>
				<h2>6. Destinatarios de los Datos</h2>
				<p>Los datos pueden ser comunicados a:</p>
				<ul>
					<li><strong>Inspección de Trabajo y Seguridad Social:</strong> cuando lo requiera en ejercicio de sus funciones</li>
					<li><strong>Representantes legales de los trabajadores:</strong> cuando sea necesario</li>
					<li><strong>Autoridades judiciales:</strong> en caso de requerimiento judicial</li>
				</ul>
				<p>No se realizarán transferencias internacionales de datos.</p>
			</section>

			<section>
				<h2>7. Derechos de los Trabajadores</h2>
				<p>Como trabajador, tienes derecho a:</p>
				<ul>
					<li><strong>Acceso:</strong> Consultar tus registros de jornada en cualquier momento (sección "Ver Historial")</li>
					<li><strong>Rectificación:</strong> Solicitar la corrección de datos inexactos</li>
					<li><strong>Supresión:</strong> Limitado por la obligación legal de conservación de 4 años</li>
					<li><strong>Limitación del tratamiento:</strong> En casos específicos previstos por ley</li>
					<li><strong>Portabilidad:</strong> Obtener una copia de tus datos en formato estructurado</li>
					<li><strong>Oposición:</strong> Limitado por tratarse de obligación legal</li>
				</ul>
				<p>
					Para ejercer estos derechos, contacta con el departamento de Recursos Humanos de tu empresa.
				</p>
			</section>

			<section>
				<h2>8. Seguridad de los Datos</h2>
				<p>Se han implementado las siguientes medidas de seguridad:</p>
				<ul>
					<li>Autenticación mediante tokens JWT cifrados</li>
					<li>Control de acceso basado en roles (trabajador/administrador)</li>
					<li>Registros inalterables (no se pueden modificar ni eliminar sin trazabilidad)</li>
					<li>Almacenamiento cifrado en base de datos</li>
					<li>Registro de auditoría de accesos administrativos</li>
					<li>Backups periódicos con cifrado</li>
				</ul>
			</section>

			<section>
				<h2>9. Derecho a Reclamar</h2>
				<p>
					Si consideras que el tratamiento de tus datos no se ajusta a la normativa, puedes
					presentar una reclamación ante la <strong>Agencia Española de Protección de Datos (AEPD)</strong>:
				</p>
				<ul>
					<li>Web: <a href="https://www.aepd.es" target="_blank">www.aepd.es</a></li>
					<li>Dirección: C/ Jorge Juan, 6, 28001 Madrid</li>
					<li>Teléfono: 901 100 099 / 912 663 517</li>
				</ul>
			</section>

			<section>
				<h2>10. Derecho a la Desconexión Digital</h2>
				<p>
					El uso del sistema de control horario respeta el derecho a la desconexión digital
					fuera del horario laboral establecido, conforme a la Ley Orgánica 3/2018.
				</p>
				<p>
					El trabajador no está obligado a responder comunicaciones ni realizar fichajes fuera
					de su jornada laboral, salvo circunstancias excepcionales debidamente justificadas.
				</p>
			</section>

			<section>
				<h2>11. Modificaciones</h2>
				<p>
					Esta Política de Privacidad puede ser actualizada para adaptarse a cambios normativos
					o mejoras del sistema. Se notificará a los trabajadores de cualquier cambio significativo.
				</p>
			</section>
		</div>

		<div class="footer-actions">
			<a href="/">← Volver al inicio</a>
			<a href="/legal">Ver Aviso Legal</a>
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
		background: white;
		padding: 3rem;
		border-radius: 12px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	header {
		margin-bottom: 3rem;
		padding-bottom: 1.5rem;
		border-bottom: 2px solid #e5e7eb;
	}

	h1 {
		font-size: 2.5rem;
		color: #111827;
		margin: 0 0 0.5rem 0;
	}

	.last-update {
		color: #6b7280;
		margin: 0;
		font-size: 0.875rem;
	}

	.content {
		line-height: 1.8;
	}

	section {
		margin-bottom: 2.5rem;
	}

	h2 {
		font-size: 1.5rem;
		color: #1f2937;
		margin: 0 0 1rem 0;
		padding-top: 1rem;
	}

	p {
		color: #374151;
		margin: 0 0 1rem 0;
	}

	ul {
		color: #374151;
		margin: 0 0 1rem 0;
		padding-left: 1.5rem;
	}

	li {
		margin-bottom: 0.5rem;
	}

	strong {
		color: #111827;
		font-weight: 600;
	}

	.note {
		background: #fef3c7;
		border-left: 4px solid #f59e0b;
		padding: 1rem;
		border-radius: 4px;
		margin: 1rem 0;
	}

	a {
		color: #667eea;
		text-decoration: none;
		font-weight: 500;
	}

	a:hover {
		text-decoration: underline;
	}

	.footer-actions {
		margin-top: 3rem;
		padding-top: 2rem;
		border-top: 1px solid #e5e7eb;
		display: flex;
		gap: 2rem;
		justify-content: center;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1.5rem;
		}

		h1 {
			font-size: 2rem;
		}

		h2 {
			font-size: 1.25rem;
		}
	}
</style>
