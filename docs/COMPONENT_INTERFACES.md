# REBIL Component Interface Design

## Overview

This document defines the component interface specifications for REBIL's React-based frontend architecture, including component APIs, prop interfaces, and integration patterns.

## Design Principles

### 🎯 Component Design Philosophy

1. **Single Responsibility**: Each component has one clear purpose
2. **Composition Over Inheritance**: Use composition patterns for flexibility
3. **Props Interface**: Strongly typed props with TypeScript
4. **Accessibility**: WCAG 2.1 AA compliant by default
5. **Performance**: Optimized for React 19 concurrent features
6. **Testability**: Components designed for easy unit testing

### 🔧 TypeScript Interface Patterns

```typescript
// Base component props pattern
interface BaseComponentProps {
    className?: string;
    children?: React.ReactNode;
    'data-testid'?: string;
}

// Variant pattern for styled components
interface ComponentVariants {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'small' | 'medium' | 'large';
}

// Event handler pattern
interface ComponentEvents {
    onClick?: (event: React.MouseEvent) => void;
    onChange?: (value: any) => void;
    onSubmit?: (data: FormData) => void;
}
```

## Core UI Components

### 🎨 Button Component

```typescript
interface ButtonProps extends BaseComponentProps, ComponentVariants {
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    icon?: React.ReactElement;
    iconPosition?: 'left' | 'right';
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

// Usage
<Button
    variant="primary"
    size="medium"
    loading={isSubmitting}
    icon={<PlusIcon />}
    onClick={handleClick}
>
    Create Booking
</Button>
```

### 📝 Input Components

```typescript
interface InputProps extends BaseComponentProps {
    type?: 'text' | 'email' | 'password' | 'tel' | 'url';
    label?: string;
    placeholder?: string;
    value?: string;
    defaultValue?: string;
    disabled?: boolean;
    required?: boolean;
    error?: string;
    helperText?: string;
    startAdornment?: React.ReactElement;
    endAdornment?: React.ReactElement;
    onChange?: (value: string) => void;
    onBlur?: (event: React.FocusEvent) => void;
    onFocus?: (event: React.FocusEvent) => void;
}

interface SelectProps<T = any> extends BaseComponentProps {
    label?: string;
    placeholder?: string;
    value?: T;
    defaultValue?: T;
    options: Array<{
        value: T;
        label: string;
        disabled?: boolean;
        group?: string;
    }>;
    multiple?: boolean;
    searchable?: boolean;
    clearable?: boolean;
    disabled?: boolean;
    error?: string;
    helperText?: string;
    renderOption?: (option: SelectOption<T>) => React.ReactNode;
    onChange?: (value: T | T[]) => void;
}
```

### 📋 Card Component

```typescript
interface CardProps extends BaseComponentProps {
    elevation?: 0 | 1 | 2 | 3 | 4;
    padding?: 'none' | 'small' | 'medium' | 'large';
    hoverable?: boolean;
    clickable?: boolean;
    onClick?: () => void;
}

interface CardHeaderProps extends BaseComponentProps {
    title: string;
    subtitle?: string;
    action?: React.ReactElement;
    avatar?: React.ReactElement;
}

interface CardContentProps extends BaseComponentProps {
    // Inherits from BaseComponentProps only
}

interface CardActionsProps extends BaseComponentProps {
    justify?: 'start' | 'center' | 'end' | 'space-between';
}

// Compound component usage
<Card hoverable onClick={handleCardClick}>
    <Card.Header
        title="2023 Toyota Camry"
        subtitle="Sedan • Automatic • 5 seats"
        action={<FavoriteButton />}
    />
    <Card.Content>
        <VehicleImage src={primaryImage} />
        <VehicleDetails vehicle={vehicle} />
    </Card.Content>
    <Card.Actions justify="space-between">
        <PriceDisplay price={dailyRate} />
        <Button variant="primary">Book Now</Button>
    </Card.Actions>
</Card>
```

## Feature-Specific Components

### 🚗 Vehicle Components

#### VehicleCard
```typescript
interface VehicleCardProps extends BaseComponentProps {
    vehicle: {
        id: string;
        make: string;
        model: string;
        year: number;
        dailyRate: number;
        location: {
            city: string;
            distance?: number;
        };
        images: Array<{
            url: string;
            isPrimary: boolean;
        }>;
        host: {
            name: string;
            rating: number;
        };
        features: string[];
        transmission: string;
        fuelType: string;
        seats: number;
    };
    layout?: 'grid' | 'list';
    showDistance?: boolean;
    showHost?: boolean;
    onFavoriteToggle?: (vehicleId: string, isFavorite: boolean) => void;
    onQuickBook?: (vehicleId: string) => void;
    onClick?: (vehicleId: string) => void;
}

// Usage
<VehicleCard
    vehicle={vehicle}
    layout="grid"
    showDistance={true}
    onFavoriteToggle={handleFavoriteToggle}
    onClick={handleVehicleClick}
/>
```

