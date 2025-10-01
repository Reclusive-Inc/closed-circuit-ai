import {useEffect, useState, useCallback} from 'react';
import {useTheme, useFadeIn} from 'ccai';
import {v4 as uuidv4} from 'uuid';
import * as Y from 'yjs';
import {WebsocketProvider} from 'y-websocket';
import {IndexeddbPersistence} from 'y-indexeddb';
import {Conversation} from './conversation';
import {ConversationList} from './conversation-list';

const appId = 'chat';
const docId = 'chat';
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.host}/kernel/${appId}/documents`;

export const App = () => {
    const theme = useTheme();
    useFadeIn();

    // document
    const [yDoc, setYDoc] = useState(null);
    const [yData, setYData] = useState(null);

    // persistence
    const [yPersistence, setYPersistence] = useState(null);
    const [persistenceEverSynced, setPersistenceEverSynced] = useState(false);

    // provider
    const [yProvider, setYProvider] = useState(null);
    const [providerStatus, setProviderStatus] = useState('');
    const [providerIsSynced, setProviderIsSynced] = useState(false);
    const [providerEverSynced, setProviderEverSynced] = useState(false);

    // conversations
    const [yConversations, setYConversations] = useState(null);
    const [yConversationsOrder, setYConversationsOrder] = useState(null);
    const [selectedConversationId, setSelectedConversationId] = useState(null);

    // requests
    const [yRequests, setYRequests] = useState(null);
    const [yRequestsOrder, setYRequestsOrder] = useState(null);

    // sidebar
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        let yDoc = null;
        let yData = null;
        let yDataObserver = null;
        let yPersistence = null;
        let yProvider = null;

        const init = () => {
            yDoc = new Y.Doc();
            setYDoc(yDoc);

            yData = yDoc.getMap('data');
            setYData(yData);

            yPersistence = new IndexeddbPersistence(docId, yDoc);
            setYPersistence(yPersistence);

            yPersistence.once('synced', () => {
                setPersistenceEverSynced(true);
                let dataId = yData.get('id');

                // observe data
                yDataObserver = (event) => {
                    if (event.keysChanged.has('id')) {
                        const updatedDataId = yData.get('id');
                        if (!dataId) {
                            dataId = updatedDataId;
                        } else {
                            console.log('chat: clearing database');

                            setProviderEverSynced(false);
                            setPersistenceEverSynced(false);
                            setSelectedConversationId(null);

                            yData.unobserve(yDataObserver);
                            yDataObserver = null;
                            yData = null;
                            setYData(null);

                            yProvider.destroy();
                            yProvider = null;
                            setYProvider(null);

                            const _yDoc = yDoc;
                            yDoc = null;
                            setYDoc(null);

                            const clearDataPromise = yPersistence.clearData();
                            yPersistence = null;
                            setYPersistence(null);
                            clearDataPromise.finally(() => {
                                _yDoc.destroy();
                                init();
                            });

                            return;
                        }
                    }
                    if (event.keysChanged.has('conversations')) setYConversations(yData.get('conversations'));
                    if (event.keysChanged.has('conversations_order')) setYConversationsOrder(yData.get('conversations_order'));
                    if (event.keysChanged.has('requests')) setYRequests(yData.get('requests'));
                    if (event.keysChanged.has('requests_order')) setYRequestsOrder(yData.get('requests_order'));
                };
                yData.observe(yDataObserver);

                // initialize data
                setYConversations(yData.get('conversations'));
                setYConversationsOrder(yData.get('conversations_order'));
                setYRequests(yData.get('requests'));
                setYRequestsOrder(yData.get('requests_order'));

                // provider
                yProvider = new WebsocketProvider(wsUrl, docId, yDoc);
                setYProvider(yProvider);
                yProvider.on('status', (status) => {
                    setProviderStatus(status?.status || '');
                });
                yProvider.on('sync', (isSynced) => {
                    setProviderIsSynced(isSynced);
                    if (isSynced) setProviderEverSynced(true);
                });
                yProvider.awareness.setLocalStateField('user', {color: '#0064BAFF'});
            });
        };

        init();

        return () => {
            if (yData && yDataObserver) yData.unobserve(yDataObserver);
            if (yProvider) yProvider.destroy();
            if (yPersistence) yPersistence.destroy();
            if (yDoc) yDoc.destroy();
        };
    }, []);

    const createConversation = useCallback(() => {
        yDoc.transact(() => {
            const rootNodeId = 'root';
            const rootNode = new Y.Map(Object.entries({
                id: rootNodeId,
                role: null,
                content: null,
                reasoning_content: null,
                tool_calls: null,
                parent: null,
                children: new Y.Array(),
                child_index: null,
                editing: null,
                editor_content: null,
                editor_reasoning_content: null,
                editor_tool_calls: null,
                completion_tokens: null,
                prompt_tokens: null,
                total_tokens: null,
                prompt_n: null,
                prompt_ms: null,
                predicted_n: null,
                predicted_ms: null,
            }));
            const conversationId = uuidv4();
            const conversation = new Y.Map(Object.entries({
                id: conversationId,
                nodes: new Y.Map(Object.entries({
                    [rootNodeId]: rootNode,
                })),
                prompt: new Y.Text(),
                label: new Y.Text(),
                requests: new Y.Array(),
            }));
            yConversations.set(conversationId, conversation);
            yConversationsOrder.push([conversationId]);
            setSelectedConversationId(conversationId);
        });
    }, [yDoc, yConversations, yConversationsOrder]);

    const selectConversation = useCallback((conversationId) => {
        setSelectedConversationId(conversationId);
    }, []);

    const deleteConversation = useCallback((conversationId) => {
        yDoc.transact(() => {
            yConversations.delete(conversationId);
            for (let i = 0; i < yConversationsOrder.length; i++) {
                if (conversationId === yConversationsOrder.get(i)) {
                    yConversationsOrder.delete(i, 1);
                    break;
                }
            }
            setSelectedConversationId((prev) => {
                if (prev === conversationId) return null;
                else return prev;
            });
        });
    }, [yDoc, yConversations, yConversationsOrder]);

    const collapseSidebar = useCallback(() => {
        setSidebarCollapsed(true);
    }, []);

    const expandSidebar = useCallback(() => {
        setSidebarCollapsed(false);
    }, []);

    return (
        <div className="flex-1 flex flex-row min-0">
            <div className="flex flex-col min-0 sidebar-width sidebar-max-width border-r" style={{display: sidebarCollapsed ? 'none' : 'flex'}}>
                <div className="flex flex-col p-2 sidebar-button-max-width overflow-hidden" style={{containerType: 'inline-size'}}>
                    <button
                        className="flex flex-row justify-center items-center gap-1 p-2 overflow-hidden"
                        style={{fontSize: 'clamp(0.5rem, 12cqw, 1rem)'}}
                        onClick={createConversation}
                        disabled={!persistenceEverSynced || !providerEverSynced || !yDoc || !yConversations || !yConversationsOrder}
                    >
                        <i className="fa-solid fa-plus line-height-inherit scale-80"></i>
                        <div>New Chat</div>
                    </button>
                </div>
                <ConversationList
                    persistenceEverSynced={persistenceEverSynced}
                    providerEverSynced={providerEverSynced}
                    yConversations={yConversations}
                    yConversationsOrder={yConversationsOrder}
                    selectedConversationId={selectedConversationId}
                    selectConversation={selectConversation}
                    deleteConversation={deleteConversation}
                />
            </div>
            <Conversation
                key={selectedConversationId}
                theme={theme}
                yDoc={yDoc}
                yProvider={yProvider}
                persistenceEverSynced={persistenceEverSynced}
                providerStatus={providerStatus}
                providerIsSynced={providerIsSynced}
                providerEverSynced={providerEverSynced}
                yConversations={yConversations}
                conversationId={selectedConversationId}
                yRequests={yRequests}
                yRequestsOrder={yRequestsOrder}
                sidebarCollapsed={sidebarCollapsed}
                collapseSidebar={collapseSidebar}
                expandSidebar={expandSidebar}
            />
        </div>
    );
};
