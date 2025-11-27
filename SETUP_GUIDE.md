# Setup and Integration Guide with Placenet

## 1. File Structure

```
shift/
├── shift.json                    # Main app configuration
├── .env.example                  # Environment variables template
├── placenet-integration.php      # PHP class for integration
├── PLACENET_INTEGRATION.md       # Integration documentation
├── LEGAL_COMPLIANCE.md           # Legal documentation
├── README.md                     # General documentation
└── src/
    ├── lib/server/
    │   ├── config.ts             # Reading shift.json
    │   ├── auth.ts               # JWT authentication compatible with Placenet
    │   └── db/
    │       ├── index.ts          # Database operations
    │       └── schema.sql        # Immutable schema
    └── routes/
        ├── +page.svelte          # Clock interface
        ├── history/              # Personal history
        ├── admin/                # Administrative panel
        └── api/                  # REST endpoints
```

## 2. Initial Configuration

### Step 1: Environment Variables

Create a `.env` file in the shift root:

```bash
# IMPORTANT: JWT_SECRET must be the SAME as in Placenet
JWT_SECRET=your-shared-secret-key-with-placenet

# Database
DB_PATH=./data/control_horario.db

# Environment
NODE_ENV=development

# Base URL (optional, for production)
BASE_URL=http://localhost:5173
```

### Step 2: Install Dependencies

```bash
cd shift
npm install
```

### Step 3: Start the Server

```bash
# Development
npm run dev

# Production
npm run build
npm run preview
```

## 3. Integration with Placenet

### Option A: PHP Integration (Recommended)

1. **Copy the integration file**

```bash
cp placenet-integration.php /path/to/placenet/app/Integration/ShiftIntegration.php
```

2. **Adjust the namespace if necessary** (edit line 10)

3. **Use in your PHP code**

```php
<?php
use App\Integration\ShiftIntegration;
use App\Token;

// Create Placenet token (example with current user data)
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

// Initialize integration
$shift = new ShiftIntegration('http://localhost:5173');

// Clock in
try {
    $result = $shift->clockIn($token);
    echo "Clock successful: " . $result['event']['ts'];
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
```

### Option B: JavaScript/Frontend Integration

```javascript
// Get JWT token from Placenet (example)
const placenetToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';

// Helper function for Shift API calls
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

// Usage examples
async function examples() {
  // Clock in
  const clockIn = await shiftAPI('/api/time/clock', 'POST', {
    event_type: 'in'
  });

  // View status
  const status = await shiftAPI('/api/time/status');
  console.log('Status:', status.status);

  // View history
  const events = await shiftAPI('/api/time/events?from=2024-01-01');
  console.log('Events:', events.events);
}
```

### Option C: Iframe Integration

```html
<!-- In your Placenet app -->
<!DOCTYPE html>
<html>
<head>
    <title>Time Control</title>
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
        // Send token to iframe when it loads
        const iframe = document.getElementById('shift-container');
        const placenetToken = '<?php echo $token; ?>';

        iframe.addEventListener('load', function() {
            // Store token in iframe localStorage
            iframe.contentWindow.localStorage.setItem('token', placenetToken);
            iframe.contentWindow.location.reload();
        });
    </script>
</body>
</html>
```

## 4. Role Configuration

In `shift.json`, roles are configured like this:

```json
{
  "integration": {
    "placenet": {
      "admin_tags": ["admin", "shift_admin"]
    }
  }
}
```

**How it works:**
- If Placenet token has `domain_tags: ['admin']` → `admin` role in Shift
- If Placenet token has `domain_tags: ['shift_admin']` → `admin` role in Shift
- If it doesn't have those tags → `worker` role in Shift

## 5. Testing

### Test 1: Create user manually

```bash
curl -X POST http://localhost:5173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "role": "worker"
  }'
```

Expected response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "name": "Test User",
    "role": "worker"
  }
}
```

### Test 2: Clock in with the token

```bash
# Save the token from the previous response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Clock in
curl -X POST http://localhost:5173/api/time/clock \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "in"}'
```

### Test 3: View status

```bash
curl http://localhost:5173/api/time/status \
  -H "Authorization: Bearer $TOKEN"
