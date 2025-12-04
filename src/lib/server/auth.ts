import jwt from 'jsonwebtoken';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { queries } from './db';
import type { User } from './db';
import { getJWTSecret, getPlacenetConfig, isPlacenetEnabled } from './config';

export interface JWTPayload {
	userId?: number;
	avatarId?: string;
	name?: string;
	role?: 'worker' | 'admin';
	domainId?: string;
	domainName?: string;
	tenantId?: string;
	iat?: number;
	exp?: number;
	kid?: string;
}

// Cache for JWKS
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJWKS() {
	if (!jwksCache) {
		const jwksEndpoint = import.meta.env.VITE_JWKS_URI || 'https://api.placenet.app/.well-known/jwks.json';
		jwksCache = createRemoteJWKSet(new URL(jwksEndpoint));
	}
	return jwksCache;
}

/**
 * Normalize Placenet JWT payload to Shift format
 */
function normalizePlacenetPayload(payload: any): JWTPayload {
	if (!isPlacenetEnabled()) {
		return payload as JWTPayload;
	}

	// If already in shift format, return as is
	if (payload.userId || payload.avatarId || payload.name) {
		return payload as JWTPayload;
	}

	// Map Placenet fields (may come as snake_case) to Shift format (camelCase)
	const avatarId = payload.avatar_id || payload.avatarId;
	const normalized: JWTPayload = {
		userId: avatarId ? parseInt(avatarId.replace(/\D/g, '')) || 0 : 0,
		avatarId: avatarId,
		name: payload.avatar_name || payload.name || 'Usuario',
		role: payload.role || 'worker',
		domainId: payload.domain_id || payload.domainId,
		domainName: payload.domain_name || payload.domainName,
		tenantId: payload.tenant_id || payload.tenantId,
		iat: payload.iat,
		exp: payload.exp
	};

	// Determine role based on tags
	const placenetConfig = getPlacenetConfig();
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
		avatarId: user.avatarId,
		name: user.name,
		role: user.role
	};

	const secret = getJWTSecret();
	if (!secret || secret.trim() === '') {
		throw new Error('JWT_SECRET is not set. Please set it in your .env file or shift.json config.');
	}

	return jwt.sign(payload, secret, {
		expiresIn: '8h' // 8 hours expiration
	});
}

/**
 * Extract user from token
 * Auto-creates users from Placenet tokens if they don't exist
 */
export async function getUserFromToken(token: string): Promise<User | null> {
	if (!token) {
		return null;
	}

	const payload = await verifyToken(token);

	if (!payload || !payload.avatarId) {
		console.log('[Auth] No payload or avatarId in token');
		return null;
	}

	// Try to get user by avatarId
	let user: User | null = null;
	try {
		user = await queries.getUserByAvatarId(payload.avatarId);
	} catch (error) {
		console.error('[Auth] Error getting user by avatarId:', error);
		return null;
	}

	// If user doesn't exist and we have valid payload, create it
	if (!user && payload.name && payload.avatarId) {
		console.log(payload);
		console.log(payload.tenantId);
		try {
			console.log(`[Auth] Auto-creating user: ${payload.avatarId} (${payload.name}) ${payload.tenantId}`);
			const userId = await queries.createUser(
				payload.avatarId,
				payload.name,
				payload.role || 'worker',
				payload.domainId || '',
				payload.domainName,
				payload.tenantId
			);
			user = await queries.getUserById(userId);
			if (user) {
				console.log(`[Auth] Successfully created user: ${user.avatarId} (ID: ${user.id})`);
			} else {
				console.error(`[Auth] Failed to retrieve created user with ID: ${userId}`);
			}
		} catch (error) {
			console.error('[Auth] Error creating user:', error);
			return null;
		}
	} else if (user) {
		// Update user role and domain info if token has different information
		const updates: { role?: 'worker' | 'admin'; domain_id?: string; domain_name?: string; name?: string } = {};
		
		if (payload.role && payload.role !== user.role) {
			updates.role = payload.role;
			console.log(`[Auth] Updating user ${user.avatarId} role from ${user.role} to ${payload.role}`);
		}
		if (payload.domainId !== user.domainId) {
			updates.domain_id = payload.domainId;
		}
		if (payload.domainName !== user.domainName) {
			updates.domain_name = payload.domainName;
		}
		if (payload.name && payload.name !== user.name) {
			updates.name = payload.name;
		}

		if (Object.keys(updates).length > 0) {
			await queries.updateUser(user.id, updates);
			user = await queries.getUserById(user.id);
			if (user && updates.role) {
				console.log(`[Auth] User ${user.avatarId} role updated to ${user.role}`);
			}
		}
	}

	// If still no user or user is inactive, return null
	if (!user || !user.active) {
		return null;
	}

	return user;
}

/**
 * Extract user from request headers
 * Looks for x-auth-token header, Authorization: Bearer <token>, or ?token= query param
 * Auto-creates users from Placenet tokens if they don't exist
 * @deprecated Use getUserFromToken instead. This is kept for backward compatibility.
 */
export async function getUserFromRequest(request: Request): Promise<User | null> {
	// Check x-auth-token header first
	let token = request.headers.get('x-auth-token');

	// Fall back to Authorization: Bearer header
	if (!token) {
		const authHeader = request.headers.get('authorization');
		if (authHeader && authHeader.startsWith('Bearer ')) {
			token = authHeader.substring(7);
		}
	}

	if (!token) {
		return null;
	}

	return getUserFromToken(token);
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
