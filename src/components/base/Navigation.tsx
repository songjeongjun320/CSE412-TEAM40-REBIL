'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import LanguageSwitcher from '@/components/ui/LanguageSwitcher';

export default function Navigation() {
    const { t, i18n } = useTranslation();
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch by only rendering translations after mount
    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <nav className="flex justify-between items-center p-4 sm:p-6 lg:px-12">
            <motion.div
                className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
            >
                REBIL
            </motion.div>
            <div className="flex items-center gap-3 sm:gap-4">
                {/* Language Switcher - Modern variant */}
                <LanguageSwitcher variant="modern" />

                <Link href="/login">
                    <motion.button
                        className="px-6 py-3 sm:px-8 sm:py-3 text-white bg-black hover:bg-gray-800 rounded-xl transition-all duration-300 text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl border-2 border-black hover:border-gray-700 relative overflow-hidden group cursor-pointer"
                        whileHover={{
                            scale: 1.05,
                            y: -2,
                        }}
                        whileTap={{ scale: 0.97 }}
                        style={{ cursor: 'pointer' }}
                    >
                        <span
                            className="relative z-10 flex items-center gap-2"
                            suppressHydrationWarning
                        >
                            <svg
                                className="w-4 h-4 sm:w-5 sm:h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                                />
                            </svg>
                            {mounted ? t('common.signIn') : 'Sign In'}
                        </span>
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-gray-700 to-gray-800 rounded-xl opacity-0 group-hover:opacity-100"
                            initial={{ x: '-100%' }}
                            whileHover={{ x: '0%' }}
                            transition={{ duration: 0.3 }}
                        />
                    </motion.button>
                </Link>
            </div>
        </nav>
    );
}
