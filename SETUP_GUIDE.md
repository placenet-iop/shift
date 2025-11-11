# Guía de Configuración e Integración con Placenet

## 1. Estructura de Archivos

```
shift/
├── shift.json                    # Configuración principal de la app
├── .env.example                  # Plantilla de variables de entorno
├── placenet-integration.php      # Clase PHP para integración
├── PLACENET_INTEGRATION.md       # Documentación de integración
├── LEGAL_COMPLIANCE.md           # Documentación legal
├── README.md                     # Documentación general
└── src/
    ├── lib/server/
    │   ├── config.ts             # Lectura de shift.json
    │   ├── auth.ts               # Autenticación JWT compatible con Placenet
    │   └── db/
    │       ├── index.ts          # Operaciones de base de datos
    │       └── schema.sql        # Esquema inmutable
    └── routes/
        ├── +page.svelte          # Interfaz de fichaje
        ├── history/              # Historial personal
        ├── admin/                # Panel administrativo
        └── api/                  # Endpoints REST
```

## 2. Configuración Inicial

### Paso 1: Variables de Entorno

Crear archivo `.env` en la raíz de shift:

```bash
# IMPORTANTE: JWT_SECRET debe ser el MISMO que en Placenet
JWT_SECRET=tu-clave-secreta-compartida-con-placenet

# Base de datos
DB_PATH=./data/control_horario.db

# Entorno
NODE_ENV=development

# URL base (opcional, para producción)
BASE_URL=http://localhost:5173
```

### Paso 2: Instalar Dependencias

```bash
cd shift
npm install
```

### Paso 3: Iniciar el Servidor

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm run preview
```

## 3. Integración con Placenet

### Opción A: Integración PHP (Recomendada)

1. **Copiar el archivo de integración**

```bash
cp placenet-integration.php /path/to/placenet/app/Integration/ShiftIntegration.php
```

2. **Ajustar el namespace si es necesario** (editar línea 10)

3. **Usar en tu código PHP**

```php
<?php
use App\Integration\ShiftIntegration;
use App\Token;

// Crear token de Placenet (ejemplo con datos del usuario actual)
$token = (new Token('ACC01'))
    ->payload([
        'avatar_id' => $user->id,
        'avatar_name' => $user->name,
        'avatar_email' => $user->email,
        'domain_id' => $user->company_id,
        'domain_name' => $user->company_name,
        'domain_tags' => $user->isAdmin ? ['admin'] : []
    ])
    ->expireHours(8);

// Inicializar integración
$shift = new ShiftIntegration('http://localhost:5173');

// Fichar entrada
try {
    $result = $shift->clockIn($token);
    echo "Fichaje exitoso: " . $result['event']['ts'];
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
```

### Opción B: Integración JavaScript/Frontend

```javascript
// Obtener token JWT de Placenet (ejemplo)
const placenetToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';

// Función helper para llamadas a Shift
async function shiftAPI(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${placenetToken}`,
      'Content-Type': 'application/json'
    }
  };

  if (data && method === 'POST') {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`http://localhost:5173${endpoint}`, options);
  return response.json();
}

// Ejemplos de uso
async function ejemplos() {
  // Fichar entrada
  const clockIn = await shiftAPI('/api/time/clock', 'POST', {
    event_type: 'in'
  });

  // Ver estado
  const status = await shiftAPI('/api/time/status');
  console.log('Estado:', status.status);

  // Ver historial
  const events = await shiftAPI('/api/time/events?from=2024-01-01');
  console.log('Eventos:', events.events);
}
```

### Opción C: Iframe Integration

```html
<!-- En tu app Placenet -->
<!DOCTYPE html>
<html>
<head>
    <title>Control Horario</title>
    <style>
        #shift-container {
            width: 100%;
            height: 100vh;
            border: none;
        }
    </style>
</head>
<body>
    <iframe id="shift-container" src="http://localhost:5173"></iframe>

    <script>
        // Enviar token al iframe cuando cargue
        const iframe = document.getElementById('shift-container');
        const placenetToken = '<?php echo $token; ?>';

        iframe.addEventListener('load', function() {
            // Guardar token en localStorage del iframe
            iframe.contentWindow.localStorage.setItem('token', placenetToken);
            iframe.contentWindow.location.reload();
        });
    </script>
</body>
</html>
```

## 4. Configuración de Roles

En `shift.json`, los roles se configuran así:

```json
{
  "integration": {
    "placenet": {
      "admin_tags": ["admin", "shift_admin"]
    }
  }
}
```

**Cómo funciona:**
- Si el token de Placenet tiene `domain_tags: ['admin']` → rol `admin` en Shift
- Si el token de Placenet tiene `domain_tags: ['shift_admin']` → rol `admin` en Shift
- Si no tiene esos tags → rol `worker` en Shift

## 5. Testing

### Test 1: Crear usuario manualmente

```bash
curl -X POST http://localhost:5173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Usuario Test",
    "role": "worker"
  }'
