import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import { serializeUser } from '$lib/server/db/serializers';

/**
 * GET /api/admin/users
 * List all users (admin only)
 */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		// User is authenticated by hooks.server.ts
		const user = requireAdmin(locals.user ?? null);

		// Get all users
		const prisma = getDb();
		const users = await prisma.user.findMany({
			orderBy: {
				createdAt: 'desc'
			}
		});

		return json({
			success: true,
			users: users.map(serializeUser)
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
