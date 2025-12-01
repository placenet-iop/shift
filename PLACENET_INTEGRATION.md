# Integración con Placenet

Este documento describe cómo integrar la aplicación de Control Horario con Placenet.

## Configuración

### 1. Variables de Entorno

En el archivo `.env` de Shift:

```bash
# JWT Secret - DEBE ser el mismo que en Placenet
JWT_SECRET=tu-clave-secreta-compartida

# Database
DATABASE_URL="file:./shift.db"

# Entorno
NODE_ENV=production
```

### 2. Configuración en shift.json

El archivo `shift.json` ya está configurado con:

```json
{
  "integration": {
    "placenet": {
      "enabled": true,
      "jwt_mapping": {
        "avatar_id": "userId",
        "avatar_name": "name",
        "avatar_email": "email",
        "domain_id": "companyId",
        "domain_name": "companyName",
        "role": "role"
      },
      "default_role": "worker",
      "admin_tags": ["admin", "shift_admin"]
    }
  }
}
```

## Formato de JWT

### Token de Placenet

Placenet genera tokens con el siguiente formato:

```json
{
  "avatar_id": "TESTU1",
  "avatar_name": "Juan Pérez",
  "avatar_email": "juan@example.com",
  "domain_id": "DXX1",
  "domain_name": "Empresa S.L.",
  "domain_tags": ["admin"],
  "iat": 1234567890,
  "exp": 1234571490
}
```

### Auto-aprovisionamiento de Usuarios

Shift automáticamente:
1. Verifica el token JWT de Placenet
2. Normaliza los campos al formato de Shift
3. Crea el usuario automáticamente si no existe
4. Asigna el rol según los tags:
   - Si tiene tag `admin` o `shift_admin` → rol `admin`
   - Si no → rol `worker`

## Uso desde Placenet

### Llamadas a la API

Todas las llamadas deben incluir el token JWT en el header:

```javascript
// Ejemplo de llamada desde Placenet
fetch('http://localhost:5173/api/time/clock', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${placenetToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    event_type: 'in' // 'in', 'out', 'pause_start', 'pause_end'
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

### Endpoints Disponibles

#### Para Trabajadores
```
POST   /api/time/clock          - Fichar entrada/salida/pausa
GET    /api/time/status         - Estado actual
GET    /api/time/events         - Historial personal
```

#### Para Administradores
```
GET    /api/admin/events        - Todos los eventos
GET    /api/admin/export        - Exportar CSV/JSON
GET    /api/admin/users         - Lista de usuarios
```

## Integración PHP (Placenet)

### Ejemplo de clase de integración

```php
<?php
namespace App\Integration;

use App\Token;

class ShiftIntegration
{
    private $baseUrl;

    public function __construct($baseUrl = 'http://localhost:5173')
    {
        $this->baseUrl = $baseUrl;
    }

    /**
     * Fichar entrada/salida
     */
    public function clock(Token $token, $eventType)
    {
        $response = $this->request('POST', '/api/time/clock', [
            'event_type' => $eventType
        ], $token);

        return $response;
    }

    /**
     * Obtener estado actual
     */
    public function getStatus(Token $token)
    {
        return $this->request('GET', '/api/time/status', null, $token);
    }

    /**
     * Obtener historial
     */
    public function getEvents(Token $token, $from = null, $to = null)
    {
        $query = [];
        if ($from) $query['from'] = $from;
        if ($to) $query['to'] = $to;

        $url = '/api/time/events';
        if ($query) $url .= '?' . http_build_query($query);

        return $this->request('GET', $url, null, $token);
    }

    /**
     * Exportar datos (solo admin)
     */
    public function export(Token $token, $format = 'csv', $from = null, $to = null, $userId = null)
    {
        $query = ['format' => $format];
        if ($from) $query['from'] = $from;
        if ($to) $query['to'] = $to;
        if ($userId) $query['user_id'] = $userId;

        $url = '/api/admin/export?' . http_build_query($query);

        return $this->request('GET', $url, null, $token);
    }

