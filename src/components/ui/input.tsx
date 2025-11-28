import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, error, id, ...props }, ref) => {
        const errorId = id ? `${id}-error` : undefined;
        return (
            <div className="w-full">
                <input
                    type={type}
                    className={cn(
                        'flex h-10 w-full rounded-md border-2 border-gray-400 bg-white px-3 py-2 text-sm text-black ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:border-black disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50 hover:border-gray-500 transition-all duration-200',
                        error ? 'border-red-500 focus-visible:ring-red-500' : '',
                        className,
                    )}
                    ref={ref}
                    aria-invalid={!!error}
                    aria-describedby={error ? errorId : undefined}
                    {...props}
                />
                {error && (
                    <p id={errorId} className="mt-1 text-xs text-red-600">
                        {error}
                    </p>
                )}
            </div>
        );
    },
);
Input.displayName = 'Input';

export { Input };
