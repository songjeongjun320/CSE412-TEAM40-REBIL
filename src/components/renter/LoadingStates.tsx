'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface LoadingCardProps {
    count?: number;
    type?: 'vehicle' | 'banner' | 'stats' | 'search';
}

export function LoadingCard({ count = 6, type = 'vehicle' }: LoadingCardProps) {
    const renderVehicleCard = (index: number) => (
        <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse"
        >
            {/* Image placeholder */}
            <div className="h-48 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
            </div>

            {/* Content placeholder */}
            <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <div className="h-5 bg-gray-200 rounded mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    </div>
                    <div className="w-16 h-6 bg-gray-200 rounded"></div>
                </div>

                <div className="flex items-center justify-between text-sm mb-4">
                    <div className="flex space-x-4">
                        <div className="h-4 bg-gray-200 rounded w-12"></div>
                        <div className="h-4 bg-gray-200 rounded w-12"></div>
                        <div className="h-4 bg-gray-200 rounded w-12"></div>
                    </div>
                </div>

                <div className="h-4 bg-gray-200 rounded mb-4"></div>

                <div className="flex items-center justify-between">
                    <div className="h-6 bg-gray-200 rounded w-20"></div>
                    <div className="flex space-x-2">
                        <div className="h-8 bg-gray-200 rounded w-20"></div>
                        <div className="h-8 bg-gray-200 rounded w-24"></div>
                    </div>
                </div>
            </div>
        </motion.div>
    );

    const renderBannerCard = () => (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl p-6 animate-pulse"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-gray-400 rounded-full"></div>
                    <div>
                        <div className="h-6 bg-gray-400 rounded mb-2 w-48"></div>
                        <div className="h-4 bg-gray-400 rounded w-64"></div>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <div className="h-10 bg-gray-400 rounded w-24"></div>
                    <div className="w-6 h-6 bg-gray-400 rounded"></div>
                </div>
            </div>
        </motion.div>
    );

    const renderStatsCard = () => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-6 animate-pulse"
        >
            <div className="h-6 bg-gray-200 rounded mb-4 w-48"></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="text-center">
                        <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-2"></div>
                        <div className="h-8 bg-gray-200 rounded mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded"></div>
                    </div>
                ))}
            </div>
        </motion.div>
    );

    const renderSearchCard = () => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl p-6 animate-pulse"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i}>
                        <div className="h-4 bg-gray-200 rounded mb-2"></div>
                        <div className="h-10 bg-gray-200 rounded"></div>
                    </div>
                ))}
            </div>
            <div className="border-t border-gray-200 pt-4">
                <div className="h-4 bg-gray-200 rounded mb-4 w-32"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i}>
                            <div className="h-4 bg-gray-200 rounded mb-2"></div>
                            <div className="h-10 bg-gray-200 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );

    switch (type) {
        case 'banner':
            return renderBannerCard();
        case 'stats':
            return renderStatsCard();
        case 'search':
            return renderSearchCard();
        case 'vehicle':
        default:
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: count }, (_, index) => renderVehicleCard(index))}
                </div>
            );
    }
}

interface EmptyStateProps {
    type: 'no-cars' | 'no-results' | 'no-recommendations' | 'connection-error';
    title?: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    icon?: string;
}

export function EmptyState({ type, title, description, action, icon }: EmptyStateProps) {
    const getEmptyStateConfig = () => {
        switch (type) {
            case 'no-cars':
                return {
                    icon: icon || '🚗',
                    title: title || 'No cars available',
                    description:
                        description ||
                        'No vehicles are currently available. Check back later for new listings!',
                    bgGradient: 'from-blue-50 to-indigo-50',
                };
            case 'no-results':
                return {
                    icon: icon || '🔍',
                    title: title || 'No results found',
                    description:
                        description ||
                        'Try adjusting your search filters or explore different locations.',
                    bgGradient: 'from-gray-50 to-slate-50',
                };
            case 'no-recommendations':
                return {
                    icon: icon || '💡',
                    title: title || 'No recommendations available',
                    description:
                        description ||
                        "We're working on finding the perfect cars for you. Try browsing our full catalog!",
                    bgGradient: 'from-purple-50 to-pink-50',
                };
            case 'connection-error':
                return {
                    icon: icon || '📡',
                    title: title || 'Connection issue',
                    description:
                        description ||
                        'Having trouble loading data. Please check your connection and try again.',
                    bgGradient: 'from-red-50 to-orange-50',
                };
            default:
                return {
                    icon: '🌐',
                    title: 'Something went wrong',
                    description: 'Please try again later.',
                    bgGradient: 'from-gray-50 to-slate-50',
                };
        }
    };

    const config = getEmptyStateConfig();

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`bg-gradient-to-br ${config.bgGradient} rounded-2xl p-12 text-center`}
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="text-8xl mb-6"
            >
                {config.icon}
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{config.title}</h3>
                <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">{config.description}</p>

                {action && (
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={action.onClick}
                        className="px-8 py-3 bg-gradient-to-r from-black to-gray-800 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-200"
                    >
                        {action.label}
                    </motion.button>
                )}
            </motion.div>
        </motion.div>
    );
}

interface ErrorBoundaryProps {
    error: Error;
    retry: () => void;
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl p-8 text-center"
        >
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-red-900 mb-2">Something went wrong</h3>
            <p className="text-red-700 mb-6">
                {error.message || 'An unexpected error occurred while loading the content.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                    onClick={retry}
                    className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                >
                    Try Again
                </button>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-white border-2 border-red-600 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                >
                    Refresh Page
                </button>
            </div>
        </motion.div>
    );
}

// Progressive loading component for images
interface ProgressiveImageProps {
    src: string;
    alt: string;
    className?: string;
    placeholder?: string;
}

export function ProgressiveImage({ src, alt, className = '', placeholder }: ProgressiveImageProps) {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    const defaultPlaceholder =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNGM0Y0RjYiLz48L3N2Zz4=';

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {/* Placeholder */}
            {!loaded && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                    <div className="text-gray-400 text-4xl">🚗</div>
                </div>
            )}

            {/* Actual image */}
            <motion.img
                src={error ? placeholder || defaultPlaceholder : src}
                alt={alt}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                    loaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setLoaded(true)}
                onError={() => {
                    setError(true);
                    setLoaded(true);
                }}
                initial={{ scale: 1.1 }}
                animate={{ scale: loaded ? 1 : 1.1 }}
                transition={{ duration: 0.6 }}
            />

            {/* Loading indicator */}
            {!loaded && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"
                    />
                </div>
            )}
        </div>
    );
}
