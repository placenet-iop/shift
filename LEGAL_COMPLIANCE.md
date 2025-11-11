# Control Horario - Cumplimiento Legal

## Base Legal

Esta aplicación de control horario cumple con la legislación española vigente:

### Real Decreto-ley 8/2019, de 8 de marzo
- Establece la obligación de registrar la jornada laboral diaria
- Registro obligatorio de hora de entrada y salida
- Conservación de registros durante 4 años
- Accesibilidad para trabajadores e Inspección de Trabajo

### Normativa 2026 (Preparado para)
- Registro 100% digital
- Sistema seguro e inalterable
- Aplicable a todas las empresas

## Requisitos Legales Implementados

### 1. Registro Diario Obligatorio ✅
- Registro de hora exacta de inicio y fin de jornada
- Registro de pausas durante la jornada
- Vinculación inequívoca al trabajador mediante JWT

### 2. Fiabilidad e Inalterabilidad ✅
- Tablas de base de datos en modo append-only
- Triggers que previenen UPDATE y DELETE en registros
- Imposible modificar o borrar fichajes una vez creados
- Trazabilidad completa: usuario, timestamp, IP, user-agent

### 3. Identificación del Trabajador ✅
- Autenticación mediante JWT (integrable con Placenet)
- Cada fichaje vinculado inequívocamente al usuario
- No se permite registro compartido o genérico

### 4. Accesibilidad del Registro ✅
- Trabajadores pueden consultar su historial en `/history`
- Administradores pueden acceder a todos los registros en `/admin`
- Exportación en CSV y JSON disponible
- Sistema de búsqueda por fechas y usuario

### 5. Conservación Mínima de Datos ✅
- Base de datos SQLite persistente
- Registros mantenidos indefinidamente (mínimo 4 años)
- Sistema de backup recomendado (responsabilidad del administrador)

### 6. Exportabilidad e Informes ✅
- Exportación a CSV con formato estándar
- Exportación a JSON para procesamiento
- Incluye: nombre, email, fecha, hora, tipo de evento, IP, navegador
- Endpoint: `/api/admin/export`

### 7. Adaptación a Teletrabajo ✅
- Fichaje desde cualquier dispositivo con navegador
- Registro de IP del cliente
- Fuente del fichaje identificada (web/mobile/kiosk)

### 8. Cumplimiento de RGPD ✅

#### Base Jurídica
- Artículo 6.1.c RGPD: Obligación legal del empleador
- Tratamiento de datos personales justificado por normativa laboral

#### Datos Registrados (Mínimos Necesarios)
- Email del trabajador
- Nombre del trabajador
- Timestamps de entrada/salida/pausas
- IP de conexión (opcional, proporcional)
- User-agent del navegador (para auditoría)

#### Medidas de Seguridad
- Autenticación mediante JWT
- HTTPS recomendado en producción
- Control de acceso basado en roles
- Audit log de todas las acciones administrativas
- Base de datos con foreign keys y constraints

#### Derechos ARCO
Los trabajadores tienen derecho a:
- **Acceso**: Ver su historial de fichajes en `/history`
- **Rectificación**: Contactar con administrador (registros inmutables por ley)
- **Cancelación**: Según normativa de conservación (4 años mínimo)
- **Oposición**: Solo posible si no hay obligación legal

### 9. Control de Roles y Accesos ✅
- **worker**: Puede fichar y ver su propio historial
- **admin**: Puede ver todos los registros, exportar y auditar
- No se permite edición o eliminación de registros

### 10. Disponibilidad Inmediata ✅
- API REST disponible en todo momento
- Exportación inmediata en CSV/JSON
- Sin manipulación de datos
- Audit log de todas las exportaciones

## Auditoría y Trazabilidad

### Sistema de Audit Log
Todas las acciones administrativas son registradas:
- Visualización de registros de otros usuarios
- Exportación de datos
- Usuario que realizó la acción
- Fecha y hora de la acción
- IP desde donde se realizó

### Consulta de Audit Log
Los administradores pueden consultar el audit log en la base de datos:
```sql
SELECT * FROM audit_log ORDER BY ts DESC;
```

## Documentación para Inspección de Trabajo

### En caso de requerimiento de la ITSS:

1. **Manual de funcionamiento**: Ver README.md
2. **Exportación de registros**: Usar `/api/admin/export`
3. **Política de conservación**: 4 años (sin límite superior)
4. **Responsable del tratamiento**: [NOMBRE DE LA EMPRESA]
5. **Procedimiento ante incidencias**: Contactar con administrador del sistema

### Exportación para Inspección
```bash
# Exportar todos los registros en CSV
curl -H "Authorization: Bearer TOKEN" \
  "https://[DOMINIO]/api/admin/export?format=csv" > registros.csv

# Exportar registros de un período específico
curl -H "Authorization: Bearer TOKEN" \
  "https://[DOMINIO]/api/admin/export?from=2024-01-01&to=2024-12-31&format=csv" > registros_2024.csv
```

## Configuración de Producción

### Variables de Entorno Recomendadas
```bash
# JWT Secret (debe coincidir con Placenet)
JWT_SECRET=tu-clave-secreta-segura

# Ruta de la base de datos
DB_PATH=./data/control_horario.db

# Puerto del servidor
PORT=3000

# Entorno
NODE_ENV=production
```

### HTTPS Obligatorio
En producción, el sistema DEBE servirse mediante HTTPS para:
- Proteger tokens JWT en tránsito
- Cumplir con medidas de seguridad RGPD
- Evitar interceptación de datos personales

### Backup Recomendado
```bash
# Backup diario de la base de datos
cp ./data/control_horario.db ./backups/control_horario_$(date +%Y%m%d).db

# Backup con compresión
tar -czf backup_$(date +%Y%m%d).tar.gz ./data/
```

## Contacto y Responsabilidad

**Responsable del Tratamiento**: [NOMBRE DE LA EMPRESA]
**Delegado de Protección de Datos**: [CONTACTO]
**Contacto**: [EMAIL]

---

## Garantías Técnicas de Inalterabilidad

### Triggers SQL
El sistema implementa triggers que impiden la modificación o eliminación:

```sql
-- Prevenir UPDATE en time_events
CREATE TRIGGER prevent_time_events_update
BEFORE UPDATE ON time_events
BEGIN
    SELECT RAISE(ABORT, 'Modification of time events is not allowed.');
END;

-- Prevenir DELETE en time_events
CREATE TRIGGER prevent_time_events_delete
BEFORE DELETE ON time_events
BEGIN
    SELECT RAISE(ABORT, 'Deletion of time events is not allowed.');
END;
```

Si un administrador intenta modificar registros directamente en la base de datos, la operación será rechazada con un error.

## Fecha de Última Actualización
2024-11-10
