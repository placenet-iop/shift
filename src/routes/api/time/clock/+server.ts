import { json, type RequestHandler } from '@sveltejs/kit';
import { queries } from '$lib/server/db';
import { serializeTimeEvent } from '$lib/server/db/serializers';
import { requireAuth, getClientIP } from '$lib/server/auth';

/**
 * POST /api/time/clock
 * Clock in, out, or pause
 *
 * Body: {
 *   event_type: 'in' | 'out' | 'pause_start' | 'pause_end'
 * }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// User is authenticated by hooks.server.ts
		const user = requireAuth(locals.user ?? null);

		// Parse request body
		const body = await request.json();
		const { event_type } = body;

		// Validate event type
		const validEventTypes = ['in', 'out', 'pause_start', 'pause_end'];
		if (!event_type || !validEventTypes.includes(event_type)) {
			return json(
				{
					error: 'Invalid event_type. Must be one of: in, out, pause_start, pause_end'
				},
				{ status: 400 }
			);
		}

		// Get latest event to validate state transitions
		const latestEvent = await queries.getLatestEventByUser(user.id);

		// Validate state transitions
		if (event_type === 'in') {
			if (latestEvent && latestEvent.eventType !== 'out') {
				return json(
					{
						error: 'Cannot clock in. You are already clocked in.'
					},
					{ status: 400 }
				);
			}
		} else if (event_type === 'out') {
			if (
				!latestEvent ||
				latestEvent.eventType === 'out' ||
				latestEvent.eventType === 'pause_start'
			) {
				return json(
					{
						error: 'Cannot clock out. You are not clocked in.'
					},
					{ status: 400 }
				);
			}
		} else if (event_type === 'pause_start') {
			if (
				!latestEvent ||
				(latestEvent.eventType !== 'in' && latestEvent.eventType !== 'pause_end')
			) {
				return json(
					{
						error: 'Cannot start pause. You must be clocked in first.'
					},
					{ status: 400 }
				);
			}
		} else if (event_type === 'pause_end') {
			if (!latestEvent || latestEvent.eventType !== 'pause_start') {
				return json(
					{
						error: 'Cannot end pause. You must start a pause first.'
					},
					{ status: 400 }
				);
			}
		}

		// Get client information
		const ip = getClientIP(request);
		const userAgent = request.headers.get('user-agent') || undefined;

		// Create time event with snapshot of user data
		const timestamp = new Date().toISOString();
		const event = await queries.createTimeEvent(
			user.id,
			event_type,
			timestamp,
			'web', // Source - could be 'mobile' or 'kiosk' in the future
			ip,
			userAgent,
			undefined, // meta
			user.name, // avatarName
			user.avatarId, // avatarEmail
			user.id, // avatarId
			user.domainId || undefined, // domainId
			user.domainName || undefined // domainName
		);

		return json({
			success: true,
			event: serializeTimeEvent(event)
		});
	} catch (error) {
		console.error('Clock error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
