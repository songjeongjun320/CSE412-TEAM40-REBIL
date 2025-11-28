'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import {
    FlexibleLocationResult,
    indonesianAddressService,
} from '@/lib/utils/indonesianAddressService';

interface FlexibleLocationSearchProps {
    value: string;
    selectedLocation: FlexibleLocationResult | null;
    onChange: (value: string) => void;
    onLocationSelect: (location: FlexibleLocationResult | null) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export function FlexibleLocationSearch({
    value,
    selectedLocation,
    onChange,
    onLocationSelect,
    disabled = false,
    placeholder = 'Where are you traveling? (e.g., Jakarta, Bandung, Surabaya...)',
    className = '',
}: FlexibleLocationSearchProps) {
    const [suggestions, setSuggestions] = useState<FlexibleLocationResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Handle clicks outside to close suggestions
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchLocations = async (query: string) => {
        setLoading(true);
        try {
            const results = await indonesianAddressService.flexibleLocationSearch(query, 8);
            setSuggestions(results);
            setShowSuggestions(true);
        } catch (error) {
            console.error('Error searching locations:', error);
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onChange(newValue);

        // Clear selected location if user is typing
        if (selectedLocation && newValue !== selectedLocation.displayText) {
            onLocationSelect(null);
        }

        // Clear suggestions when typing
        if (showSuggestions) {
            setShowSuggestions(false);
        }
    };

    const handleSearchClick = async () => {
        if (value.trim().length >= 2) {
            await searchLocations(value);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && value.trim().length >= 2) {
            e.preventDefault();
            handleSearchClick();
        }
    };

    const handleLocationSelect = (location: FlexibleLocationResult) => {
        onChange(location.displayText);
        onLocationSelect(location);
        setShowSuggestions(false);
        inputRef.current?.blur();
    };

    const handleInputFocus = () => {
        // Only show existing suggestions on focus, don't auto-search
        if (suggestions.length > 0) {
            setShowSuggestions(true);
        }
    };

    const handleClearLocation = () => {
        onChange('');
        onLocationSelect(null);
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const getLocationIcon = (type: string) => {
        switch (type) {
            case 'province':
                return '🏛️';
            case 'regency':
                return '🏙️';
            case 'district':
                return '🏘️';
            case 'village':
                return '🏡';
            default:
                return '📍';
        }
    };

    return (
        <div className={`relative ${className}`} ref={searchRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleInputFocus}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={`w-full px-4 py-2 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-gray-800 focus:text-black disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors h-[38px] ${
                        selectedLocation ? 'bg-green-50 border-green-400' : ''
                    }`}
                />

                {/* Search button */}
                {value && !loading && !selectedLocation && (
                    <button
                        onClick={handleSearchClick}
                        disabled={value.trim().length < 2}
                        className="absolute right-10 top-1/2 transform -translate-y-1/2 text-blue-600 hover:text-blue-800 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Search locations (or press Enter)"
                    >
                        🔍
                    </button>
                )}

                {/* Clear button */}
                {value && !loading && (
                    <button
                        onClick={handleClearLocation}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        ✕
                    </button>
                )}

                {/* Loading indicator */}
                {loading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full"
                        />
                    </div>
                )}

                {/* Selected location indicator */}
                {!loading && selectedLocation && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                        ✓
                    </div>
                )}
            </div>

            {/* Suggestions dropdown */}
            <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                    >
                        {suggestions.map((location, index) => (
                            <motion.button
                                key={`${location.type}-${location.id}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => handleLocationSelect(location)}
                                className="w-full px-4 py-3 text-left hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-b-0 flex items-center space-x-3"
                            >
                                <span className="text-lg">{getLocationIcon(location.type)}</span>
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">{location.name}</div>
                                    <div className="text-sm text-gray-600">{location.fullPath}</div>
                                </div>
                                <span className="text-xs text-gray-400 capitalize">
                                    {location.type}
                                </span>
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* No results message */}
            {showSuggestions &&
                suggestions.length === 0 &&
                !loading &&
                value.trim().length >= 2 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500"
                    >
                        <div className="text-lg mb-1">🔍</div>
                        <div className="text-sm">No locations found for &quot;{value}&quot;</div>
                        <div className="text-xs text-gray-400 mt-1">
                            Try searching for a city, province, or district name
                        </div>
                    </motion.div>
                )}
        </div>
    );
}