```

Respuesta esperada:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "name": "Usuario Test",
    "role": "worker"
  }
}
```

### Test 2: Fichar con el token

```bash
# Guardar el token de la respuesta anterior
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Fichar entrada
curl -X POST http://localhost:5173/api/time/clock \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "in"}'
```

### Test 3: Ver estado

```bash
curl http://localhost:5173/api/time/status \
  -H "Authorization: Bearer $TOKEN"
```

### Test 4: Ver historial

```bash
curl http://localhost:5173/api/time/events \
  -H "Authorization: Bearer $TOKEN"
```

### Test 5: Probar con token de Placenet (PHP)

```php
<?php
// En tu entorno Placenet
require_once 'app/Token.php';
use App\Token;

// Crear token de prueba
$token = Token::fromTest('tenant1'); // Usa uno de los test predefinidos
echo "Token: " . $token . "\n";

// Hacer petición a Shift
$ch = curl_init('http://localhost:5173/api/time/status');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token,
    'Content-Type: application/json'
]);
$response = curl_exec($ch);
echo "Respuesta: " . $response . "\n";
```

## 6. Producción

### Checklist de Despliegue

- [ ] Configurar `JWT_SECRET` seguro (mismo en Placenet y Shift)
- [ ] Establecer `NODE_ENV=production`
- [ ] Configurar HTTPS (obligatorio)
- [ ] Configurar backup automático de la base de datos
- [ ] Revisar permisos de acceso a `/data`
- [ ] Configurar CORS si Placenet y Shift están en dominios diferentes
- [ ] Probar todos los endpoints en producción
- [ ] Configurar monitorización de logs
- [ ] Documentar procedimientos de backup/restore

### Variables de Entorno en Producción

```bash
# .env (producción)
JWT_SECRET=clave-muy-segura-generada-aleatoriamente
DB_PATH=/var/lib/shift/control_horario.db
NODE_ENV=production
BASE_URL=https://shift.tuempresa.com
PORT=3000
```

### CORS Configuration (si es necesario)

Si Placenet y Shift están en dominios diferentes, necesitas configurar CORS.

Crear `src/hooks.server.ts`:

```typescript
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Permitir CORS desde Placenet
	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			headers: {
				'Access-Control-Allow-Origin': 'https://placenet.tuempresa.com',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				'Access-Control-Max-Age': '86400'
			}
		});
	}

	const response = await resolve(event);

	response.headers.set('Access-Control-Allow-Origin', 'https://placenet.tuempresa.com');
	response.headers.set('Access-Control-Allow-Credentials', 'true');

	return response;
};
```

## 7. Monitorización

### Logs de Auditoría

Ver todos los accesos administrativos:

```bash
sqlite3 ./data/control_horario.db "SELECT * FROM audit_log ORDER BY ts DESC LIMIT 20;"
```

### Estadísticas de Uso

```sql
-- Fichajes por día
SELECT
  DATE(ts) as fecha,
  COUNT(*) as total_fichajes
FROM time_events
GROUP BY DATE(ts)
ORDER BY fecha DESC
LIMIT 30;

-- Usuarios más activos
SELECT
  u.name,
  COUNT(*) as fichajes
FROM time_events te
JOIN users u ON te.user_id = u.id
GROUP BY u.id
ORDER BY fichajes DESC;
```

## 8. Soporte

### Logs de Errores

Los errores se registran en la consola del servidor. Para ver en tiempo real:

```bash
npm run dev  # modo desarrollo con logs detallados
```

### Base de Datos

Conectar directamente:

```bash
sqlite3 ./data/control_horario.db

# Comandos útiles:
.tables          # Ver todas las tablas
.schema users    # Ver esquema de tabla
SELECT * FROM users;  # Ver usuarios
```

### Problemas Comunes

**1. Token inválido**
- Verificar que `JWT_SECRET` es el mismo en Placenet y Shift
- Comprobar que el token no ha expirado
- Revisar formato del token

**2. Usuario no se crea automáticamente**
- Verificar que el token incluye `avatar_email` y `avatar_name`
- Revisar logs del servidor
- Comprobar conexión a la base de datos

**3. Permisos incorrectos**
- Verificar `domain_tags` en el token de Placenet
- Revisar configuración de `admin_tags` en shift.json

**4. CORS errors**
- Configurar CORS en `src/hooks.server.ts`
- Verificar dominios permitidos

## 9. Documentación Adicional

- **README.md**: Documentación general de la aplicación
- **LEGAL_COMPLIANCE.md**: Cumplimiento legal y RGPD
- **PLACENET_INTEGRATION.md**: Detalles de integración con Placenet
- **shift.json**: Configuración completa de la aplicación

## 10. Contacto y Soporte

Para reportar problemas o solicitar ayuda:
1. Revisar esta documentación
2. Consultar logs del servidor
3. Verificar configuración de `shift.json` y `.env`
4. Contactar al equipo de desarrollo

---

**Última actualización**: 2024-11-10
