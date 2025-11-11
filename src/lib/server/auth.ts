import jwt from 'jsonwebtoken';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { queries } from './db';
import type { User } from './db';
import { getJWTSecret, getPlacenetConfig, isPlacenetEnabled } from './config';

export interface JWTPayload {
	// Standard shift format
	userId?: number;
	email?: string;
	name?: string;
	role?: 'worker' | 'admin';

	// Placenet format
	avatar_id?: string;
	avatar_name?: string;
	avatar_email?: string;
	domain_id?: string;
	domain_name?: string;
	domain_tags?: string[];
	tags?: string[];

	// JWT standard fields
	iat?: number;
	exp?: number;
	kid?: string;
}

// Cache for JWKS
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJWKS() {
	if (!jwksCache) {
		const jwksEndpoint = process.env.JWKS_ENDPOINT || 'https://dev-placenet.fra1.cdn.digitaloceanspaces.com/dev-jwks.json';
		jwksCache = createRemoteJWKSet(new URL(jwksEndpoint));
	}
	return jwksCache;
}

/**
 * Normalize Placenet JWT payload to Shift format
 */
function normalizePlacenetPayload(payload: JWTPayload): JWTPayload {
	if (!isPlacenetEnabled()) {
		return payload;
	}

	const placenetConfig = getPlacenetConfig();
	const mapping = placenetConfig.jwt_mapping;

	// If already in shift format, return as is
	if (payload.userId || payload.email || payload.name) {
		return payload;
	}

	// Map Placenet fields to Shift fields
	const normalized: JWTPayload = {
		userId: payload.avatar_id ? parseInt(payload.avatar_id.replace(/\D/g, '')) || 0 : 0,
		email: payload.avatar_email || `${payload.avatar_id}@placenet.local`,
		name: payload.avatar_name || 'Usuario',
		role: 'worker', // Default role

		// Keep original Placenet fields
		avatar_id: payload.avatar_id,
		avatar_name: payload.avatar_name,
		avatar_email: payload.avatar_email,
		domain_id: payload.domain_id,
		domain_name: payload.domain_name,
		domain_tags: payload.domain_tags || payload.tags,

		iat: payload.iat,
		exp: payload.exp
	};

	// Determine role based on tags
	const adminTags = placenetConfig.admin_tags || [];
	const userTags = payload.domain_tags || payload.tags || [];

	if (adminTags.some(tag => userTags.includes(tag)) || payload.role === 'admin') {
		normalized.role = 'admin';
	}

	return normalized;
}

/**
 * Verify and decode JWT token from Placenet or Shift
 * First tries RS256 with JWKS, then falls back to HS256 with JWT_SECRET
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
	try {
		// First, try to decode the header to check the algorithm
		const decoded = jwt.decode(token, { complete: true });

		if (!decoded || typeof decoded === 'string') {
			return null;
		}

		const alg = decoded.header.alg;

		// If RS256, use JWKS
		if (alg === 'RS256') {
			try {
				const JWKS = getJWKS();
				const { payload } = await jwtVerify(token, JWKS, {
					algorithms: ['RS256']
				});

				// Normalize if it's a Placenet token
				return normalizePlacenetPayload(payload as JWTPayload);
			} catch (error) {
				console.error('RS256 JWT verification failed:', error);
				return null;
			}
		}

		// If HS256, use secret
		if (alg === 'HS256') {
			try {
				const secret = getJWTSecret();
				const payload = jwt.verify(token, secret, {
					algorithms: ['HS256']
				}) as JWTPayload;

				return normalizePlacenetPayload(payload);
			} catch (error) {
				console.error('HS256 JWT verification failed:', error);
				return null;
			}
		}

		console.error('Unsupported JWT algorithm:', alg);
		return null;
	} catch (error) {
		console.error('JWT verification failed:', error);
		return null;
	}
}

/**
 * Generate JWT token (for testing/development)
 */
export function generateToken(user: User): string {
	const payload: JWTPayload = {
		userId: user.id,
		email: user.email,
		name: user.name,
		role: user.role
	};

	return jwt.sign(payload, JWT_SECRET, {
		expiresIn: '8h' // 8 hours expiration
	});
}

/**
 * Extract user from request headers
 * Looks for Authorization: Bearer <token>
 * Auto-creates users from Placenet tokens if they don't exist
 */
export async function getUserFromRequest(request: Request): Promise<User | null> {
	const authHeader = request.headers.get('authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}

	const token = authHeader.substring(7); // Remove 'Bearer ' prefix
	const payload = await verifyToken(token);

	if (!payload || !payload.email) {
		return null;
	}

	// Try to get user by email first (for Placenet integration)
	let user = queries.getUserByEmail(payload.email);

	// If user doesn't exist and we have valid payload, create it (auto-provision from Placenet)
	if (!user && payload.name && payload.email) {
		const userId = queries.createUser(
			payload.email,
			payload.name,
			payload.role || 'worker',
			payload.domain_id,
			payload.domain_name
		);
		user = queries.getUserById(userId);
	}

	// If still no user or user is inactive, return null
	if (!user || !user.active) {
		return null;
	}

	return user;
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User | null): boolean {
	return user?.role === 'admin';
}

/**
 * Require authentication - throws error if not authenticated
 */
export function requireAuth(user: User | null): User {
	if (!user) {
		throw new Error('Authentication required');
	}
	return user;
}

/**
 * Require admin role - throws error if not admin
 */
export function requireAdmin(user: User | null): User {
	const authenticatedUser = requireAuth(user);
	if (!isAdmin(authenticatedUser)) {
		throw new Error('Admin role required');
	}
	return authenticatedUser;
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string | undefined {
	// Try various headers that might contain the real IP
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}

	const realIp = request.headers.get('x-real-ip');
	if (realIp) {
		return realIp;
	}

	// For development/testing
	return 'unknown';
}
