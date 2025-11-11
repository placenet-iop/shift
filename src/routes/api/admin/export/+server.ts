import { type RequestHandler } from '@sveltejs/kit';
import { queries, getDb } from '$lib/server/db';
import { getUserFromRequest, requireAdmin, getClientIP } from '$lib/server/auth';

/**
 * GET /api/admin/export
 * Export time events to CSV (admin only)
 *
 * Query params:
 *   from: ISO-8601 date (optional)
 *   to: ISO-8601 date (optional)
 *   user_id: Filter by user ID (optional)
 *   format: 'csv' (default) or 'json'
 */
export const GET: RequestHandler = async ({ request, url }) => {
	try {
		// Authenticate and require admin
		const user = await getUserFromRequest(request);
		requireAdmin(user);

		if (!user) {
			return new Response('Unauthorized', { status: 401 });
		}

		// Get query parameters
		const from = url.searchParams.get('from') || undefined;
		const to = url.searchParams.get('to') || undefined;
		const userId = url.searchParams.get('user_id');
		const format = url.searchParams.get('format') || 'csv';

		// Log audit
		const ip = getClientIP(request);
		queries.createAuditLog(
			user.id,
			'export_records',
			userId ? parseInt(userId) : undefined,
			{ from, to, format },
			ip
		);

		// Get events with user information
		const db = getDb();
		let query = `
			SELECT
				u.name as worker_name,
				u.email as worker_email,
				te.event_type,
				te.ts,
				te.source,
				te.ip,
				te.user_agent,
				te.created_at
			FROM time_events te
			JOIN users u ON te.user_id = u.id
			WHERE 1=1
		`;
		const params: (string | number)[] = [];

		if (from) {
			query += ' AND te.ts >= ?';
			params.push(from);
		}
		if (to) {
			query += ' AND te.ts <= ?';
			params.push(to);
		}
		if (userId) {
			query += ' AND te.user_id = ?';
			params.push(parseInt(userId));
		}

		query += ' ORDER BY te.ts DESC';

		const events = db.prepare(query).all(...params);

		// Generate export
		if (format === 'json') {
			return new Response(JSON.stringify(events, null, 2), {
				headers: {
					'Content-Type': 'application/json',
					'Content-Disposition': `attachment; filename="control_horario_${Date.now()}.json"`
				}
			});
		}

		// Generate CSV
		const csv = generateCSV(events);

		return new Response(csv, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="control_horario_${Date.now()}.csv"`
			}
		});
	} catch (error) {
		console.error('Export error:', error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : 'Internal server error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};

function generateCSV(data: any[]): string {
	if (data.length === 0) {
		return 'No data available';
	}

	// CSV Headers
	const headers = [
		'Trabajador',
		'Email',
		'Tipo de Evento',
		'Fecha y Hora',
		'Origen',
		'IP',
		'Navegador',
		'Registrado en'
	];

	// CSV Rows
	const rows = data.map((record) => [
		escapeCSV(record.worker_name),
		escapeCSV(record.worker_email),
		escapeCSV(translateEventType(record.event_type)),
		escapeCSV(record.ts),
		escapeCSV(record.source),
		escapeCSV(record.ip || ''),
		escapeCSV(record.user_agent || ''),
		escapeCSV(record.created_at)
	]);

	// Combine headers and rows
	const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

	// Add BOM for proper Excel UTF-8 support
	return '\ufeff' + csvContent;
}

function escapeCSV(value: string | null | undefined): string {
	if (value === null || value === undefined) {
		return '';
	}
	const stringValue = String(value);
	// Escape quotes and wrap in quotes if contains comma, quote, or newline
	if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
		return `"${stringValue.replace(/"/g, '""')}"`;
	}
	return stringValue;
}

function translateEventType(type: string): string {
	const translations: Record<string, string> = {
		in: 'Entrada',
		out: 'Salida',
		pause_start: 'Inicio Pausa',
		pause_end: 'Fin Pausa'
	};
	return translations[type] || type;
}
