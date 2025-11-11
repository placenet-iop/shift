-- Control Horario Database Schema
-- Compliant with Spanish labor law (RD 8/2019) and RGPD

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('worker', 'admin')) DEFAULT 'worker',
    domain_id TEXT,
    domain_name TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Time events table (IMMUTABLE - append-only)
-- Stores all clock in/out/pause events
CREATE TABLE IF NOT EXISTS time_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('in', 'out', 'pause_start', 'pause_end')),
    ts TEXT NOT NULL, -- ISO-8601 UTC timestamp
    source TEXT NOT NULL CHECK(source IN ('web', 'mobile', 'kiosk')) DEFAULT 'web',
    ip TEXT,
    user_agent TEXT,
    meta TEXT, -- JSON for additional data
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_time_events_user_ts ON time_events(user_id, ts);
CREATE INDEX IF NOT EXISTS idx_time_events_created ON time_events(created_at);

-- Audit log table for administrative actions
-- Tracks who accessed/exported data for RGPD compliance
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_user_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'export', 'view_records', 'create_user', etc.
    target_user_id INTEGER, -- User affected by the action
    details TEXT, -- JSON with additional info
    ip TEXT,
    ts TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    FOREIGN KEY (admin_user_id) REFERENCES users(id),
    FOREIGN KEY (target_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts);

-- IMMUTABILITY TRIGGERS
-- Prevent UPDATE and DELETE on time_events to ensure legal compliance
CREATE TRIGGER IF NOT EXISTS prevent_time_events_update
BEFORE UPDATE ON time_events
BEGIN
    SELECT RAISE(ABORT, 'Modification of time events is not allowed. Legal requirement: records must be immutable.');
END;

CREATE TRIGGER IF NOT EXISTS prevent_time_events_delete
BEFORE DELETE ON time_events
BEGIN
    SELECT RAISE(ABORT, 'Deletion of time events is not allowed. Legal requirement: records must be preserved for 4 years.');
END;

-- Trigger to update users.updated_at
CREATE TRIGGER IF NOT EXISTS update_users_timestamp
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;
