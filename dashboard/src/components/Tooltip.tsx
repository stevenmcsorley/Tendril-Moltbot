import React, { useState } from 'react';

interface TooltipProps {
    text: string;
    children: React.ReactNode;
}

export default function Tooltip({ text, children }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div
            className="tooltip-container"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            style={{ position: 'relative', display: 'inline-block' }}
        >
            {children}
            {isVisible && (
                <div className="tooltip-box">
                    {text}
                </div>
            )}
        </div>
    );
}
