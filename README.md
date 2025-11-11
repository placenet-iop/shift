# Control Horario - Sistema de Registro de Jornada Laboral

Sistema de control horario digital que cumple con la legislación española (Real Decreto-ley 8/2019) y preparado para la normativa 2026.

## Características Principales

- **Registro inmutable** de entrada/salida y pausas
- **Cumplimiento legal** con normativa española
- **RGPD compliant** con sistema de auditoría
- **Interfaz intuitiva** para trabajadores y administradores
- **Exportación** en CSV y JSON
- **Trazabilidad completa** de todos los eventos
- **Integración** con Placenet mediante JWT

## Tecnologías

- **Frontend**: SvelteKit + TypeScript
- **Base de datos**: SQLite (better-sqlite3)
- **Autenticación**: JWT (jsonwebtoken)
- **Estilo**: CSS modular integrado

## Estructura del Proyecto

```
shift/
├── src/
│   ├── lib/
│   │   └── server/
│   │       ├── db/
│   │       │   ├── index.ts          # Conexión y queries de BD
│   │       │   └── schema.sql        # Esquema de base de datos
│   │       └── auth.ts               # Autenticación JWT
│   ├── routes/
│   │   ├── +page.svelte              # Página principal (fichaje)
│   │   ├── history/
│   │   │   └── +page.svelte          # Historial del trabajador
│   │   ├── admin/
│   │   │   └── +page.svelte          # Panel de administración
│   │   └── api/
│   │       ├── auth/
│   │       │   └── login/+server.ts  # Login de desarrollo
│   │       ├── time/
│   │       │   ├── clock/+server.ts  # Fichaje
│   │       │   ├── events/+server.ts # Consulta de eventos
│   │       │   └── status/+server.ts # Estado actual
│   │       └── admin/
│   │           ├── events/+server.ts # Ver todos los eventos
│   │           ├── export/+server.ts # Exportar datos
│   │           └── users/+server.ts  # Listar usuarios
│   ├── app.html
│   └── app.d.ts
├── static/                           # Archivos estáticos
├── data/                             # Base de datos (se crea automáticamente)
├── LEGAL_COMPLIANCE.md               # Documentación de cumplimiento legal
├── README.md                         # Este archivo
├── package.json
├── svelte.config.js
├── tsconfig.json
└── vite.config.ts
```

## Instalación

```bash
# Instalar dependencias (si no están instaladas)
npm install

# Iniciar en desarrollo
npm run dev

# Build para producción
npm run build

# Preview de producción
npm run preview
```

## Configuración

### Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto:

```bash
# JWT Secret (debe coincidir con Placenet en producción)
JWT_SECRET=tu-clave-secreta-muy-segura-cambiar-en-produccion

# Ruta de la base de datos
DB_PATH=./data/control_horario.db

# Puerto (opcional, por defecto 5173 en dev)
PORT=3000

# Entorno
NODE_ENV=production
```

### Integración con Placenet

Para integrar con Placenet, asegúrate de:

1. Configurar la misma clave `JWT_SECRET` que usa Placenet
2. Los tokens JWT de Placenet deben incluir:
   ```json
   {
     "userId": 123,
     "email": "user@example.com",
     "name": "Juan Pérez",
     "role": "worker"
   }
   ```
3. Enviar el token en el header: `Authorization: Bearer <token>`

## Uso

### Para Trabajadores

1. **Login**: Acceder a la aplicación con credenciales
2. **Fichar**:
   - Entrada: Botón "Fichar Entrada"
   - Pausa: Botón "Iniciar Pausa" (solo si fichado)
   - Reanudar: Botón "Reanudar Trabajo" (solo si en pausa)
   - Salida: Botón "Fichar Salida" (solo si fichado)
3. **Ver historial**: Link "Ver Historial" para consultar fichajes

### Para Administradores

1. **Login** con cuenta de administrador
2. **Ver registros**:
   - Acceder a `/admin`
   - Filtrar por usuario, fecha
   - Ver todos los fichajes
