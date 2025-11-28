import React from 'react';

import { Button } from './button';

export function ErrorCard({
    title,
    message,
    retryButton,
    redirectButton,
}: {
    title: string;
    message: React.ReactNode;
    retryButton?: { onClick: () => void; text: string };
    redirectButton?: { onClick: () => void; text: string };
}) {
    return (
        <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-6">
            <h2 className="text-lg font-semibold text-destructive">{title}</h2>
            <p className="mt-2 text-sm text-destructive/80">{message}</p>
            <div className="mt-4 flex gap-2">
                {retryButton && (
                    <Button variant="outline" size="sm" onClick={retryButton.onClick}>
                        {retryButton.text}
                    </Button>
                )}
                {redirectButton && (
                    <Button variant="secondary" size="sm" onClick={redirectButton.onClick}>
                        {redirectButton.text}
                    </Button>
                )}
            </div>
        </div>
    );
}
