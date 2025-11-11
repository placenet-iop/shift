import { json, type RequestHandler } from '@sveltejs/kit';
import { generateToken } from '$lib/server/auth';
import { queries } from '$lib/server/db';

/**
 * POST /api/dev/token
 * Development endpoint to generate test tokens
 *
 * Body: {
 *   email: string,
 *   name: string,
 *   role?: 'worker' | 'admin'
 * }
 *
 * This endpoint should be disabled in production!
 */
export const POST: RequestHandler = async ({ request }) => {
	// Only allow in development
	if (process.env.NODE_ENV === 'production') {
		return json({ error: 'Not available in production' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { email, name, role = 'worker' } = body;

		if (!email || !name) {
			return json({ error: 'Email and name are required' }, { status: 400 });
		}

		// Check if user exists
		let user = queries.getUserByEmail(email);

		// If user doesn't exist, create one
		if (!user) {
			const userId = queries.createUser(email, name, role);
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
			},
			// Include URL for quick testing
			url: `http://localhost:5173?token=${token}`
		});
	} catch (error) {
		console.error('Token generation error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};

/**
 * GET /api/dev/token?email=...&name=...&role=...
 * Quick token generation via URL
 */
export const GET: RequestHandler = async ({ url }) => {
	// Only allow in development
	if (process.env.NODE_ENV === 'production') {
		return json({ error: 'Not available in production' }, { status: 403 });
	}

	const email = url.searchParams.get('email') || 'test@example.com';
	const name = url.searchParams.get('name') || 'Test User';
	const role = (url.searchParams.get('role') || 'worker') as 'worker' | 'admin';

	try {
		// Check if user exists
		let user = queries.getUserByEmail(email);

		// If user doesn't exist, create one
		if (!user) {
			const userId = queries.createUser(email, name, role);
			user = queries.getUserById(userId);

			if (!user) {
				return json({ error: 'Failed to create user' }, { status: 500 });
			}
		}

		// Generate JWT token
		const token = generateToken(user);

		// Redirect to main app with token
		return new Response(null, {
			status: 302,
			headers: {
				Location: `/?token=${token}`
			}
		});
	} catch (error) {
		console.error('Token generation error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
