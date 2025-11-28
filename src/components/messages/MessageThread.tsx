'use client';

import { format, isToday, isYesterday } from 'date-fns';
import { useEffect, useRef } from 'react';

import { LoadingSpinner } from '@/components/ui';
import { useMessages } from '@/hooks/useMessages';
import type { MessageThreadProps } from '@/types/message.types';

import { MessageInput } from './MessageInput';

export function MessageThread({
    booking_id,
    current_user_id,
    other_user_id,
    other_user_name,
    onNewMessage,
}: MessageThreadProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { messages, isLoading, error, markAsRead, refetch } = useMessages(
        booking_id,
        other_user_id,
    );

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Mark unread messages as read when thread is opened
    // Use a ref to track which messages we've already tried to mark as read
    const markedAsReadRef = useRef(new Set<string>());

    useEffect(() => {
        const unreadMessages = messages.filter(
            (msg) =>
                !msg.is_read &&
                msg.receiver_id === current_user_id &&
                !markedAsReadRef.current.has(msg.id),
        );

        if (unreadMessages.length > 0) {
            const messageIds = unreadMessages.map((msg) => msg.id);

            // Mark these message IDs as "being processed" to prevent duplicates
            messageIds.forEach((id) => markedAsReadRef.current.add(id));

            markAsRead(messageIds);
        }
    }, [messages, current_user_id, markAsRead]);

    const handleMessageSent = () => {
        refetch();
        if (onNewMessage && messages.length > 0) {
            onNewMessage(messages[0]);
        }
    };

    const formatMessageTime = (timestamp: string) => {
        const date = new Date(timestamp);

        if (isToday(date)) {
            return format(date, 'HH:mm');
        } else if (isYesterday(date)) {
            return `Yesterday ${format(date, 'HH:mm')}`;
        } else {
            return format(date, 'MM/dd HH:mm');
        }
    };

    const groupMessagesByDate = () => {
        const groups: { [key: string]: typeof messages } = {};

        messages.forEach((message) => {
            const date = new Date(message.created_at);
            let dateKey;

            if (isToday(date)) {
                dateKey = 'Today';
            } else if (isYesterday(date)) {
                dateKey = 'Yesterday';
            } else {
                dateKey = format(date, 'MMMM dd, yyyy');
            }

            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(message);
        });

        return groups;
    };

    if (isLoading && messages.length === 0) {
        return (
            <div className="flex items-center justify-center h-96">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center">
                <div className="text-red-600 mb-4">{error}</div>
                <button
                    onClick={refetch}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Try Again
                </button>
            </div>
        );
    }

    const messageGroups = groupMessagesByDate();

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white border-b p-4">
                <h3 className="text-lg font-semibold text-gray-900">
                    Conversation with {other_user_name}
                </h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        No messages yet. Send the first message!
                    </div>
                ) : (
                    Object.entries(messageGroups)
                        .reverse()
                        .map(([dateGroup, groupMessages]) => (
                            <div key={dateGroup} className="space-y-3">
                                {/* Date separator */}
                                <div className="flex items-center justify-center">
                                    <span className="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">
                                        {dateGroup}
                                    </span>
                                </div>

                                {/* Messages for this date */}
                                {groupMessages.reverse().map((message) => {
                                    const isSent = message.sender_id === current_user_id;

                                    return (
                                        <div
                                            key={message.id}
                                            className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[70%] rounded-lg p-3 ${
                                                    isSent
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-100 text-gray-900'
                                                }`}
                                            >
                                                <p className="break-words whitespace-pre-wrap">
                                                    {message.message}
                                                </p>
                                                <div
                                                    className={`text-xs mt-1 ${
                                                        isSent ? 'text-blue-100' : 'text-gray-500'
                                                    }`}
                                                >
                                                    {formatMessageTime(message.created_at)}
                                                    {isSent && (
                                                        <span className="ml-2">
                                                            {message.is_read ? 'Read' : 'Sent'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t bg-white">
                <MessageInput
                    booking_id={booking_id}
                    receiver_id={other_user_id}
                    onMessageSent={handleMessageSent}
                    placeholder={`Send message to ${other_user_name}...`}
                />
            </div>
        </div>
    );
}
