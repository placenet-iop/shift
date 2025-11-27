import { json, type RequestHandler } from '@sveltejs/kit';
import { queries } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';

/**
 * GET /api/time/status
 * Get current clock status for the authenticated user
 */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		// User is authenticated by hooks.server.ts
		const user = locals.user;
		requireAuth(user);

		// Get latest event
		const latestEvent = queries.getLatestEventByUser(user.id);

		// Determine status
		let status: 'clocked_out' | 'clocked_in' | 'on_pause' = 'clocked_out';
		let nextAction: 'in' | 'out' | 'pause_start' | 'pause_end' = 'in';

		if (latestEvent) {
			if (latestEvent.event_type === 'in') {
				status = 'clocked_in';
				nextAction = 'out'; // Can clock out or start pause
			} else if (latestEvent.event_type === 'pause_start') {
				status = 'on_pause';
				nextAction = 'pause_end';
			} else if (latestEvent.event_type === 'pause_end') {
				status = 'clocked_in';
				nextAction = 'out';
			} else if (latestEvent.event_type === 'out') {
				status = 'clocked_out';
				nextAction = 'in';
			}
		}

		return json({
			success: true,
			status,
			nextAction,
			latestEvent: latestEvent || null
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
