import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Server-side redirect to /admin
 * Admin role is already checked in hooks.server.ts
 */
export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');
	if (token) {
		throw redirect(302, `/admin?token=${token}`);
	}
	throw redirect(302, '/admin');
};

