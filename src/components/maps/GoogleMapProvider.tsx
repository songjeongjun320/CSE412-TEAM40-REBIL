'use client';

import { APIProvider } from '@vis.gl/react-google-maps';
import React from 'react';

interface GoogleMapProviderProps {
    children: React.ReactNode;
}

export function GoogleMapProvider({ children }: GoogleMapProviderProps) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
        return (
            <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
                <div className="text-center p-6">
                    <div className="text-2xl text-gray-400 mb-4">🗺️</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                        Google Maps API Key Required
                    </h3>
                    <p className="text-sm text-gray-600">
                        Please add your Google Maps API key to the environment variables
                    </p>
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-left">
                        <p className="font-semibold text-yellow-800">Setup Instructions:</p>
                        <ol className="mt-2 space-y-1 text-yellow-700">
                            <li>1. Go to Google Cloud Console</li>
                            <li>2. Enable Maps JavaScript API</li>
                            <li>3. Create an API key</li>
                            <li>4. Update NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local</li>
                        </ol>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <APIProvider apiKey={apiKey} libraries={['marker', 'geometry', 'places']}>
            {children}
        </APIProvider>
    );
}
