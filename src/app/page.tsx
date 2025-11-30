'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import CTASection from '@/components/base/CTASection';
import HeroSection from '@/components/base/HeroSection';
import Navigation from '@/components/base/Navigation';

export default function Home() {
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const renterSteps = [
        {
            number: 1,
            title: t('home.steps.renter.step1.title'),
            description: t('home.steps.renter.step1.description'),
        },
        {
            number: 2,
            title: t('home.steps.renter.step2.title'),
            description: t('home.steps.renter.step2.description'),
        },
        {
            number: 3,
            title: t('home.steps.renter.step3.title'),
            description: t('home.steps.renter.step3.description'),
        },
    ];

    const hostSteps = [
        {
            number: 1,
            title: t('home.steps.host.step1.title'),
            description: t('home.steps.host.step1.description'),
        },
        {
            number: 2,
            title: t('home.steps.host.step2.title'),
            description: t('home.steps.host.step2.description'),
        },
        {
            number: 3,
            title: t('home.steps.host.step3.title'),
            description: t('home.steps.host.step3.description'),
        },
    ];

    const safetyItems = [
        {
            key: 'verifiedUsers',
            icon: '🛡️',
            title: t('home.safety.verifiedUsers'),
            description: t('home.safety.verifiedUsersDesc'),
            wrapperClass: '',
        },
        {
            key: 'insuranceCoverage',
            icon: '🔒',
            title: t('home.safety.insuranceCoverage'),
            description: t('home.safety.insuranceCoverageDesc'),
            wrapperClass: '',
        },
        {
            key: 'securePayments',
            icon: '💳',
            title: t('home.safety.securePayments'),
            description: t('home.safety.securePaymentsDesc'),
            wrapperClass: 'sm:col-span-2 lg:col-span-1',
        },
    ];

    // Prevent hydration mismatch - render simple loading state on server
    if (!mounted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
                <Navigation />
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-xl text-gray-600">Loading...</div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200"
            suppressHydrationWarning
        >
            {/* Navigation */}
            <Navigation />
            {/* Hero Section */}
            <HeroSection />

            {/* Features Section */}
            <section className="py-10 sm:py-16 lg:py-20 px-4 sm:px-8 lg:px-16 bg-white">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-black mb-8 sm:mb-10">
                        {t('home.howItWorks')}
                    </h2>

                    <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center mb-8 sm:mb-12 lg:mb-14">
                        <div className="order-2 lg:order-1">
                            <h3 className="text-2xl sm:text-3xl font-bold text-black mb-6 sm:mb-8">
                                {t('home.forRenters')}
                            </h3>
                            <div className="space-y-4 sm:space-y-6">
                                {renterSteps.map((step) => (
                                    <div key={step.number} className="flex items-start gap-3 sm:gap-4">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 border border-gray-300">
                                            <span className="text-black font-bold text-sm sm:text-base lg:text-lg">
                                                {step.number}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-black text-base sm:text-lg mb-1 sm:mb-2">
                                                {step.title}
                                            </h4>
                                            <p className="text-gray-600 text-sm sm:text-base">
                                                {step.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-gray-800 to-black rounded-2xl p-6 sm:p-8 text-white order-1 lg:order-2">
                            <div className="text-center">
                                <div className="w-20 h-20 sm:w-28 sm:h-28 lg:w-32 lg:h-32 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                                    <span className="text-3xl sm:text-4xl lg:text-5xl">🚗</span>
                                </div>
                                <h4 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-2 sm:mb-3">
                                    {t('home.features.perfectForTravelers')}
                                </h4>
                                <p className="text-gray-300 text-sm sm:text-base">
                                    {t('home.features.perfectForTravelersDesc')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
                        <div className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-2xl p-6 sm:p-8 text-white">
                            <div className="text-center">
                                <div className="w-20 h-20 sm:w-28 sm:h-28 lg:w-32 lg:h-32 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                                    <span className="text-3xl sm:text-4xl lg:text-5xl">💰</span>
                                </div>
                                <h4 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-2 sm:mb-3">
                                    {t('home.features.earnExtraIncome')}
                                </h4>
                                <p className="text-gray-300 text-sm sm:text-base">
                                    {t('home.features.earnExtraIncomeDesc')}
                                </p>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl sm:text-3xl font-bold text-black mb-6 sm:mb-8">
                                {t('home.forHosts')}
                            </h3>
                            <div className="space-y-4 sm:space-y-6">
                                {hostSteps.map((step) => (
                                    <div key={step.number} className="flex items-start gap-3 sm:gap-4">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 border border-gray-300">
                                            <span className="text-black font-bold text-sm sm:text-base lg:text-lg">
                                                {step.number}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-black text-base sm:text-lg mb-1 sm:mb-2">
                                                {step.title}
                                            </h4>
                                            <p className="text-gray-600 text-sm sm:text-base">
                                                {step.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Safety Section */}
            <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-8 lg:px-16 bg-gray-50">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black mb-6 sm:mb-8">
                        {t('home.safetyFirst')}
                    </h2>
                    <p className="text-lg sm:text-xl text-gray-700 mb-8 sm:mb-12">
                        {t('home.safetyDescription')}
                    </p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                        {safetyItems.map((item) => (
                            <div key={item.key} className={`p-4 sm:p-6 ${item.wrapperClass}`}>
                                <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 border border-gray-300">
                                    <span className="text-3xl sm:text-4xl lg:text-5xl">{item.icon}</span>
                                </div>
                                <h3 className="font-bold text-black mb-2 text-base sm:text-lg">
                                    {item.title}
                                </h3>
                                <p className="text-gray-600 text-sm sm:text-base">
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <CTASection />

            {/* Footer */}
            <footer className="py-8 sm:py-12 px-4 sm:px-6 lg:px-12 bg-gray-900 text-gray-400">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
                        <div className="col-span-2 md:col-span-1">
                            <div className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
                                REBIL
                            </div>
                            <p className="text-gray-400 text-sm sm:text-base">
                                {t('footer.tagline')}
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-3 sm:mb-4 text-sm sm:text-base">
                                {t('footer.forRenters')}
                            </h4>
                            <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                                <li>{t('footer.findCars')}</li>
                                <li>{t('footer.howItWorks')}</li>
                                <li>{t('footer.insurance')}</li>
                                <li>{t('footer.support')}</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-3 sm:mb-4 text-sm sm:text-base">
                                {t('footer.forHosts')}
                            </h4>
                            <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                                <li>{t('footer.listYourCar')}</li>
                                <li>{t('footer.earningsCalculator')}</li>
                                <li>{t('footer.hostProtection')}</li>
                                <li>{t('footer.resources')}</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-3 sm:mb-4 text-sm sm:text-base">
                                {t('footer.company')}
                            </h4>
                            <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                                <li>{t('footer.aboutUs')}</li>
                                <li>{t('footer.safety')}</li>
                                <li>{t('footer.contact')}</li>
                                <li>{t('footer.terms')}</li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-gray-800 mt-6 sm:mt-8 pt-6 sm:pt-8 text-center text-xs sm:text-sm">
                        <p>{t('footer.copyright')}</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
