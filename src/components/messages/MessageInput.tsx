'use client';

import { Loader2, Send } from 'lucide-react';
import { KeyboardEvent, useRef, useState } from 'react';

import type { MessageInputProps } from '@/types/message.types';

export function MessageInput({
    booking_id,
    receiver_id,
    onMessageSent,
    disabled = false,
    placeholder = 'Type a message...',
}: MessageInputProps) {
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = async () => {
        if (!message.trim() || isSubmitting || disabled) return;

        setIsSubmitting(true);
        setError(null);

        try {
            // Rely on cookies for authentication instead of Authorization header
            // The middleware will handle setting the proper auth cookies
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    booking_id,
                    receiver_id,
                    message: message.trim(),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send message.');
            }

            // Success
            setMessage('');
            onMessageSent();

            // Resize textarea back to single line
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send message.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        setError(null);

        // Auto-resize textarea
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    };

    const isDisabled = disabled || isSubmitting || !message.trim();
    const characterCount = message.length;
    const maxLength = 2000;
    const isNearLimit = characterCount > maxLength * 0.8;

    return (
        <div className="p-4">
            {/* Error message */}
            {error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            <div className="flex items-end space-x-3">
                {/* Message input */}
                <div className="flex-1">
                    <div className="relative">
                        <textarea
                            ref={textareaRef}
                            value={message}
                            onChange={handleTextareaChange}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            disabled={disabled || isSubmitting}
                            className={`
                w-full px-4 py-3 border rounded-lg resize-none text-gray-900
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
                ${error ? 'border-red-300' : 'border-gray-300'}
                min-h-[48px] max-h-[120px]
              `}
                            rows={1}
                            maxLength={maxLength}
                        />

                        {/* Character counter */}
                        {(characterCount > 0 || isNearLimit) && (
                            <div
                                className={`
                  absolute bottom-2 right-2 text-xs
                  ${isNearLimit ? 'text-orange-500' : 'text-gray-400'}
                  ${characterCount >= maxLength ? 'text-red-500 font-semibold' : ''}
                `}
                            >
                                {characterCount}/{maxLength}
                            </div>
                        )}
                    </div>
                </div>

                {/* Send button */}
                <button
                    onClick={handleSubmit}
                    disabled={isDisabled}
                    className={`
            flex items-center justify-center w-12 h-12 rounded-lg
            transition-colors duration-200
            ${
                isDisabled
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }
          `}
                    title="Send message (Enter)"
                >
                    {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Send className="w-5 h-5" />
                    )}
                </button>
            </div>

            {/* Helper text */}
            <div className="mt-2 text-xs text-gray-500">
                Press Enter to send message. Use Shift+Enter for line breaks.
            </div>
        </div>
    );
}