    /**
     * Request helper
     */
    private function request($method, $path, $data = null, Token $token = null)
    {
        $url = $this->baseUrl . $path;

        $headers = [
            'Content-Type: application/json',
        ];

        if ($token) {
            $headers[] = 'Authorization: Bearer ' . (string)$token;
        }

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) {
            throw new \Exception("HTTP Error: $httpCode - $response");
        }

        return json_decode($response, true);
    }
}
```

### Uso en Placenet

```php
<?php
use App\Token;
use App\Integration\ShiftIntegration;

// Crear token desde Placenet
$token = (new Token('ACC01'))
    ->payload([
        'avatar_id' => 'TESTU1',
        'avatar_name' => 'Juan Pérez',
        'avatar_email' => 'juan@example.com',
        'domain_id' => 'DXX1',
        'domain_name' => 'Empresa S.L.',
        'domain_tags' => []
    ])
    ->expireHours(8);

// Integración con Shift
$shift = new ShiftIntegration('http://localhost:5173');

// Fichar entrada
$result = $shift->clock($token, 'in');
echo "Fichaje: " . $result['success'] . "\n";

// Ver estado
$status = $shift->getStatus($token);
echo "Estado: " . $status['status'] . "\n";

// Mis registros
$events = $shift->getEvents($token, '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z');
echo "Eventos: " . count($events['events']) . "\n";

// Exportar (solo admin)
$adminToken = (new Token('ACC01'))
    ->payload([
        'avatar_id' => 'ADMIN1',
        'avatar_name' => 'Admin',
        'avatar_email' => 'admin@example.com',
        'domain_id' => 'DXX1',
        'domain_name' => 'Empresa S.L.',
        'domain_tags' => ['admin']
    ])
    ->expireHours(8);

$export = $shift->export($adminToken, 'csv');
file_put_contents('export.csv', $export);
```

## Iframe Integration

Para integrar Shift en Placenet mediante iframe:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Shift</title>
</head>
<body>
    <iframe
        id="shift-frame"
        src="http://localhost:5173"
        style="width: 100%; height: 100vh; border: none;">
    </iframe>

    <script>
        // Enviar token al iframe
        const frame = document.getElementById('shift-frame');
        const token = 'YOUR_JWT_TOKEN_FROM_PLACENET';

        // Guardar token en localStorage del iframe
        frame.contentWindow.postMessage({
            type: 'set-token',
            token: token
        }, 'http://localhost:5173');
    </script>
</body>
</html>
```

## Testing

### Crear usuario de prueba desde Placenet

```bash
curl -X POST http://localhost:5173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@placenet.com",
    "name": "Usuario Test",
    "role": "worker"
  }'
```

### Probar con token de Placenet

1. Generar token en Placenet:
```php
$token = Token::fromTest('tenant1');
echo (string)$token;
```

2. Usar el token en las peticiones a Shift:
```bash
curl -X POST http://localhost:5173/api/time/clock \
  -H "Authorization: Bearer TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "in"}'
```

## Seguridad

- **HTTPS obligatorio** en producción
- **JWT_SECRET** debe ser el mismo en Placenet y Shift
- **CORS** configurar si están en dominios diferentes
- **Tokens RS256** son soportados automáticamente
- **Validación de tokens** se hace en cada petición

## Troubleshooting

### Token inválido
- Verificar que JWT_SECRET es el mismo
- Comprobar que el token no ha expirado
- Verificar formato del token (Header.Payload.Signature)

### Usuario no se crea
- Verificar que el token incluye `avatar_email` y `avatar_name`
- Revisar logs del servidor
- Comprobar que la base de datos es accesible

### Permisos incorrectos
- Verificar `domain_tags` o `tags` en el token
- Revisar configuración de `admin_tags` en shift.json
- Comprobar que el usuario existe en la base de datos

## Contacto

Para soporte de integración, consultar la documentación completa en README.md y LEGAL_COMPLIANCE.md.
