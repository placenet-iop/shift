<script lang="ts">
	let lastUpdate = '2025-01-11';
</script>

<main>
	<div class="container">
		<header>
			<h1>Aviso Legal</h1>
			<p class="last-update">Última actualización: {lastUpdate}</p>
		</header>

		<div class="content">
			<section>
				<h2>1. Información General</h2>
				<p>
					El presente Aviso Legal regula el uso del sistema de Control Horario Digital (en adelante, "Shift"),
					desarrollado para dar cumplimiento a lo establecido en el Real Decreto-ley 8/2019,
					de 8 de marzo, de medidas urgentes de protección social y de lucha contra la precariedad
					laboral en la jornada de trabajo.
				</p>
			</section>

			<section>
				<h2>2. Objeto y Finalidad</h2>
				<p>
					Shift es un sistema de registro de jornada laboral digital que permite a las empresas
					cumplir con la obligación legal de registrar diariamente la jornada de trabajo de sus empleados,
					conforme al artículo 34.9 del Estatuto de los Trabajadores.
				</p>
				<p><strong>Finalidades del sistema:</strong></p>
				<ul>
					<li>Registro digital de la jornada laboral (entrada, salida, pausas)</li>
					<li>Consulta del historial de fichajes por parte de los trabajadores</li>
					<li>Generación de informes para la empresa y la Inspección de Trabajo</li>
					<li>Garantía de los derechos laborales de los trabajadores</li>
				</ul>
			</section>

			<section>
				<h2>3. Usuarios del Sistema</h2>
				<p>El sistema está diseñado para ser utilizado por:</p>
				<ul>
					<li><strong>Trabajadores:</strong> Para registrar su jornada y consultar su historial</li>
					<li><strong>Administradores:</strong> Personal autorizado de la empresa para gestionar y exportar registros</li>
					<li><strong>Inspección de Trabajo:</strong> Acceso mediante exportación de datos cuando sea requerido</li>
				</ul>
			</section>

			<section>
				<h2>4. Obligaciones de los Usuarios</h2>

				<h3>4.1. Obligaciones de los Trabajadores</h3>
				<ul>
					<li>Registrar su jornada de forma puntual y veraz</li>
					<li>Utilizar únicamente sus credenciales personales (no compartirlas)</li>
					<li>Notificar cualquier error o incidencia en el registro</li>
					<li>Respetar el uso correcto del sistema</li>
				</ul>

				<h3>4.2. Obligaciones de la Empresa</h3>
				<ul>
					<li>Garantizar el acceso al sistema a todos los trabajadores</li>
					<li>Conservar los registros durante al menos 4 años</li>
					<li>Facilitar el acceso a la Inspección de Trabajo cuando sea requerido</li>
					<li>Proteger los datos conforme al RGPD</li>
					<li>Informar a los trabajadores sobre el tratamiento de datos</li>
				</ul>
			</section>

			<section>
				<h2>5. Marco Legal Aplicable</h2>
				<p>El sistema Shift se rige por:</p>
				<ul>
					<li><strong>Real Decreto-ley 8/2019</strong>, de 8 de marzo (obligación de registro de jornada)</li>
					<li><strong>Estatuto de los Trabajadores</strong> (artículo 34.9)</li>
					<li><strong>Reglamento General de Protección de Datos (RGPD)</strong> - UE 2016/679</li>
					<li><strong>Ley Orgánica 3/2018</strong> de Protección de Datos Personales y garantía de los derechos digitales</li>
					<li><strong>Ley 34/2002</strong> de Servicios de la Sociedad de la Información y Comercio Electrónico</li>
				</ul>
			</section>

			<section>
				<h2>6. Características Técnicas del Sistema</h2>

				<h3>6.1. Integridad e Inalterabilidad</h3>
				<p>
					Los registros de jornada son <strong>inalterables</strong>. Una vez guardado un fichaje,
					no puede ser modificado ni eliminado, garantizando la trazabilidad y veracidad de los datos.
				</p>

				<h3>6.2. Autenticación</h3>
				<p>
					El acceso al sistema se realiza mediante autenticación segura a través de tokens JWT
					proporcionados por Placenet, garantizando la identificación inequívoca del usuario.
				</p>

				<h3>6.3. Almacenamiento</h3>
				<p>
					Los datos se almacenan en una base de datos cifrada con copias de seguridad periódicas,
					garantizando su disponibilidad durante el período legal de 4 años.
				</p>
			</section>

			<section>
				<h2>7. Acceso y Consulta de Registros</h2>
				<p><strong>Trabajadores:</strong> Pueden consultar su historial completo en cualquier momento a través de la sección "Mis registros".</p>
				<p><strong>Empresa:</strong> Los administradores pueden acceder a los registros de todos los trabajadores y exportarlos en formato CSV o JSON.</p>
				<p><strong>Inspección de Trabajo:</strong> La empresa facilitará los registros cuando sean requeridos mediante exportación de datos.</p>
			</section>

			<section>
				<h2>8. Sanciones por Mal Uso</h2>
				<p>
					El uso indebido del sistema (falsificación de registros, suplantación de identidad, etc.)
					puede dar lugar a sanciones disciplinarias conforme al convenio colectivo aplicable
					y a la legislación laboral vigente.
				</p>
			</section>

			<section>
				<h2>9. Responsabilidad</h2>
				<p>
					La empresa es responsable de garantizar el correcto funcionamiento del sistema y
					la protección de los datos conforme a la normativa vigente.
				</p>
				<p>
					El proveedor del sistema (Shift) no se hace responsable de un uso inadecuado por
					parte de los usuarios o de la falta de cumplimiento de las obligaciones legales por
					parte de la empresa.
				</p>
			</section>

			<section>
				<h2>10. Incidencias Técnicas</h2>
				<p>
					En caso de incidencia técnica que impida el registro de jornada (caída del sistema,
					problemas de acceso, etc.), el trabajador debe notificarlo inmediatamente al
					departamento correspondiente.
				</p>
				<p>
					La empresa implementará medios alternativos temporales para garantizar el registro
					hasta la resolución de la incidencia.
				</p>
			</section>

			<section>
				<h2>11. Modificaciones del Sistema</h2>
				<p>
					La empresa se reserva el derecho de modificar, actualizar o mejorar el sistema
					para adaptarlo a cambios normativos o tecnológicos. Los usuarios serán informados
					de cualquier cambio significativo.
				</p>
			</section>

			<section>
				<h2>12. Propiedad Intelectual</h2>
				<p>
					Todos los contenidos, diseños, código fuente y elementos del sistema están protegidos
					por derechos de propiedad intelectual. Queda prohibida su reproducción, distribución
					o modificación sin autorización expresa.
				</p>
			</section>

			<section>
				<h2>13. Jurisdicción y Ley Aplicable</h2>
				<p>
					El presente Aviso Legal se rige por la legislación española. Para cualquier controversia
					que pudiera derivarse del uso del sistema, las partes se someten a los Juzgados y
					Tribunales que correspondan conforme a la legislación vigente.
				</p>
			</section>

			<section>
				<h2>14. Contacto</h2>
				<p>
					Para cualquier consulta, incidencia o ejercicio de derechos relacionados con el sistema,
					los usuarios pueden contactar con el departamento de Recursos Humanos de su empresa.
				</p>
			</section>
		</div>

		<div class="footer-actions">
			<a href="/">← Volver al inicio</a>
			<a href="/privacy">Ver Política de Privacidad</a>
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

	h3 {
		font-size: 1.125rem;
		color: #374151;
		margin: 1.5rem 0 0.75rem 0;
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

		h3 {
			font-size: 1rem;
		}
	}
</style>
