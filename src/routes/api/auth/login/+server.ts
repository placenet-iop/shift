import { json, type RequestHandler } from '@sveltejs/kit';
import { queries } from '$lib/server/db';
import { generateToken } from '$lib/server/auth';

/**
 * POST /api/auth/login
 * Development/testing login endpoint
 *
 * Body: {
 *   email: string
 * }
 *
 * This creates or retrieves a user and returns a JWT token.
 * In production, this would be replaced by Placenet's authentication.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { email, name, role } = body;

		if (!email) {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		// Check if user exists
		let user = queries.getUserByEmail(email);

		// If user doesn't exist, create one
		if (!user) {
			if (!name) {
				return json({ error: 'Name is required for new users' }, { status: 400 });
			}

			const userId = queries.createUser(email, name, role || 'worker');
			user = queries.getUserById(userId);

			if (!user) {
				return json({ error: 'Failed to create user' }, { status: 500 });
			}
		}

		// Generate JWT token
		const token = generateToken(user);

		return json({
			success: true,
			token,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role
			}
		});
	} catch (error) {
		console.error('Login error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
