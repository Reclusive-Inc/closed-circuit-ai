import {useLayoutEffect, useState, useRef, memo} from 'react';
import {Collapsible} from 'radix-ui';
import {CodeMirror, CodeHighlight, Markdown, ContentIndicator} from 'ccai';
import {v4 as uuidv4} from 'uuid';
import * as Y from 'yjs';

export const Node = memo(({
                              theme,
                              yDoc,
                              yProvider,
                              conversationId,
                              yRequests,
                              yRequestsOrder,
                              yConversation,
                              yNodes,
                              yConversationRequests,
                              nodeId,
                              parentNodeId,
                              isLast,
                              resizeAnnounce,
                          }) => {
    // node
    const [yNode, setYNode] = useState(null);

    // parent
    const [yParent, setYParent] = useState(null);

    // siblings
    const [ySiblings, setYSiblings] = useState(null);
    const [siblings, setSiblings] = useState(null);

    // siblingIndex
    const [siblingIndex, setSiblingIndex] = useState(null);

    // text fields
    const [yContent, setYContent] = useState(null);
    const [content, setContent] = useState(null);
    const [toolContentOpen, setToolContentOpen] = useState(false);
    const [yReasoningContent, setYReasoningContent] = useState(null);
    const [reasoningContent, setReasoningContent] = useState(null);
    const [reasoningContentOpen, setReasoningContentOpen] = useState(false);
    const [yToolCalls, setYToolCalls] = useState(null);
    const [toolCalls, setToolCalls] = useState(null);
    const [toolCallsOpen, setToolCallsOpen] = useState(false);

    // editor text fields
    const [yEditorContent, setYEditorContent] = useState(null);
    const [yEditorContentUndoManager, setYEditorContentUndoManager] = useState(null);
    const [yEditorReasoningContent, setYEditorReasoningContent] = useState(null);
    const [yEditorReasoningContentUndoManager, setYEditorReasoningContentUndoManager] = useState(null);
    const [yEditorToolCalls, setYEditorToolCalls] = useState(null);
    const [yEditorToolCallsUndoManager, setYEditorToolCallsUndoManager] = useState(null);

    // other fields
    const [isEditing, setIsEditing] = useState(null);
    const [role, setRole] = useState(null);
    const [totalTokens, setTotalTokens] = useState(null);
    const [predictedN, setPredictedN] = useState(null);
    const [predictedMs, setPredictedMs] = useState(null);
    const [predictedNPerS, setPredictedNPerS] = useState(null);

    // container ref
    const containerRef = useRef(null);

    // conditions
    const [initialized, setInitialized] = useState(false);
    const valid = nodeId && parentNodeId && conversationId && yConversation && yNodes && yConversationRequests && yRequests && yRequestsOrder && yNode && yParent && ySiblings;

    useLayoutEffect(() => {
        const initialized = nodeId && parentNodeId && yNodes;
        setInitialized(initialized);
        if (!initialized) return;

        // node
        const yNode = yNodes.get(nodeId);
        setYNode(yNode);
        if (!yNode) return;

        // parent
        const yParent = yNodes.get(parentNodeId);
        setYParent(yParent);
        if (!yParent) return;

        // siblings
        const ySiblings = yParent.get('children');
        setYSiblings(ySiblings);
        if (!ySiblings) return;
        const ySiblingsObserver = () => {
            setSiblings(ySiblings.toArray());
        };
        ySiblings.observe(ySiblingsObserver);
        setSiblings(ySiblings.toArray());

        // siblingIndex
        const yParentObserver = (event) => {
            if (event.keysChanged.has('child_index')) setSiblingIndex(yParent.get('child_index'));
        };
        yParent.observe(yParentObserver);
        setSiblingIndex(yParent.get('child_index'));

        // text fields
        const yContent = yNode.get('content');
        setYContent(yContent);
        let yContentObserver = null;
        if (yContent) {
            yContentObserver = () => {
                setContent(yContent.toString());
            };
            yContent.observe(yContentObserver);
            setContent(yContent.toString());
        }
        const yReasoningContent = yNode.get('reasoning_content');
        setYReasoningContent(yReasoningContent);
        let yReasoningContentObserver = null;
        if (yReasoningContent) {
            yReasoningContentObserver = () => {
                setReasoningContent(yReasoningContent.toString());
            };
            yReasoningContent.observe(yReasoningContentObserver);
            setReasoningContent(yReasoningContent.toString());
        }
        const yToolCalls = yNode.get('tool_calls');
        setYToolCalls(yToolCalls);
        let yToolCallsObserver = null;
        if (yToolCalls) {
            yToolCallsObserver = () => {
                setToolCalls(yToolCalls.toString());
            };
            yToolCalls.observe(yToolCallsObserver);
            setToolCalls(yToolCalls.toString());
        }

        // editor text fields
        const yEditorContent = yNode.get('editor_content');
        setYEditorContent(yEditorContent);
        let yEditorContentUndoManager = null;
        if (yEditorContent) {
            yEditorContentUndoManager = new Y.UndoManager(yEditorContent);
            setYEditorContentUndoManager(yEditorContentUndoManager);
        }
        const yEditorReasoningContent = yNode.get('editor_reasoning_content');
        setYEditorReasoningContent(yEditorReasoningContent);
        let yEditorReasoningContentUndoManager = null;
        if (yEditorReasoningContent) {
            yEditorReasoningContentUndoManager = new Y.UndoManager(yEditorReasoningContent);
            setYEditorReasoningContentUndoManager(yEditorReasoningContentUndoManager);
        }
        const yEditorToolCalls = yNode.get('editor_tool_calls');
        setYEditorToolCalls(yEditorToolCalls);
        let yEditorToolCallsUndoManager = null;
        if (yEditorToolCalls) {
            yEditorToolCallsUndoManager = new Y.UndoManager(yEditorToolCalls);
            setYEditorToolCallsUndoManager(yEditorToolCallsUndoManager);
        }

        // other fields
        const updatePredictedStats = () => {
            const predictedN = yNode.get('predicted_n');
            const predictedMs = yNode.get('predicted_ms');
            const predictedNPerS = predictedN && predictedMs ? (predictedN / (predictedMs / 1000)).toFixed(1) : null;
            setPredictedN(predictedN);
            setPredictedMs(predictedMs);
            setPredictedNPerS(predictedNPerS);
        };
        const yNodeObserver = (event) => {
            if (event.keysChanged.has('editing')) setIsEditing(yNode.get('editing'));
            if (event.keysChanged.has('role')) setRole(yNode.get('role'));
            if (event.keysChanged.has('total_tokens')) setTotalTokens(yNode.get('total_tokens'));
            if (event.keysChanged.has('predicted_n') || event.keysChanged.has('predicted_ms')) updatePredictedStats();
        };
        yNode.observe(yNodeObserver);
        setIsEditing(yNode.get('editing'));
        setRole(yNode.get('role'));
        setTotalTokens(yNode.get('total_tokens'));
        updatePredictedStats();

        return () => {
            yNode.unobserve(yNodeObserver);
            if (yEditorToolCallsUndoManager) yEditorToolCallsUndoManager.destroy();
            if (yEditorReasoningContentUndoManager) yEditorReasoningContentUndoManager.destroy();
            if (yEditorContentUndoManager) yEditorContentUndoManager.destroy();
            if (yToolCallsObserver) yToolCalls.unobserve(yToolCallsObserver);
            if (yReasoningContentObserver) yReasoningContent.unobserve(yReasoningContentObserver);
            if (yContentObserver) yContent.unobserve(yContentObserver);
            yParent.unobserve(yParentObserver);
            ySiblings.unobserve(ySiblingsObserver);
        };
    }, [nodeId, parentNodeId, yNodes]);

    // resize observer
    useLayoutEffect(() => {
        if (!resizeAnnounce || isEditing) return;
        const resizeObserver = new ResizeObserver(resizeAnnounce);
        resizeObserver.observe(containerRef.current);
        return () => {
            resizeObserver.disconnect();
        };
    }, [resizeAnnounce, isEditing]);

    const beginEdit = () => {
        yDoc.transact(() => {
            yNode.set('editing', true);
            if (yContent) {
                yEditorContent.delete(0, yEditorContent.length);
                yEditorContent.insert(0, yContent.toString());
            }
            if (yReasoningContent) {
                yEditorReasoningContent.delete(0, yEditorReasoningContent.length);
                yEditorReasoningContent.insert(0, yReasoningContent.toString());
            }
            if (yToolCalls) {
                yEditorToolCalls.delete(0, yEditorToolCalls.length);
                yEditorToolCalls.insert(0, yToolCalls.toString());
            }
        });
    };

    const submitEdit = () => {
        yDoc.transact(() => {
            yNode.set('editing', false);

            // clone our node into a modified twin
            const twinId = uuidv4();
            const yTwin = new Y.Map(Object.entries({
                id: twinId,
                role: role,
                content: yEditorContent ? new Y.Text(yEditorContent.toString()) : null,
                reasoning_content: yEditorReasoningContent ? new Y.Text(yEditorReasoningContent.toString()) : null,
                tool_calls: yEditorToolCalls ? new Y.Text(yEditorToolCalls.toString()) : null,
                parent: parentNodeId,
                children: new Y.Array(),
                child_index: null,
                editing: false,
                editor_content: yEditorContent ? new Y.Text() : null,
                editor_reasoning_content: yEditorReasoningContent ? new Y.Text() : null,
                editor_tool_calls: yEditorToolCalls ? new Y.Text() : null,
                completion_tokens: null,
                prompt_tokens: null,
                total_tokens: null,
                prompt_n: null,
                prompt_ms: null,
                predicted_n: null,
                predicted_ms: null,
            }));
            yNodes.set(twinId, yTwin);
            ySiblings.push([twinId]); // attach twin node to parent node
            yParent.set('child_index', ySiblings.length - 1); // set it as active child

            // create request
            const id = uuidv4();
            const request = new Y.Map(Object.entries({
                id: id,
                type: 'chat',
                priority: 0,
                conversation_id: conversationId,
                node_id: twinId,
            }));
            yRequests.set(id, request);
            yRequestsOrder.push([id]);
            yConversationRequests.push([id]);

            // clear editor fields
            if (yEditorContent) {
                yEditorContent.delete(0, yEditorContent.length);
            }
            if (yEditorReasoningContent) {
                yEditorReasoningContent.delete(0, yEditorReasoningContent.length);
            }
            if (yEditorToolCalls) {
                yEditorToolCalls.delete(0, yEditorToolCalls.length);
            }
        });
    };

    const cancelEdit = () => {
        yDoc.transact(() => {
            yNode.set('editing', false);
            if (yEditorContent) {
                yEditorContent.delete(0, yEditorContent.length);
            }
            if (yEditorReasoningContent) {
                yEditorReasoningContent.delete(0, yEditorReasoningContent.length);
            }
            if (yEditorToolCalls) {
                yEditorToolCalls.delete(0, yEditorToolCalls.length);
            }
        });
    };

    const nextSibling = () => {
        if (siblingIndex >= ySiblings.length - 1) return;
        yParent.set('child_index', siblingIndex + 1);
    };

    const previousSibling = () => {
        if (siblingIndex <= 0) return;
        yParent.set('child_index', siblingIndex - 1);
    };

    return (
        <div ref={containerRef} className="flex flex-col shrink-0 gap-2 width-percent-100 content-max-width align-self-center mb-4">
            {
                (() => {
                    if (!initialized) return (<div>&nbsp;</div>);
                    if (!valid) return (<div>Invalid data.</div>);
                    const isUser = role === 'user';
                    const isAssistant = role === 'assistant';
                    const isTool = role === 'tool';
                    return (
                        <div
                            className="flex flex-col"
                            style={{
                                width: isUser && !isEditing ? '80%' : '100%',
                                alignSelf: isUser && !isEditing ? 'end' : 'auto',
                            }}
                        >
                            {isUser && (<div className="px-2 text-smaller-4 text-muted">User</div>)}
                            <div className={['flex flex-col mr-2 overflow-hidden', isUser && !isEditing && 'bg-panel border-rounded'].filter(Boolean).join(' ')}>
                                {
                                    !isEditing && reasoningContent && (
                                        <Collapsible.Root open={reasoningContentOpen} onOpenChange={setReasoningContentOpen} className="mb-4 border border-rounded">
                                            <Collapsible.Trigger asChild>
                                                <div className="flex flex-row justify-between items-center p-2 cursor-pointer">
                                                    <div className="nowrap overflow-hidden ellipsis">Thinking</div>
                                                    <div className="flex-1 px-2">
                                                        <ContentIndicator contentLength={reasoningContent.length}/>
                                                    </div>
                                                    <div>
                                                        {
                                                            reasoningContentOpen
                                                                ? <i className="fa-solid fa-caret-up"></i>
                                                                : <i className="fa-solid fa-caret-down"></i>
                                                        }
                                                    </div>
                                                </div>
                                            </Collapsible.Trigger>
                                            <Collapsible.Content className="collapsible-content">
                                                <div className="p-2">{reasoningContent}</div>
                                            </Collapsible.Content>
                                        </Collapsible.Root>
                                    )
                                }
                                {
                                    !isEditing && content && !isTool && (
                                        <Markdown content={content} className={isUser ? 'p-3' : 'px-2'}/>
                                    )
                                }
                                {
                                    !isEditing && content && isTool && (
                                        <Collapsible.Root open={toolContentOpen} onOpenChange={setToolContentOpen} className="border border-rounded">
                                            <Collapsible.Trigger asChild>
                                                <div className="flex flex-row justify-between items-center p-2 cursor-pointer">
                                                    <div className="nowrap overflow-hidden ellipsis">Tool Results</div>
                                                    <div className="flex-1 px-2">
                                                        <ContentIndicator contentLength={content.length}/>
                                                    </div>
                                                    <div>
                                                        {
                                                            toolContentOpen
                                                                ? <i className="fa-solid fa-caret-up"></i>
                                                                : <i className="fa-solid fa-caret-down"></i>
                                                        }
                                                    </div>
                                                </div>
                                            </Collapsible.Trigger>
                                            <Collapsible.Content className="collapsible-content">
                                                <pre className="p-2"><CodeHighlight content={content} className="language-json"/></pre>
                                            </Collapsible.Content>
                                        </Collapsible.Root>
                                    )
                                }
                                {
                                    !isEditing && toolCalls && (
                                        <Collapsible.Root open={toolCallsOpen} onOpenChange={setToolCallsOpen} className="border border-rounded">
                                            <Collapsible.Trigger asChild>
                                                <div className="flex flex-row justify-between items-center p-2 cursor-pointer">
                                                    <div className="nowrap overflow-hidden ellipsis">Tool Calls</div>
                                                    <div className="flex-1 px-2">
                                                        <ContentIndicator contentLength={toolCalls.length}/>
                                                    </div>
                                                    <div>
                                                        {
                                                            toolCallsOpen
                                                                ? <i className="fa-solid fa-caret-up"></i>
                                                                : <i className="fa-solid fa-caret-down"></i>
                                                        }
                                                    </div>
                                                </div>
                                            </Collapsible.Trigger>
                                            <Collapsible.Content className="collapsible-content">
                                                <pre className="p-2"><CodeHighlight content={toolCalls} className="language-json"/></pre>
                                            </Collapsible.Content>
                                        </Collapsible.Root>
                                    )
                                }
                                {
                                    isEditing && !isUser && yEditorReasoningContent && (
                                        <>
                                            <div className="text-smaller-4 text-muted">Reasoning Content:</div>
                                            <CodeMirror
                                                yText={yEditorReasoningContent}
                                                yUndoManager={yEditorReasoningContentUndoManager}
                                                awareness={yProvider.awareness}
                                                language={'markdown'}
                                                theme={theme}
                                                className={'cm-min-height-10vh cm-border'}
                                            />
                                        </>
                                    )
                                }
                                {
                                    isEditing && yEditorContent && (
                                        <>
                                            {
                                                !isUser && (<div className="text-smaller-4 text-muted mt-3">Content:</div>)
                                            }
                                            <CodeMirror
                                                yText={yEditorContent}
                                                yUndoManager={yEditorContentUndoManager}
                                                awareness={yProvider.awareness}
                                                language={'markdown'}
                                                theme={theme}
                                                className={'cm-min-height-10vh cm-border'}
                                                focus={true}
                                            />
                                        </>
                                    )
                                }
                                {
                                    isEditing && !isUser && yEditorToolCalls && (
                                        <>
                                            <div className="text-smaller-4 text-muted mt-3">Tool Calls:</div>
                                            <CodeMirror
                                                yText={yEditorToolCalls}
                                                yUndoManager={yEditorToolCallsUndoManager}
                                                awareness={yProvider.awareness}
                                                language={'json'}
                                                theme={theme}
                                                className={'cm-min-height-10vh cm-border'}
                                            />
                                        </>
                                    )
                                }
                            </div>
                            {
                                isUser && (
                                    <div className="flex flex-row justify-end items-center mr-2 pt-1 pr-3">
                                        {
                                            isEditing && (
                                                <div className="flex flex-row justify-end items-center gap-1 text-smaller-4">
                                                    <button className="flex flex-row items-center gap-1 p-1 overflow-hidden border border-rounded" onClick={cancelEdit}>
                                                        <div>Cancel</div>
                                                    </button>
                                                    <button className="flex flex-row items-center gap-1 p-1 overflow-hidden border border-rounded" onClick={submitEdit}>
                                                        <i className="fa-solid fa-code-branch line-height-inherit scale-80"></i>
                                                        <div>Submit</div>
                                                    </button>
                                                </div>
                                            )
                                        }
                                        {
                                            !isEditing && (
                                                <div className="flex flex-row justify-end items-center gap-1 overflow-hidden text-smaller-4 opacity-50 hover-opacity-100">
                                                    <button className="flex flex-row items-center gap-1 p-1 overflow-hidden border border-rounded" onClick={beginEdit}>
                                                        <i className="fa-solid fa-code-branch line-height-inherit scale-80"></i>
                                                        <div>Edit</div>
                                                    </button>
                                                    <div className="flex flex-row items-center gap-1 border border-rounded">
                                                        <button
                                                            className="flex flex-row item-center p-1 overflow-hidden border-none"
                                                            onClick={previousSibling}
                                                            disabled={siblingIndex <= 0}
                                                        >
                                                            <i className="fa-solid fa-chevron-left line-height-inherit scale-80"></i>
                                                        </button>
                                                        <div className="nowrap">{siblingIndex + 1} / {siblings.length}</div>
                                                        <button
                                                            className="flex flex-row item-center p-1 overflow-hidden border-none"
                                                            onClick={nextSibling}
                                                            disabled={siblingIndex >= siblings.length - 1}
                                                        >
                                                            <i className="fa-solid fa-chevron-right line-height-inherit scale-80"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        }
                                    </div>
                                )
                            }
                            {isAssistant && isLast && !isEditing && (
                                <div className="flex flex-row justify-end items-center mr-2 pr-2">
                                    <div
                                        className="nowrap overflow-hidden text-smaller-8 text-muted opacity-50 user-select-none"
                                        style={{visibility: totalTokens ? 'visible' : 'hidden'}}
                                        title={`~${predictedNPerS ? predictedNPerS : '?'} tokens per second`}
                                    >
                                        {totalTokens ? totalTokens : '?'} tokens
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()
            }
        </div>
    );
});
