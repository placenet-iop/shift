import { json, type RequestHandler } from '@sveltejs/kit';
import { getConfig } from '$lib/server/config';

/**
 * GET /api/config/theme
 * Returns theme configuration (colors, branding)
 */
export const GET: RequestHandler = async () => {
	try {
		const config = getConfig();

		return json({
			success: true,
			theme: config.ui?.theme || {
				primary_color: '#2563eb',
				success_color: '#16a34a',
				warning_color: '#ea580c',
				danger_color: '#dc2626'
			}
		});
	} catch (error) {
		console.error('Theme config error:', error);
		return json(
			{
				success: false,
				error: 'Failed to load theme configuration'
			},
			{ status: 500 }
		);
	}
};
