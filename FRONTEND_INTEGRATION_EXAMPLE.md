# Frontend Integration Example: MessageInput Component

## Overview
This document demonstrates how to integrate the MessageInput component with the find-booking API for seamless messaging between users with existing booking relationships.

## Component Usage Example

### 1. Basic MessageInput Integration

```tsx
import { MessageInput } from '@/components/messages/MessageInput';
import { useState, useEffect } from 'react';

function ConversationPage({ targetUserId }: { targetUserId: string }) {
    const [bookingInfo, setBookingInfo] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Find existing booking between users
    useEffect(() => {
        findBookingBetweenUsers(targetUserId);
    }, [targetUserId]);

    const findBookingBetweenUsers = async (targetUserId: string) => {
        try {
            const response = await fetch('/api/messages/find-booking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    target_user_id: targetUserId
                })
            });

            const data = await response.json();

            if (data.success) {
                setBookingInfo(data.booking);
                await loadMessages(data.booking.booking_id);
            } else {
                setError('No shared booking found with this user');
            }
        } catch (err) {
            setError('Failed to find booking relationship');
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (bookingId: string) => {
        try {
            const response = await fetch(`/api/messages?booking_id=${bookingId}`, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            const data = await response.json();
            if (data.success) {
                setMessages(data.messages);
            }
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    };

    const handleMessageSent = () => {
        // Refresh messages after sending
        if (bookingInfo) {
            loadMessages(bookingInfo.booking_id);
        }
    };

    if (loading) return <div>Finding conversation...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!bookingInfo) return <div>No conversation available</div>;

    return (
        <div className="conversation-container">
            {/* Conversation Header */}
            <div className="conversation-header">
                <h2>Conversation about {bookingInfo.vehicle_info.year} {bookingInfo.vehicle_info.make} {bookingInfo.vehicle_info.model}</h2>
                <p>Booking Status: {bookingInfo.booking_status}</p>
            </div>

            {/* Messages Display */}
            <div className="messages-list">
                {messages.map((message) => (
                    <div key={message.id} className="message">
                        <strong>{message.sender_name}:</strong> {message.message}
                        <small>{new Date(message.created_at).toLocaleString()}</small>
                    </div>
                ))}
            </div>

            {/* Message Input */}
            <MessageInput
                booking_id={bookingInfo.booking_id}
                receiver_id={targetUserId}
                onMessageSent={handleMessageSent}
                placeholder="Type your message..."
            />
        </div>
    );
}
```

### 2. Advanced Integration with Error Handling

