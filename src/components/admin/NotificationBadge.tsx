'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface NotificationBadgeProps {
    count: number;
    max?: number;
    className?: string;
}

export function NotificationBadge({ count, max = 99, className = '' }: NotificationBadgeProps) {
    if (count === 0) return null;

    const displayCount = count > max ? `${max}+` : count.toString();

    return (
        <AnimatePresence>
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className={`
          absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold
          rounded-full min-w-[20px] h-5 flex items-center justify-center px-1
          shadow-lg border-2 border-white
          ${className}
        `}
            >
                <motion.span
                    key={displayCount}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                >
                    {displayCount}
                </motion.span>
            </motion.div>
        </AnimatePresence>
    );
}
