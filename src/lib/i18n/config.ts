import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

// Import translation files
import en from './locales/en.json';
import id from './locales/id.json';
import ko from './locales/ko.json';

export const defaultLng = 'en';
export const languages = ['en', 'id', 'ko'] as const;

export const resources = {
    en: { translation: en },
    id: { translation: id },
    ko: { translation: ko },
} as const;

// Language names for UI display
export const languageNames = {
    en: 'English',
    id: 'Bahasa Indonesia',
    ko: '한국어',
} as const;

// Initialize i18next - Client-side only for LanguageDetector
if (typeof window !== 'undefined') {
    // Client-side initialization with language detection
    i18n.use(LanguageDetector)
        .use(initReactI18next)
        .init({
            resources,
            // Don't set lng here - let LanguageDetector handle it
            fallbackLng: defaultLng,
            debug: false, // Disable debug for production

            interpolation: {
                escapeValue: false,
            },

            detection: {
                order: ['localStorage', 'cookie', 'navigator', 'htmlTag'],
                caches: ['localStorage', 'cookie'],
                lookupLocalStorage: 'i18nextLng',
                lookupCookie: 'i18next',
                cookieOptions: {
                    path: '/',
                    sameSite: 'lax',
                    secure: process.env.NODE_ENV === 'production',
                    expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                },
            },

            supportedLngs: languages,

            react: {
                useSuspense: false,
                bindI18n: 'languageChanged', // Listen to language change events
                bindI18nStore: 'added removed', // Listen to resource changes
            },
        });
} else {
    // Server-side initialization without LanguageDetector
    i18n.use(initReactI18next).init({
        resources,
        lng: defaultLng,
        fallbackLng: defaultLng,
        interpolation: {
            escapeValue: false,
        },
        supportedLngs: languages,
        react: {
            useSuspense: false,
        },
    });
}

export default i18n;
