import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center rounded-full border-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
        variants: {
            variant: {
                default: 'border-black bg-black text-white hover:bg-gray-800',
                secondary: 'border-gray-400 bg-gray-200 text-black hover:bg-gray-300',
                destructive: 'border-red-600 bg-red-600 text-white hover:bg-red-700',
                outline: 'text-black border-black bg-white',
                success:
                    'border-green-600 bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200',
                warning:
                    'border-yellow-600 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200',
            },
            size: {
                default: 'px-2.5 py-0.5 text-xs',
                sm: 'px-2 py-0.5 text-xs',
                lg: 'px-3 py-1 text-sm',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
