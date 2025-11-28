// Unified motion configuration for consistent animations across components

export const standardMotionConfig = {
    transition: {
        type: 'spring' as const,
        stiffness: 400,
        damping: 17,
        duration: 0.2,
    },
};

export const motionVariants = {
    subtle: {
        hover: { scale: 1.02 },
        tap: { scale: 0.98 },
    },
    bounce: {
        hover: { scale: 1.05, y: -2 },
        tap: { scale: 0.95 },
    },
    pulse: {
        hover: { scale: 1.02 },
        tap: { scale: 0.98 },
    },
    none: {
        hover: {},
        tap: {},
    },
} as const;

export const slideInVariants = {
    initial: { opacity: 0, x: 300, scale: 0.95 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 300, scale: 0.95 },
};

export const fadeInVariants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
};

export const loadingVariants = {
    initial: { opacity: 0, scale: 0 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0 },
};

export const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
