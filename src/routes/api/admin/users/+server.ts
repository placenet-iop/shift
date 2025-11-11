import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getUserFromRequest, requireAdmin } from '$lib/server/auth';

/**
 * GET /api/admin/users
 * List all users (admin only)
 */
export const GET: RequestHandler = async ({ request }) => {
	try {
		// Authenticate and require admin
		const user = await getUserFromRequest(request);
		requireAdmin(user);

		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get all users
		const db = getDb();
		const users = db.prepare('SELECT id, email, name, role, active, created_at FROM users').all();

		return json({
			success: true,
			users
		});
	} catch (error) {
		console.error('Get users error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
