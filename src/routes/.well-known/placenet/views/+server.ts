import { json, type RequestHandler } from '@sveltejs/kit';
import { verifyToken, getUserFromToken } from '$lib/server/auth';

/**
 * GET /.well-known/placenet/views
 * Returns available views/routes for Placenet parent app
 * If no token is provided, returns empty array (for discovery)
 * If token is provided, requires admin role
 */
export const GET: RequestHandler = async ({ url, request }) => {
	// Try to get token from query params or headers
	let token = url.searchParams.get('token');
	if (!token) {
		token = request.headers.get('x-auth-token');
	}
	if (!token) {
		const authHeader = request.headers.get('authorization');
		if (authHeader && authHeader.startsWith('Bearer ')) {
			token = authHeader.substring(7);
		}
	}

	// If no token, return empty array for discovery
	if (!token) {
		return json([]);
	}

	// Verify token and check if user is admin
	try {
		const payload = await verifyToken(token);
		if (!payload) {
			return json([]);
		}

		const user = await getUserFromToken(token);
		if (!user || user.role !== 'admin') {
			return json([]);
		}

		// Return views for authenticated admin users
		// Use absolute URL so dashboard navigates to shift domain, not its own domain
		const baseUrl = url.origin;
		const views = [
			{ path: `${baseUrl}/`, label: 'Time Clock' },
			{ path: `${baseUrl}/history`, label: 'History' },
			{ path: `${baseUrl}/admin`, label: 'Admin Panel' }
		];

		return json(views);
	} catch (error) {
		// On any error, return empty array
		console.error('Error in views endpoint:', error);
		return json([]);
	}
};