3. **Exportar**:
   - Botón "Exportar CSV" o "Exportar JSON"
   - Descarga automática del archivo
4. **Gestionar usuarios**:
   - Pestaña "Usuarios"
   - Ver lista de trabajadores

## API Endpoints

### Autenticación

```bash
# Login (desarrollo)
POST /api/auth/login
Body: { "email": "user@example.com", "name": "Juan Pérez", "role": "worker" }
Response: { "success": true, "token": "jwt-token", "user": {...} }
```

### Fichaje (requiere autenticación)

```bash
# Fichar
POST /api/time/clock
Headers: { "Authorization": "Bearer <token>" }
Body: { "event_type": "in" | "out" | "pause_start" | "pause_end" }

# Ver estado actual
GET /api/time/status
Headers: { "Authorization": "Bearer <token>" }

# Ver historial propio
GET /api/time/events?from=2024-01-01&to=2024-12-31
Headers: { "Authorization": "Bearer <token>" }
```

### Administración (requiere rol admin)

```bash
# Ver todos los eventos
GET /api/admin/events?from=2024-01-01&to=2024-12-31&user_id=1
Headers: { "Authorization": "Bearer <token>" }

# Exportar datos
GET /api/admin/export?format=csv&from=2024-01-01&to=2024-12-31
Headers: { "Authorization": "Bearer <token>" }

# Listar usuarios
GET /api/admin/users
Headers: { "Authorization": "Bearer <token>" }
```

## Base de Datos

### Esquema

- **users**: Usuarios del sistema (trabajadores y administradores)
- **time_events**: Eventos de fichaje (inmutables)
- **audit_log**: Log de auditoría de acciones administrativas

### Características de Seguridad

- Triggers que previenen UPDATE y DELETE en `time_events`
- Foreign keys habilitadas
- Journal mode WAL para mejor concurrencia
- Índices para consultas eficientes

### Consultas Directas (Administradores)

```bash
# Conectar a la base de datos
sqlite3 ./data/control_horario.db

# Ver todos los eventos
SELECT * FROM time_events ORDER BY ts DESC LIMIT 10;

# Ver audit log
SELECT * FROM audit_log ORDER BY ts DESC;

# Estadísticas por usuario
SELECT u.name, COUNT(*) as total_events
FROM time_events te
JOIN users u ON te.user_id = u.id
GROUP BY u.id;
```

## Backup y Conservación

Los registros deben conservarse durante **mínimo 4 años** según la legislación española.

```bash
# Backup manual
cp ./data/control_horario.db ./backups/control_horario_$(date +%Y%m%d).db

# Backup con cron (diario a las 2 AM)
0 2 * * * cp /path/to/shift/data/control_horario.db /path/to/backups/backup_$(date +\%Y\%m\%d).db

# Backup con compresión
tar -czf backup_$(date +%Y%m%d).tar.gz ./data/
```

## Cumplimiento Legal

Ver [LEGAL_COMPLIANCE.md](./LEGAL_COMPLIANCE.md) para:
- Base legal (RD 8/2019)
- Requisitos implementados
- Documentación para Inspección de Trabajo
- Cumplimiento RGPD
- Procedimientos de auditoría

## Desarrollo

### Crear un usuario administrador

```bash
# Usar el endpoint de login con role=admin
curl -X POST http://localhost:5173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","name":"Admin","role":"admin"}'
```

### Testing

```bash
# Verificar que los triggers funcionan
npm run dev
# En otra terminal:
sqlite3 ./data/control_horario.db

# Intentar modificar un registro (debe fallar)
sqlite> UPDATE time_events SET event_type = 'modified' WHERE id = 1;
# Error: Modification of time events is not allowed.

# Intentar eliminar un registro (debe fallar)
sqlite> DELETE FROM time_events WHERE id = 1;
# Error: Deletion of time events is not allowed.
```

## Despliegue en Producción

1. **Build del proyecto**:
   ```bash
   npm run build
   ```

2. **Variables de entorno**:
   - Configurar `JWT_SECRET` seguro
   - Configurar `DB_PATH` en ubicación persistente
   - Establecer `NODE_ENV=production`

