'use client';

import { MessageCircle } from 'lucide-react';

import type { MessageNotificationProps } from '@/types/message.types';

export function MessageNotification({ unreadCount, onClick }: MessageNotificationProps) {
    if (unreadCount === 0) {
        return (
            <button
                onClick={onClick}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
                title="Messages"
            >
                <MessageCircle className="w-6 h-6" />
            </button>
        );
    }

    return (
        <button
            onClick={onClick}
            className="relative p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors duration-200"
            title={`${unreadCount} unread messages`}
        >
            <MessageCircle className="w-6 h-6" />

            {/* Notification badge */}
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full border-2 border-white">
                {unreadCount > 99 ? '99+' : unreadCount}
            </span>

            {/* Pulse animation for new messages */}
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full animate-ping opacity-75"></span>
        </button>
    );
}
