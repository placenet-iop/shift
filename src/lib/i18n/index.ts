import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import en from './locales/en';
import es from './locales/es';

export type Locale = 'en' | 'es';

export const locales: Record<Locale, typeof en> = {
	en,
	es
};

// Get initial locale from localStorage or default to 'en'
function getInitialLocale(): Locale {
	if (!browser) return 'en';
	const stored = localStorage.getItem('locale') as Locale;
	return stored && (stored === 'en' || stored === 'es') ? stored : 'en';
}

// Create locale store
export const locale = writable<Locale>(getInitialLocale());

// Translation function factory - creates a reactive translation function
function createTranslationFunction(currentLocale: Locale) {
	return (key: string, params?: Record<string, string | number>): string => {
		const translations = locales[currentLocale];
		
		// Navigate through nested keys (e.g., 'common.buttons.save')
		const keys = key.split('.');
		let value: any = translations;
		
		for (const k of keys) {
			if (value && typeof value === 'object' && k in value) {
				value = value[k];
			} else {
				console.warn(`Translation key "${key}" not found in locale "${currentLocale}"`);
				return key;
			}
		}
		
		if (typeof value !== 'string') {
			console.warn(`Translation key "${key}" is not a string in locale "${currentLocale}"`);
			return key;
		}
		
		// Replace parameters
		if (params) {
			return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
				return params[paramKey]?.toString() || match;
			});
		}
		
		return value;
	};
}

// Non-reactive translation function (for use outside components)
export function t(key: string, params?: Record<string, string | number>): string {
	const currentLocale = get(locale);
	const translationFn = createTranslationFunction(currentLocale);
	return translationFn(key, params);
}

// Reactive translation store - returns a new translation function when locale changes
export const translate = derived(locale, (currentLocale) => createTranslationFunction(currentLocale));

// Set locale and persist to localStorage
export function setLocale(newLocale: Locale) {
	if (browser) {
		localStorage.setItem('locale', newLocale);
	}
	locale.set(newLocale);
}

// Format date based on locale (reactive version)
export const formatDate = derived(locale, (currentLocale) => {
	return (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
		const dateObj = typeof date === 'string' ? new Date(date) : date;
		const localeCode = currentLocale === 'es' ? 'es-ES' : 'en-US';
		return dateObj.toLocaleDateString(localeCode, options);
	};
});

// Format time based on locale (reactive version)
export const formatTime = derived(locale, (currentLocale) => {
	return (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
		const dateObj = typeof date === 'string' ? new Date(date) : date;
		const localeCode = currentLocale === 'es' ? 'es-ES' : 'en-US';
		return dateObj.toLocaleTimeString(localeCode, options);
	};
});

// Format datetime based on locale (reactive version)
export const formatDateTime = derived(locale, (currentLocale) => {
	return (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
		const dateObj = typeof date === 'string' ? new Date(date) : date;
		const localeCode = currentLocale === 'es' ? 'es-ES' : 'en-US';
		return dateObj.toLocaleString(localeCode, options);
	};
});

