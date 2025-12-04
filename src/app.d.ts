// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: import('./lib/server/db').User;
			token?: string;
			tenantId?: string;
			domainId?: string;
			domainName?: string;
			avatarId?: string;
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