#### VehicleSearch
```typescript
interface VehicleSearchProps extends BaseComponentProps {
    initialFilters?: SearchFilters;
    onFiltersChange?: (filters: SearchFilters) => void;
    onSearch?: (filters: SearchFilters) => void;
    showMap?: boolean;
    layout?: 'horizontal' | 'vertical';
}

interface SearchFilters {
    location?: {
        query: string;
        coordinates?: [number, number];
        radius?: number;
    };
    dates?: {
        startDate: Date;
        endDate: Date;
    };
    vehicle?: {
        type?: VehicleType[];
        transmission?: TransmissionType[];
        fuelType?: FuelType[];
        seats?: number;
        priceRange?: [number, number];
        features?: string[];
    };
    host?: {
        rating?: number;
        responseTime?: string;
        verificationLevel?: string;
    };
}

// Usage
<VehicleSearch
    initialFilters={savedFilters}
    onFiltersChange={setFilters}
    onSearch={handleSearch}
    showMap={true}
    layout="horizontal"
/>
```

### 📅 Booking Components

#### BookingFlow
```typescript
interface BookingFlowProps extends BaseComponentProps {
    vehicle: VehicleDetails;
    initialData?: Partial<BookingData>;
    onStepChange?: (step: BookingStep, data: Partial<BookingData>) => void;
    onComplete?: (booking: CompletedBooking) => void;
    onCancel?: () => void;
}

interface BookingData {
    dates: {
        startDate: Date;
        endDate: Date;
    };
    locations: {
        pickup?: Location;
        dropoff?: Location;
    };
    insurance: InsuranceType;
    specialInstructions?: string;
    pricing: {
        dailyRate: number;
        totalDays: number;
        subtotal: number;
        fees: Record<string, number>;
        total: number;
    };
    renter: {
        id: string;
        verificationStatus: VerificationStatus;
    };
}

enum BookingStep {
    DATE_SELECTION = 'DATE_SELECTION',
    LOCATION_PICKUP = 'LOCATION_PICKUP',
    INSURANCE_SELECTION = 'INSURANCE_SELECTION',
    REVIEW_DETAILS = 'REVIEW_DETAILS',
    PAYMENT = 'PAYMENT',
    CONFIRMATION = 'CONFIRMATION'
}

// Usage
<BookingFlow
    vehicle={selectedVehicle}
    initialData={draftBooking}
    onStepChange={handleStepChange}
    onComplete={handleBookingComplete}
    onCancel={handleBookingCancel}
/>
```

#### BookingCard
```typescript
interface BookingCardProps extends BaseComponentProps {
    booking: {
        id: string;
        vehicle: {
            make: string;
            model: string;
            year: number;
            primaryImage: string;
        };
        dates: {
            startDate: string;
            endDate: string;
        };
        status: BookingStatus;
        totalAmount: number;
        counterparty: {
            name: string;
            avatar?: string;
            rating: number;
        };
        location: {
            pickup: string;
            dropoff?: string;
        };
    };
    userRole: 'HOST' | 'RENTER';
    availableActions: BookingAction[];
    onAction?: (action: BookingAction, bookingId: string) => void;
    onViewDetails?: (bookingId: string) => void;
    onMessage?: (bookingId: string) => void;
}

enum BookingAction {
    APPROVE = 'APPROVE',
    REJECT = 'REJECT',
    CANCEL = 'CANCEL',
    START = 'START',
    COMPLETE = 'COMPLETE',
    DISPUTE = 'DISPUTE',
    REVIEW = 'REVIEW'
}

// Usage
<BookingCard
    booking={booking}
    userRole="HOST"
    availableActions={[BookingAction.APPROVE, BookingAction.REJECT]}
    onAction={handleBookingAction}
    onViewDetails={handleViewDetails}
    onMessage={handleMessage}
/>
```

### 💬 Messaging Components

#### MessageThread
```typescript
interface MessageThreadProps extends BaseComponentProps {
    bookingId: string;
    currentUserId: string;
    otherUser: {
        id: string;
        name: string;
        avatar?: string;
        isOnline?: boolean;
    };
    autoRefresh?: boolean;
    onNewMessage?: (message: Message) => void;
}

interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    timestamp: string;
    isRead: boolean;
    type: 'TEXT' | 'SYSTEM' | 'ATTACHMENT';
    metadata?: {
        attachments?: Attachment[];
        systemAction?: string;
    };
}

// Usage
<MessageThread
    bookingId={booking.id}
    currentUserId={user.id}
    otherUser={otherParticipant}
    autoRefresh={true}
    onNewMessage={handleNewMessage}
/>
```

