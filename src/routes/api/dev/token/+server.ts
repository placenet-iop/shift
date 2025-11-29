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
		let user: any;
		try {
			user = await queries.getUserByEmail(email);
		} catch (dbError) {
			console.error('Database query error:', dbError);
			return json(
				{
					error: `Database error: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}. Make sure the database is initialized.`
				},
				{ status: 500 }
			);
		}

		// If user doesn't exist, create one
		if (!user) {
			try {
				const userId = await queries.createUser(email, name, role);
				user = await queries.getUserById(userId);

				if (!user) {
					return json({ error: 'Failed to create user - user was not found after creation' }, { status: 500 });
				}
			} catch (createError) {
				console.error('User creation error:', createError);
				return json(
					{
						error: `Failed to create user: ${createError instanceof Error ? createError.message : 'Unknown error'}`
					},
					{ status: 500 }
				);
			}
		}

		// Generate JWT token
		let token: string;
		try {
			token = generateToken(user);
		} catch (tokenError) {
			console.error('Token generation failed:', tokenError);
			const errorMessage = tokenError instanceof Error ? tokenError.message : 'Unknown error';
			return json(
				{
					error: `Failed to generate token: ${errorMessage}. Make sure JWT_SECRET is set in .env file.`
				},
				{ status: 500 }
			);
		}

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
		const errorMessage = error instanceof Error ? error.message : 'Internal server error';
		const errorStack = error instanceof Error ? error.stack : undefined;
		console.error('Error stack:', errorStack);
		return json(
			{
				error: `Failed to generate token: ${errorMessage}`
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
		let user = await queries.getUserByEmail(email);

		// If user doesn't exist, create one
		if (!user) {
			const userId = await queries.createUser(email, name, role);
			user = await queries.getUserById(userId);

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
