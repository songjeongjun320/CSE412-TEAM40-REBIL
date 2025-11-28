'use client';

// import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { useEffect, useState } from 'react';

import I18nProvider from '@/components/providers/I18nProvider';
import QueryProvider from '@/components/providers/QueryProvider';

import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

// Note: metadata export moved to a separate file due to 'use client' directive

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const [currentLang, setCurrentLang] = useState('en');

    useEffect(() => {
        // Initialize language on client-side
        if (typeof window !== 'undefined') {
            const savedLanguage =
                localStorage.getItem('i18nextLng') ||
                document.cookie
                    .split(';')
                    .find((cookie) => cookie.trim().startsWith('i18next='))
                    ?.split('=')[1] ||
                'en';
            setCurrentLang(savedLanguage);
            document.documentElement.lang = savedLanguage;

            // Listen for language changes
            const handleLanguageChange = (event: Event) => {
                const customEvent = event as CustomEvent;
                const language = customEvent.detail?.language;
                if (language && ['en', 'id', 'ko'].includes(language)) {
                    setCurrentLang(language);
                    document.documentElement.lang = language;
                }
            };

            window.addEventListener('languageChanged', handleLanguageChange);

            return () => {
                window.removeEventListener('languageChanged', handleLanguageChange);
            };
        }
    }, []);

    return (
        <html lang={currentLang} suppressHydrationWarning>
            <head>
                <title>REBIL - Redefining Car Rental Forever</title>
                <meta
                    name="description"
                    content="Revolutionary peer-to-peer car rental platform connecting car owners with renters"
                />
                <link rel="icon" href="/favicon.ico" />
                <link rel="icon" href="/favicon.png" />
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
                suppressHydrationWarning
            >
                <I18nProvider>
                    <QueryProvider>{children}</QueryProvider>
                </I18nProvider>
            </body>
        </html>
    );
}
