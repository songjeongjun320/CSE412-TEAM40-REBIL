# REBIL API Specifications

## Overview

This document provides comprehensive API specifications for the REBIL car rental platform, including endpoint definitions, request/response schemas, authentication patterns, and integration guidelines.

## Base Configuration

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Base URL Structure
```
Production: https://rebil.app/api
Development: http://localhost:3000/api
```

### Content Types
- **Request**: `application/json`
- **Response**: `application/json`
- **Error Response**: `application/json`

## Authentication

### Authentication Flow
All protected endpoints require authentication via Supabase Auth cookies or Authorization header.

```typescript
// Cookie-based (Browser)
// Automatically handled by Supabase client

// Header-based (API clients)
Authorization: Bearer <access_token>
```

### Role-Based Access
```typescript
enum UserRole {
    ADMIN = 'ADMIN',
    HOST = 'HOST',
    RENTER = 'RENTER'
}

// Role requirements per endpoint documented below
```

## Core API Endpoints

### 🚗 Vehicle Management

#### Search Vehicles
```http
GET /api/vehicles/search
```

**Query Parameters:**
```typescript
interface SearchParams {
    location?: string;           // "lat,lng" or city name
    startDate?: string;          // ISO 8601 date
    endDate?: string;            // ISO 8601 date
    carType?: 'sedan' | 'suv' | 'motorcycle' | 'ev';
    transmission?: 'MANUAL' | 'AUTOMATIC' | 'CVT';
    fuelType?: 'GASOLINE' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
    minPrice?: number;
    maxPrice?: number;
    seats?: number;
    features?: string[];         // Array of feature names
    radius?: number;             // Search radius in km
    page?: number;               // Default: 1
    limit?: number;              // Default: 20, Max: 100
    sortBy?: 'price' | 'distance' | 'rating' | 'availability';
    sortOrder?: 'asc' | 'desc';
}
```

**Response:**
```typescript
interface SearchResponse {
    vehicles: Array<{
        id: string;
        make: string;
        model: string;
        year: number;
        carType: string;
        transmission: string;
        fuelType: string;
        seats: number;
        doors: number;
        dailyRate: number;
        weeklyRate?: number;
        monthlyRate?: number;
        location: {
            lat: number;
            lng: number;
            address: string;
            city: string;
            province: string;
        };
        features: string[];
        host: {
            id: string;
            name: string;
            rating: number;
            responseTime: string;
        };
        images: Array<{
            url: string;
            isPrimary: boolean;
        }>;
        availability: {
            isAvailable: boolean;
            nextAvailableDate?: string;
        };
        pricing: {
            dailyRate: number;
            weeklyDiscount?: number;
            monthlyDiscount?: number;
            deliveryFee: number;
        };
        distance?: number;        // Only if location provided
        rating: number;
        reviewCount: number;
    }>;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
    };
    filters: {
        applied: SearchParams;
        available: {
            carTypes: string[];
            priceRange: { min: number; max: number };
            features: string[];
            locations: string[];
        };
    };
}
```

#### Get Vehicle Details
```http
GET /api/vehicles/{vehicleId}
```

**Path Parameters:**
- `vehicleId`: string (UUID)

**Query Parameters:**
```typescript
interface VehicleDetailsParams {
    startDate?: string;    // For availability check
    endDate?: string;      // For availability check
    includeHost?: boolean; // Include host details
}
```

