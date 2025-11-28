'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

interface NewlyAvailableCar {
    id: string;
    make: string;
    model: string;
    year: number;
    daily_rate: number;
    host_id: string;
    updated_at: string;
}

interface NewCarBannerProps {
    newCars: NewlyAvailableCar[];
    onDismiss: (carId: string) => void;
    onDismissAll: () => void;
    canRent: boolean;
}

export function NewCarBanner({ newCars, onDismiss, onDismissAll, canRent }: NewCarBannerProps) {
    if (newCars.length === 0 || !canRent) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -50, scale: 0.95 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="bg-gradient-to-r from-black to-gray-800 text-white py-4 px-4 sm:px-6 lg:px-8 shadow-lg"
            >
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                                <motion.div
                                    animate={{ rotate: [0, 10, -10, 0] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"
                                >
                                    🚗
                                </motion.div>
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">
                                    {newCars.length} New Car
                                    {newCars.length > 1 ? 's' : ''} Available!
                                </h3>
                                <p className="text-white/80 text-sm">
                                    {newCars.length === 1
                                        ? `${newCars[0].make} ${newCars[0].model} (${newCars[0].year}) is now available for booking`
                                        : `${newCars.length} cars have been approved and are ready to rent`}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Link
                                href="#featured-cars"
                                onClick={() => {
                                    document
                                        .getElementById('recently-approved')
                                        ?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors backdrop-blur-sm"
                            >
                                View Cars
                            </Link>
                            <button
                                onClick={onDismissAll}
                                className="text-white/60 hover:text-white transition-colors p-1 cursor-pointer"
                                title="Dismiss all notifications"
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    {newCars.length > 1 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-3 flex flex-wrap gap-2"
                        >
                            {newCars.slice(0, 3).map((car) => (
                                <motion.div
                                    key={car.id}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1 text-sm flex items-center space-x-2"
                                >
                                    <span>
                                        {car.make} {car.model} ({car.year})
                                    </span>
                                    <button
                                        onClick={() => onDismiss(car.id)}
                                        className="text-white/60 hover:text-white text-xs cursor-pointer"
                                    >
                                        ×
                                    </button>
                                </motion.div>
                            ))}
                            {newCars.length > 3 && (
                                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1 text-sm text-white/80">
                                    +{newCars.length - 3} more
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
