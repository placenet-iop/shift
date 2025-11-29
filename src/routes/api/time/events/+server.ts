import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';
import { serializeTimeEvent } from '$lib/server/db/serializers';

/**
 * GET /api/time/events
 * Get time events for the authenticated user
 *
 * Query params:
 *   from: ISO-8601 date (optional)
 *   to: ISO-8601 date (optional)
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		// User is authenticated by hooks.server.ts
		const user = requireAuth(locals.user ?? null);

		// Get query parameters
		const from = url.searchParams.get('from') || undefined;
		const to = url.searchParams.get('to') || undefined;

		const prisma = getDb();
		const events = await prisma.timeEvent.findMany({
			where: {
				userId: user.id,
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
			count: events.length,
			user: {
				domain_id: user.domainId,
				domain_name: user.domainName
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