```tsx
import { MessageInput } from '@/components/messages/MessageInput';
import { useAuth } from '@/hooks/cached/useAuth';
import { useState, useEffect } from 'react';

interface BookingRelationship {
    booking_id: string;
    booking_status: string;
    vehicle_info: {
        make: string;
        model: string;
        year: number;
    };
    relationship: 'host_to_renter' | 'renter_to_host';
    created_at: string;
}

function MessagingFlow({ otherUserId, otherUserName }: {
    otherUserId: string;
    otherUserName: string;
}) {
    const { session } = useAuth();
    const [booking, setBooking] = useState<BookingRelationship | null>(null);
    const [messages, setMessages] = useState([]);
    const [loadingBooking, setLoadingBooking] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (session?.access_token) {
            discoverBookingRelationship();
        }
    }, [session, otherUserId]);

    const discoverBookingRelationship = async () => {
        try {
            setLoadingBooking(true);
            setError(null);

            const response = await fetch('/api/messages/find-booking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    target_user_id: otherUserId
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setBooking(data.booking);
                await loadConversationHistory(data.booking.booking_id);
            } else {
                // Handle different error scenarios
                if (response.status === 404) {
                    setError(`No booking history found with ${otherUserName}. You can only message users you've had bookings with.`);
                } else if (response.status === 401) {
                    setError('Please sign in to start a conversation.');
                } else {
                    setError(data.error || 'Unable to start conversation');
                }
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoadingBooking(false);
        }
    };

    const loadConversationHistory = async (bookingId: string) => {
        try {
            const response = await fetch(`/api/messages?booking_id=${bookingId}&limit=50`, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            const data = await response.json();
            if (data.success) {
                setMessages(data.messages.reverse()); // Show oldest first
            }
        } catch (err) {
            console.error('Failed to load conversation history:', err);
        }
    };

    const handleMessageSent = async () => {
        if (booking) {
            // Refresh conversation
            await loadConversationHistory(booking.booking_id);
        }
    };

    const getRelationshipDescription = () => {
        if (!booking) return '';

        const vehicle = `${booking.vehicle_info.year} ${booking.vehicle_info.make} ${booking.vehicle_info.model}`;
        const isHost = booking.relationship === 'host_to_renter';

        return isHost
            ? `You rented your ${vehicle} to ${otherUserName}`
            : `You rented ${otherUserName}'s ${vehicle}`;
    };

    // Loading state
    if (loadingBooking) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p>Looking for conversation history with {otherUserName}...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-red-800 font-semibold mb-2">Cannot Start Conversation</h3>
                <p className="text-red-600">{error}</p>
                <button
                    onClick={discoverBookingRelationship}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                    Try Again
                </button>
            </div>
        );
    }

    // No booking found
    if (!booking) {
        return (
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="text-yellow-800 font-semibold mb-2">No Conversation Available</h3>
                <p className="text-yellow-700">
                    You can only message users you've had bookings with.
                    Complete a booking with {otherUserName} to start messaging.
                </p>
            </div>
        );
    }

    // Success state - show conversation
    return (
        <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-lg shadow">
            {/* Conversation Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">
                    Conversation with {otherUserName}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                    {getRelationshipDescription()}
                </p>
                <p className="text-xs text-gray-500">
                    Booking Status: {booking.booking_status} •
                    Started: {new Date(booking.created_at).toLocaleDateString()}
                </p>
            </div>

            {/* Messages Area */}
            <div className="h-96 overflow-y-auto p-4">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <div key={message.id} className="flex flex-col">
                                <div className="flex items-center space-x-2 mb-1">
                                    <span className="font-medium text-sm text-gray-900">
                                        {message.sender_name}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {new Date(message.created_at).toLocaleString()}
                                    </span>
                                </div>
                                <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
                                    <p className="text-gray-800">{message.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Message Input */}
            <div className="border-t border-gray-200">
                <MessageInput
                    booking_id={booking.booking_id}
                    receiver_id={otherUserId}
                    onMessageSent={handleMessageSent}
                    placeholder={`Message ${otherUserName}...`}
                />
            </div>
        </div>
    );
}

export default MessagingFlow;
```

## Key Integration Points

### 1. Automatic Booking Discovery
- Call `/api/messages/find-booking` with `target_user_id`
- Handle cases where no booking exists between users
- Display appropriate messaging based on booking relationship

### 2. Error Handling
- **No Booking Found**: Show user-friendly message explaining messaging is only available for users with shared bookings
- **Authentication Required**: Redirect to login or show authentication prompt
- **Network Errors**: Provide retry functionality

### 3. Real-time Updates (Future Enhancement)
```tsx
// Example WebSocket integration for real-time messages
useEffect(() => {
    if (booking?.booking_id) {
        const ws = new WebSocket(`wss://your-websocket-server/${booking.booking_id}`);

        ws.onmessage = (event) => {
            const newMessage = JSON.parse(event.data);
            setMessages(prev => [...prev, newMessage]);
        };

        return () => ws.close();
    }
}, [booking?.booking_id]);
```

### 4. Message Validation
The MessageInput component already handles:
- ✅ Character limits (2000 max)
- ✅ Empty message prevention
- ✅ Error display
- ✅ Loading states
- ✅ Auto-resize textarea

## Usage in Different Contexts

### Host Dashboard
```tsx
// List all conversations for host
<ConversationsList userRole="host" />
```

### Renter Dashboard
```tsx
// List all conversations for renter
<ConversationsList userRole="renter" />
```

### Booking Detail Page
```tsx
// Direct messaging from booking page
<MessageInput
    booking_id={bookingId}
    receiver_id={isHost ? booking.renter_id : booking.host_id}
    onMessageSent={refreshBookingDetails}
/>
```

This integration ensures that messaging is contextual, secure, and only available between users with legitimate booking relationships.