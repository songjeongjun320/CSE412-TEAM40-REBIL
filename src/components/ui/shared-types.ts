// Shared TypeScript interfaces and types for UI components

import * as React from 'react';

// Standard variant types used across components
export type StandardVariant =
    | 'default'
    | 'destructive'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'link';
export type StandardSize = 'default' | 'sm' | 'lg';
export type ExtendedVariant = StandardVariant | 'success' | 'warning' | 'info' | 'primary';

// Animation types for consistent motion patterns
export type AnimationType = 'none' | 'subtle' | 'bounce' | 'pulse';

// Standard component props that most UI components should extend
export interface BaseComponentProps {
    className?: string;
    children?: React.ReactNode;
}

// Props for components with standard variants and sizes
export interface StandardComponentProps extends BaseComponentProps {
    variant?: StandardVariant;
    size?: StandardSize;
}

// Props for components with extended variants (like alerts, badges)
export interface ExtendedComponentProps extends BaseComponentProps {
    variant?: ExtendedVariant;
    size?: StandardSize;
}

// Props for interactive components with animation support
export interface InteractiveComponentProps extends StandardComponentProps {
    animation?: AnimationType;
    disabled?: boolean;
}

// Props for components that can be used as child slots
export interface SlotComponentProps extends InteractiveComponentProps {
    asChild?: boolean;
}

// Props for loading states
export interface LoadingComponentProps extends InteractiveComponentProps {
    loading?: boolean;
}

// Toast-specific types
export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface ToastData {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
    duration?: number;
}

// Alert-specific types for better type safety
export type AlertVariant = 'default' | 'destructive' | 'success' | 'warning' | 'info';

// Badge-specific types
export type BadgeVariant =
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline'
    | 'success'
    | 'warning';

// Component composition helpers
export interface CompositeComponentProps extends BaseComponentProps {
    // For components that have header, content, footer parts
    header?: React.ReactNode;
    content?: React.ReactNode;
    footer?: React.ReactNode;
}

// Event handler types for consistency
export interface ClickableComponentProps {
    onClick?: React.MouseEventHandler<HTMLElement>;
    onDoubleClick?: React.MouseEventHandler<HTMLElement>;
}

export interface FocusableComponentProps {
    onFocus?: React.FocusEventHandler<HTMLElement>;
    onBlur?: React.FocusEventHandler<HTMLElement>;
}

// Form-related component props
export interface FormComponentProps extends BaseComponentProps {
    name?: string;
    required?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
}

// Input-specific props
export interface InputComponentProps extends FormComponentProps {
    placeholder?: string;
    value?: string;
    defaultValue?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

// Select-specific props
export interface SelectComponentProps extends FormComponentProps {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
}