```

### Test 4: View history

```bash
curl http://localhost:5173/api/time/events \
  -H "Authorization: Bearer $TOKEN"
```

### Test 5: Test with Placenet token (PHP)

```php
<?php
// In your Placenet environment
require_once 'app/Token.php';
use App\Token;

// Create test token
$token = Token::fromTest('tenant1'); // Use one of the predefined tests
echo "Token: " . $token . "\n";

// Make request to Shift
$ch = curl_init('http://localhost:5173/api/time/status');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token,
    'Content-Type: application/json'
]);
$response = curl_exec($ch);
echo "Response: " . $response . "\n";
```

## 6. Production

### Deployment Checklist

- [ ] Configure secure `JWT_SECRET` (same in Placenet and Shift)
- [ ] Set `NODE_ENV=production`
- [ ] Configure HTTPS (mandatory)
- [ ] Configure automatic database backup
- [ ] Review access permissions to `/data`
- [ ] Configure CORS if Placenet and Shift are on different domains
- [ ] Test all endpoints in production
- [ ] Configure log monitoring
- [ ] Document backup/restore procedures

### Environment Variables in Production

```bash
# .env (production)
JWT_SECRET=very-secure-randomly-generated-key
DB_PATH=/var/lib/shift/control_horario.db
NODE_ENV=production
BASE_URL=https://shift.yourcompany.com
PORT=3000
```

### CORS Configuration (if necessary)

If Placenet and Shift are on different domains, you need to configure CORS.

Create `src/hooks.server.ts`:

```typescript
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Allow CORS from Placenet
	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			headers: {
				'Access-Control-Allow-Origin': 'https://placenet.yourcompany.com',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				'Access-Control-Max-Age': '86400'
			}
		});
	}

	const response = await resolve(event);

	response.headers.set('Access-Control-Allow-Origin', 'https://placenet.yourcompany.com');
	response.headers.set('Access-Control-Allow-Credentials', 'true');

	return response;
};
```

## 7. Monitoring

### Audit Logs

View all administrative accesses:

```bash
sqlite3 ./data/control_horario.db "SELECT * FROM audit_log ORDER BY ts DESC LIMIT 20;"
```

### Usage Statistics

```sql
-- Clock entries per day
SELECT
  DATE(ts) as fecha,
  COUNT(*) as total_fichajes
FROM time_events
GROUP BY DATE(ts)
ORDER BY fecha DESC
LIMIT 30;

-- Most active users
SELECT
  u.name,
  COUNT(*) as fichajes
FROM time_events te
JOIN users u ON te.user_id = u.id
GROUP BY u.id
ORDER BY fichajes DESC;
```

## 8. Support

### Error Logs

Errors are logged in the server console. To view in real-time:

```bash
npm run dev  # development mode with detailed logs
```

### Database

Connect directly:

```bash
sqlite3 ./data/control_horario.db

# Useful commands:
.tables          # View all tables
.schema users    # View table schema
SELECT * FROM users;  # View users
```

### Common Issues

**1. Invalid token**
- Verify that `JWT_SECRET` is the same in Placenet and Shift
- Check that the token hasn't expired
- Review token format

**2. User not created automatically**
- Verify that the token includes `avatar_email` and `avatar_name`
- Check server logs
- Verify database connection

**3. Incorrect permissions**
- Verify `domain_tags` in Placenet token
- Review `admin_tags` configuration in shift.json

**4. CORS errors**
- Configure CORS in `src/hooks.server.ts`
- Verify allowed domains

## 9. Additional Documentation

- **README.md**: General application documentation
- **LEGAL_COMPLIANCE.md**: Legal compliance and GDPR
- **PLACENET_INTEGRATION.md**: Placenet integration details
- **shift.json**: Complete application configuration

## 10. Contact and Support

To report issues or request help:
1. Review this documentation
2. Check server logs
3. Verify `shift.json` and `.env` configuration
4. Contact the development team

---

**Last update**: 2024-11-10
