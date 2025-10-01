export const Tab = ({tabId, tabIndex, isActive, selectTab, closeTab, reorderTab}) => {
    const onDragStart = (event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('dragIndex', tabIndex);
    };
    const onDragOver = (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    };
    const onDrop = (event) => {
        event.preventDefault();
        const dragIndex = parseInt(event.dataTransfer.getData('dragIndex'), 10);
        const rect = event.currentTarget.getBoundingClientRect();
        const right = event.clientX > rect.left + rect.width / 2;
        const dropIndex = tabIndex + (right ? 1 : 0);
        if (dragIndex !== dropIndex) {
            reorderTab(dragIndex, dropIndex);
        }
    };
    return (
        <div
            className={`flex-1 flex flex-row justify-between items-center gap-2 px-2 py-3 tab-max-width overflow-hidden cursor-pointer ${isActive ? 'bg active' : 'text-muted inactive'}`}
            style={{containerType: 'inline-size'}}
            onClick={() => selectTab(tabId)}
            draggable="true"
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <div title={tabId} className="nowrap overflow-hidden ellipsis text-direction-rtl text-align-left" style={{fontSize: 'clamp(2px, 12cqw, 1rem)'}}>
                {
                    (() => {
                        const lastSlash = tabId.lastIndexOf('/');
                        if (lastSlash === -1) {
                            return <span>{tabId}</span>;
                        }
                        const directory = tabId.substring(0, lastSlash + 1);
                        const filename = tabId.substring(lastSlash + 1);
                        return (
                            <span className="text-direction-ltr unicode-bidi-plaintext">
                                <span className="text-muted" style={{fontSize: 'clamp(1px, 8cqw, 0.875rem)'}}>{directory}</span>
                                <span>{filename}</span>
                            </span>
                        );
                    })()
                }
            </div>
            <button className="flex flex-row justify-center items-center width-4 height-4 overflow-hidden border-transparent" onClick={(event) => {
                closeTab(tabId);
                event.stopPropagation();
            }}
            >
                <i className="fa-solid fa-xmark line-height-inherit scale-80"></i>
            </button>
        </div>
    );
};
