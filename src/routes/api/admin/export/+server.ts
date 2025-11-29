import { type RequestHandler } from '@sveltejs/kit';
import { queries, getDb } from '$lib/server/db';
import { requireAdmin, getClientIP } from '$lib/server/auth';
import { serializeTimeEvent } from '$lib/server/db/serializers';

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
export const GET: RequestHandler = async ({ request, url, locals }) => {
	try {
		// User is authenticated by hooks.server.ts
		const user = requireAdmin(locals.user ?? null);

		// Get query parameters
		const from = url.searchParams.get('from') || undefined;
		const to = url.searchParams.get('to') || undefined;
		const userId = url.searchParams.get('user_id');
		const format = url.searchParams.get('format') || 'csv';

		// Log audit
		const ip = getClientIP(request);
		await queries.createAuditLog(
			user.id,
			'export_records',
			userId ? parseInt(userId) : undefined,
			{ from, to, format },
			ip
		);

		// Get events with user information
		const prisma = getDb();
		const parsedUserId = userId ? parseInt(userId) : undefined;
		const events = await prisma.timeEvent.findMany({
			where: {
				userId: parsedUserId,
				ts: {
					gte: from ? new Date(from) : undefined,
					lte: to ? new Date(to) : undefined
				}
			},
			include: {
				user: true
			},
			orderBy: {
				ts: 'desc'
			}
		});

		const serialized = events.map((event) => serializeTimeEvent(event, event.user || undefined));
		const exportRows = serialized.map((record) => ({
			worker_name: record.user_name,
			worker_email: record.user_email,
			event_type: record.event_type,
			ts: record.ts,
			source: record.source,
			ip: record.ip,
			user_agent: record.user_agent,
			created_at: record.created_at
		}));

		// Generate export
		if (format === 'json') {
			return new Response(JSON.stringify(exportRows, null, 2), {
				headers: {
					'Content-Type': 'application/json',
					'Content-Disposition': `attachment; filename="shift_records_${Date.now()}.json"`
				}
			});
		}

		// Generate CSV
		const csv = generateCSV(exportRows);

		return new Response(csv, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="shift_records_${Date.now()}.csv"`
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
