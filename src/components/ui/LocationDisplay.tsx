'use client';

import { useEffect, useState } from 'react';

import { formatLocationDisplay, type LocationData } from '@/lib/utils/locationHelpers';

interface LocationDisplayProps {
    location: LocationData;
    className?: string;
    fallback?: string;
}

export function LocationDisplay({
    location,
    className = '',
    fallback = 'Location not specified',
}: LocationDisplayProps) {
    const [displayText, setDisplayText] = useState<string>('Loading...');

    useEffect(() => {
        const formatLocation = async () => {
            try {
                const formatted = await formatLocationDisplay(location);
                setDisplayText(formatted);
            } catch (error) {
                console.error('Error formatting location:', error);
                setDisplayText(fallback);
            }
        };

        formatLocation();
    }, [location, fallback]);

    return <span className={className}>{displayText}</span>;
}