3. **HTTPS obligatorio**:
   - Usar reverse proxy (nginx, Caddy)
   - Certificado SSL válido

4. **Backups automáticos**:
   - Configurar cron job para backups diarios
   - Almacenar backups en ubicación segura
   - Probar restauración periódicamente

5. **Monitorización**:
   - Logs de acceso
   - Alertas de errores
   - Revisión periódica del audit log

---

**Desarrollado para cumplir con la legislación española de control horario**
**RD 8/2019 y preparado para normativa 2026**

✅ Requisitos legales que debe cumplir la app
1. Registro obligatorio digital

El registro de la jornada (hora de entrada y de salida) debe realizarse de forma obligatoria para todos los trabajadores. 
Europa Press
+2
Control Laboral
+2

El sistema debe ser digital (ya no válidos métodos solo en papel o con Excel) y accesible para el trabajador y la inspección. 
Gestoría Cantón
+2
ejornada.es
+2

Debe registrar también pausas o descansos si aplica al tipo de jornada. 
Software CRM

2. Identificación y fiabilidad

El sistema debe identificar de forma inequívoca al trabajador que realiza el fichaje. 
ejornada.es
+1

Los datos deben ser inalterables o modificables sólo con trazabilidad (por ejemplo no permitir que se borren sin dejar rastro). 
Software CRM
+1

Debe permitir registro mediante dispositivos digitales (ordenador, móvil, tablet) adaptado al trabajo remoto o presencial. 
kaicontrol.com
+1

3. Transparencia y acceso

Los trabajadores deben poder acceder a sus registros de jornada. 
Grupo Albatros
+1

La inspección de trabajo debe poder acceder o solicitar los registros digitales, en tiempo real o mediante exportación. 
Software CRM
+1

4. Conservación de los datos

Los registros deben conservarse durante un mínimo de 4 años. 
Turno Digital
+1

Se deben establecer políticas de backup, seguridad, integridad y disponibilidad de esos datos. 
Turno Digital

5. Eliminación del papel / herramientas no conformes

Quedarán obsoletos los sistemas que no garanticen integridad y trazabilidad (p.e. papel, Excel) para el registro. 
evolkgalicia.es
+1

6. Cumplimiento de protección de datos (RGPD)

Aunque el registro se base en obligación legal, debes cumplir el Reglamento General de Protección de Datos: informar al trabajador, minimizar datos personales, controlar accesos, etc. 
Cinco Días
+1

Si se utilizan datos sensibles (huella digital, biométrica), requisitos adicionales de seguridad. 
aycelaborytax.com

7. Sanciones por incumplimiento

Las empresas que no cumplan pueden enfrentarse a sanciones que van desde multas leves hasta graves, incluso por cada trabajador afectado. 
Soluserv
+1

8. Información al trabajador / derechos

El registro debe respetar también el derecho a la desconexión digital y la transparencia sobre la jornada real. 
Gestoría Cantón

Es conveniente que la empresa informe al trabajador sobre el tratamiento de sus datos y el sistema de registro.

🧾 Especificaciones mínimas para tu app (para pasar a desarrollo)

Interfaz para que cada trabajador pueda registrar inicio, fin de jornada y pausa(s) (si aplica).

Autenticación firme (ya que usarás el JWT de Placenet) para asegurar identidad.

Guardado de cada evento: usuario, tipo de evento (entrada/salida/pausa), timestamp (UTC), origen dispositivo/IP, user agent.

Base de datos que impida borrado/modificación de los registros históricos sin dejar huella (append-only).

Endpoint para que el trabajador vea su historial.

Endpoint para exportar registros para administración / inspección (formato CSV u otro estándar).

Sistema de backup y retención de datos ≥ 4 años.

Seguridad: cifrado/roles/acceso restringido.

Integración con protección de datos: aviso al trabajador, registro de tratamiento, minimización datos.

Preparado para distintos entornos: presencial, remoto.

Logs de auditoría cuando se modifiquen configuraciones o roles.
