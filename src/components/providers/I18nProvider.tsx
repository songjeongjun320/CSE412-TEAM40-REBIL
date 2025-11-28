'use client';

import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import i18n, { languages } from '@/lib/i18n/config';

interface I18nProviderProps {
    children: React.ReactNode;
}

export default function I18nProvider({ children }: I18nProviderProps) {
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && !isInitialized) {
            // Force re-detect language on client mount
            const savedLanguage =
                localStorage.getItem('i18nextLng') ||
                document.cookie
                    .split(';')
                    .find((cookie) => cookie.trim().startsWith('i18next='))
                    ?.split('=')[1] ||
                'en';

            const validLanguage = languages.includes(savedLanguage as (typeof languages)[number])
                ? savedLanguage
                : 'en';

            // Change language immediately
            i18n.changeLanguage(validLanguage).then(() => {
                document.documentElement.lang = validLanguage;
                setIsInitialized(true);
            });

            // Listen for custom language change events
            const handleLanguageEvent = (event: Event) => {
                const customEvent = event as CustomEvent;
                const language = customEvent.detail?.language;
                if (language && languages.includes(language as (typeof languages)[number])) {
                    i18n.changeLanguage(language);
                    document.documentElement.lang = language;
                    localStorage.setItem('i18nextLng', language);
                    document.cookie = `i18next=${language}; path=/; max-age=${365 * 24 * 60 * 60}; sameSite=lax`;
                }
            };

            window.addEventListener('languageChanged', handleLanguageEvent);

            return () => {
                window.removeEventListener('languageChanged', handleLanguageEvent);
            };
        }
    }, [isInitialized]);

    return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
