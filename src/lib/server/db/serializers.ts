import type { User, TimeEvent } from '@prisma/client';

/**
 * Serialize TimeEvent for API responses
 * Converts Prisma model to API-friendly format
 */
export function serializeTimeEvent(event: TimeEvent, user?: User | null): any {
	return {
		id: event.id,
		user_id: event.userId,
		user_name: user?.name,
		event_type: event.eventType,
		ts: event.ts.toISOString(),
		source: event.source,
		ip: event.ip,
		user_agent: event.userAgent,
		meta: event.meta,
		created_at: event.createdAt.toISOString(),
		domainId: user?.domainId,
		domainName: user?.domainName
	};
}

/**
 * Serialize User for API responses
 * Converts Prisma model to API-friendly format
 */
export function serializeUser(user: User): any {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		role: user.role,
		domain_id: user.domainId,
		domain_name: user.domainName,
		active: user.active,
		created_at: user.createdAt.toISOString(),
		updated_at: user.updatedAt.toISOString()
	};
}