**Response:**
```typescript
interface VehicleDetails {
    id: string;
    make: string;
    model: string;
    year: number;
    vin?: string;
    licensePlate?: string;
    color?: string;
    carType: string;
    transmission: string;
    fuelType: string;
    seats: number;
    doors: number;
    description?: string;
    features: string[];
    dailyRate: number;
    weeklyRate?: number;
    monthlyRate?: number;
    location: LocationDetails;
    deliveryAvailable: boolean;
    deliveryFee: number;
    deliveryRadius: number;
    minimumTripDuration: number;
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING_APPROVAL';
    images: Array<{
        id: string;
        url: string;
        type?: string;
        isPrimary: boolean;
        displayOrder: number;
    }>;
    host: {
        id: string;
        name: string;
        email: string;
        phone?: string;
        profileImage?: string;
        joinedAt: string;
        responseTime: string;
        acceptanceRate: number;
        rating: number;
        reviewCount: number;
        preferences?: {
            autoApprovalEnabled: boolean;
            advanceBookingHours: number;
            requireVerification: boolean;
        };
    };
    availability: {
        isAvailable: boolean;
        calendar: Array<{
            date: string;
            isAvailable: boolean;
            reason?: string;
        }>;
        conflicts?: Array<{
            startDate: string;
            endDate: string;
            type: 'BOOKING' | 'MAINTENANCE' | 'BLOCKED';
        }>;
    };
    reviews: {
        rating: number;
        count: number;
        recent: Array<{
            id: string;
            rating: number;
            comment?: string;
            reviewer: {
                name: string;
                profileImage?: string;
            };
            createdAt: string;
        }>;
    };
    pricing: {
        dailyRate: number;
        weeklyRate?: number;
        monthlyRate?: number;
        weeklyDiscount?: number;
        monthlyDiscount?: number;
        deliveryFee: number;
        securityDeposit: number;
        cancellationPolicy: string;
    };
    createdAt: string;
    updatedAt: string;
}
```

### 📅 Booking Management

#### Create Booking
```http
POST /api/bookings
```

**Authentication:** Required (RENTER role)

**Request Body:**
```typescript
interface CreateBookingRequest {
    carId: string;
    startDate: string;        // ISO 8601
    endDate: string;          // ISO 8601
    insuranceType: 'BASIC' | 'STANDARD' | 'PREMIUM';
    pickupLocation?: {
        lat: number;
        lng: number;
        address: string;
    };
    dropoffLocation?: {
        lat: number;
        lng: number;
        address: string;
    };
    specialInstructions?: string;
    renterId: string;
    agreedToTerms: boolean;
}
```

**Response:**
```typescript
interface CreateBookingResponse {
    booking: {
        id: string;
        carId: string;
        renterId: string;
        hostId: string;
        startDate: string;
        endDate: string;
        status: BookingStatus;
        totalDays: number;
        pricing: {
            dailyRate: number;
            subtotal: number;
            insuranceFee: number;
            serviceFee: number;
            deliveryFee: number;
            totalAmount: number;
            securityDeposit: number;
        };
        approvalType: 'AUTO' | 'MANUAL';
        estimatedApprovalTime?: number; // minutes
        expiresAt?: string;             // for pending bookings
    };
    message: string;
    nextSteps: string[];
}
```

#### Get User Bookings
```http
GET /api/bookings
```

**Authentication:** Required

**Query Parameters:**
```typescript
interface BookingsParams {
    status?: BookingStatus | BookingStatus[];
    role?: 'HOST' | 'RENTER';      // Filter by user role
    page?: number;
    limit?: number;
    sortBy?: 'created_at' | 'start_date' | 'total_amount';
    sortOrder?: 'asc' | 'desc';
    startDate?: string;             // Filter bookings after date
    endDate?: string;               // Filter bookings before date
}
```

**Response:**
```typescript
interface BookingsResponse {
    bookings: Array<{
        id: string;
        carId: string;
        car: {
            make: string;
            model: string;
            year: number;
            licensePlate?: string;
            primaryImage?: string;
        };
        counterparty: {
            id: string;
            name: string;
            email: string;
            phone?: string;
            rating: number;
        };
        startDate: string;
        endDate: string;
        status: BookingStatus;
        totalAmount: number;
        canCancel: boolean;
        cancellationDeadline?: string;
        actions: string[];          // Available actions for current user
        createdAt: string;
        updatedAt: string;
    }>;
    pagination: PaginationMeta;
    summary: {
        total: number;
        byStatus: Record<BookingStatus, number>;
        totalValue: number;
    };
}
```

