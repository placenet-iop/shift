import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';

/**
 * GET /api/admin/status
 * Get current status for all users (admin only)
 */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		// User is authenticated by hooks.server.ts
		const user = requireAdmin(locals.user ?? null);

		const prisma = getDb();

		// Get all users
		const users = await prisma.user.findMany({
			select: {
				id: true
			}
		});

		// For each user, get their most recent event and calculate status
		const statuses = await Promise.all(
			users.map(async (u) => {
				const latestEvent = await prisma.timeEvent.findFirst({
					where: {
						userId: u.id
					},
					orderBy: {
						ts: 'desc'
					}
				});

				let status = 'clocked_out';
				if (latestEvent) {
					if (latestEvent.eventType === 'in' || latestEvent.eventType === 'pause_end') {
						status = 'clocked_in';
					} else if (latestEvent.eventType === 'pause_start') {
						status = 'on_pause';
					}
				}

				return {
					user_id: u.id,
					status,
					latest_event: latestEvent
						? {
								id: latestEvent.id,
								ts: latestEvent.ts.toISOString(),
								event_type: latestEvent.eventType
							}
						: null
				};
			})
		);

		return json({
			success: true,
			statuses
		});
	} catch (error) {
		console.error('Get status error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
