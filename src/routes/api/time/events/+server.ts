import { json, type RequestHandler } from '@sveltejs/kit';
import { queries, getDb } from '$lib/server/db';
import { getUserFromRequest, requireAuth } from '$lib/server/auth';

/**
 * GET /api/time/events
 * Get time events for the authenticated user
 *
 * Query params:
 *   from: ISO-8601 date (optional)
 *   to: ISO-8601 date (optional)
 */
export const GET: RequestHandler = async ({ request, url }) => {
	try {
		// Authenticate user
		const user = await getUserFromRequest(request);
		requireAuth(user);

		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get query parameters
		const from = url.searchParams.get('from') || undefined;
		const to = url.searchParams.get('to') || undefined;

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
			WHERE te.user_id = ?
		`;
		const params: (string | number)[] = [user.id];

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
			count: events.length,
			user: {
				domain_id: user.domain_id,
				domain_name: user.domain_name
			}
		});
	} catch (error) {
		console.error('Get events error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
