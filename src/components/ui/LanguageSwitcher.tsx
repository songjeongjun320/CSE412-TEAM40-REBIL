'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { languageNames, languages } from '@/lib/i18n/config';

// Language flags as Unicode emojis for better performance
const languageFlags = {
    en: '🇺🇸',
    id: '🇮🇩',
    ko: '🇰🇷',
} as const;

interface LanguageSwitcherProps {
    variant?: 'compact' | 'full' | 'modern';
    className?: string;
}

export default function LanguageSwitcher({
    variant = 'modern',
    className = '',
}: LanguageSwitcherProps) {
    const { i18n } = useTranslation();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [currentLanguage, setCurrentLanguage] = useState<string>('en');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Update current language when i18n language changes
    useEffect(() => {
        const updateLanguage = () => {
            const lang = i18n.language || localStorage.getItem('i18nextLng') || 'en';
            const validLang = languages.includes(lang as any) ? lang : 'en';
            setCurrentLanguage(validLang);
        };

        // Set initial language
        updateLanguage();

        // Listen for language changes
        const handleLanguageChange = () => {
            updateLanguage();
        };

        i18n.on('languageChanged', handleLanguageChange);

        return () => {
            i18n.off('languageChanged', handleLanguageChange);
        };
    }, [i18n]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Handle language change
    const handleLanguageChange = (langCode: string) => {
        setCurrentLanguage(langCode);
        setIsOpen(false);

        // Store in localStorage and cookie BEFORE changing language
        localStorage.setItem('i18nextLng', langCode);
        document.cookie = `i18next=${langCode}; path=/; max-age=${365 * 24 * 60 * 60}; sameSite=lax`;

        // Update HTML lang attribute
        document.documentElement.lang = langCode;

        // Change language in i18next
        i18n.changeLanguage(langCode).then(() => {
            // Dispatch custom event to notify other components
            const event = new CustomEvent('languageChanged', { detail: { language: langCode } });
            window.dispatchEvent(event);

            // Use Next.js router refresh instead of full reload
            // This is faster and maintains scroll position
            router.refresh();
        });
    };

    // Modern variant - 새로운 디자인
    if (variant === 'modern') {
        return (
            <div className={`relative ${className}`} ref={dropdownRef}>
                <motion.button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-3 px-4 py-2.5 bg-white/90 backdrop-blur-sm hover:bg-white rounded-xl border border-gray-200/60 hover:border-gray-300 transition-all duration-300 shadow-sm hover:shadow-lg group"
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    aria-label="Language selector"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-xl" role="img" aria-hidden="true">
                            {languageFlags[currentLanguage as keyof typeof languageFlags] || '🌐'}
                        </span>
                        <span className="font-medium text-gray-700 text-sm hidden sm:block">
                            {languageNames[currentLanguage as keyof typeof languageNames] ||
                                'English'}
                        </span>
                    </div>
                    <ChevronDown
                        className={`w-4 h-4 text-gray-500 transition-transform duration-300 group-hover:text-gray-700 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </motion.button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="absolute right-0 top-full mt-3 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-gray-400/60 py-2 min-w-[200px] z-50 overflow-hidden"
                            role="listbox"
                        >
                            <div className="px-2 py-1">
                                {languages.map((langCode) => (
                                    <motion.button
                                        key={langCode}
                                        onClick={() => handleLanguageChange(langCode)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all duration-200 ${
                                            currentLanguage === langCode
                                                ? 'text-blue-700 border border-blue-200/50'
                                                : 'text-gray-700'
                                        }`}
                                        style={{
                                            background:
                                                currentLanguage === langCode
                                                    ? 'linear-gradient(to right, rgb(239, 246, 255), rgb(238, 242, 255))'
                                                    : 'rgba(0, 0, 0, 0)',
                                        }}
                                        whileHover={{
                                            backgroundColor:
                                                currentLanguage === langCode
                                                    ? 'rgb(239, 246, 255)'
                                                    : 'rgb(249, 250, 251)',
                                            scale: 1.02,
                                        }}
                                        whileTap={{ scale: 0.98 }}
                                        role="option"
                                        aria-selected={currentLanguage === langCode}
                                    >
                                        <span className="text-xl" role="img" aria-hidden="true">
                                            {languageFlags[langCode]}
                                        </span>
                                        <span className="font-medium flex-1">
                                            {languageNames[langCode]}
                                        </span>
                                        {currentLanguage === langCode && (
                                            <motion.span
                                                className="text-blue-600 font-bold"
                                                aria-hidden="true"
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                ✓
                                            </motion.span>
                                        )}
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // Compact variant - 기존 디자인 개선
    if (variant === 'compact') {
        return (
            <div className={`relative ${className}`} ref={dropdownRef}>
                <motion.button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/80 hover:bg-white/90 rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    aria-label="Language selector"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                >
                    <span className="text-lg" role="img" aria-hidden="true">
                        {languageFlags[currentLanguage as keyof typeof languageFlags] || '🌐'}
                    </span>
                    <span className="text-sm font-medium text-gray-700 hidden sm:block">
                        {languageNames[currentLanguage as keyof typeof languageNames] || 'English'}
                    </span>
                    <ChevronDown
                        className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </motion.button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[180px] z-50"
                            role="listbox"
                        >
                            {languages.map((langCode) => (
                                <motion.button
                                    key={langCode}
                                    onClick={() => handleLanguageChange(langCode)}
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors duration-150 ${
                                        currentLanguage === langCode
                                            ? 'text-blue-600'
                                            : 'text-gray-700'
                                    }`}
                                    style={{
                                        backgroundColor:
                                            currentLanguage === langCode
                                                ? 'rgb(239, 246, 255)'
                                                : 'rgba(0, 0, 0, 0)',
                                    }}
                                    whileHover={{
                                        backgroundColor:
                                            currentLanguage === langCode
                                                ? 'rgb(239, 246, 255)'
                                                : 'rgb(249, 250, 251)',
                                    }}
                                    role="option"
                                    aria-selected={currentLanguage === langCode}
                                >
                                    <span className="text-lg" role="img" aria-hidden="true">
                                        {languageFlags[langCode]}
                                    </span>
                                    <span className="font-medium">{languageNames[langCode]}</span>
                                    {currentLanguage === langCode && (
                                        <span className="ml-auto text-blue-600" aria-hidden="true">
                                            ✓
                                        </span>
                                    )}
                                </motion.button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // Full variant with text labels
    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                aria-label="Language selector"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <Globe className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-gray-700">
                    {languageNames[currentLanguage as keyof typeof languageNames] || 'English'}
                </span>
                <ChevronDown
                    className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[200px] z-50"
                        role="listbox"
                    >
                        {languages.map((langCode) => (
                            <motion.button
                                key={langCode}
                                onClick={() => handleLanguageChange(langCode)}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors duration-150 ${
                                    currentLanguage === langCode ? 'text-blue-600' : 'text-gray-700'
                                }`}
                                style={{
                                    backgroundColor:
                                        currentLanguage === langCode
                                            ? 'rgb(239, 246, 255)'
                                            : 'rgba(0, 0, 0, 0)',
                                }}
                                whileHover={{
                                    backgroundColor:
                                        currentLanguage === langCode
                                            ? 'rgb(239, 246, 255)'
                                            : 'rgb(249, 250, 251)',
                                }}
                                role="option"
                                aria-selected={currentLanguage === langCode}
                            >
                                <span className="text-lg" role="img" aria-hidden="true">
                                    {languageFlags[langCode]}
                                </span>
                                <span className="font-medium flex-1">
                                    {languageNames[langCode]}
                                </span>
                                {currentLanguage === langCode && (
                                    <span className="text-blue-600" aria-hidden="true">
                                        ✓
                                    </span>
                                )}
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
