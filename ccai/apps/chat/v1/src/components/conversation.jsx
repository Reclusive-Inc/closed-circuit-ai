import {useLayoutEffect, useState, useRef, useCallback} from 'react';
import {Progress} from 'radix-ui';
import {CodeMirror, useAutoScroll} from 'ccai';
import {v4 as uuidv4} from 'uuid';
import * as Y from 'yjs';
import {Node} from './node';

export const Conversation = ({
                                 theme,
                                 yDoc,
                                 yProvider,
                                 persistenceEverSynced,
                                 providerStatus,
                                 providerIsSynced,
                                 providerEverSynced,
                                 yConversations,
                                 conversationId,
                                 yRequests,
                                 yRequestsOrder,
                                 sidebarCollapsed,
                                 collapseSidebar,
                                 expandSidebar,
                             }) => {
    // conversation
    const [yConversation, setYConversation] = useState(null);

    // nodes
    const [yNodes, setYNodes] = useState(null);
    const [nodesOrder, setNodesOrder] = useState(null);

    // prompt
    const [yPrompt, setYPrompt] = useState(null);
    const [yPromptUndoManager, setYPromptUndoManager] = useState(null);
    const [promptFocused, setPromptFocused] = useState(null);

    // label
    const [yLabel, setYLabel] = useState(null);
    const [label, setLabel] = useState(null);
    const [yLabelUndoManager, setYLabelUndoManager] = useState(null);
    const [isEditingLabel, setIsEditingLabel] = useState(false);

    // requests
    const [yConversationRequests, setYConversationRequests] = useState(null);
    const [pendingRequests, setPendingRequests] = useState(null);
    const [pendingLabelRequests, setPendingLabelRequests] = useState(null);

    // container ref and autoscroll
    const nodesContainerRef = useRef(null);
    const {onContainerScroll, onContainerResize, hardScroll} = useAutoScroll(nodesContainerRef);

    // conditions
    const [initialized, setInitialized] = useState(false);
    const synced = persistenceEverSynced && providerEverSynced;
    const valid = yDoc && yProvider && yConversations && conversationId && yRequests && yRequestsOrder && yConversation && yNodes && yPrompt && yLabel && yConversationRequests;

    useLayoutEffect(() => {
        const initialized = synced && yConversations && yRequests && yRequestsOrder;
        setInitialized(initialized);
        if (!initialized || !conversationId) return;

        // conversation
        const yConversation = yConversations.get(conversationId);
        setYConversation(yConversation);
        if (!yConversation) return;

        // nodes
        const yNodes = yConversation.get('nodes');
        setYNodes(yNodes);
        const updateNodesOrder = () => {
            const ids = [];
            const yRoot = yNodes.get('root');
            let yNode = yRoot;
            while (yNode) {
                const yParent = yNode;
                const siblings = yParent.get('children');
                if (!siblings || !siblings.length) break;
                const siblingIndex = yParent.get('child_index');
                if (typeof siblingIndex !== 'number') break;
                if (siblingIndex < 0 || siblingIndex >= siblings.length) break;
                const nodeId = siblings.get(siblingIndex);
                yNode = yNodes.get(nodeId);
                ids.push(nodeId);
            }
            setNodesOrder(ids);
        };
        const yNodesObserver = (events) => {
            let shouldUpdateNodesOrder = false;
            for (const event of events) {
                if (event.keysChanged?.has('children')) shouldUpdateNodesOrder = true;
                if (event.keysChanged?.has('child_index')) shouldUpdateNodesOrder = true;
            }
            if (shouldUpdateNodesOrder) updateNodesOrder();
        };
        if (yNodes) {
            yNodes.observeDeep(yNodesObserver);
            updateNodesOrder();
        }

        // prompt
        const yPrompt = yConversation.get('prompt');
        setYPrompt(yPrompt);
        let yPromptUndoManager = null;
        if (yPrompt) {
            yPromptUndoManager = new Y.UndoManager(yPrompt);
        }
        setYPromptUndoManager(yPromptUndoManager);

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
        let yLabelUndoManager = null;
        if (yLabel) {
            yLabelUndoManager = new Y.UndoManager(yLabel);
        }
        setYLabelUndoManager(yLabelUndoManager);

        // requests
        const yConversationRequests = yConversation.get('requests');
        setYConversationRequests(yConversationRequests);
        const updatePendingRequests = () => {
            setPendingRequests(yConversationRequests.toArray().filter((requestId) => {
                const yRequest = yRequests.get(requestId);
                return yRequest && yRequest.get('type') === 'chat';
            }));
            setPendingLabelRequests(yConversationRequests.toArray().filter((requestId) => {
                const yRequest = yRequests.get(requestId);
                return yRequest && yRequest.get('type') === 'label';
            }));
        };
        const yConversationRequestsObserver = () => {
            updatePendingRequests();
        };
        if (yConversationRequests) {
            yConversationRequests.observe(yConversationRequestsObserver);
            updatePendingRequests();
        }

        hardScroll();

        return () => {
            if (yConversationRequests) yConversationRequests.unobserve(yConversationRequestsObserver);
            if (yLabelUndoManager) yLabelUndoManager.destroy();
            if (yLabel) yLabel.unobserve(yLabelObserver);
            if (yPromptUndoManager) yPromptUndoManager.destroy();
            if (yNodes) yNodes.unobserveDeep(yNodesObserver);
        };
    }, [synced, yConversations, conversationId, yRequests, yRequestsOrder, hardScroll]);

    const submitPrompt = () => {
        yDoc.transact(() => {
            const prompt = yPrompt.toString();
            if (prompt.trim() === '') return; // return if prompt is empty

            const parentId = nodesOrder.length === 0 ? 'root' : nodesOrder[nodesOrder.length - 1];
            const yParentNode = yNodes.get(parentId);
            const yParentNodeChildren = yParentNode.get('children');

            // create new node
            const nodeId = uuidv4();
            const yNode = new Y.Map(Object.entries({
                id: nodeId,
                role: 'user',
                content: new Y.Text(yPrompt.toString()),
                reasoning_content: null,
                tool_calls: null,
                parent: parentId,
                children: new Y.Array(),
                child_index: null,
                editing: false,
                editor_content: new Y.Text(),
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
            yNodes.set(nodeId, yNode);
            yParentNodeChildren.push([nodeId]); // attach our node to parent node
            yParentNode.set('child_index', yParentNodeChildren.length - 1); // set it as active child

            // create request
            const id = uuidv4();
            const yRequest = new Y.Map(Object.entries({
                id: id,
                type: 'chat',
                priority: 0,
                conversation_id: conversationId,
                node_id: nodeId,
            }));
            yRequests.set(id, yRequest);
            yRequestsOrder.push([id]);
            yConversationRequests.push([id]);

            // create label request
            if (parentId === 'root') {
                const labelRequestId = uuidv4();
                const yLabelRequest = new Y.Map(Object.entries({
                    id: labelRequestId,
                    type: 'label',
                    priority: -100,
                    conversation_id: conversationId,
                    node_id: nodeId,
                }));
                yRequests.set(labelRequestId, yLabelRequest);
                yRequestsOrder.push([labelRequestId]);
                yConversationRequests.push([labelRequestId]);
            }

            // clear prompt
            yPrompt.delete(0, yPrompt.length);
        });
        hardScroll();
    };

    const cancelRequests = () => {
        yDoc.transact(() => {
            for (const requestId of pendingRequests) {
                yRequests.delete(requestId);
                for (let i = 0; i < yRequestsOrder.length; i++) {
                    if (requestId === yRequestsOrder.get(i)) {
                        yRequestsOrder.delete(i, 1);
                        break;
                    }
                }
                for (let i = 0; i < yConversationRequests.length; i++) {
                    if (requestId === yConversationRequests.get(i)) {
                        yConversationRequests.delete(i, 1);
                        break;
                    }
                }
            }
        });
    };

    const cancelLabelRequests = () => {
        yDoc.transact(() => {
            for (const requestId of pendingLabelRequests) {
                yRequests.delete(requestId);
                for (let i = 0; i < yRequestsOrder.length; i++) {
                    if (requestId === yRequestsOrder.get(i)) {
                        yRequestsOrder.delete(i, 1);
                        break;
                    }
                }
                for (let i = 0; i < yConversationRequests.length; i++) {
                    if (requestId === yConversationRequests.get(i)) {
                        yConversationRequests.delete(i, 1);
                        break;
                    }
                }
            }
        });
    };

    const beginLabelEdit = useCallback(() => {
        setIsEditingLabel(true);
    }, []);

    const endLabelEdit = useCallback(() => {
        setIsEditingLabel(false);
    }, []);

    const onPromptFocus = useCallback(() => {
        setPromptFocused(true);
    }, []);

    const onPromptBlur = useCallback(() => {
        setPromptFocused(false);
    }, []);

    const toggleSidebar = () => {
        if (!sidebarCollapsed) {
            collapseSidebar();
        } else {
            expandSidebar();
        }
    };

    return (
        <div className="flex-1 flex flex-col min-0">
            <div className="flex flex-row justify-between items-center gap-2 bg-header border-b">
                <div className="flex flex-row items-center min-width-0 gap-2">
                    <div className="flex flex-row items-center gap-2 pl-2 text-muted">
                        <button
                            className="flex flex-row justify-center items-center width-6 height-6 overflow-hidden text-smaller-4"
                            onClick={toggleSidebar}
                        >
                            {!sidebarCollapsed ? (<i className="fa-solid fa-caret-left"></i>) : (<i className="fa-solid fa-caret-right"></i>)}
                        </button>
                    </div>
                    {
                        (() => {
                            if (!initialized || !valid) {
                                return (<div className="p-2">&nbsp;</div>);
                            }
                            return (
                                <>
                                    {(() => {
                                        if (isEditingLabel) {
                                            return (
                                                <CodeMirror
                                                    yText={yLabel}
                                                    yUndoManager={yLabelUndoManager}
                                                    awareness={yProvider.awareness}
                                                    language={''}
                                                    theme={theme}
                                                    className={'flex-1 cm-max-height-65px cm-border-r'}
                                                    style={{minWidth: '150px'}}
                                                    focus={true}
                                                    onBlur={endLabelEdit}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Escape' && !event.defaultPrevented) {
                                                            endLabelEdit();
                                                        }
                                                    }}
                                                />
                                            );
                                        } else {
                                            return (
                                                <div
                                                    className={`flex-1 py-2 nowrap overflow-hidden ellipsis ${label ? 'opacity-100' : 'opacity-50'}`}
                                                    style={{minWidth: '50px'}}
                                                    title={`${label || ''}`}
                                                    onClick={beginLabelEdit}
                                                >
                                                    {label || 'unlabeled'}
                                                </div>
                                            );
                                        }
                                    })()}
                                    <div
                                        className="flex flex-row justify-center items-center width-4 height-4"
                                        style={{visibility: !pendingLabelRequests.length ? 'hidden' : 'visible'}}
                                    >
                                        <i className="fa-solid fa-circle line-height-inherit faded-pulse"></i>
                                    </div>
                                    <button
                                        className="flex flex-row items-center p-1 overflow-hidden text-smaller-6"
                                        onClick={cancelLabelRequests}
                                        disabled={!pendingLabelRequests.length}
                                        style={{visibility: !pendingLabelRequests.length ? 'hidden' : 'visible'}}
                                    >
                                        Cancel Label
                                    </button>
                                </>
                            );
                        })()
                    }
                </div>
                <div className="flex flex-row items-center gap-2 p-2">
                    <div
                        className="flex flex-row justify-center items-center width-6 height-6 opacity-50"
                        style={{visibility: providerStatus === 'connected' && providerIsSynced && persistenceEverSynced ? 'hidden' : 'visible'}}
                        title={`persistenceEverSynced: ${persistenceEverSynced}\nproviderStatus: ${providerStatus}\nproviderIsSynced: ${providerIsSynced}\nproviderEverSynced: ${providerEverSynced}`}
                    >
                        <i className="fa-solid fa-bolt fa-fade line-height-inherit scale-80"></i>
                    </div>
                </div>
            </div>
            <div
                ref={nodesContainerRef}
                className="flex-1 flex flex-col min-0 pl-4 mobile-pl-1 overflow-hidden-auto scrollbar-stable mask-top-2"
                onScroll={onContainerScroll}
            >
                {
                    (() => {
                        if (!initialized) return (
                            <>
                                <div className="py-2 mt-2">
                                    Waiting for connection.
                                </div>
                                <div className="py-1 text-smaller-2 text-muted">
                                    Ensure the server is running (check the notebook tab).
                                </div>
                            </>
                        );
                        if (!conversationId) return (<div className="py-2 mt-2">No selection.</div>);
                        if (!valid) return (<div className="py-2 mt-2">Invalid data.</div>);
                        return (
                            <>
                                <div className="flex-grow-spacer-4"></div>
                                {
                                    (() => {
                                        let parentNodeId = 'root';
                                        return nodesOrder.map((nodeId, index) => {
                                            const isLast = index === nodesOrder.length - 1;
                                            const element = (
                                                <Node
                                                    key={nodeId}
                                                    theme={theme}
                                                    yDoc={yDoc}
                                                    yProvider={yProvider}
                                                    conversationId={conversationId}
                                                    yRequests={yRequests}
                                                    yRequestsOrder={yRequestsOrder}
                                                    yConversation={yConversation}
                                                    yNodes={yNodes}
                                                    yConversationRequests={yConversationRequests}
                                                    nodeId={nodeId}
                                                    parentNodeId={parentNodeId}
                                                    isLast={isLast}
                                                    resizeAnnounce={isLast ? onContainerResize : null}
                                                />
                                            );
                                            parentNodeId = nodeId;
                                            return element;
                                        })
                                    })()
                                }
                                <div className="flex-spacer-4"></div>
                            </>
                        );
                    })()
                }
            </div>
            {
                (() => {
                    if (!initialized || !valid) return;
                    return (
                        <>
                            {
                                (() => {
                                    if (pendingRequests.length > 0) {
                                        return (
                                            <Progress.Root className="progress-bar-root height-1px" value={null}>
                                                <Progress.Indicator className="progress-bar-indicator progress-bar-shimmer"/>
                                            </Progress.Root>
                                        );
                                    } else {
                                        return (
                                            <div className="height-1px" style={{background: 'var(--color-border)'}}></div>
                                        );
                                    }
                                })()
                            }
                            <div className="flex flex-col pl-4 mobile-pl-1 pt-1 footer-max-height overflow-hidden-auto scrollbar-stable">
                                <div className="flex flex-col width-percent-100 content-max-width align-self-center">
                                    <CodeMirror
                                        yText={yPrompt}
                                        yUndoManager={yPromptUndoManager}
                                        awareness={yProvider.awareness}
                                        language={'markdown'}
                                        theme={theme}
                                        className={'cm-min-height-10vh mr-2 cm-border'}
                                        onFocus={onPromptFocus}
                                        onBlur={onPromptBlur}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col pl-4 mobile-pl-1 overflow-hidden scrollbar-stable">
                                <div className="flex flex-row justify-end width-percent-100 content-max-width align-self-center">
                                    <div
                                        className="mr-3 nowrap text-smaller-8 text-muted opacity-50 user-select-none pointer-events-none"
                                        style={{visibility: promptFocused ? 'visible' : 'hidden'}}
                                    >
                                        Esc + Tab
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col pt-1 pb-2 pl-4 mobile-pl-1 overflow-hidden scrollbar-stable">
                                <div className="flex flex-row justify-between items-center width-percent-100 content-max-width align-self-center">
                                    <div className="flex flex-row"></div>
                                    <div className="flex flex-row justify-end items-center gap-2 mr-2">
                                        <button
                                            className={`flex flex-row items-center p-1 overflow-hidden text-smaller-6 ${!pendingRequests.length ? 'opacity-10' : 'opacity-100'}`}
                                            onClick={cancelRequests}
                                            disabled={!pendingRequests.length}
                                        >
                                            Cancel
                                        </button>
                                        <button className="flex flex-row items-center p-2 overflow-hidden text-larger-2" onClick={submitPrompt}>
                                            <i className="fa-solid fa-paper-plane"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    );
                })()
            }
        </div>
    );
};
