import {useEffect, useState, useRef} from 'react';

export const exponentialSaturation = (value, sensitivity = 0.001) => {
    return 100 * (1 - Math.exp(-sensitivity * value));
}

export const ContentIndicator = ({contentLength}) => {
    const contentLengthRef = useRef(null);
    const timeoutRef = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!contentLength) return;
        if (!contentLengthRef.current) {
            contentLengthRef.current = contentLength;
            return;
        }
        if (contentLength === contentLengthRef.current) return;
        contentLengthRef.current = contentLength;
        setVisible(true);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        const idleDelay = 1000;
        timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            setVisible(false);
        }, idleDelay);
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [contentLength]);

    return (
        <div
            className={`height-1px bg-content-indicator-bar transition-width-100-opacity-1000 ${visible ? 'opacity-75' : 'opacity-0'}`}
            style={{width: `${exponentialSaturation(contentLength).toFixed(2)}%`}}
        ></div>
    );
};
