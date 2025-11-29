import { json, type RequestHandler } from '@sveltejs/kit';
import { queries, getDb } from '$lib/server/db';
import { requireAdmin, getClientIP } from '$lib/server/auth';
import { serializeTimeEvent } from '$lib/server/db/serializers';

/**
 * GET /api/admin/events
 * Get all time events (admin only)
 *
 * Query params:
 *   from: ISO-8601 date (optional)
 *   to: ISO-8601 date (optional)
 *   user_id: Filter by user ID (optional)
 */
export const GET: RequestHandler = async ({ request, url, locals }) => {
	try {
		// User is authenticated by hooks.server.ts
		const user = requireAdmin(locals.user ?? null);

		// Get query parameters
		const from = url.searchParams.get('from') || undefined;
		const to = url.searchParams.get('to') || undefined;
		const userId = url.searchParams.get('user_id');

		// Log audit
		const ip = getClientIP(request);
		await queries.createAuditLog(
			user.id,
			'view_all_events',
			userId ? parseInt(userId) : undefined,
			{ from, to },
			ip
		);

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

		return json({
			success: true,
			events: events.map((event) => serializeTimeEvent(event, event.user || undefined)),
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
