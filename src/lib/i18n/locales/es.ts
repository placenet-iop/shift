export default {
	common: {
		appName: 'Shift',
		subtitle: 'Sistema de Control de Horario',
		loading: 'Cargando...',
		error: 'Error',
		success: 'Éxito',
		search: 'Buscar',
		clear: 'Limpiar',
		back: 'Volver',
		backToHome: '← Volver al inicio',
		save: 'Guardar',
		cancel: 'Cancelar',
		close: 'Cerrar',
		accept: 'Aceptar',
		yes: 'Sí',
		no: 'No',
		all: 'Todos',
		none: 'Ninguno',
		actions: 'Acciones',
		view: 'Ver',
		edit: 'Editar',
		delete: 'Eliminar',
		export: 'Exportar',
		import: 'Importar',
		filter: 'Filtrar',
		filters: 'Filtros',
		clearFilters: 'Limpiar Filtros',
		noResults: 'No se encontraron resultados',
		connectionError: 'Error de conexión',
		unknownError: 'Ocurrió un error desconocido'
	},
	auth: {
		restrictedAccess: 'Acceso Restringido',
		restrictedMessage: 'Esta aplicación solo es accesible desde Placenet.',
		restrictedInfo: 'Si estás viendo este mensaje, necesitas acceder a través de tu cuenta de Placenet.',
		devNotice: 'Desarrollo/Pruebas:',
		devInfo: 'Para pruebas locales, puedes generar un token usando el endpoint de desarrollo:',
		devLink: 'Ir al Generador de Token de Desarrollo →',
		devManual: 'O establece manualmente un token en la consola:',
		tokenPlaceholder: 'TU_TOKEN_JWT'
	},
	status: {
		currentStatus: 'Estado Actual',
		clockedOut: 'Inactivo',
		clockedIn: 'Trabajando',
		onBreak: 'En Pausa',
		working: 'Trabajando',
		inactive: 'Inactivo',
		lastRecord: 'Último registro:',
		noRecords: 'Aún no hay registros'
	},
	buttons: {
		clockIn: 'Fichar Entrada',
		clockOut: 'Fichar Salida',
		startBreak: 'Iniciar Pausa',
		resumeWork: 'Reanudar Trabajo',
		viewHistory: 'Mis registros',
		adminPanel: 'Panel de Administración',
		exportCSV: 'Exportar CSV',
		exportJSON: 'Exportar JSON',
		search: 'Buscar',
		loading: 'Cargando...'
	},
	messages: {
		timeRecorded: 'Registro de tiempo guardado correctamente',
		failedToClock: 'Error al fichar',
		failedToLoadStatus: 'Error al cargar el estado',
		failedToLoadEvents: 'Error al cargar los eventos',
		failedToLoadUsers: 'Error al cargar los usuarios',
		exportFailed: 'Error en la exportación',
		exportError: 'Error de exportación',
		noAdminPermissions: 'No tienes permisos de administrador'
	},
	privacy: {
		title: 'Información sobre Protección de Datos',
		welcome: 'Bienvenido al Sistema Digital de Control Horario. De acuerdo con el Reglamento General de Protección de Datos (RGPD), le informamos sobre el tratamiento de sus datos personales:',
		whatData: '¿Qué datos recopilamos?',
		dataList: {
			identification: 'Identificación: nombre y correo electrónico',
			timeRecords: 'Registros de tiempo: entrada, salida y pausas con fecha/hora exacta',
			technical: 'Información técnica: dispositivo y dirección IP'
		},
		whatFor: '¿Para qué?',
		whatForText: 'Para cumplir con la obligación legal de registro de jornada (Real Decreto-ley 8/2019). Su consentimiento no es necesario ya que se trata de una obligación legal.',
		yourRights: 'Sus derechos',
		rightsText: 'Puede ejercer sus derechos a:',
		rightsList: {
			access: 'Acceso: Ver sus registros de tiempo en "Mis registros"',
			rectification: 'Rectificación: Solicitar corrección de datos inexactos',
			portability: 'Portabilidad: Obtener una copia de sus datos'
		},
		importantNote: 'Los registros se conservan durante 4 años y son inmutables para garantizar la transparencia y el cumplimiento legal.',
		viewFullPolicy: 'Ver Política Completa',
		readAndUnderstand: 'He leído y entiendo'
	},
	admin: {
		title: 'Panel de Administración',
		subtitle: 'Control Horario - Shift',
		tabs: {
			timeRecords: 'Registros de Tiempo',
			users: 'Usuarios'
		},
		filters: {
			searchFilters: 'Filtros de Búsqueda',
			viewFilters: 'Filtros de Visualización',
			user: 'Usuario:',
			allUsers: 'Todos los usuarios',
			from: 'Desde:',
			to: 'Hasta:',
			eventType: 'Tipo de Evento:',
			allEvents: 'Todos los eventos',
			domain: 'Dominio:',
			allDomains: 'Todos los dominios'
		},
		events: {
			loadingRecords: 'Cargando registros...',
			noRecords: 'No se encontraron registros en el período seleccionado',
			totalRecords: 'Total de registros',
			showing: 'Mostrando',
			users: 'Usuarios',
			domains: 'Dominios',
			tableHeaders: {
				worker: 'Trabajador',
				type: 'Tipo',
				dateTime: 'Fecha y Hora',
				domainId: 'ID de Dominio',
				domain: 'Dominio'
			}
		},
		users: {
			title: 'Gestión de Usuarios',
			total: 'Total:',
			active: 'Activos:',
			admins: 'Administradores:',
			tableHeaders: {
				user: 'Usuario',
				roleStatus: 'Rol / Estado',
				domain: 'Dominio',
				activity: 'Actividad (30 días)',
				lastRecord: 'Último Registro',
				registered: 'Registrado'
			},
			roles: {
				admin: 'Administrador',
				worker: 'Trabajador'
			},
			status: {
				active: 'Activo',
				inactive: 'Inactivo'
			},
			stats: {
				total: 'Total:',
				clockIns: 'Entradas:',
				clockOuts: 'Salidas:'
			},
			noRecords: 'Sin registros',
			loading: 'Cargando...'
		}
	},
	history: {
		title: 'Historial de Registros de Tiempo',
		from: 'Desde:',
		to: 'Hasta:',
		loadingRecords: 'Cargando registros...',
		noRecords: 'No se encontraron registros en el período seleccionado',
		totalRecords: 'Total de registros:',
		worker: 'Trabajador:',
		domain: 'Dominio:',
		weeklySummary: 'Resumen semanal de horas'
	},
	events: {
		clockIn: 'Fichar Entrada',
		clockOut: 'Fichar Salida',
		breakStart: 'Inicio de Pausa',
		breakEnd: 'Fin de Pausa'
	},
	legal: {
		privacyPolicy: 'Política de Privacidad',
		legalNotice: 'Aviso Legal'
	},
	language: {
		english: 'English',
		spanish: 'Español',
		selectLanguage: 'Seleccionar Idioma'
	}
};

