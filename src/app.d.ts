// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: import('./lib/server/db').User;
			token?: string;
			tenant_id?: string;
			domain_id?: string;
			domain_name?: string;
			domain_tags?: string[];
			avatar_id?: string;
			avatar_name?: string;
			avatar_image?: string | null;
			avatar_tags?: string | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		__authToken?: string;
	}
}

export {};
