import { error } from '@sveltejs/kit';
import { verifyToken, getUserFromToken } from '$lib/server/auth';

const publicRoutes = ['/', '/auth', '/dev', '/.well-known/placenet/views', '/api/config/theme'];

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
	event.locals.tenantId = payload.tenantId;
	event.locals.domainId = payload.domainId;
	event.locals.domainName = payload.domainName;
	event.locals.avatarId = payload.avatarId;

	// Admin routes require admin role
	if (event.url.pathname.startsWith('/admin') && user.role !== 'admin') {
		throw error(403, 'Admin role required');
	}

	// Placenet special routes require admin role
	// Views endpoint is public (handles auth in endpoint), admin endpoint requires auth
	if (event.url.pathname === '/.well-known/placenet/admin' && user.role !== 'admin') {
		throw error(403, 'Admin role required');
	}

	return await resolve(event);
};

