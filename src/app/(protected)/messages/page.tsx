'use client';

import { AlertCircle, MessageCircle, Plus, Search, User, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { FixConversationsButton } from '@/components/debug/FixConversationsButton';
import {
    ConversationList,
    CustomerList,
    InquiriesList,
    MessageInput,
    MessageThread,
} from '@/components/messages';
import { LoadingSpinner } from '@/components/ui';
import { useAuth } from '@/hooks/cached/useAuth';
import { useBookingLookup } from '@/hooks/useBookingLookup';
import { useConversations } from '@/hooks/useConversations';

// Force dynamic rendering since this page requires authentication and user-specific data
export const dynamic = 'force-dynamic';

type ViewMode = 'conversations' | 'customers' | 'inquiries';
type ConversationFilter = 'all' | 'unread' | 'active' | 'archived';

function MessagesPageContent() {
    const { user, roles } = useAuth();
    const { conversations, isLoading, error, refetch } = useConversations();
    const {
        booking,
        isLoading: isLookingUpBooking,
        error: bookingError,
        hasSearched,
        findBooking,
        reset: resetBookingLookup,
    } = useBookingLookup();
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('conversations');
    const [searchTerm, setSearchTerm] = useState('');
    const [conversationFilter, setConversationFilter] = useState<ConversationFilter>('all');
    const [showMobileConversations, setShowMobileConversations] = useState(true);
    const [newMessageRecipient, setNewMessageRecipient] = useState<{
        email: string;
        name: string;
        id: string;
    } | null>(null);

    // Determine user role for UI customization
    const isHost = roles?.isHost || false;
    const isRenter = roles?.isRenter || false;

    // Automatically find booking when new message recipient is set
    useEffect(() => {
        if (newMessageRecipient?.id) {
            findBooking(newMessageRecipient.id);
        } else {
            resetBookingLookup();
        }
    }, [newMessageRecipient?.id, findBooking, resetBookingLookup]);

    // Filter conversations based on current filter
    const filteredConversations = conversations.filter((conv) => {
        // Search filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            if (
                !conv.other_user_name.toLowerCase().includes(searchLower) &&
                !conv.vehicle_name.toLowerCase().includes(searchLower) &&
                !conv.last_message?.toLowerCase().includes(searchLower)
            ) {
                return false;
            }
        }

        // Status filter
        switch (conversationFilter) {
            case 'unread':
                return conv.unread_count > 0;
            case 'active':
                return ['CONFIRMED', 'IN_PROGRESS'].includes(conv.booking_status);
            case 'archived':
                return ['COMPLETED', 'CANCELLED'].includes(conv.booking_status);
            case 'all':
            default:
                return true;
        }
    });

    // Find selected conversation details
    const selectedConversation = conversations.find(
        (conv) => conv.booking_id === selectedBookingId,
    );

    // Stats for dashboard cards
    const stats = {
        total: conversations.length,
        unread: conversations.filter((c) => c.unread_count > 0).length,
        active: conversations.filter((c) => ['CONFIRMED', 'IN_PROGRESS'].includes(c.booking_status))
            .length,
        completed: conversations.filter((c) => c.booking_status === 'COMPLETED').length,
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h3>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={refetch}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between py-4">
                        <div className="flex items-center space-x-3">
                            <MessageCircle className="w-8 h-8 text-blue-600" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
                                <p className="text-sm text-gray-600">
                                    {isHost && isRenter
                                        ? 'Manage your host and renter communications'
                                        : isHost
                                          ? 'Connect with your customers'
                                          : 'Chat with vehicle hosts'}
                                </p>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="hidden md:flex items-center space-x-6">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                    {stats.unread}
                                </div>
                                <div className="text-xs text-gray-600">Unread</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">
                                    {stats.active}
                                </div>
                                <div className="text-xs text-gray-600">Active</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-600">
                                    {stats.total}
                                </div>
                                <div className="text-xs text-gray-600">Total</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Navigation Tabs */}
                <div className="bg-white rounded-t-xl border-b">
                    <div className="flex space-x-0">
                        <button
                            onClick={() => setViewMode('conversations')}
                            className={`flex-1 md:flex-none md:px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                viewMode === 'conversations'
                                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <MessageCircle className="w-4 h-4 inline mr-2" />
                            Conversations ({stats.total})
                        </button>

                        {isHost && (
                            <>
                                <button
                                    onClick={() => setViewMode('customers')}
                                    className={`flex-1 md:flex-none md:px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                        viewMode === 'customers'
                                            ? 'border-blue-500 text-blue-600 bg-blue-50'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <Users className="w-4 h-4 inline mr-2" />
                                    Customers
                                </button>

                                <button
                                    onClick={() => setViewMode('inquiries')}
                                    className={`flex-1 md:flex-none md:px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                        viewMode === 'inquiries'
                                            ? 'border-blue-500 text-blue-600 bg-blue-50'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <Plus className="w-4 h-4 inline mr-2" />
                                    Inquiries
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="bg-white rounded-b-xl shadow-sm">
                    {viewMode === 'conversations' && (
                        <div className="flex flex-col lg:flex-row h-[calc(100vh-300px)]">
                            {/* Conversation List Panel */}
                            <div
                                className={`
                                w-full lg:w-96 border-r border-gray-200 flex flex-col
                                ${!showMobileConversations && selectedConversation ? 'hidden lg:flex' : 'flex'}
                            `}
                            >
                                {/* Search and Filters */}
                                <div className="p-4 border-b bg-gray-50">
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search conversations..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        />
                                    </div>

                                    <div className="flex space-x-1">
                                        {[
                                            { key: 'all', label: 'All', count: stats.total },
                                            { key: 'unread', label: 'Unread', count: stats.unread },
                                            { key: 'active', label: 'Active', count: stats.active },
                                        ].map(({ key, label, count }) => (
                                            <button
                                                key={key}
                                                onClick={() =>
                                                    setConversationFilter(key as ConversationFilter)
                                                }
                                                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                                                    conversationFilter === key
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-white text-gray-600 hover:bg-gray-100'
                                                }`}
                                            >
                                                {label} {count > 0 && `(${count})`}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Conversation List */}
                                <div className="flex-1 overflow-y-auto">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-12">
                                            <LoadingSpinner />
                                        </div>
                                    ) : filteredConversations.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 px-4">
                                            <MessageCircle className="w-12 h-12 text-gray-300 mb-3" />
                                            <h3 className="font-medium text-gray-900 mb-1">
                                                {searchTerm || conversationFilter !== 'all'
                                                    ? 'No matching conversations'
                                                    : 'No conversations yet'}
                                            </h3>
                                            <p className="text-sm text-gray-600 text-center">
                                                {searchTerm || conversationFilter !== 'all'
                                                    ? 'Try adjusting your search or filter'
                                                    : isHost
                                                      ? 'Customer conversations will appear here when bookings are made'
                                                      : 'Start by booking a vehicle to chat with hosts'}
                                            </p>
                                        </div>
                                    ) : (
                                        <ConversationList
                                            conversations={filteredConversations}
                                            onConversationSelect={(id) => {
                                                setSelectedBookingId(id);
                                                setShowMobileConversations(false);
                                            }}
                                            selectedBookingId={selectedBookingId}
                                            isLoading={false}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Message Thread Panel */}
                            <div
                                className={`
                                flex-1 flex flex-col
                                ${showMobileConversations && !selectedConversation ? 'hidden lg:flex' : 'flex'}
                            `}
                            >
                                {selectedConversation ? (
                                    <>
                                        {/* Mobile Back Button */}
                                        <div className="lg:hidden border-b p-4 bg-gray-50">
                                            <button
                                                onClick={() => {
                                                    setShowMobileConversations(true);
                                                    setSelectedBookingId(null);
                                                }}
                                                className="text-blue-600 text-sm font-medium"
                                            >
                                                ← Back to conversations
                                            </button>
                                        </div>

                                        <MessageThread
                                            booking_id={selectedConversation.booking_id}
                                            current_user_id={user.id}
                                            other_user_id={selectedConversation.other_user_id}
                                            other_user_name={selectedConversation.other_user_name}
                                            onNewMessage={() => refetch()}
                                        />
                                    </>
                                ) : newMessageRecipient ? (
                                    <div className="flex flex-col h-full">
                                        {/* New Conversation Header */}
                                        <div className="border-b p-4 bg-white">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                        <User className="w-5 h-5 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-medium text-gray-900">
                                                            {newMessageRecipient.name}
                                                        </h3>
                                                        <p className="text-sm text-gray-600">
                                                            {newMessageRecipient.email}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setNewMessageRecipient(null);
                                                        resetBookingLookup();
                                                    }}
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>

                                        {/* Message Area */}
                                        <div className="flex-1 p-4 bg-gray-50">
                                            {isLookingUpBooking ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <div className="flex items-center space-x-2 text-gray-500">
                                                        <LoadingSpinner />
                                                        <span className="text-sm">
                                                            Looking for existing bookings...
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : hasSearched ? (
                                                bookingError ? (
                                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                                                        <div className="flex items-center space-x-2 text-red-700 mb-2">
                                                            <AlertCircle className="w-4 h-4" />
                                                            <span className="text-sm font-medium">
                                                                Error checking bookings
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-red-600 mb-3">
                                                            {bookingError}
                                                        </p>
                                                        {/* Additional context for debugging */}
                                                        <details className="text-xs text-red-600 mb-3">
                                                            <summary className="cursor-pointer font-medium">
                                                                Debug Information
                                                            </summary>
                                                            <div className="mt-2 p-2 bg-red-100 rounded text-xs">
                                                                <p>
                                                                    <strong>User ID:</strong>{' '}
                                                                    {newMessageRecipient?.id}
                                                                </p>
                                                                <p>
                                                                    <strong>User Email:</strong>{' '}
                                                                    {newMessageRecipient?.email}
                                                                </p>
                                                                <p>
                                                                    <strong>Error:</strong>{' '}
                                                                    {bookingError}
                                                                </p>
                                                                <p className="mt-1">
                                                                    <em>
                                                                        Check console for detailed
                                                                        logs
                                                                    </em>
                                                                </p>
                                                            </div>
                                                        </details>
                                                        <div className="space-y-2">
                                                            <button
                                                                onClick={() =>
                                                                    findBooking(
                                                                        newMessageRecipient.id,
                                                                    )
                                                                }
                                                                className="w-full bg-red-600 text-white py-2 px-3 rounded-md hover:bg-red-700 transition-colors text-xs"
                                                            >
                                                                Try Again
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : booking ? (
                                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                                        <div className="flex items-center space-x-2 text-green-700 mb-2">
                                                            <AlertCircle className="w-4 h-4" />
                                                            <span className="text-sm font-medium">
                                                                Booking found! You can now message
                                                                each other.
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-green-600">
                                                            Found booking for{' '}
                                                            {booking.vehicle_info.year}{' '}
                                                            {booking.vehicle_info.make}{' '}
                                                            {booking.vehicle_info.model} from{' '}
                                                            {new Date(
                                                                booking.created_at,
                                                            ).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                                        <div className="flex items-center space-x-2 text-yellow-700 mb-2">
                                                            <AlertCircle className="w-4 h-4" />
                                                            <span className="text-sm font-medium">
                                                                Unexpected: No active bookings found
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-yellow-600 mb-3">
                                                            This customer appears in your customers
                                                            list but no active bookings were found.
                                                            This might be due to cancelled bookings
                                                            or a data sync issue.
                                                        </p>
                                                        {/* Debug information for troubleshooting */}
                                                        <details className="text-xs text-yellow-600 mb-3">
                                                            <summary className="cursor-pointer font-medium">
                                                                Debug Information
                                                            </summary>
                                                            <div className="mt-2 p-2 bg-yellow-100 rounded text-xs">
                                                                <p>
                                                                    <strong>Customer ID:</strong>{' '}
                                                                    {newMessageRecipient?.id}
                                                                </p>
                                                                <p>
                                                                    <strong>Customer Email:</strong>{' '}
                                                                    {newMessageRecipient?.email}
                                                                </p>
                                                                <p className="mt-1">
                                                                    <em>
                                                                        This customer shows in the
                                                                        customers tab but has no
                                                                        qualifying bookings for
                                                                        messaging. Check console for
                                                                        API details.
                                                                    </em>
                                                                </p>
                                                            </div>
                                                        </details>
                                                        <div className="space-y-2">
                                                            <button
                                                                onClick={() =>
                                                                    findBooking(
                                                                        newMessageRecipient.id,
                                                                    )
                                                                }
                                                                className="w-full bg-yellow-600 text-white py-2 px-3 rounded-md hover:bg-yellow-700 transition-colors text-xs"
                                                            >
                                                                Retry Booking Search
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setNewMessageRecipient(null);
                                                                    resetBookingLookup();
                                                                }}
                                                                className="w-full bg-gray-200 text-gray-700 py-2 px-3 rounded-md hover:bg-gray-300 transition-colors text-xs"
                                                            >
                                                                Back to Customers
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            ) : (
                                                <div className="text-center text-gray-500 text-sm">
                                                    Checking for existing bookings with{' '}
                                                    {newMessageRecipient.name}...
                                                </div>
                                            )}
                                        </div>

                                        {/* Message Input */}
                                        <div className="border-t bg-white">
                                            {booking ? (
                                                <MessageInput
                                                    booking_id={booking.booking_id}
                                                    receiver_id={newMessageRecipient.id}
                                                    onMessageSent={() => {
                                                        refetch();
                                                        // Switch to the conversation after sending the first message
                                                        setSelectedBookingId(booking.booking_id);
                                                        setNewMessageRecipient(null);
                                                        resetBookingLookup();
                                                    }}
                                                    placeholder={`Send a message to ${newMessageRecipient.name}...`}
                                                    disabled={isLookingUpBooking}
                                                />
                                            ) : hasSearched && !isLookingUpBooking ? (
                                                <div className="p-4">
                                                    <button
                                                        onClick={() => {
                                                            setNewMessageRecipient(null);
                                                            resetBookingLookup();
                                                        }}
                                                        className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                                                    >
                                                        Back to Conversations
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="p-4">
                                                    <div className="text-center text-gray-500 text-sm">
                                                        Please wait while we check for existing
                                                        bookings...
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full bg-gray-50">
                                        <div className="text-center max-w-sm">
                                            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                                Select a conversation
                                            </h3>
                                            <p className="text-gray-600">
                                                Choose a conversation from the list to start
                                                messaging.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Customers Tab (Host Only) */}
                    {viewMode === 'customers' && isHost && (
                        <CustomerList
                            onStartConversation={(customerEmail, customerName, customerId) => {
                                // Start a new conversation with this customer
                                setNewMessageRecipient({
                                    email: customerEmail,
                                    name: customerName,
                                    id: customerId, // Using proper UUID instead of email
                                });
                                setViewMode('conversations');
                                setSelectedBookingId(null); // Clear any selected conversation
                                console.log(
                                    'Starting new conversation with:',
                                    customerName,
                                    customerEmail,
                                    'ID:',
                                    customerId,
                                );
                            }}
                        />
                    )}

                    {/* Inquiries Tab (Host Only) */}
                    {viewMode === 'inquiries' && isHost && (
                        <InquiriesList
                            onReplyToInquiry={(inquiry) => {
                                // TODO: Implement inquiry reply functionality
                                console.log('Reply to inquiry:', inquiry);
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Debug button - only show in development */}
            {process.env.NODE_ENV === 'development' && <FixConversationsButton />}
        </div>
    );
}

export default function MessagesPage() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <LoadingSpinner />
            </div>
        );
    }

    return <MessagesPageContent />;
}
