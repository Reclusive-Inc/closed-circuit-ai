import {useLayoutEffect, useState, useRef, memo} from 'react';
import {Progress} from 'radix-ui';
import * as Y from 'yjs';
import {CodeMirror} from '../codemirror';
import {CellOutput} from './output.jsx';

export const Cell = memo(({
                              theme,
                              yProvider,
                              notebookId,
                              yRequests,
                              yCells,
                              cellsOrder,
                              yNotebookRequests,
                              cellId,
                              cellIndex,
                              resizeAnnounce,
                              executeCell,
                              deleteCell,
                              reorderCell,
                          }) => {
    // cell
    const [yCell, setYCell] = useState(null);

    // source
    const [ySource, setYSource] = useState(null);
    const [source, setSource] = useState(null);
    const [ySourceUndoManager, setYSourceUndoManager] = useState(null);

    // requests
    const [pendingExecuteRequests, setPendingExecuteRequests] = useState(null);

    // other fields
    const [cellType, setCellType] = useState(null);
    const [executionSource, setExecutionSource] = useState(null);
    const [executionCount, setExecutionCount] = useState(null);
    const [metadata, setMetadata] = useState(null);
    const [outputs, setOutputs] = useState(null);

    // container ref
    const containerRef = useRef(null);

    // conditions
    const [initialized, setInitialized] = useState(false);
    const valid = notebookId && yRequests && yCells && cellsOrder && yNotebookRequests && cellId && cellIndex != null && yCell && ySource;

    useLayoutEffect(() => {
        const initialized = notebookId && yRequests && yCells && yNotebookRequests && cellId;
        setInitialized(initialized);
        if (!initialized) return;

        // cell
        const yCell = yCells.get(cellId);
        setYCell(yCell);
        if (!yCell) return;

        // source
        const ySource = yCell.get('source');
        setYSource(ySource);
        const ySourceObserver = () => {
            setSource(ySource.toString());
        };
        let ySourceUndoManager = null;
        if (ySource) {
            ySource.observe(ySourceObserver);
            setSource(ySource.toString());
            ySourceUndoManager = new Y.UndoManager(ySource);
        }
        setYSourceUndoManager(ySourceUndoManager);

        // requests
        const updatePendingRequests = () => {
            setPendingExecuteRequests(yNotebookRequests.toArray().filter((requestId) => {
                const yRequest = yRequests.get(requestId);
                return yRequest && yRequest.get('type') === 'execute_cell' && yRequest.get('notebook_id') === notebookId && yRequest.get('cell_id') === cellId;
            }));
        };
        const yNotebookRequestsObserver = () => {
            updatePendingRequests();
        };
        yNotebookRequests.observe(yNotebookRequestsObserver);
        updatePendingRequests();

        // other fields
        const yCellObserver = (event) => {
            if (event.keysChanged.has('cell_type')) setCellType(yCell.get('cell_type'));
            if (event.keysChanged.has('execution_source')) setExecutionSource(yCell.get('execution_source'));
            if (event.keysChanged.has('execution_count')) setExecutionCount(yCell.get('execution_count'));
            if (event.keysChanged.has('metadata')) setMetadata(yCell.get('metadata'));
            if (event.keysChanged.has('outputs')) setOutputs(yCell.get('outputs'));
        };
        yCell.observe(yCellObserver);
        setCellType(yCell.get('cell_type'));
        setExecutionSource(yCell.get('execution_source'));
        setExecutionCount(yCell.get('execution_count'));
        setMetadata(yCell.get('metadata'));
        setOutputs(yCell.get('outputs'));

        return () => {
            yCell.unobserve(yCellObserver);
            yNotebookRequests.unobserve(yNotebookRequestsObserver);
            if (ySource) ySourceUndoManager.destroy();
        };
    }, [notebookId, yRequests, yCells, yNotebookRequests, cellId]);

    // resize observer
    useLayoutEffect(() => {
        if (!resizeAnnounce) return;
        const resizeObserver = new ResizeObserver(resizeAnnounce);
        resizeObserver.observe(containerRef.current);
        return () => {
            resizeObserver.disconnect();
        };
    }, [resizeAnnounce]);

    return (
        <div ref={containerRef} className="flex flex-col shrink-0 mr-2 mb-2 border">
            {
                (() => {
                    if (!initialized) return (<div className="p-2">&nbsp;</div>);
                    if (!valid) return (<div className="p-2">Invalid cell.</div>);
                    return (
                        <>
                            <div className="flex flex-row justify-between items-center gap-2 p-2">
                                <div className="flex flex-row items-center gap-2">
                                    <div>[{executionCount != null ? executionCount : '\u00A0'}]:</div>
                                    <button
                                        className="flex flex-row items-center gap-1 p-1 overflow-hidden text-smaller-2"
                                        onClick={() => executeCell(cellId)}
                                        style={source !== executionSource ? {boxShadow: '0px 0px 2px 1px rgba(255, 140, 0, 0.3)'} : {}}
                                    >
                                        <i className="fa-solid fa-play line-height-inherit scale-80"></i>
                                        <div>Execute</div>
                                    </button>
                                </div>
                                <div className="flex flex-row items-center gap-2 overflow-hidden">
                                    <button className="flex flex-row items-center gap-1 p-1 overflow-hidden text-smaller-2" onClick={() => deleteCell(cellId, cellIndex)}>
                                        <i className="fa-solid fa-trash-can line-height-inherit scale-80"></i>
                                        <div>Delete</div>
                                    </button>
                                    <div className="flex flex-col justify-center items-center gap-1px">
                                        <button
                                            className="flex flex-row justify-center items-center width-4 height-4 overflow-hidden text-smaller-6"
                                            onClick={() => reorderCell(cellId, cellIndex, cellIndex - 1)}
                                            disabled={cellIndex === 0}
                                        >
                                            <i className="fa-solid fa-caret-up"></i>
                                        </button>
                                        <button
                                            className="flex flex-row justify-center items-center width-4 height-4 overflow-hidden text-smaller-6"
                                            onClick={() => reorderCell(cellId, cellIndex, cellIndex + 1)}
                                            disabled={cellIndex === cellsOrder.length - 1}
                                        >
                                            <i className="fa-solid fa-caret-down"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {
                                (() => {
                                    if (pendingExecuteRequests.length > 0) {
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
                            <CodeMirror
                                yText={ySource}
                                yUndoManager={ySourceUndoManager}
                                awareness={yProvider.awareness}
                                language={'python'}
                                theme={theme}
                                className={`cm-min-height-10vh ${outputs?.length ? 'cm-border-b' : 'cm-border-none'}`}
                            />
                            <div className="flex flex-col">
                                {
                                    (outputs || []).map((output, index) => {
                                        return (
                                            <CellOutput key={output.metadata.id} output={output}/>
                                        );
                                    })
                                }
                            </div>
                        </>
                    );
                })()
            }
        </div>
    );
});
