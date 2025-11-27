# Integration with AppDev

## ✅ Configuration Completed

Shift is now configured to receive JWT tokens from AppDev. The changes made:

1. **JWKS Support**: Shift now dynamically obtains public keys from Placenet's JWKS endpoint
2. **JWT RS256 Support**: Verifies tokens signed with RS256 using keys from the JWKS endpoint
3. **postMessage Listener**: Listens for AppDev format messages `{ type: 'auth', token: '...', goto: '...' }`
4. **READY Protocol**: Sends `READY` to AppDev when the app loads
5. **Auto-provisioning**: Automatically creates users from JWT token data

## 🚀 How to Use

### Step 1: Ensure both servers are running

**Shift** (this project):
```bash
cd /Users/maximestebancalvo/shift
npm run dev
# Should be at: http://localhost:5173
```

**AppDev** (parent project):
```bash
cd /Volumes/Untitled/VS_CODE/Projects/appdev
npm run dev
# Probably at: http://localhost:5174 or similar
```

### Step 2: Access Shift from AppDev

1. Open your browser at the AppDev URL (e.g., `http://localhost:5174`)
2. You'll see a list of available apps
3. Click on **"shift"**
4. You'll see the Shift interface loaded in an iframe

### Step 3: Authenticate with user buttons

AppDev will show buttons for users configured in `apps/shift.json`:

- **WORKER1@EmpresaA** - Regular worker
- **WORKER2@EmpresaA** - Another worker
- **ADMIN1@EmpresaA** - Administrator with full access
- **PORTER1@EdificioB** - Porter
- **SUPERADMIN@Placenet** - Super administrator

When clicking any button:
1. AppDev generates an RS256-signed JWT token
2. Sends the token to Shift via `postMessage`
3. Shift receives it, verifies and auto-creates the user
4. The user is authenticated and can clock in/out

## 📋 Configured Users

In `/Volumes/Untitled/VS_CODE/Projects/appdev/apps/shift.json`:

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

- **`role: "worker"`**: Can clock in/out and view their history
- **`role: "admin"`**: Can clock in/out, view history, access `/admin`, export data
- **`domain_tags: ["admin"]`**: Also grants admin permissions

## 🔧 Environment Variables

The `.env` file is already configured with:

```bash
# JWT Secret for HS256 tokens (local development)
JWT_SECRET=dev-secret-key-for-testing

# JWKS Endpoint to obtain public keys from AppDev
JWKS_ENDPOINT=https://dev-placenet.fra1.cdn.digitaloceanspaces.com/dev-jwks.json
```

## 🔍 Debugging

### View messages in console

Open the browser DevTools and you'll see:

**In AppDev (parent window)**:
```
[AppDev] >> { type: 'auth', token: '...', goto: '/' }
[AppDev] << READY
```

**In Shift (iframe)**:
```
[Shift] Received message: { type: 'auth', token: '...' }
[Shift] Token received from AppDev
```

### Verify the token

In the Shift console (iframe):
```javascript
// View stored token
localStorage.getItem('token')

// Decode token (without verification)
JSON.parse(atob(localStorage.getItem('token').split('.')[1]))
```

### Manual testing

If you want to test without AppDev:

```javascript
// In the Shift console
localStorage.setItem('token', 'YOUR_TOKEN_HERE');
location.reload();
```

Or use the development endpoint:
```
http://localhost:5173/dev
```

## 🎯 Complete Flow

1. **User clicks button** in AppDev
2. **AppDev generates JWT token**:
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
3. **AppDev sends message** to iframe:
   ```javascript
   iframe.contentWindow.postMessage({
     type: 'auth',
     token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkRFVl9TVkMwMSJ9...',
     goto: '/'
   }, '*');
   ```
4. **Shift receives message**:
   - Stores token in `localStorage`
   - Sends `READY` back
   - Verifies token using RS256 public key
   - Normalizes Placenet data to Shift format
   - Auto-creates user if it doesn't exist
   - Loads clock status
5. **User can clock in immediately**

## 🔐 Security

### Token Verification

Shift verifies RS256 tokens using:
- **JWKS Endpoint**: Dynamically obtains public keys from `https://dev-placenet.fra1.cdn.digitaloceanspaces.com/dev-jwks.json`
- **kid header**: Identifies which key to use from JWKS (e.g., `DEV_SVC01`)
- **Algorithm**: RS256 (asymmetric signature)
- **Cache**: Keys are cached in memory for better performance

### Secure Auto-provisioning

Users are automatically created ONLY if:
1. The JWT token is valid (signature verified)
2. Contains `avatar_email` and `avatar_name`
3. Doesn't already exist with that email

### Roles

- Roles are determined by `domain_tags` in the token
- If the token includes `domain_tags: ["admin"]` or `domain_tags: ["shift_admin"]` → `admin` role
- Otherwise → `worker` role

## 📱 Direct Access

If you want to access Shift directly (without AppDev):

```
http://localhost:5173/dev
```

Generates a test token and redirects automatically.

## ⚠️ Common Issues

### Invalid token

If you see "JWT verification failed" in the Shift console:
- Verify that `JWKS_ENDPOINT` is configured in `.env`
- Ensure the JWKS endpoint is accessible and returns keys correctly
- Check that AppDev is signing tokens with a key that's in the JWKS

### User not created

If the token is valid but the user isn't created:
- Verify that the token includes `avatar_email` and `avatar_name`
- Check the Shift server console for DB errors

### postMessage not working

If the token isn't received:
- Open DevTools in both windows (AppDev and Shift iframe)
- Verify you see messages `[AppDev] >>` and `[Shift] Received message`
- Ensure Shift is in an iframe within AppDev

## 📚 Relevant Files

- **AppDev Config**: `/Volumes/Untitled/VS_CODE/Projects/appdev/apps/shift.json`
- **Shift Auth**: `/Users/maximestebancalvo/shift/src/lib/server/auth.ts`
- **Shift Frontend**: `/Users/maximestebancalvo/shift/src/routes/+page.svelte`
- **Env Config**: `/Users/maximestebancalvo/shift/.env`

---

**Everything ready!** Now you can access Shift from AppDev and tokens will be processed automatically.
