'use client';

import { Copy, MapPin, Navigation } from 'lucide-react';
import React, { useState } from 'react';

import { IndonesianAddress } from './index';

interface AddressDisplayProps {
    address: IndonesianAddress;
    cityName?: string;
    provinceName?: string;
    districtName?: string;
    villageName?: string;
    showMap?: boolean;
    showCopyButton?: boolean;
    compact?: boolean;
    className?: string;
}

// Address formatting utilities
function formatFullHierarchicalAddress(
    address: IndonesianAddress,
    cityName?: string,
    provinceName?: string,
    districtName?: string,
    villageName?: string,
): string {
    const parts: string[] = [];

    // Street address is always first
    if (address.street_address) {
        parts.push(address.street_address);
    }

    // Add hierarchical administrative levels
    // Priority: Use hierarchical (UUID-based) data over legacy text data
    if (address.village_id && villageName) {
        parts.push(villageName);
    } else if (address.village && !address.village_id) {
        const villageLabel =
            typeof (address as any).village === 'string'
                ? (address as any).village
                : address.village?.name;
        if (villageLabel) parts.push(villageLabel);
    }

    if (address.district_id && districtName) {
        parts.push(districtName);
    } else if (address.district && !address.district_id) {
        const districtLabel =
            typeof (address as any).district === 'string'
                ? (address as any).district
                : address.district?.name;
        if (districtLabel) parts.push(districtLabel);
    }

    if (cityName) {
        parts.push(cityName);
    }

    if (provinceName) {
        parts.push(provinceName);
    }

    if (address.postal_code) {
        parts.push(address.postal_code);
    }

    return parts.filter(Boolean).join(', ');
}

function formatCompactAddress(
    address: IndonesianAddress,
    cityName?: string,
    provinceName?: string,
    districtName?: string,
    villageName?: string,
    maxLevel: 'village' | 'district' | 'city' = 'city',
): string {
    const parts: string[] = [];

    // Determine the most specific level to display
    if (maxLevel === 'village' && address.village_id && villageName) {
        parts.push(villageName);
        if (cityName) parts.push(cityName);
    } else if (maxLevel === 'district' && address.district_id && districtName) {
        parts.push(districtName);
        if (cityName) parts.push(cityName);
    } else {
        // Default to city level
        if (cityName) parts.push(cityName);
        if (provinceName) parts.push(provinceName);
    }

    return parts.join(', ');
}

function getAddressDisplayLevel(
    address: IndonesianAddress,
): 'village' | 'district' | 'city' | 'basic' {
    if (address.village_id) return 'village';
    if (address.district_id) return 'district';
    if (address.city_id) return 'city';
    return 'basic';
}

function isLegacyAddress(address: IndonesianAddress): boolean {
    return !!(address.village || address.district) && !address.village_id && !address.district_id;
}

