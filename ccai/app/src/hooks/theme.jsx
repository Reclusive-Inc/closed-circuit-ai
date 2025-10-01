import {useLayoutEffect, useState} from 'react';

export const useTheme = () => {
    const [theme, setTheme] = useState(null);

    useLayoutEffect(() => {
        const onTheme = (e) => setTheme(e.detail);
        window.addEventListener('theme', onTheme);
        setTheme(window.theme);
        return () => window.removeEventListener('theme', onTheme);
    }, []);

    return theme;
};