#### ConversationList
```typescript
interface ConversationListProps extends BaseComponentProps {
    conversations: Conversation[];
    selectedConversationId?: string;
    onConversationSelect?: (conversationId: string) => void;
    onMarkAsRead?: (conversationId: string) => void;
    loading?: boolean;
    emptyState?: React.ReactElement;
}

interface Conversation {
    id: string;
    bookingId: string;
    otherUser: {
        id: string;
        name: string;
        avatar?: string;
    };
    vehicle: {
        make: string;
        model: string;
        year: number;
    };
    lastMessage: {
        content: string;
        timestamp: string;
        senderId: string;
    };
    unreadCount: number;
    isActive: boolean;
}

// Usage
<ConversationList
    conversations={conversations}
    selectedConversationId={selectedId}
    onConversationSelect={handleSelect}
    loading={isLoading}
/>
```

### 📍 Location Components

#### AddressInput
```typescript
interface AddressInputProps extends BaseComponentProps {
    label?: string;
    placeholder?: string;
    value?: Address;
    required?: boolean;
    disabled?: boolean;
    error?: string;
    countryCode?: string;
    showMap?: boolean;
    allowManualEntry?: boolean;
    onAddressSelect?: (address: Address) => void;
    onCoordinatesChange?: (coordinates: [number, number]) => void;
}

interface Address {
    formatted: string;
    components: {
        streetNumber?: string;
        streetName?: string;
        city: string;
        province: string;
        postalCode?: string;
        country: string;
    };
    coordinates: {
        lat: number;
        lng: number;
    };
    placeId?: string;
}

// Usage
<AddressInput
    label="Pickup Location"
    value={pickupAddress}
    required={true}
    showMap={true}
    onAddressSelect={handleAddressSelect}
    countryCode="ID"
/>
```

#### LocationMap
```typescript
interface LocationMapProps extends BaseComponentProps {
    center?: [number, number];
    zoom?: number;
    markers?: MapMarker[];
    selectedMarkerId?: string;
    clustered?: boolean;
    interactive?: boolean;
    height?: number | string;
    onMarkerClick?: (markerId: string) => void;
    onMapClick?: (coordinates: [number, number]) => void;
    onBoundsChange?: (bounds: MapBounds) => void;
}

interface MapMarker {
    id: string;
    position: [number, number];
    title?: string;
    icon?: string;
    popup?: React.ReactElement;
    data?: any;
}

// Usage
<LocationMap
    center={[userLat, userLng]}
    zoom={12}
    markers={vehicleMarkers}
    selectedMarkerId={selectedVehicleId}
    clustered={true}
    onMarkerClick={handleMarkerClick}
    height="400px"
/>
```

### ⭐ Review Components

#### ReviewForm
```typescript
interface ReviewFormProps extends BaseComponentProps {
    booking: {
        id: string;
        vehicle: VehicleBasicInfo;
        counterparty: UserBasicInfo;
    };
    type: 'HOST_REVIEW' | 'RENTER_REVIEW';
    onSubmit?: (review: ReviewSubmission) => void;
    onCancel?: () => void;
}

interface ReviewSubmission {
    rating: number;
    comment?: string;
    categories?: {
        cleanliness?: number;
        communication?: number;
        accuracy?: number;
        value?: number;
    };
    isPublic: boolean;
    wouldRecommend?: boolean;
}

// Usage
<ReviewForm
    booking={completedBooking}
    type="HOST_REVIEW"
    onSubmit={handleReviewSubmit}
    onCancel={handleCancel}
/>
```

#### ReviewCard
```typescript
interface ReviewCardProps extends BaseComponentProps {
    review: {
        id: string;
        rating: number;
        comment?: string;
        categories?: Record<string, number>;
        reviewer: {
            name: string;
            avatar?: string;
            verificationLevel: string;
        };
        createdAt: string;
        helpful?: number;
    };
    showHelpful?: boolean;
    compact?: boolean;
    onHelpfulClick?: (reviewId: string) => void;
}

// Usage
<ReviewCard
    review={review}
    showHelpful={true}
    compact={false}
    onHelpfulClick={handleHelpfulClick}
/>
```

## Layout Components

