# Time Control - Working Hours Registration System

Digital time control system that complies with Spanish legislation (Royal Decree-Law 8/2019) and prepared for 2026 regulations.

## Main Features

- **Immutable registration** of entry/exit and breaks
- **Legal compliance** with Spanish regulations
- **GDPR compliant** with audit system
- **Intuitive interface** for workers and administrators
- **Export** in CSV and JSON
- **Complete traceability** of all events
- **Integration** with Placenet via JWT

## Technologies

- **Frontend**: SvelteKit + TypeScript
- **Database**: SQLite (better-sqlite3)
- **Authentication**: JWT (jsonwebtoken)
- **Styling**: Integrated modular CSS

## Project Structure

```
shift/
├── src/
│   ├── lib/
│   │   └── server/
│   │       ├── db/
│   │       │   ├── index.ts          # Database connection and queries
│   │       │   └── schema.sql        # Database schema
│   │       └── auth.ts               # JWT authentication
│   ├── routes/
│   │   ├── +page.svelte              # Main page (clock in/out)
│   │   ├── history/
│   │   │   └── +page.svelte          # Worker history
│   │   ├── admin/
│   │   │   └── +page.svelte          # Administration panel
│   │   └── api/
│   │       ├── auth/
│   │       │   └── login/+server.ts  # Development login
│   │       ├── time/
│   │       │   ├── clock/+server.ts  # Clock in/out
│   │       │   ├── events/+server.ts # Event queries
│   │       │   └── status/+server.ts # Current status
│   │       └── admin/
│   │           ├── events/+server.ts # View all events
│   │           ├── export/+server.ts # Export data
│   │           └── users/+server.ts  # List users
│   ├── app.html
│   └── app.d.ts
├── static/                           # Static files
├── data/                             # Database (created automatically)
├── LEGAL_COMPLIANCE.md               # Legal compliance documentation
├── README.md                         # This file
├── package.json
├── svelte.config.js
├── tsconfig.json
└── vite.config.ts
```

## Installation

```bash
# Install dependencies (if not installed)
npm install

# Start in development
npm run dev

# Build for production
npm run build

# Production preview
npm run preview
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# JWT Secret (must match Placenet in production)
JWT_SECRET=your-very-secure-secret-key-change-in-production

# Database path
DB_PATH=./data/control_horario.db

# Port (optional, default 5173 in dev)
PORT=3000

# Environment
NODE_ENV=production
```

### Integration with Placenet

To integrate with Placenet, make sure to:

1. Configure the same `JWT_SECRET` key that Placenet uses
2. Placenet JWT tokens must include:
   ```json
   {
     "userId": 123,
     "email": "user@example.com",
     "name": "Juan Pérez",
     "role": "worker"
   }
   ```
3. Send the token in the header: `Authorization: Bearer <token>`

## Usage

### For Workers

1. **Login**: Access the application with credentials
2. **Clock in/out**:
   - Entry: "Clock In" button
   - Break: "Start Break" button (only if clocked in)
   - Resume: "Resume Work" button (only if on break)
   - Exit: "Clock Out" button (only if clocked in)
3. **View history**: "View History" link to check clock entries

### For Administrators

1. **Login** with administrator account
2. **View records**:
   - Access `/admin`
   - Filter by user, date
   - View all clock entries
3. **Export**:
   - "Export CSV" or "Export JSON" button
   - Automatic file download
4. **Manage users**:
   - "Users" tab
   - View list of workers

## API Endpoints

### Authentication

```bash
# Login (development)
POST /api/auth/login
Body: { "email": "user@example.com", "name": "Juan Pérez", "role": "worker" }
Response: { "success": true, "token": "jwt-token", "user": {...} }
```

### Clock in/out (requires authentication)

```bash
# Clock in/out
POST /api/time/clock
Headers: { "Authorization": "Bearer <token>" }
Body: { "event_type": "in" | "out" | "pause_start" | "pause_end" }

# View current status
GET /api/time/status
Headers: { "Authorization": "Bearer <token>" }

# View own history
GET /api/time/events?from=2024-01-01&to=2024-12-31
Headers: { "Authorization": "Bearer <token>" }
```

### Administration (requires admin role)

```bash
# View all events
GET /api/admin/events?from=2024-01-01&to=2024-12-31&user_id=1
Headers: { "Authorization": "Bearer <token>" }

# Export data
GET /api/admin/export?format=csv&from=2024-01-01&to=2024-12-31
Headers: { "Authorization": "Bearer <token>" }

# List users
GET /api/admin/users
Headers: { "Authorization": "Bearer <token>" }
```

## Database

### Schema

- **users**: System users (workers and administrators)
- **time_events**: Clock entries (immutable)
- **audit_log**: Audit log of administrative actions

### Security Features

- Triggers that prevent UPDATE and DELETE on `time_events`
- Foreign keys enabled
- WAL journal mode for better concurrency
- Indexes for efficient queries

### Direct Queries (Administrators)

