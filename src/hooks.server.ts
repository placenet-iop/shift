import { error } from '@sveltejs/kit';
import { verifyToken, getUserFromToken } from '$lib/server/auth';

const publicRoutes = ['/', '/auth'];

export const handle = async ({ event, resolve }) => {
	// Allow public routes
	if (publicRoutes.includes(event.url.pathname)) {
		return await resolve(event);
	}

	// Check header first (ongoing requests), then URL query param (initial load)
	let token = event.request.headers.get('x-auth-token');

	if (!token) {
		token = event.url.searchParams.get('token');
	}

	// Also check Authorization: Bearer header for backward compatibility
	if (!token) {
		const authHeader = event.request.headers.get('authorization');
		if (authHeader && authHeader.startsWith('Bearer ')) {
			token = authHeader.substring(7);
		}
	}

	// All other routes require token
	if (!token) {
		throw error(401, 'Unauthorized');
	}

	const payload = await verifyToken(token);
	if (!payload) {
		throw error(401, 'Invalid token');
	}

	// Get or create user from token
	const user = await getUserFromToken(token);
	if (!user) {
		throw error(401, 'User not found or inactive');
	}

	// Attach user data to locals
	event.locals.user = user;
	event.locals.token = token;
	event.locals.tenant_id = payload.tenant_id;
	event.locals.domain_id = payload.domain_id;
	event.locals.domain_name = payload.domain_name;
	event.locals.domain_tags = payload.domain_tags || [];
	event.locals.avatar_id = payload.avatar_id;
	event.locals.avatar_name = payload.avatar_name;
	event.locals.avatar_image = payload.avatar_image;
	event.locals.avatar_tags = payload.avatar_tags;

	// Admin routes require admin role
	if (event.url.pathname.startsWith('/admin') && user.role !== 'admin') {
		throw error(403, 'Admin role required');
	}

	return await resolve(event);
};

