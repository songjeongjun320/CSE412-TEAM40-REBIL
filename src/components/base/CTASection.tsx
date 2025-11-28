'use client';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export default function CTASection() {
    const { t } = useTranslation();

    return (
        <section className="py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-12 bg-black">
            <div className="max-w-4xl mx-auto text-center">
                <motion.h2
                    className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-5 sm:mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                >
                    {t('cta.title')}
                </motion.h2>
                <motion.p
                    className="text-lg sm:text-xl text-gray-300 mb-6 sm:mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    viewport={{ once: true }}
                >
                    {t('cta.subtitle')}
                </motion.p>
            </div>
        </section>
    );
}