### 🏗️ Page Layout
```typescript
interface PageLayoutProps extends BaseComponentProps {
    title?: string;
    description?: string;
    breadcrumbs?: Breadcrumb[];
    actions?: React.ReactElement[];
    sidebar?: React.ReactElement;
    fullWidth?: boolean;
}

interface Breadcrumb {
    label: string;
    href?: string;
    onClick?: () => void;
}

// Usage
<PageLayout
    title="Vehicle Management"
    breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Vehicles', href: '/vehicles' },
        { label: 'Edit Vehicle' }
    ]}
    actions={[
        <Button key="save" variant="primary">Save</Button>,
        <Button key="cancel" variant="outline">Cancel</Button>
    ]}
>
    <VehicleEditForm />
</PageLayout>
```

### 🧭 Navigation
```typescript
interface NavigationProps extends BaseComponentProps {
    user?: {
        name: string;
        avatar?: string;
        roles: UserRole[];
    };
    currentPath?: string;
    notifications?: {
        unreadCount: number;
        items: Notification[];
    };
    onSignOut?: () => void;
}

interface NavigationItem {
    id: string;
    label: string;
    href?: string;
    icon?: React.ReactElement;
    badge?: string | number;
    roles?: UserRole[];
    children?: NavigationItem[];
}

// Usage
<Navigation
    user={currentUser}
    currentPath={pathname}
    notifications={notifications}
    onSignOut={handleSignOut}
/>
```

## Form Components

### 📋 Form Patterns

```typescript
interface FormProps<T = any> extends BaseComponentProps {
    initialValues?: Partial<T>;
    validationSchema?: ValidationSchema<T>;
    onSubmit?: (values: T) => void | Promise<void>;
    onCancel?: () => void;
    loading?: boolean;
    disabled?: boolean;
}

interface FieldProps {
    name: string;
    label?: string;
    required?: boolean;
    disabled?: boolean;
    helperText?: string;
}

// Generic form field wrapper
interface FormFieldProps extends FieldProps {
    children: React.ReactElement;
    error?: string;
}

// Usage pattern
<Form
    initialValues={vehicleData}
    validationSchema={vehicleSchema}
    onSubmit={handleSubmit}
    loading={isSubmitting}
>
    <FormField name="make" label="Make" required>
        <Input placeholder="Enter vehicle make" />
    </FormField>

    <FormField name="model" label="Model" required>
        <Input placeholder="Enter vehicle model" />
    </FormField>

    <FormField name="year" label="Year" required>
        <Select options={yearOptions} />
    </FormField>
</Form>
```

## State Management Patterns

### 🔄 Component State Interfaces

```typescript
// Loading states
interface LoadingState {
    isLoading: boolean;
    error?: string;
    data?: any;
}

// Async operation states
interface AsyncState<T> {
    status: 'idle' | 'loading' | 'success' | 'error';
    data?: T;
    error?: string;
    lastUpdated?: Date;
}

// Pagination state
interface PaginationState {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

// Search state
interface SearchState<T> {
    query: string;
    filters: T;
    results: any[];
    pagination: PaginationState;
    loading: boolean;
}
```

## Accessibility Standards

### ♿ Accessibility Props

```typescript
interface AccessibilityProps {
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    'aria-expanded'?: boolean;
    'aria-selected'?: boolean;
    'aria-disabled'?: boolean;
    'aria-live'?: 'off' | 'polite' | 'assertive';
    role?: string;
    tabIndex?: number;
}

// Integrated into all interactive components
interface InteractiveComponentProps extends BaseComponentProps, AccessibilityProps {
    // Component-specific props
}
```

### 🎯 Focus Management

```typescript
interface FocusManagementProps {
    autoFocus?: boolean;
    focusOnMount?: boolean;
    returnFocus?: boolean;
    trapFocus?: boolean;
}

// Usage in modals and forms
<Modal focusOnMount returnFocus trapFocus>
    <BookingForm autoFocus />
</Modal>
```

## Testing Interfaces

### 🧪 Test-Friendly Components

```typescript
interface TestableComponentProps {
    'data-testid'?: string;
    'data-test-state'?: string;
    'data-test-loading'?: boolean;
}

// Testing utilities
interface ComponentTestUtils {
    getByRole: (role: string) => HTMLElement;
    getByLabelText: (text: string) => HTMLElement;
    getByTestId: (testId: string) => HTMLElement;
}

// Example test setup
const utils = render(
    <VehicleCard
        vehicle={mockVehicle}
        data-testid="vehicle-card"
        data-test-state="available"
    />
);
```

---

*This component interface specification ensures consistent, maintainable, and accessible component development across the REBIL platform.*