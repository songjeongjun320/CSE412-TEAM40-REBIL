import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Disable React Strict Mode to prevent double execution during development
    reactStrictMode: false,

    // Configure image domains for Supabase Storage
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname:
                    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace(
                        'http://',
                        '',
                    ) || '*.supabase.co',
                port: '',
                pathname: '/storage/v1/object/public/**',
            },
            // Fallback for any Supabase project
            {
                protocol: 'https',
                hostname: '*.supabase.co',
                port: '',
                pathname: '/storage/v1/object/public/**',
            },
        ],
    },

    // Improve build stability
    experimental: {
        // Reduce file system race conditions
        optimizePackageImports: ['@supabase/ssr', '@supabase/supabase-js'],
    },

    // Handle file system issues better
    onDemandEntries: {
        // Period (in ms) where the server will keep pages in the buffer
        maxInactiveAge: 25 * 1000,
        // Number of pages that should be kept simultaneously without being disposed
        pagesBufferLength: 2,
    },

    // Improve error handling during build
    typescript: {
        // Don't fail build on TypeScript errors during development
        ignoreBuildErrors: process.env.NODE_ENV === 'development',
    },

    // Allow builds to succeed even if ESLint reports errors (e.g., unused vars)
    eslint: {
        ignoreDuringBuilds: true,
    },

    // Improve static file handling
    generateEtags: false,

    // Better handling of temporary files
    distDir: '.next',

    // Improve build manifest handling
    webpack: (config, { dev, isServer }) => {
        // Improve file system handling
        if (!dev && !isServer) {
            config.optimization = {
                ...config.optimization,
                splitChunks: {
                    ...config.optimization.splitChunks,
                    cacheGroups: {
                        ...config.optimization.splitChunks.cacheGroups,
                        default: {
                            minChunks: 1,
                            priority: -20,
                            reuseExistingChunk: true,
                        },
                    },
                },
            };
        }

        return config;
    },
};

export default nextConfig;
