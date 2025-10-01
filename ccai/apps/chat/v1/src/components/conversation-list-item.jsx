import {useLayoutEffect, useState, memo} from 'react';

export const ConversationListItem = memo(({yConversations, conversationId, isSelected, selectConversation, deleteConversation}) => {
    // conversation
    const [yConversation, setYConversation] = useState(null);

    // label
    const [yLabel, setYLabel] = useState(null);
    const [label, setLabel] = useState(null);

    // requests
    const [yConversationRequests, setYConversationRequests] = useState(null);
    const [pendingRequests, setPendingRequests] = useState(null);

    // conditions
    const [initialized, setInitialized] = useState(false);
    const valid = conversationId && yConversations && yConversation && yLabel && yConversationRequests;

    useLayoutEffect(() => {
        const initialized = conversationId && yConversations;
        setInitialized(initialized);
        if (!initialized) return;

        // conversation
        const yConversation = yConversations.get(conversationId);
        setYConversation(yConversation);
        if (!yConversation) return;

        // label
        const yLabel = yConversation.get('label');
        setYLabel(yLabel);
        const yLabelObserver = () => {
            setLabel(yLabel.toString());
        };
        if (yLabel) {
            yLabel.observe(yLabelObserver);
            setLabel(yLabel.toString());
        }

        // requests
        const yConversationRequests = yConversation.get('requests');
        setYConversationRequests(yConversationRequests);
        const yConversationRequestsObserver = () => {
            setPendingRequests(yConversationRequests.toArray());
        };
        if (yConversationRequests) {
            yConversationRequests.observe(yConversationRequestsObserver);
            setPendingRequests(yConversationRequests.toArray());
        }

        return () => {
            if (yConversationRequests) yConversationRequests.unobserve(yConversationRequestsObserver);
            if (yLabel) yLabel.unobserve(yLabelObserver);
        };
    }, [conversationId, yConversations]);

    return (
        <div
            className={`flex flex-row items-center min-width-0 shrink-0 gap-1 px-2 py-1 cursor-pointer ${isSelected ? 'bg-panel selected' : 'unselected'}`}
            onClick={() => selectConversation(conversationId)}
        >
            {
                (() => {
                    if (!initialized || !valid) return (<div>&nbsp;</div>);
                    return (
                        <>
                            <div className={`flex-1 nowrap overflow-hidden ellipsis ${label ? 'opacity-100' : 'opacity-50'}`} title={`${label || ''}`}>
                                {label || 'unlabeled'}
                            </div>
                            {
                                pendingRequests.length > 0 && (
                                    <div className="flex flex-row justify-center items-center width-4 height-4">
                                        <i className="fa-solid fa-circle line-height-inherit faded-pulse"></i>
                                    </div>
                                )
                            }
                        </>
                    );
                })()
            }
            <button
                className="flex flex-row justify-center items-center width-4 height-4 overflow-hidden border-transparent"
                onClick={(event) => {
                    event.stopPropagation();
                    deleteConversation(conversationId);
                }}
            >
                <i className="fa-solid fa-xmark line-height-inherit scale-80"></i>
            </button>
        </div>
    );
});
