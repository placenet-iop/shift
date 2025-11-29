import { readFile } from 'fs/promises';
import { resolve } from 'path';
import process from 'node:process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getConfigPath() {
	const fallback = resolve(process.cwd(), '..', 'appdev', 'apps', 'shift.json');
	return process.env.APPDEV_SHIFT_JSON ? resolve(process.env.APPDEV_SHIFT_JSON) : fallback;
}

async function loadAppdevUsers() {
	const configPath = getConfigPath();
	const raw = await readFile(configPath, 'utf-8');
	const parsed = JSON.parse(raw);
	if (!parsed?.auth || !Array.isArray(parsed.auth)) {
		throw new Error(`No "auth" array found in ${configPath}`);
	}
	return { entries: parsed.auth, source: configPath };
}

function normalizeRole(role) {
	return role === 'admin' ? 'admin' : 'worker';
}

async function upsertUser(entry) {
	const email = entry.avatar_email;
	const name = entry.avatar_name || entry.avatar_id;
	if (!email || !name) {
		console.warn(`Skipping entry without email or name: ${JSON.stringify(entry)}`);
		return;
	}

	await prisma.user.upsert({
		where: { email },
		update: {
			name,
			role: normalizeRole(entry.role),
			domainId: entry.domain_id || null,
			domainName: entry.domain_name || null,
			active: true
		},
		create: {
			email,
			name,
			role: normalizeRole(entry.role),
			domainId: entry.domain_id || null,
			domainName: entry.domain_name || null
		}
	});
	console.log(`✓ Synced ${email}`);
}

async function main() {
	const { entries, source } = await loadAppdevUsers();
	console.log(`Seeding ${entries.length} users from ${source}`);
	for (const entry of entries) {
		await upsertUser(entry);
	}
	console.log('Done.');
}

main()
	.catch((error) => {
		console.error('Failed to seed appdev users:', error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});

