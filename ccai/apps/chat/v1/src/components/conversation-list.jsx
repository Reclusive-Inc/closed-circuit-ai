import {useLayoutEffect, useState} from 'react';
import {ConversationListItem} from './conversation-list-item';

export const ConversationList = ({
                                     persistenceEverSynced,
                                     providerEverSynced,
                                     yConversations,
                                     yConversationsOrder,
                                     selectedConversationId,
                                     selectConversation,
                                     deleteConversation,
                                 }) => {
    // conversations_order
    const [conversationsOrder, setConversationsOrder] = useState(null);

    // conditions
    const [initialized, setInitialized] = useState(false);
    const synced = persistenceEverSynced && providerEverSynced;
    const valid = yConversations && yConversationsOrder;

    useLayoutEffect(() => {
        const initialized = synced && yConversations && yConversationsOrder;
        setInitialized(initialized);
        if (!initialized) return;

        const yConversationsOrderObserver = () => {
            setConversationsOrder(yConversationsOrder.toArray().reverse());
        };
        yConversationsOrder.observe(yConversationsOrderObserver);
        setConversationsOrder(yConversationsOrder.toArray().reverse());
        return () => {
            yConversationsOrder.unobserve(yConversationsOrderObserver);
        };
    }, [synced, yConversations, yConversationsOrder]);

    return (
        <div className="flex-1 flex flex-col min-0 overflow-hidden-auto">
            {
                (() => {
                    if (!initialized) return (<div className="p-2">&nbsp;</div>);
                    if (!valid) return (<div className="p-2">Invalid data.</div>);
                    return conversationsOrder.map((conversationId, index) => {
                        const isSelected = conversationId === selectedConversationId;
                        return (
                            <ConversationListItem
                                key={conversationId}
                                yConversations={yConversations}
                                conversationId={conversationId}
                                isSelected={isSelected}
                                selectConversation={selectConversation}
                                deleteConversation={deleteConversation}
                            />
                        );
                    })
                })()
            }
        </div>
    );
};
