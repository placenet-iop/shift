import { readFileSync } from 'fs';
import { join } from 'path';

interface ShiftConfig {
	app_id: string;
	app_name: string;
	config: {
		jwt: {
			algorithm: string;
			kid: string;
			expiration: number;
			secret: string;
		};
		database: {
			type: string;
			path: string;
		};
	};
	integration: {
		placenet: {
			enabled: boolean;
			jwt_mapping: Record<string, string>;
			default_role: string;
			admin_tags: string[];
		};
	};
	ui?: {
		theme?: {
			primary_color: string;
			success_color: string;
			warning_color: string;
			danger_color: string;
		};
	};
	features: Record<string, any>;
	legal: Record<string, any>;
}

let config: ShiftConfig | null = null;

export function getConfig(): ShiftConfig {
	if (!config) {
		const configPath = join(process.cwd(), 'shift.json');
		const configData = readFileSync(configPath, 'utf-8');
		config = JSON.parse(configData);
	}
	return config!;
}

export function getJWTSecret(): string {
	const envSecret = process.env.JWT_SECRET;
	if (envSecret) return envSecret;

	const cfg = getConfig();
	return cfg.config.jwt.secret;
}

export function getJWTConfig() {
	const cfg = getConfig();
	return cfg.config.jwt;
}

export function getPlacenetConfig() {
	const cfg = getConfig();
	return cfg.integration.placenet;
}

export function isPlacenetEnabled(): boolean {
	const cfg = getConfig();
	return cfg.integration.placenet.enabled;
}
