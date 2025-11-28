'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { memo, useCallback, useEffect, useState } from 'react';

import { StarRatingCompact } from '@/components/ui/StarRating';
import { HostInfo } from '@/hooks/useHostsInfo';
import { useReviews } from '@/hooks/useReviews';
import { Tables } from '@/types/base/database.types';
import type { ReviewStats } from '@/types/reviews.types';

type Car = Tables<'cars'>;
type CarImage = Tables<'car_images'>;

type FeaturedCar = Car & {
    car_images: CarImage[];
};

interface VehicleCardProps {
    car: FeaturedCar;
    canRent: boolean;
    isNew?: boolean;
    showWishlist?: boolean;
    hostInfo?: HostInfo;
    showRating?: boolean;
}

const VehicleCardComponent = ({
    car,
    canRent,
    isNew = false,
    showWishlist = true,
    hostInfo,
    showRating = true,
}: VehicleCardProps) => {
    const [isWishlisted, setIsWishlisted] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [ratingStats, setRatingStats] = useState<ReviewStats | null>(null);
    const [loadingRating, setLoadingRating] = useState(false);

    const { getReviewStats } = useReviews();

    // Use provided host info or fallback to loading state
    const hostName = hostInfo?.full_name || 'Loading...';

    // Fetch rating stats for this car
    const fetchRatingStats = useCallback(async () => {
        if (!car.id) return;

        setLoadingRating(true);
        try {
            const stats = await getReviewStats({ car_id: car.id });
            setRatingStats(stats);
        } catch (error) {
            console.error('Error fetching rating stats:', error);
            setRatingStats(null);
        } finally {
            setLoadingRating(false);
        }
    }, [car.id, getReviewStats]);

    useEffect(() => {
        if (showRating && car.id) {
            fetchRatingStats();
        }
    }, [car.id, showRating, fetchRatingStats]);

    const getPrimaryImage = () => {
        const primaryImage = car.car_images?.find((img) => img.is_primary);
        return (
            primaryImage?.image_url ||
            car.car_images?.[0]?.image_url ||
            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNGM0Y0RjYiLz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMDAsIDc1KSI+CiAgICA8IS0tIENhciBib2R5IC0tPgogICAgPHJlY3QgeD0iMjAiIHk9IjgwIiB3aWR0aD0iMTYwIiBoZWlnaHQ9IjYwIiByeD0iMTAiIGZpbGw9IiM2QjcyODAiLz4KICAgIDwhLS0gQ2FyIHRvcCAtLT4KICAgIDxyZWN0IHg9IjQwIiB5PSI2MCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0MCIgcng9IjgiIGZpbGw9IiM2QjcyODAiLz4KICAgIDwhLS0gV2luZG93cyAtLT4KICAgIDxyZWN0IHg9IjUwIiB5PSI2NSIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIzMCIgcng9IjUiIGZpbGw9IiNFNUU3RUIiLz4KICAgIDwhLS0gV2hlZWxzIC0tPgogICAgPGNpcmNsZSBjeD0iNTAiIGN5PSIxNDAiIHI9IjIwIiBmaWxsPSIjMzc0MTUxIi8+CiAgICA8Y2lyY2xlIGN4PSIxNTAiIGN5PSIxNDAiIHI9IjIwIiBmaWxsPSIjMzc0MTUxIi8+CiAgICA8IS0tIFdoZWVsIGRldGFpbHMgLS0+CiAgICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjE0MCIgcj0iMTIiIGZpbGw9IiM2QjcyODAiLz4KICAgIDxjaXJjbGUgY3g9IjE1MCIgY3k9IjE0MCIgcj0iMTIiIGZpbGw9IiM2QjcyODAiLz4KICAgIDwhLS0gSGVhZGxpZ2h0cyAtLT4KICAgIDxyZWN0IHg9IjI1IiB5PSI4NSIgd2lkdGg9IjgiIGhlaWdodD0iMTUiIHJ4PSI0IiBmaWxsPSIjRkNEMzNEIi8+CiAgICA8cmVjdCB4PSIxNjciIHk9Ijg1IiB3aWR0aD0iOCIgaGVpZ2h0PSIxNSIgcng9IjQiIGZpbGw9IiNGQ0QzM0QiLz4KICAgIDwhLS0gRG9vciAtLT4KICAgIDxyZWN0IHg9IjgwIiB5PSI4NSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjUwIiByeD0iMyIgZmlsbD0iIzRCNTU2MyIvPgogIDwvZz4KICA8dGV4dCB4PSIyMDAiIHk9IjI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzZCNzI4MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2Ij5DYXIgSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo='
        );
    };

    const handleWishlistToggle = () => {
        setIsWishlisted(!isWishlisted);
        // TODO: Implement wishlist API call
    };

    const formatTimeAgo = (dateString: string) => {
        const now = new Date();
        const date = new Date(dateString);
        const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

        if (diffInHours < 1) return 'Just now';
        if (diffInHours < 24) return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}d ago`;
        return date.toLocaleDateString();
    };

    const getCarTypeIcon = (type: string) => {
        const icons = {
            sedan: '🚗',
            suv: '🚙',
            compact: '🚙',
            luxury: '🏎️',
            electric: '⚡',
            hybrid: '🌱',
        };
        return icons[type.toLowerCase() as keyof typeof icons] || '🚗';
    };

    const getEfficiencyBadge = () => {
        if (car.fuel_type?.toLowerCase() === 'electric') {
            return (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-black text-white">
                    ⚡ Electric
                </span>
            );
        }
        if (car.fuel_type?.toLowerCase() === 'hybrid') {
            return (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-700 text-white">
                    🌱 Hybrid
                </span>
            );
        }
        return null;
    };

    return (
        <Link
            href={canRent ? `/vehicles/${car.id}` : '#'}
            className={`block bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 group relative border-2 border-gray-400 hover:border-gray-500 ${
                canRent ? 'card-interactive' : 'cursor-not-allowed pointer-events-none opacity-75'
            }`}
        >
            <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="w-full h-full"
            >
                {/* New badge */}
                {isNew && (
                    <motion.div
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="absolute top-3 left-3 z-10 bg-black text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg"
                    >
                        NEW!
                    </motion.div>
                )}

                {/* Wishlist button */}
                {showWishlist && canRent && (
                    <button
                        onClick={handleWishlistToggle}
                        className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-md hover:bg-white transition-colors group interactive-element"
                    >
                        <motion.span
                            animate={{ scale: isWishlisted ? 1.2 : 1 }}
                            className={`text-lg ${isWishlisted ? 'text-red-500' : 'text-gray-400'}`}
                        >
                            {isWishlisted ? '❤️' : '🤍'}
                        </motion.span>
                    </button>
                )}

                {/* Image section */}
                <div className="h-40 bg-gray-200 relative overflow-hidden">
                    {imageLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                    )}
                    <img
                        src={getPrimaryImage()}
                        alt={`${car.make} ${car.model}`}
                        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 ${
                            imageLoading ? 'opacity-0' : 'opacity-100'
                        }`}
                        onLoad={() => setImageLoading(false)}
                        onError={() => {
                            setImageLoading(false);
                        }}
                    />

                    {/* Overlay with quick info */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute bottom-3 left-3 text-white">
                            <div className="flex items-center space-x-2 text-sm">
                                <span>{getCarTypeIcon(car.make || 'sedan')}</span>
                                <span>{car.transmission}</span>
                                <span>•</span>
                                <span>{car.seats} seats</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content section */}
                <div className="p-4">
                    {/* Header with car name and badges */}
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                            <h4 className="text-base font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors truncate">
                                {car.make} {car.model} ({car.year})
                            </h4>
                            <p className="text-xs text-gray-600 mb-1">Host: {hostName}</p>

                            {/* Rating Display */}
                            {showRating && (
                                <div className="flex items-center">
                                    {loadingRating ? (
                                        <div className="flex items-center gap-1 text-xs text-gray-400">
                                            <div className="animate-spin w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full"></div>
                                            <span>Loading rating...</span>
                                        </div>
                                    ) : ratingStats && ratingStats.total_reviews > 0 ? (
                                        <StarRatingCompact
                                            rating={ratingStats.average_rating}
                                            totalReviews={ratingStats.total_reviews}
                                            size="sm"
                                            className="text-xs"
                                        />
                                    ) : (
                                        <span className="text-xs text-gray-500">
                                            No reviews yet
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex-shrink-0 ml-2">{getEfficiencyBadge()}</div>
                    </div>

                    {/* Quick specs */}
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                        <div className="flex items-center space-x-3">
                            <span className="flex items-center">⚙️ {car.transmission}</span>
                            <span className="flex items-center">⛽ {car.fuel_type}</span>
                            <span className="flex items-center">👥 {car.seats} seats</span>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-gray-600 text-xs mb-3 line-clamp-2">
                        {car.description ||
                            `${car.transmission} ${car.fuel_type} vehicle with ${car.seats} seats`}
                    </p>

                    {/* Recently approved indicator */}
                    {isNew && (
                        <div className="flex items-center text-xs text-black mb-2">
                            <span className="w-2 h-2 bg-black rounded-full mr-2 animate-pulse"></span>
                            Recently approved • {formatTimeAgo(car.updated_at)}
                        </div>
                    )}

                    {/* Pricing */}
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-xl font-bold text-gray-900">
                                Rp {car.daily_rate.toLocaleString()}
                            </span>
                            <span className="text-gray-600 text-xs">/day</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
};

// Memoize the component to prevent unnecessary re-renders when host info doesn't change
export const VehicleCard = memo(VehicleCardComponent, (prevProps, nextProps) => {
    // Custom comparison to optimize re-renders
    return (
        prevProps.car.id === nextProps.car.id &&
        prevProps.canRent === nextProps.canRent &&
        prevProps.isNew === nextProps.isNew &&
        prevProps.showWishlist === nextProps.showWishlist &&
        prevProps.hostInfo?.id === nextProps.hostInfo?.id &&
        prevProps.hostInfo?.full_name === nextProps.hostInfo?.full_name
    );
});
