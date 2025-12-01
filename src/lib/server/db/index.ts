import { PrismaClient, type Prisma, type User, type TimeEvent, type AuditLog } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
	_prisma?: PrismaClient;
};

const prisma = globalForPrisma._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') {
	globalForPrisma._prisma = prisma;
}

export function getDb(): PrismaClient {
	return prisma;
}

export async function closeDb(): Promise<void> {
	await prisma.$disconnect();
	}

function optionalDate(value?: string | null): Date | undefined {
	return value ? new Date(value) : undefined;
}

export const queries = {
	getUserById: async (id: number): Promise<User | null> => {
		return prisma.user.findUnique({ where: { id } });
	},

	getUserByEmail: async (email: string): Promise<User | null> => {
		return prisma.user.findUnique({ where: { email } });
	},

	createUser: async (
		email: string,
		name: string,
		role: 'worker' | 'admin' = 'worker',
		domainId?: string,
		domainName?: string
	): Promise<number> => {
		const user = await prisma.user.create({
			data: {
				email,
				name,
				role,
				domainId: domainId || null,
				domainName: domainName || null
			}
		});
		return user.id;
	},

	updateUser: async (
		id: number,
		updates: { name?: string; role?: 'worker' | 'admin'; domain_id?: string | null; domain_name?: string | null }
	): Promise<void> => {
		const data: Prisma.UserUpdateInput = {};

		if (updates.name !== undefined) {
			data.name = updates.name;
		}
		if (updates.role !== undefined) {
			data.role = updates.role;
		}
		if (updates.domain_id !== undefined) {
			data.domainId = updates.domain_id || null;
		}
		if (updates.domain_name !== undefined) {
			data.domainName = updates.domain_name || null;
		}

		if (Object.keys(data).length > 0) {
			await prisma.user.update({
				where: { id },
				data
			});
		}
	},

	createTimeEvent: async (
		userId: number,
		eventType: 'in' | 'out' | 'pause_start' | 'pause_end',
		ts: string,
		source: 'web' | 'mobile' | 'kiosk',
		ip?: string,
		userAgent?: string,
		meta?: object,
		avatarName?: string,
		avatarEmail?: string,
		avatarId?: number,
		domainId?: string,
		domainName?: string
	): Promise<TimeEvent> => {
		return prisma.timeEvent.create({
			data: {
				userId,
				eventType,
				ts: new Date(ts),
				source,
				ip: ip || null,
				userAgent: userAgent || null,
				meta: meta ?? undefined,
				avatarName: avatarName || null,
				avatarEmail: avatarEmail || null,
				avatarId: avatarId || null,
				domainId: domainId || null,
				domainName: domainName || null
			}
		});
	},

	getTimeEventsByUser: async (userId: number, from?: string, to?: string): Promise<TimeEvent[]> => {
		return prisma.timeEvent.findMany({
			where: {
				userId,
				ts: {
					gte: optionalDate(from),
					lte: optionalDate(to)
				}
			},
			orderBy: { ts: 'desc' }
		});
	},

	getAllTimeEvents: async (from?: string, to?: string): Promise<TimeEvent[]> => {
		return prisma.timeEvent.findMany({
			where: {
				ts: {
					gte: optionalDate(from),
					lte: optionalDate(to)
				}
			},
			orderBy: { ts: 'desc' }
		});
	},

	getLatestEventByUser: async (userId: number): Promise<TimeEvent | null> => {
		return prisma.timeEvent.findFirst({
			where: { userId },
			orderBy: { ts: 'desc' }
		});
	},

	createAuditLog: async (
		adminUserId: number,
		action: string,
		targetUserId?: number,
		details?: object,
		ip?: string
	): Promise<number> => {
		const log = await prisma.auditLog.create({
			data: {
				adminUserId,
				action,
				targetUserId: targetUserId || null,
				details: details ?? undefined,
				ip: ip || null
			}
		});
		return log.id;
	},

	getAuditLogs: async (from?: string, to?: string, limit: number = 100): Promise<AuditLog[]> => {
		return prisma.auditLog.findMany({
			where: {
				ts: {
					gte: optionalDate(from),
					lte: optionalDate(to)
				}
			},
			orderBy: { ts: 'desc' },
			take: limit
		});
	}
};

export type { User, TimeEvent, AuditLog };
