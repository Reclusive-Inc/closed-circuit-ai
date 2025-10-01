import {useEffect, useRef, useCallback} from 'react';

export const useAutoScroll = (containerRef) => {
    const pinnedRef = useRef(null);
    const pinnedTimeoutRef = useRef(null);

    const isBottomRef = useRef(null);
    const prevTopRef = useRef(null);

    const isActiveRef = useRef(null);
    const timeoutRef = useRef(null);
    const animationRef = useRef(null);
    const timestampRef = useRef(null);

    const pinMs = 1000; // pin duration
    const timeoutMs = 1000; // deactivate rAF loop after inactivity
    const autoScrollSpeed = 0.5; // 0.5 = 50% of the remaining distance per second
    const bottomPixels = 5; // enable autoscroll upon resize within this distance
    const maxDelta = 1000;

    const autoScrollAnimation = useCallback((timestamp) => {
        animationRef.current = null;

        const prevTimestamp = timestampRef.current || timestamp;
        const delta = Math.min(timestamp - prevTimestamp, maxDelta) * 0.001;
        timestampRef.current = timestamp;

        const container = containerRef.current;
        const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (scrollBottom > 1) {
            container.scrollTop += Math.min(Math.max(scrollBottom * autoScrollSpeed * delta, 1), scrollBottom);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        } else {
            if (!timeoutRef.current) {
                timeoutRef.current = setTimeout(() => {
                    // deactivate rAF loop after inactivity
                    isActiveRef.current = false;
                    cancelAnimationFrame(animationRef.current);
                    timeoutRef.current = null;
                }, timeoutMs);
            }
        }
        animationRef.current = requestAnimationFrame(autoScrollAnimation);
    }, [containerRef]);

    const onContainerScroll = useCallback(() => {
        const container = containerRef.current;

        const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        isBottomRef.current = scrollBottom < bottomPixels;

        // check for user scroll
        const prevTop = prevTopRef.current;
        prevTopRef.current = container.scrollTop;
        if (prevTop && container.scrollTop < prevTop) {
            // deactivate pin
            if (pinnedRef.current) {
                pinnedRef.current = false;
                clearTimeout(pinnedTimeoutRef.current);
                pinnedTimeoutRef.current = null;
            }

            // deactivate autoscroll
            if (isActiveRef.current) {
                isActiveRef.current = false;
                cancelAnimationFrame(animationRef.current);
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            }

            // override
            isBottomRef.current = false;
        }
    }, [containerRef]);

    const onContainerResize = useCallback(() => {
        if (pinnedRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        } else if (!isActiveRef.current && isBottomRef.current) {
            // activate autoscroll
            isActiveRef.current = true;
            animationRef.current = requestAnimationFrame(autoScrollAnimation);
        }
    }, [containerRef, autoScrollAnimation]);

    const hardScroll = useCallback(() => {
        // deactivate autoscroll
        if (isActiveRef.current) {
            isActiveRef.current = false;
            cancelAnimationFrame(animationRef.current);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        }

        // pin the scrollbar for a moment
        pinnedRef.current = true;
        if (pinnedTimeoutRef.current) clearTimeout(pinnedTimeoutRef.current);
        pinnedTimeoutRef.current = setTimeout(() => {
            pinnedTimeoutRef.current = null;
            pinnedRef.current = false;

            // activate autoscroll
            isActiveRef.current = true;
            animationRef.current = requestAnimationFrame(autoScrollAnimation);
        }, pinMs);

        // scroll now
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
        isBottomRef.current = true;
    }, [containerRef, autoScrollAnimation]);

    useEffect(() => {
        const resizeObserver = new ResizeObserver(onContainerResize);
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            if (pinnedTimeoutRef.current) clearTimeout(pinnedTimeoutRef.current);
            if (isActiveRef.current) {
                isActiveRef.current = false;
                cancelAnimationFrame(animationRef.current);
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            }
        };
    }, [containerRef, onContainerResize]);

    return {
        onContainerScroll,
        onContainerResize,
        hardScroll,
    };
};
