import type { User, TimeEvent } from '@prisma/client';

/**
 * Serialize TimeEvent for API responses
 * Converts Prisma model to API-friendly format
 */
export function serializeTimeEvent(event: TimeEvent, user?: User | null): any {
	return {
		id: event.id,
		user_id: event.userId,
		user_name: event.avatarName || user?.name,
		event_type: event.eventType,
		ts: event.ts.toISOString(),
		source: event.source,
		ip: event.ip,
		user_agent: event.userAgent,
		meta: event.meta,
		created_at: event.createdAt.toISOString(),
		// Prefer snapshot data from event, fallback to current user data
		avatar_name: event.avatarName || user?.name,
		avatarId: event.avatarId || event.userId,
		domain_id: event.domainId || user?.domainId,
		domain_name: event.domainName || user?.domainName
	};
}

/**
 * Serialize User for API responses
 * Converts Prisma model to API-friendly format
 */
export function serializeUser(user: User): any {
	return {
		id: user.id,
		avatarId: user.avatarId,
		name: user.name,
		role: user.role,
		domain_id: user.domainId,
		domain_name: user.domainName,
		active: user.active,
		created_at: user.createdAt.toISOString(),
		updated_at: user.updatedAt.toISOString()
	};
}

