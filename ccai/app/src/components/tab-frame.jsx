export const TabFrame = ({url, isActive}) => {
    return (
        <iframe
            src={url}
            className="absolute width-percent-100 height-percent-100 inset-0 border-none"
            style={{
                visibility: isActive ? 'visible' : 'hidden',
                zIndex: isActive ? 1 : 0,
                pointerEvents: isActive ? 'auto' : 'none',
            }}
        />
    );
};
