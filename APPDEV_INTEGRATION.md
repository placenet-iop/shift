# Integración con AppDev

## ✅ Configuración Completada

Shift ya está configurado para recibir tokens JWT de AppDev. Los cambios realizados:

1. **JWKS Support**: Shift ahora obtiene las claves públicas dinámicamente desde el endpoint JWKS de Placenet
2. **JWT RS256 Support**: Verifica tokens firmados con RS256 usando las claves del JWKS endpoint
3. **postMessage Listener**: Escucha mensajes del formato AppDev `{ type: 'auth', token: '...', goto: '...' }`
4. **READY Protocol**: Envía `READY` a AppDev cuando la app carga
5. **Auto-provisioning**: Crea usuarios automáticamente desde los datos del token JWT

## 🚀 Cómo Usar

### Paso 1: Asegurar que ambos servidores estén corriendo

**Shift** (este proyecto):
```bash
cd /Users/maximestebancalvo/shift
npm run dev
# Debe estar en: http://localhost:5173
```

**AppDev** (proyecto parent):
```bash
cd /Volumes/Untitled/VS_CODE/Projects/appdev
npm run dev
# Probablemente en: http://localhost:5174 o similar
```

### Paso 2: Acceder a Shift desde AppDev

1. Abre tu navegador en la URL de AppDev (ej: `http://localhost:5174`)
2. Verás una lista de apps disponibles
3. Haz clic en **"shift"**
4. Verás la interfaz de Shift cargada en un iframe

### Paso 3: Autenticar con los botones de usuario

AppDev mostrará botones para los usuarios configurados en `apps/shift.json`:

- **WORKER1@EmpresaA** - Trabajador normal
- **WORKER2@EmpresaA** - Otro trabajador
- **ADMIN1@EmpresaA** - Administrador con acceso completo
- **PORTER1@EdificioB** - Portero
- **SUPERADMIN@Placenet** - Super administrador

Al hacer clic en cualquier botón:
1. AppDev genera un token JWT firmado con RS256
2. Envía el token a Shift vía `postMessage`
3. Shift lo recibe, verifica y auto-crea el usuario
4. El usuario queda autenticado y puede fichar

## 📋 Usuarios Configurados

En `/Volumes/Untitled/VS_CODE/Projects/appdev/apps/shift.json`:

```json
{
    "avatar_id": "WORKER1",
    "avatar_name": "Juan Pérez",
    "avatar_email": "juan@empresa.com",
    "domain_id": "EmpresaA",
    "domain_name": "Empresa A S.L.",
    "role": "worker",
    "goto": "/"
}
```

- **`role: "worker"`**: Puede fichar y ver su historial
- **`role: "admin"`**: Puede fichar, ver historial, acceder a `/admin`, exportar datos
- **`domain_tags: ["admin"]`**: También otorga permisos de admin

## 🔧 Variables de Entorno

El archivo `.env` ya está configurado con:

```bash
# JWT Secret para tokens HS256 (desarrollo local)
JWT_SECRET=dev-secret-key-for-testing

# JWKS Endpoint para obtener las claves públicas de AppDev
JWKS_ENDPOINT=https://dev-placenet.fra1.cdn.digitaloceanspaces.com/dev-jwks.json
```

## 🔍 Debugging

### Ver mensajes en la consola

Abre las DevTools del navegador y verás:

**En AppDev (parent window)**:
```
[AppDev] >> { type: 'auth', token: '...', goto: '/' }
[AppDev] << READY
```

**En Shift (iframe)**:
```
[Shift] Received message: { type: 'auth', token: '...' }
[Shift] Token received from AppDev
```

### Verificar el token

En la consola de Shift (iframe):
```javascript
// Ver token guardado
localStorage.getItem('token')

// Decodificar token (sin verificación)
JSON.parse(atob(localStorage.getItem('token').split('.')[1]))
```

### Testear manualmente

Si quieres probar sin AppDev:

```javascript
// En la consola de Shift
localStorage.setItem('token', 'TU_TOKEN_AQUI');
location.reload();
```

O usa el endpoint de desarrollo:
```
http://localhost:5173/dev
```

## 🎯 Flujo Completo

1. **Usuario hace clic en botón** en AppDev
2. **AppDev genera token JWT**:
   ```javascript
   POST /api/jwt
   {
     "avatar_id": "WORKER1",
     "avatar_name": "Juan Pérez",
     "avatar_email": "juan@empresa.com",
     "domain_id": "EmpresaA",
     "domain_name": "Empresa A S.L.",
     "role": "worker"
   }
   ```
3. **AppDev envía mensaje** al iframe:
   ```javascript
   iframe.contentWindow.postMessage({
     type: 'auth',
     token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkRFVl9TVkMwMSJ9...',
     goto: '/'
   }, '*');
   ```
4. **Shift recibe mensaje**:
   - Guarda token en `localStorage`
   - Envía `READY` de vuelta
   - Verifica token usando la clave pública RS256
   - Normaliza datos de Placenet a formato Shift
   - Auto-crea usuario si no existe
   - Carga estado de fichaje
5. **Usuario puede fichar inmediatamente**

## 🔐 Seguridad

### Verificación de Tokens

Shift verifica tokens RS256 usando:
- **JWKS Endpoint**: Obtiene las claves públicas dinámicamente desde `https://dev-placenet.fra1.cdn.digitaloceanspaces.com/dev-jwks.json`
- **kid header**: Identifica qué clave usar del JWKS (ej: `DEV_SVC01`)
- **Algoritmo**: RS256 (firma asimétrica)
- **Cache**: Las claves se cachean en memoria para mejor rendimiento

### Auto-provisioning Seguro

Los usuarios se crean automáticamente SOLO si:
1. El token JWT es válido (firma verificada)
2. Contiene `avatar_email` y `avatar_name`
3. No existe previamente con ese email

### Roles

- Los roles se determinan por `domain_tags` en el token
- Si el token incluye `domain_tags: ["admin"]` o `domain_tags: ["shift_admin"]` → rol `admin`
- Si no → rol `worker`

## 📱 Acceso Directo

Si quieres acceder a Shift directamente (sin AppDev):

```
http://localhost:5173/dev
```

Genera un token de prueba y se te redirigirá automáticamente.

## ⚠️ Problemas Comunes

### Token inválido

Si ves "JWT verification failed" en la consola de Shift:
- Verifica que `JWKS_ENDPOINT` esté configurado en `.env`
- Asegúrate de que el JWKS endpoint esté accesible y devuelva las claves correctamente
- Comprueba que AppDev esté firmando los tokens con una clave que esté en el JWKS

### Usuario no se crea

Si el token es válido pero no se crea el usuario:
- Verifica que el token incluya `avatar_email` y `avatar_name`
- Revisa la consola del servidor de Shift para ver errores de DB

### postMessage no funciona

Si no se recibe el token:
- Abre DevTools en ambas ventanas (AppDev y Shift iframe)
- Verifica que veas los mensajes `[AppDev] >>` y `[Shift] Received message`
- Asegúrate de que Shift esté en un iframe dentro de AppDev

## 📚 Archivos Relevantes

- **AppDev Config**: `/Volumes/Untitled/VS_CODE/Projects/appdev/apps/shift.json`
- **Shift Auth**: `/Users/maximestebancalvo/shift/src/lib/server/auth.ts`
- **Shift Frontend**: `/Users/maximestebancalvo/shift/src/routes/+page.svelte`
- **Env Config**: `/Users/maximestebancalvo/shift/.env`

---

**Todo listo!** Ahora puedes acceder a Shift desde AppDev y los tokens se procesarán automáticamente.