#### Update Booking Status
```http
PATCH /api/bookings/{bookingId}/status
```

**Authentication:** Required (HOST or RENTER based on action)

**Path Parameters:**
- `bookingId`: string (UUID)

**Request Body:**
```typescript
interface UpdateBookingStatusRequest {
    action: 'APPROVE' | 'REJECT' | 'CANCEL' | 'COMPLETE' | 'START';
    reason?: string;
    metadata?: Record<string, any>;
}
```

### 💬 Messaging System

#### Send Message
```http
POST /api/messages
```

**Authentication:** Required

**Request Body:**
```typescript
interface SendMessageRequest {
    bookingId: string;
    receiverId: string;
    message: string;
    metadata?: {
        type?: 'TEXT' | 'SYSTEM' | 'ATTACHMENT';
        attachments?: Array<{
            url: string;
            type: string;
            name: string;
        }>;
    };
}
```

**Response:**
```typescript
interface SendMessageResponse {
    message: {
        id: string;
        bookingId: string;
        senderId: string;
        receiverId: string;
        message: string;
        createdAt: string;
        isRead: boolean;
    };
    conversationUpdated: boolean;
}
```

#### Get Conversations
```http
GET /api/messages/conversations
```

**Authentication:** Required

**Query Parameters:**
```typescript
interface ConversationsParams {
    status?: 'ALL' | 'UNREAD' | 'ACTIVE' | 'ARCHIVED';
    page?: number;
    limit?: number;
}
```

**Response:**
```typescript
interface ConversationsResponse {
    conversations: Array<{
        bookingId: string;
        otherUser: {
            id: string;
            name: string;
            profileImage?: string;
        };
        vehicle: {
            make: string;
            model: string;
            year: number;
            primaryImage?: string;
        };
        lastMessage: {
            message: string;
            createdAt: string;
            senderId: string;
        };
        unreadCount: number;
        bookingStatus: BookingStatus;
        isActive: boolean;
    }>;
    unreadTotal: number;
}
```

#### Get Conversation Messages
```http
GET /api/messages/conversations/{bookingId}
```

**Path Parameters:**
- `bookingId`: string (UUID)

**Query Parameters:**
```typescript
interface MessagesParams {
    page?: number;
    limit?: number;          // Default: 50, Max: 100
    before?: string;         // Message ID for pagination
    markAsRead?: boolean;    // Default: true
}
```

### 🏠 Indonesian Location Data

#### Get Provinces
```http
GET /api/indonesian-data/provinces
```

**Response:**
```typescript
interface ProvincesResponse {
    provinces: Array<{
        id: string;
        code: string;
        name: string;
        islandGroup: string;
        isSpecialRegion: boolean;
    }>;
}
```

#### Get Regencies/Cities
```http
GET /api/indonesian-data/regencies
```

**Query Parameters:**
```typescript
interface RegenciesParams {
    province: string;        // Province code or ID
    type?: 'ALL' | 'CITY' | 'REGENCY';
    majorOnly?: boolean;     // Only major cities
}
```

**Response:**
```typescript
interface RegenciesResponse {
    regencies: Array<{
        id: string;
        provinceId: string;
        code: string;
        name: string;
        type: string;
        isCapital: boolean;
        isMajorCity: boolean;
        population: number;
    }>;
}
```

### ⭐ Review System

#### Submit Review
```http
POST /api/reviews
```

**Authentication:** Required

**Request Body:**
```typescript
interface SubmitReviewRequest {
    bookingId: string;
    reviewedId: string;      // User being reviewed
    carId: string;
    rating: number;          // 1-5
    comment?: string;
    isPublic: boolean;
    categories?: {
        cleanliness?: number;
        communication?: number;
        accuracy?: number;
        value?: number;
    };
}
```

