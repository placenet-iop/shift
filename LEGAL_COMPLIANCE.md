# Time Control - Legal Compliance

## Legal Basis

This time control application complies with current Spanish legislation:

### Royal Decree-Law 8/2019, of March 8
- Establishes the obligation to register daily working hours
- Mandatory registration of entry and exit times
- Records must be kept for 4 years
- Accessibility for workers and Labor Inspection

### 2026 Regulations (Prepared for)
- 100% digital registration
- Secure and unalterable system
- Applicable to all companies

## Implemented Legal Requirements

### 1. Mandatory Daily Registration ✅
- Registration of exact start and end times
- Registration of breaks during the workday
- Unambiguous link to the worker via JWT

### 2. Reliability and Immutability ✅
- Database tables in append-only mode
- Triggers that prevent UPDATE and DELETE on records
- Impossible to modify or delete clock entries once created
- Complete traceability: user, timestamp, IP, user-agent

### 3. Worker Identification ✅
- Authentication via JWT (integrable with Placenet)
- Each clock entry unambiguously linked to the user
- Shared or generic registration not allowed

### 4. Record Accessibility ✅
- Workers can consult their history at `/history`
- Administrators can access all records at `/admin`
- Export available in CSV and JSON
- Search system by dates and user

### 5. Minimum Data Retention ✅
- Persistent SQLite database
- Records maintained indefinitely (minimum 4 years)
- Backup system recommended (administrator's responsibility)

### 6. Exportability and Reports ✅
- Export to CSV with standard format
- Export to JSON for processing
- Includes: name, email, date, time, event type, IP, browser
- Endpoint: `/api/admin/export`

### 7. Remote Work Adaptation ✅
- Clock in/out from any device with a browser
- Client IP registration
- Clock source identified (web/mobile/kiosk)

### 8. GDPR Compliance ✅

#### Legal Basis
- Article 6.1.c GDPR: Legal obligation of the employer
- Processing of personal data justified by labor regulations

#### Registered Data (Minimum Necessary)
- Worker's email
- Worker's name
- Entry/exit/pause timestamps
- Connection IP (optional, proportional)
- Browser user-agent (for auditing)

#### Security Measures
- Authentication via JWT
- HTTPS recommended in production
- Role-based access control
- Audit log of all administrative actions
- Database with foreign keys and constraints

#### ARCO Rights
Workers have the right to:
- **Access**: View their clock history at `/history`
- **Rectification**: Contact administrator (records immutable by law)
- **Cancellation**: According to retention regulations (4 years minimum)
- **Opposition**: Only possible if there's no legal obligation

### 9. Role and Access Control ✅
- **worker**: Can clock in/out and view their own history
- **admin**: Can view all records, export and audit
- Editing or deletion of records not allowed

### 10. Immediate Availability ✅
- REST API available at all times
- Immediate export in CSV/JSON
- No data manipulation
- Audit log of all exports

## Audit and Traceability

### Audit Log System
All administrative actions are recorded:
- Viewing records of other users
- Data export
- User who performed the action
- Date and time of the action
- IP from where it was performed

### Audit Log Query
Administrators can query the audit log in the database:
```sql
SELECT * FROM audit_log ORDER BY ts DESC;
```

## Documentation for Labor Inspection

### In case of ITSS request:

1. **Operating manual**: See README.md
2. **Record export**: Use `/api/admin/export`
3. **Retention policy**: 4 years (no upper limit)
4. **Data controller**: [COMPANY NAME]
5. **Incident procedure**: Contact system administrator

### Export for Inspection
```bash
# Export all records in CSV
curl -H "Authorization: Bearer TOKEN" \
  "https://[DOMAIN]/api/admin/export?format=csv" > records.csv

# Export records from a specific period
curl -H "Authorization: Bearer TOKEN" \
  "https://[DOMAIN]/api/admin/export?from=2024-01-01&to=2024-12-31&format=csv" > records_2024.csv
```

## Production Configuration

### Recommended Environment Variables
```bash
# JWT Secret (must match Placenet)
JWT_SECRET=your-secure-secret-key

# Database path
DB_PATH=./data/control_horario.db

# Server port
PORT=3000

# Environment
NODE_ENV=production
```

### HTTPS Mandatory
In production, the system MUST be served via HTTPS to:
- Protect JWT tokens in transit
- Comply with GDPR security measures
- Prevent interception of personal data

### Recommended Backup
```bash
# Daily database backup
cp ./data/control_horario.db ./backups/control_horario_$(date +%Y%m%d).db

# Backup with compression
tar -czf backup_$(date +%Y%m%d).tar.gz ./data/
```

## Contact and Responsibility

**Data Controller**: [COMPANY NAME]
**Data Protection Officer**: [CONTACT]
**Contact**: [EMAIL]

---

## Technical Guarantees of Immutability

### SQL Triggers
The system implements triggers that prevent modification or deletion:

```sql
-- Prevent UPDATE on time_events
CREATE TRIGGER prevent_time_events_update
BEFORE UPDATE ON time_events
BEGIN
    SELECT RAISE(ABORT, 'Modification of time events is not allowed.');
END;

-- Prevent DELETE on time_events
CREATE TRIGGER prevent_time_events_delete
BEFORE DELETE ON time_events
BEGIN
    SELECT RAISE(ABORT, 'Deletion of time events is not allowed.');
END;
```

If an administrator attempts to modify records directly in the database, the operation will be rejected with an error.

## Last Update Date
2024-11-10
