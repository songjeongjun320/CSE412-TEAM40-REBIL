import type { Metadata } from 'next';

export const generateMetadata = (language: string): Metadata => {
    const titles = {
        en: 'REBIL - Redefining Car Rental Forever',
        id: 'REBIL - Revolusi Rental Mobil Selamanya',
        ko: 'REBIL - 자동차 렌탈의 영원한 혁신',
    };

    const descriptions = {
        en: 'Revolutionary peer-to-peer car rental platform connecting car owners with renters',
        id: 'Platform rental mobil peer-to-peer revolusioner yang menghubungkan pemilik mobil dengan penyewa',
        ko: '자동차 소유자와 렌터를 연결하는 혁신적인 P2P 자동차 렌탈 플랫폼',
    };

    return {
        title: titles[language as keyof typeof titles] || titles.en,
        description: descriptions[language as keyof typeof descriptions] || descriptions.en,
        icons: {
            icon: ['/favicon.ico', '/favicon.png'],
        },
    };
};
