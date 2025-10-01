import {useEffect} from 'react';

export const useFadeIn = () => {
    useEffect(() => {
        document.getElementById('root').classList.remove('preload');
    }, []);
};
