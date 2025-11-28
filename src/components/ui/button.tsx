'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { motionVariants, standardMotionConfig } from './motion-config';

const buttonVariants = cva(
    'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed btn-interactive',
    {
        variants: {
            variant: {
                default:
                    'bg-black text-white hover:bg-gray-800 shadow-md hover:shadow-lg border-2 border-black',
                destructive:
                    'bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg border-2 border-red-600',
                outline:
                    'border-2 border-black bg-white hover:bg-gray-100 text-black shadow-sm hover:shadow-md',
                secondary:
                    'bg-gray-200 text-black hover:bg-gray-300 shadow-sm hover:shadow-md border-2 border-gray-400',
                ghost: 'hover:bg-gray-100 text-black border-2 border-gray-300 hover:border-gray-400',
                link: 'text-black underline-offset-4 hover:underline hover:text-gray-700 border-2 border-transparent',
                // Legacy variants from base/Button for backward compatibility
                primary:
                    'bg-black text-white hover:bg-gray-800 shadow-lg hover:shadow-xl border-2 border-black',
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-9 rounded-md px-3',
                lg: 'h-11 rounded-md px-8',
                icon: 'h-10 w-10',
            },
            animation: {
                none: '',
                subtle: 'hover:scale-[1.02] active:scale-[0.98]',
                bounce: 'hover:scale-105 hover:-translate-y-0.5 active:scale-95',
                pulse: 'hover:scale-[1.02] active:scale-[0.98]',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant,
            size,
            animation,
            asChild = false,
            loading,
            disabled,
            children,
            ...props
        },
        ref,
    ) => {
        const isDisabled = disabled || loading;
        const animationType = (animation || 'subtle') as keyof typeof motionVariants;

        if (asChild) {
            return (
                <Slot
                    className={cn(buttonVariants({ variant, size, animation, className }))}
                    ref={ref}
                    {...props}
                >
                    {children}
                </Slot>
            );
        }

        const motionConfig = motionVariants[animationType];

        return (
            <motion.button
                className={cn(buttonVariants({ variant, size, animation: 'none', className }))}
                whileHover={!isDisabled && motionConfig ? motionConfig.hover : undefined}
                whileTap={!isDisabled && motionConfig ? motionConfig.tap : undefined}
                transition={standardMotionConfig.transition}
                ref={ref}
                disabled={isDisabled}
                // Use type assertion to handle the conflict between React and Framer Motion event types
                {...(props as any)}
            >
                {loading && (
                    <motion.div
                        className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        aria-hidden="true"
                    />
                )}
                <motion.span
                    initial={false}
                    animate={{ opacity: loading ? 0.7 : 1 }}
                    transition={{ duration: 0.2 }}
                >
                    {children}
                </motion.span>
            </motion.button>
        );
    },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
