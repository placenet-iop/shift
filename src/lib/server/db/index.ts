import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

// Database path - stored in data directory
const DB_PATH = process.env.DB_PATH || './data/control_horario.db';

// Initialize database connection
let db: Database.Database | null = null;

export function getDb(): Database.Database {
	if (!db) {
		// Ensure data directory exists
		const dir = dirname(DB_PATH);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}

		db = new Database(DB_PATH);
		db.pragma('journal_mode = WAL'); // Better concurrency
		db.pragma('foreign_keys = ON'); // Enable foreign key constraints

		// Initialize schema
		initializeSchema(db);
	}
	return db;
}

function initializeSchema(database: Database.Database): void {
	const schemaPath = join(process.cwd(), 'src/lib/server/db/schema.sql');
	const schema = readFileSync(schemaPath, 'utf-8');

	// Execute schema
	database.exec(schema);

	// Run migrations
	runMigrations(database);

	console.log('Database schema initialized successfully');
}

function runMigrations(database: Database.Database): void {
	// Check if domain_id and domain_name columns exist in users table
	const columns = database.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
	const hasDomainId = columns.some(col => col.name === 'domain_id');
	const hasDomainName = columns.some(col => col.name === 'domain_name');

	// Add domain_id column if it doesn't exist
	if (!hasDomainId) {
		database.exec('ALTER TABLE users ADD COLUMN domain_id TEXT');
		console.log('Added domain_id column to users table');
	}

	// Add domain_name column if it doesn't exist
	if (!hasDomainName) {
		database.exec('ALTER TABLE users ADD COLUMN domain_name TEXT');
		console.log('Added domain_name column to users table');
	}
}

// Close database connection
export function closeDb(): void {
	if (db) {
		db.close();
		db = null;
	}
}

// Types for database records
export interface User {
	id: number;
	email: string;
	name: string;
	role: 'worker' | 'admin';
	domain_id?: string;
	domain_name?: string;
	active: number;
	created_at: string;
	updated_at: string;
}

export interface TimeEvent {
	id: number;
	user_id: number;
	event_type: 'in' | 'out' | 'pause_start' | 'pause_end';
	ts: string; // ISO-8601 UTC
	source: 'web' | 'mobile' | 'kiosk';
	ip?: string;
	user_agent?: string;
	meta?: string; // JSON
	created_at: string;
}

export interface AuditLog {
	id: number;
	admin_user_id: number;
	action: string;
	target_user_id?: number;
	details?: string; // JSON
	ip?: string;
	ts: string;
}

// Helper functions for database operations
export const queries = {
	// User queries
	getUserById: (id: number): User | undefined => {
		const db = getDb();
		return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
	},

	getUserByEmail: (email: string): User | undefined => {
		const db = getDb();
		return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
	},

	createUser: (email: string, name: string, role: 'worker' | 'admin' = 'worker', domainId?: string, domainName?: string): number => {
		const db = getDb();
		const result = db
			.prepare('INSERT INTO users (email, name, role, domain_id, domain_name) VALUES (?, ?, ?, ?, ?)')
			.run(email, name, role, domainId || null, domainName || null);
		return result.lastInsertRowid as number;
	},

	// Time event queries
	createTimeEvent: (
		userId: number,
		eventType: 'in' | 'out' | 'pause_start' | 'pause_end',
		ts: string,
		source: 'web' | 'mobile' | 'kiosk',
		ip?: string,
		userAgent?: string,
		meta?: object
	): number => {
		const db = getDb();
		const result = db
			.prepare(
				'INSERT INTO time_events (user_id, event_type, ts, source, ip, user_agent, meta) VALUES (?, ?, ?, ?, ?, ?, ?)'
			)
			.run(userId, eventType, ts, source, ip || null, userAgent || null, meta ? JSON.stringify(meta) : null);
		return result.lastInsertRowid as number;
	},

	getTimeEventsByUser: (userId: number, from?: string, to?: string): TimeEvent[] => {
		const db = getDb();
		let query = 'SELECT * FROM time_events WHERE user_id = ?';
		const params: (number | string)[] = [userId];

		if (from) {
			query += ' AND ts >= ?';
			params.push(from);
		}
		if (to) {
			query += ' AND ts <= ?';
			params.push(to);
		}

		query += ' ORDER BY ts DESC';

		return db.prepare(query).all(...params) as TimeEvent[];
	},

	getAllTimeEvents: (from?: string, to?: string): TimeEvent[] => {
		const db = getDb();
		let query = 'SELECT * FROM time_events WHERE 1=1';
		const params: string[] = [];

		if (from) {
			query += ' AND ts >= ?';
			params.push(from);
		}
		if (to) {
			query += ' AND ts <= ?';
			params.push(to);
		}

		query += ' ORDER BY ts DESC';

		return db.prepare(query).all(...params) as TimeEvent[];
	},

	getLatestEventByUser: (userId: number): TimeEvent | undefined => {
		const db = getDb();
		return db
			.prepare('SELECT * FROM time_events WHERE user_id = ? ORDER BY ts DESC LIMIT 1')
			.get(userId) as TimeEvent | undefined;
	},

	// Audit log queries
	createAuditLog: (
		adminUserId: number,
		action: string,
		targetUserId?: number,
		details?: object,
		ip?: string
	): number => {
		const db = getDb();
		const result = db
			.prepare(
				'INSERT INTO audit_log (admin_user_id, action, target_user_id, details, ip) VALUES (?, ?, ?, ?, ?)'
			)
			.run(
				adminUserId,
				action,
				targetUserId || null,
				details ? JSON.stringify(details) : null,
				ip || null
			);
		return result.lastInsertRowid as number;
	},

	getAuditLogs: (from?: string, to?: string, limit: number = 100): AuditLog[] => {
		const db = getDb();
		let query = 'SELECT * FROM audit_log WHERE 1=1';
		const params: (string | number)[] = [];

		if (from) {
			query += ' AND ts >= ?';
			params.push(from);
		}
		if (to) {
			query += ' AND ts <= ?';
			params.push(to);
		}

		query += ' ORDER BY ts DESC LIMIT ?';
		params.push(limit);

		return db.prepare(query).all(...params) as AuditLog[];
	}
};
