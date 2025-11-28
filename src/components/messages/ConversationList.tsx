'use client';

import { format, isToday, isYesterday } from 'date-fns';
import { Car, MessageCircle, User } from 'lucide-react';

import { LoadingSpinner } from '@/components/ui';
import type { ConversationListProps } from '@/types/message.types';

export function ConversationList({
    conversations,
    onConversationSelect,
    selectedBookingId,
    isLoading = false,
}: ConversationListProps) {
    const formatLastMessageTime = (timestamp: string | null) => {
        if (!timestamp) return '';

        const date = new Date(timestamp);

        if (isToday(date)) {
            return format(date, 'HH:mm');
        } else if (isYesterday(date)) {
            return 'Yesterday';
        } else {
            return format(date, 'MM/dd');
        }
    };

    const truncateMessage = (message: string | null, maxLength: number = 50) => {
        if (!message) return 'No messages';

        if (message.length <= maxLength) return message;
        return message.substring(0, maxLength) + '...';
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
            </div>
        );
    }

    if (conversations.length === 0) {
        return (
            <div className="text-center py-12">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations</h3>
                <p className="text-gray-600">No active conversations yet.</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-gray-200">
            {conversations.map((conversation) => {
                const isSelected = selectedBookingId === conversation.booking_id;

                return (
                    <button
                        key={conversation.booking_id}
                        onClick={() => onConversationSelect(conversation.booking_id)}
                        className={`
              w-full p-4 text-left hover:bg-gray-50 transition-colors duration-200
              ${isSelected ? 'bg-blue-50 border-r-2 border-blue-600' : ''}
            `}
                    >
                        <div className="flex items-start space-x-3">
                            {/* Avatar/Icon */}
                            <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-gray-600" />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-sm font-semibold text-gray-900 truncate">
                                        {conversation.other_user_name}
                                    </h4>
                                    <div className="flex items-center space-x-2">
                                        {conversation.unread_count > 0 && (
                                            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-600 rounded-full">
                                                {conversation.unread_count > 99
                                                    ? '99+'
                                                    : conversation.unread_count}
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500">
                                            {formatLastMessageTime(conversation.last_message_at)}
                                        </span>
                                    </div>
                                </div>

                                {/* Vehicle info */}
                                <div className="flex items-center space-x-1 mb-2">
                                    <Car className="w-3 h-3 text-gray-400" />
                                    <span className="text-xs text-gray-600 truncate">
                                        {conversation.vehicle_name}
                                    </span>
                                    <span
                                        className={`
                    text-xs px-2 py-0.5 rounded-full
                    ${
                        conversation.booking_status === 'CONFIRMED'
                            ? 'bg-green-100 text-green-800'
                            : conversation.booking_status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : conversation.booking_status === 'IN_PROGRESS'
                                ? 'bg-blue-100 text-blue-800'
                                : conversation.booking_status === 'COMPLETED'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-red-100 text-red-800'
                    }
                  `}
                                    >
                                        {conversation.booking_status === 'CONFIRMED' && 'Confirmed'}
                                        {conversation.booking_status === 'PENDING' && 'Pending'}
                                        {conversation.booking_status === 'IN_PROGRESS' &&
                                            'In Progress'}
                                        {conversation.booking_status === 'COMPLETED' && 'Completed'}
                                        {conversation.booking_status === 'CANCELLED' && 'Cancelled'}
                                    </span>
                                </div>

                                {/* Last message */}
                                <p
                                    className={`
                  text-sm truncate
                  ${conversation.unread_count > 0 ? 'text-gray-900 font-medium' : 'text-gray-600'}
                `}
                                >
                                    {truncateMessage(conversation.last_message)}
                                </p>
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