export default function AddressDisplay({
    address,
    cityName,
    provinceName,
    districtName,
    villageName,
    showMap = false,
    showCopyButton = false,
    compact = false,
    className = '',
}: AddressDisplayProps) {
    const [copySuccess, setCopySuccess] = useState(false);

    const fullAddress = formatFullHierarchicalAddress(
        address,
        cityName,
        provinceName,
        districtName,
        villageName,
    );

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(fullAddress);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy address:', err);
        }
    };

    const openInMaps = () => {
        if (address.latitude && address.longitude) {
            const url = `https://www.google.com/maps?q=${address.latitude},${address.longitude}`;
            window.open(url, '_blank');
        } else {
            const encodedAddress = encodeURIComponent(fullAddress);
            const url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
            window.open(url, '_blank');
        }
    };

    // Compact display for cards and lists
    if (compact) {
        const displayLevel = getAddressDisplayLevel(address);
        const compactText = formatCompactAddress(
            address,
            cityName,
            provinceName,
            districtName,
            villageName,
            displayLevel === 'basic' ? undefined : displayLevel,
        );

        return (
            <div className={`flex items-center space-x-2 text-sm text-gray-600 ${className}`}>
                <MapPin className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="truncate" title={fullAddress}>
                    {compactText || 'Address not available'}
                </span>
                {isLegacyAddress(address) && (
                    <span className="text-xs bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded">
                        Legacy
                    </span>
                )}
                {showMap && (
                    <button
                        onClick={openInMaps}
                        className="text-blue-600 hover:text-blue-800 flex-shrink-0 cursor-pointer"
                        title="Open in Maps"
                    >
                        <Navigation className="h-4 w-4" />
                    </button>
                )}
            </div>
        );
    }

    // Full address display
    return (
        <div className={`space-y-3 ${className}`}>
            {/* Street Address */}
            <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="text-base font-medium text-gray-900 mb-1">
                        {address.street_address || 'Street address not provided'}
                    </div>

                    {/* Administrative Hierarchy */}
                    <div className="text-sm text-gray-600 space-y-0.5">
                        {/* Show hierarchical path when available */}
                        {(address.village_id ||
                            address.district_id ||
                            address.village ||
                            address.district) && (
                            <div className="flex items-center space-x-2">
                                {/* Village level */}
                                {address.village_id && villageName ? (
                                    <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs">
                                        Village: {villageName}
                                    </span>
                                ) : address.village && !address.village_id ? (
                                    <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded text-xs">
                                        Village:{' '}
                                        {typeof (address as any).village === 'string'
                                            ? (address as any).village
                                            : address.village?.name}
                                    </span>
                                ) : null}

                                {/* District level */}
                                {address.district_id && districtName ? (
                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">
                                        District: {districtName}
                                    </span>
                                ) : address.district && !address.district_id ? (
                                    <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded text-xs">
                                        District:{' '}
                                        {typeof (address as any).district === 'string'
                                            ? (address as any).district
                                            : address.district?.name}
                                    </span>
                                ) : null}
                            </div>
                        )}

                        {/* City and Province */}
                        <div className="font-medium">
                            {cityName && provinceName ? (
                                <>
                                    {cityName}, {provinceName}
                                    {address.postal_code && (
                                        <span className="ml-2 text-gray-500">
                                            {address.postal_code}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="text-gray-400">
                                    City and province information not available
                                </span>
                            )}
                        </div>

                        {/* Address Type Indicator */}
                        {isLegacyAddress(address) && (
                            <div className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                                📝 Legacy address format - consider updating to detailed format
                            </div>
                        )}
                    </div>

                    {/* Additional Info */}
                    {address.additional_info && (
                        <div className="mt-2 text-sm text-gray-500 italic">
                            {address.additional_info}
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            {(showMap || showCopyButton) && (
                <div className="flex items-center space-x-3 pt-2 border-t border-gray-100">
                    {showMap && (
                        <button
                            onClick={openInMaps}
                            className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                        >
                            <Navigation className="h-4 w-4" />
                            <span>Open in Maps</span>
                        </button>
                    )}

                    {showCopyButton && (
                        <button
                            onClick={copyToClipboard}
                            className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
                        >
                            <Copy className="h-4 w-4" />
                            <span>{copySuccess ? 'Copied!' : 'Copy Address'}</span>
                        </button>
                    )}
                </div>
            )}

            {/* GPS Coordinates */}
            {address.latitude && address.longitude && (
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                    GPS: {address.latitude.toFixed(6)}, {address.longitude.toFixed(6)}
                </div>
            )}
        </div>
    );
}

// Enhanced Address Card component
export function AddressCard({
    address,
    cityName,
    provinceName,
    districtName,
    villageName,
    title,
    className = '',
}: AddressDisplayProps & { title?: string }) {
    return (
        <div className={`bg-white rounded-lg border-2 border-gray-400 p-4 ${className}`}>
            {title && <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>}
            <AddressDisplay
                address={address}
                cityName={cityName}
                provinceName={provinceName}
                districtName={districtName}
                villageName={villageName}
                showMap={true}
                showCopyButton={true}
            />
        </div>
    );
}

// Enhanced Address Line component with intelligent truncation
export function AddressLine({
    address,
    cityName,
    provinceName,
    districtName,
    villageName,
    maxLength = 50,
    showLevel = false,
    className = '',
}: AddressDisplayProps & { maxLength?: number; showLevel?: boolean }) {
    const displayLevel = getAddressDisplayLevel(address);
    const fullAddress = formatFullHierarchicalAddress(
        address,
        cityName,
        provinceName,
        districtName,
        villageName,
    );

    const displayAddress =
        fullAddress.length > maxLength ? fullAddress.substring(0, maxLength) + '...' : fullAddress;

    return (
        <div className={`flex items-center space-x-2 ${className}`}>
            <span className="text-gray-600" title={fullAddress}>
                {displayAddress}
            </span>
            {showLevel && (
                <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                        displayLevel === 'village'
                            ? 'bg-green-100 text-green-600'
                            : displayLevel === 'district'
                              ? 'bg-blue-100 text-blue-600'
                              : displayLevel === 'city'
                                ? 'bg-purple-100 text-purple-600'
                                : 'bg-gray-100 text-gray-600'
                    }`}
                >
                    {displayLevel}
                </span>
            )}
        </div>
    );
}

// Hierarchical breadcrumb display
export function AddressBreadcrumb({
    address,
    cityName,
    provinceName,
    districtName,
    villageName,
    className = '',
}: AddressDisplayProps) {
    const breadcrumbs: { label: string; level: string }[] = [];

    if (provinceName) breadcrumbs.push({ label: provinceName, level: 'province' });
    if (cityName) breadcrumbs.push({ label: cityName, level: 'city' });
    if (address.district_id && districtName)
        breadcrumbs.push({ label: districtName, level: 'district' });
    else if (address.district && !address.district_id) {
        const districtLabel =
            typeof (address as any).district === 'string'
                ? (address as any).district
                : address.district?.name;
        if (districtLabel) breadcrumbs.push({ label: districtLabel, level: 'district-legacy' });
    }
    if (address.village_id && villageName)
        breadcrumbs.push({ label: villageName, level: 'village' });
    else if (address.village && !address.village_id) {
        const villageLabel =
            typeof (address as any).village === 'string'
                ? (address as any).village
                : address.village?.name;
        if (villageLabel) breadcrumbs.push({ label: villageLabel, level: 'village-legacy' });
    }

    if (breadcrumbs.length === 0) {
        return <span className="text-gray-400 text-sm">Address hierarchy not available</span>;
    }

    return (
        <nav
            className={`flex items-center space-x-1 text-sm ${className}`}
            aria-label="Address breadcrumb"
        >
            {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                    <span
                        className={`${
                            crumb.level.includes('legacy') ? 'text-yellow-600' : 'text-gray-600'
                        } hover:text-gray-800`}
                    >
                        {crumb.label}
                    </span>
                    {index < breadcrumbs.length - 1 && <span className="text-gray-400">/</span>}
                </React.Fragment>
            ))}
        </nav>
    );
}
