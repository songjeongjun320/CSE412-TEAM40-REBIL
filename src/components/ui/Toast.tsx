'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { prefersReducedMotion, slideInVariants, standardMotionConfig } from './motion-config';

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    description?: string;
    duration?: number;
}

interface ToastProps {
    toast: Toast;
    onDismiss: (id: string) => void;
}

const toastIcons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
};

const toastStyles = {
    success:
        'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200',
    error: 'bg-destructive/10 border-destructive text-destructive',
    info: 'bg-primary/10 border-primary text-primary',
    warning:
        'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200',
};

// Use standard motion configuration from shared config

export function ToastComponent({ toast, onDismiss }: ToastProps) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => onDismiss(toast.id), 200);
        }, toast.duration || 5000);

        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onDismiss]);

    return (
        <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : slideInVariants.initial}
            animate={
                prefersReducedMotion
                    ? { opacity: isVisible ? 1 : 0 }
                    : isVisible
                      ? slideInVariants.animate
                      : slideInVariants.exit
            }
            exit={prefersReducedMotion ? { opacity: 0 } : slideInVariants.exit}
            transition={standardMotionConfig.transition}
            className={`
                p-4 rounded-lg border shadow-lg max-w-sm w-full
                ${toastStyles[toast.type]}
            `}
            role="status"
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
        >
            <div className="flex items-start space-x-3">
                <span className="text-lg flex-shrink-0 mt-0.5">{toastIcons[toast.type]}</span>
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{toast.title}</h4>
                    {toast.description && (
                        <p className="text-sm opacity-90 mt-1">{toast.description}</p>
                    )}
                </div>
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={standardMotionConfig.transition}
                    onClick={() => {
                        setIsVisible(false);
                        setTimeout(() => onDismiss(toast.id), 200);
                    }}
                    className="flex-shrink-0 ml-2 text-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label="Dismiss notification"
                >
                    ×
                </motion.button>
            </div>
        </motion.div>
    );
}

interface ToastContainerProps {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
    return (
        <div
            className="fixed top-4 right-4 z-50 space-y-2"
            aria-live="polite"
            aria-atomic="true"
            role="region"
            aria-label="Notifications"
        >
            <AnimatePresence>
                {toasts.map((toast) => (
                    <ToastComponent key={toast.id} toast={toast} onDismiss={onDismiss} />
                ))}
            </AnimatePresence>
        </div>
    );
}