#### Get Reviews
```http
GET /api/reviews
```

**Query Parameters:**
```typescript
interface ReviewsParams {
    userId?: string;         // Reviews for specific user
    carId?: string;          // Reviews for specific car
    type?: 'RECEIVED' | 'GIVEN';
    page?: number;
    limit?: number;
}
```

### 👑 Admin Endpoints

#### Get Pending Vehicle Approvals
```http
GET /api/admin/vehicle-approvals
```

**Authentication:** Required (ADMIN role)

**Response:**
```typescript
interface PendingApprovalsResponse {
    vehicles: Array<{
        id: string;
        host: {
            id: string;
            name: string;
            email: string;
        };
        make: string;
        model: string;
        year: number;
        licensePlate?: string;
        location: LocationDetails;
        dailyRate: number;
        submittedAt: string;
        images: VehicleImage[];
        verificationStatus: {
            documents: boolean;
            photos: boolean;
            inspection: boolean;
        };
    }>;
    summary: {
        pending: number;
        avgProcessingTime: number; // hours
        oldestSubmission: string;
    };
}
```

#### Approve/Reject Vehicle
```http
POST /api/admin/vehicle-approvals/{vehicleId}
```

**Path Parameters:**
- `vehicleId`: string (UUID)

**Request Body:**
```typescript
interface VehicleApprovalRequest {
    action: 'APPROVE' | 'REJECT';
    reason?: string;
    conditions?: string[];   // Conditions for approval
    followUpRequired?: boolean;
}
```

## Error Handling

### Standard Error Response
```typescript
interface ErrorResponse {
    error: {
        code: string;
        message: string;
        details?: any;
        timestamp: string;
        requestId: string;
    };
}
```

### Common Error Codes
```typescript
enum ErrorCode {
    // Authentication
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',

    // Validation
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
    INVALID_FORMAT = 'INVALID_FORMAT',

    // Business Logic
    VEHICLE_NOT_AVAILABLE = 'VEHICLE_NOT_AVAILABLE',
    BOOKING_CONFLICT = 'BOOKING_CONFLICT',
    INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
    BOOKING_EXPIRED = 'BOOKING_EXPIRED',

    // System
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    RATE_LIMITED = 'RATE_LIMITED',
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (business rule violation)
- `422` - Unprocessable Entity (semantic errors)
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error

## Rate Limiting

### Standard Rate Limits
```typescript
interface RateLimits {
    search: '100 requests/minute';
    bookings: '20 requests/minute';
    messages: '50 requests/minute';
    uploads: '10 requests/minute';
    general: '1000 requests/hour';
}
```

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Webhooks

### Booking Status Updates
```http
POST /webhooks/booking-status
```

**Payload:**
```typescript
interface BookingWebhook {
    event: 'booking.created' | 'booking.approved' | 'booking.cancelled' | 'booking.completed';
    timestamp: string;
    data: {
        booking: BookingDetails;
        previousStatus?: BookingStatus;
        trigger: 'USER' | 'SYSTEM' | 'ADMIN';
    };
}
```

### Payment Events
```http
POST /webhooks/payment-status
```

**Payload:**
```typescript
interface PaymentWebhook {
    event: 'payment.successful' | 'payment.failed' | 'payment.refunded';
    timestamp: string;
    data: {
        paymentId: string;
        bookingId: string;
        amount: number;
        currency: string;
        stripePaymentIntentId?: string;
    };
}
```

## Testing

### Test Environment
```
Base URL: https://rebil-staging.app/api
Test Cards: Use Stripe test cards
Test Users: Seeded test accounts available
```

### API Testing Collection
```bash
# Postman collection
curl -O https://rebil.app/docs/rebil-api.postman_collection.json

# OpenAPI specification
curl -O https://rebil.app/docs/openapi.yaml
```

---

*For additional support or questions, please refer to the [Developer Portal](https://developers.rebil.app) or contact the API team.*