```bash
# Connect to database
sqlite3 ./data/control_horario.db

# View all events
SELECT * FROM time_events ORDER BY ts DESC LIMIT 10;

# View audit log
SELECT * FROM audit_log ORDER BY ts DESC;

# Statistics by user
SELECT u.name, COUNT(*) as total_events
FROM time_events te
JOIN users u ON te.user_id = u.id
GROUP BY u.id;
```

## Backup and Retention

Records must be kept for **minimum 4 years** according to Spanish legislation.

```bash
# Manual backup
cp ./data/control_horario.db ./backups/control_horario_$(date +%Y%m%d).db

# Backup with cron (daily at 2 AM)
0 2 * * * cp /path/to/shift/data/control_horario.db /path/to/backups/backup_$(date +\%Y\%m\%d).db

# Backup with compression
tar -czf backup_$(date +%Y%m%d).tar.gz ./data/
```

## Legal Compliance

See [LEGAL_COMPLIANCE.md](./LEGAL_COMPLIANCE.md) for:
- Legal basis (RD 8/2019)
- Implemented requirements
- Documentation for Labor Inspection
- GDPR compliance
- Audit procedures

## Development

### Create an administrator user

```bash
# Use the login endpoint with role=admin
curl -X POST http://localhost:5173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","name":"Admin","role":"admin"}'
```

### Testing

```bash
# Verify that triggers work
npm run dev
# In another terminal:
sqlite3 ./data/control_horario.db

# Try to modify a record (should fail)
sqlite> UPDATE time_events SET event_type = 'modified' WHERE id = 1;
# Error: Modification of time events is not allowed.

# Try to delete a record (should fail)
sqlite> DELETE FROM time_events WHERE id = 1;
# Error: Deletion of time events is not allowed.
```

## Production Deployment

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Environment variables**:
   - Configure secure `JWT_SECRET`
   - Configure `DB_PATH` in persistent location
   - Set `NODE_ENV=production`

3. **HTTPS mandatory**:
   - Use reverse proxy (nginx, Caddy)
   - Valid SSL certificate

4. **Automatic backups**:
   - Configure cron job for daily backups
   - Store backups in secure location
   - Test restoration periodically

5. **Monitoring**:
   - Access logs
   - Error alerts
   - Periodic audit log review

---

**Developed to comply with Spanish time control legislation**
**RD 8/2019 and prepared for 2026 regulations**

✅ Legal requirements the app must comply with
1. Mandatory digital registration

The registration of working hours (entry and exit times) must be mandatory for all workers. 
Europa Press
+2
Labor Control
+2

The system must be digital (paper-only or Excel methods no longer valid) and accessible to the worker and inspection. 
Gestoría Cantón
+2
ejornada.es
+2

It must also register breaks or rest periods if applicable to the work schedule. 
Software CRM

2. Identification and reliability

The system must unambiguously identify the worker performing the clock entry. 
ejornada.es
+1

Data must be unalterable or modifiable only with traceability (e.g., not allowing deletion without leaving a trace). 
Software CRM
+1

It must allow registration via digital devices (computer, mobile, tablet) adapted to remote or on-site work. 
kaicontrol.com
+1

3. Transparency and access

Workers must be able to access their working hours records. 
Grupo Albatros
+1

Labor inspection must be able to access or request digital records, in real-time or via export. 
Software CRM
+1

4. Data retention

Records must be kept for a minimum of 4 years. 
Turno Digital
+1

Backup, security, integrity and availability policies for this data must be established. 
Turno Digital

5. Elimination of paper / non-compliant tools

Systems that do not guarantee integrity and traceability (e.g., paper, Excel) for registration will become obsolete. 
evolkgalicia.es
+1

6. Data protection compliance (GDPR)

Although registration is based on legal obligation, you must comply with the General Data Protection Regulation: inform the worker, minimize personal data, control access, etc. 
Cinco Días
+1

If sensitive data is used (fingerprint, biometric), additional security requirements. 
aycelaborytax.com

7. Non-compliance sanctions

Companies that do not comply may face sanctions ranging from minor to serious fines, even per affected worker. 
Soluserv
+1

8. Worker information / rights

Registration must also respect the right to digital disconnection and transparency about actual working hours. 
Gestoría Cantón

It is advisable for the company to inform the worker about the processing of their data and the registration system.

🧾 Minimum specifications for your app (to move to development)

Interface for each worker to register start, end of workday and break(s) (if applicable).

Strong authentication (since you'll use Placenet's JWT) to ensure identity.

Save each event: user, event type (entry/exit/break), timestamp (UTC), device origin/IP, user agent.

Database that prevents deletion/modification of historical records without leaving a trace (append-only).

Endpoint for the worker to view their history.

Endpoint to export records for administration / inspection (CSV or other standard format).

Backup and data retention system ≥ 4 years.

Security: encryption/roles/restricted access.

Integration with data protection: notice to worker, processing registry, data minimization.

Prepared for different environments: on-site, remote.

Audit logs when configurations or roles are modified.
