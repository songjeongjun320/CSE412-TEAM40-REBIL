'use client';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export default function HeroSection() {
    const { t } = useTranslation();

    return (
        <section className="text-center py-4 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-12">
            <motion.h1
                className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold text-black mb-3 sm:mb-4 leading-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                {t('home.heroTitle')}
            </motion.h1>
            <motion.p
                className="text-lg sm:text-xl lg:text-2xl text-gray-700 mb-5 sm:mb-8 max-w-4xl mx-auto"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
            >
                {t('home.heroSubtitle')}
            </motion.p>
        </section>
    );
}
