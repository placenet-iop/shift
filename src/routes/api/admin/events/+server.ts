import { json, type RequestHandler } from '@sveltejs/kit';
import { queries, getDb } from '$lib/server/db';
import { getUserFromRequest, requireAdmin, getClientIP } from '$lib/server/auth';

/**
 * GET /api/admin/events
 * Get all time events (admin only)
 *
 * Query params:
 *   from: ISO-8601 date (optional)
 *   to: ISO-8601 date (optional)
 *   user_id: Filter by user ID (optional)
 */
export const GET: RequestHandler = async ({ request, url }) => {
	try {
		// Authenticate and require admin
		const user = await getUserFromRequest(request);
		requireAdmin(user);

		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get query parameters
		const from = url.searchParams.get('from') || undefined;
		const to = url.searchParams.get('to') || undefined;
		const userId = url.searchParams.get('user_id');

		// Log audit
		const ip = getClientIP(request);
		queries.createAuditLog(
			user.id,
			'view_all_events',
			userId ? parseInt(userId) : undefined,
			{ from, to },
			ip
		);

		// Get events with user info (including domain_id and domain_name)
		const db = getDb();
		let query = `
			SELECT
				te.*,
				u.name as user_name,
				u.email as user_email,
				u.domain_id,
				u.domain_name
			FROM time_events te
			JOIN users u ON te.user_id = u.id
			WHERE 1=1
		`;
		const params: (string | number)[] = [];

		if (userId) {
			query += ' AND te.user_id = ?';
			params.push(parseInt(userId));
		}

		if (from) {
			query += ' AND te.ts >= ?';
			params.push(from);
		}

		if (to) {
			query += ' AND te.ts <= ?';
			params.push(to);
		}

		query += ' ORDER BY te.ts DESC';

		const events = db.prepare(query).all(...params);

		return json({
			success: true,
			events,
			count: events.length
		});
	} catch (error) {
		console.error('Get admin events error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
