'use client';

import { Wrench } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/hooks/cached/useAuth';

export function FixConversationsButton() {
    const {} = useAuth();
    const [isFixing, setIsFixing] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleFix = async () => {
        setIsFixing(true);
        setResult(null);

        try {
            // Rely on cookies for authentication instead of Authorization header
            // The middleware will handle setting the proper auth cookies
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            const response = await fetch('/api/debug/fix-conversations', {
                method: 'POST',
                headers,
                body: JSON.stringify({}),
            });

            const data = await response.json();
            setResult(data);

            if (data.success) {
                alert('Conversation list fixed! Please refresh the page.');
                window.location.reload();
            }
        } catch (error) {
            console.error('Fix failed:', error);
            setResult({ error: 'Fix failed' });
        } finally {
            setIsFixing(false);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <button
                onClick={handleFix}
                disabled={isFixing}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-lg disabled:opacity-50"
            >
                <Wrench className="w-4 h-4" />
                <span>{isFixing ? 'Fixing...' : 'Fix Conversations'}</span>
            </button>

            {result && (
                <div className="mt-2 p-3 bg-white rounded-lg shadow-lg max-w-sm">
                    <pre className="text-xs overflow-auto max-h-40">
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
