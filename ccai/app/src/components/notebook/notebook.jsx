import {useEffect, useRef, useState, useCallback} from 'react';
import {v4 as uuidv4} from 'uuid';
import * as Y from 'yjs';
import {Cell} from './cell';
import {FileSyncDialog} from './file-sync-dialog';
import {useAutoScroll} from '../../hooks/autoscroll';

export const Notebook = ({
                             theme,
                             yDoc,
                             yProvider,
                             persistenceEverSynced,
                             providerStatus,
                             providerIsSynced,
                             providerEverSynced,
                             sessionId,
                             notebookId,
                             yNotebook,
                             yRequests,
                             yRequestsOrder,
                         }) => {
    // cells
    const [yCells, setYCells] = useState(null);

    // cells_order
    const [yCellsOrder, setYCellsOrder] = useState(null);
    const [cellsOrder, setCellsOrder] = useState(null);

    // requests
    const [yNotebookRequests, setYNotebookRequests] = useState(null);
    const [pendingRequests, setPendingRequests] = useState(null);

    // other fields
    const [notebookFilename, setNotebookFilename] = useState(null);
    const [notebookAbsPath, setNotebookAbsPath] = useState(null);
    const [notebookSyncedAt, setNotebookSyncedAt] = useState(null);

    // container ref and autoscroll
    const cellsContainerRef = useRef(null);
    const {onContainerScroll, onContainerResize, hardScroll} = useAutoScroll(cellsContainerRef);

    // conditions
    const [initialized, setInitialized] = useState(false);
    const synced = persistenceEverSynced && providerEverSynced;
    const valid = yDoc && yProvider && notebookId && yNotebook && yRequests && yRequestsOrder && yCells && yCellsOrder && yNotebookRequests;

    useEffect(() => {
        const initialized = synced && notebookId && yRequests && yRequestsOrder;
        setInitialized(initialized);
        if (!initialized) return;
        if (!yNotebook) return;

        // cells
        const yCells = yNotebook.get('cells');
        setYCells(yCells);

        // cells_order
        const yCellsOrder = yNotebook.get('cells_order');
        setYCellsOrder(yCellsOrder);
        const yCellsOrderObserver = () => {
            setCellsOrder(yCellsOrder.toArray());
        };
        if (yCellsOrder) {
            yCellsOrder.observe(yCellsOrderObserver);
            setCellsOrder(yCellsOrder.toArray());
        }

        // requests
        const yNotebookRequests = yNotebook.get('requests');
        setYNotebookRequests(yNotebookRequests);
        const updatePendingRequests = () => {
            setPendingRequests(yNotebookRequests.toArray().filter((requestId) => {
                const yRequest = yRequests.get(requestId);
                return yRequest && yRequest.get('notebook_id') === notebookId;
            }));
        };
        const yNotebookRequestsObserver = () => {
            updatePendingRequests();
        };
        if (yNotebookRequests) {
            yNotebookRequests.observe(yNotebookRequestsObserver);
            updatePendingRequests();
        }

        // other fields
        const yNotebookObserver = (event) => {
            if (event.keysChanged.has('filename')) setNotebookFilename(yNotebook.get('filename'));
            if (event.keysChanged.has('abs_path')) setNotebookAbsPath(yNotebook.get('abs_path'));
            if (event.keysChanged.has('synced_at')) setNotebookSyncedAt(yNotebook.get('synced_at'));
        };
        yNotebook.observe(yNotebookObserver);
        setNotebookFilename(yNotebook.get('filename'));
        setNotebookAbsPath(yNotebook.get('abs_path'));
        setNotebookSyncedAt(yNotebook.get('synced_at'));

        return () => {
            yNotebook.unobserve(yNotebookObserver);
            if (yNotebookRequests) yNotebookRequests.unobserve(yNotebookRequestsObserver);
            if (yCellsOrder) yCellsOrder.unobserve(yCellsOrderObserver);
        };
    }, [synced, notebookId, yNotebook, yRequests, yRequestsOrder]);

    const createCell = () => {
        yDoc.transact(() => {
            const id = uuidv4();
            const cell = new Y.Map(Object.entries({
                id: id,
                cell_type: 'code',
                execution_source: null,
                execution_count: null,
                metadata: {},
                source: new Y.Text(),
                outputs: [],
            }));
            yCells.set(id, cell);
            yCellsOrder.push([id]);
        });

        hardScroll();
    };

    const executeCell = useCallback((cellId) => {
        yDoc.transact(() => {
            const id = uuidv4();
            const request = new Y.Map(Object.entries({
                'id': id,
                'type': 'execute_cell',
                'priority': 0,
                'session_id': sessionId,
                'notebook_id': notebookId,
                'cell_id': cellId,
            }));
            yRequests.set(id, request);
            yRequestsOrder.push([id]);
            yNotebookRequests.push([id]);
        });
    }, [yDoc, sessionId, notebookId, yRequests, yRequestsOrder, yNotebookRequests]);

    const deleteCell = useCallback((cellId, cellIndex) => {
        yDoc.transact(() => {
            yCells.delete(cellId);
            yCellsOrder.delete(cellIndex, 1);
        });
    }, [yDoc, yCells, yCellsOrder]);

    const reorderCell = useCallback((cellId, cellIndex, destinationCellIndex) => {
        yDoc.transact(() => {
            yCellsOrder.delete(cellIndex, 1);
            yCellsOrder.insert(destinationCellIndex, [cellId]);
        });
    }, [yDoc, yCellsOrder]);

    const saveNotebook = () => {
        yDoc.transact(() => {
            const id = uuidv4();
            const request = new Y.Map(Object.entries({
                'id': id,
                'type': 'save_notebook',
                'priority': 0,
                'session_id': sessionId,
                'notebook_id': notebookId,
            }));
            yRequests.set(id, request);
            yRequestsOrder.push([id]);
            yNotebookRequests.push([id]);
        });
    };

    const reloadNotebook = () => {
        yDoc.transact(() => {
            const id = uuidv4();
            const request = new Y.Map(Object.entries({
                'id': id,
                'type': 'reload_notebook',
                'priority': 0,
                'session_id': sessionId,
                'notebook_id': notebookId,
            }));
            yRequests.set(id, request);
            yRequestsOrder.push([id]);
            yNotebookRequests.push([id]);
        });
    };

    return (
        <>
            <div className="flex flex-row justify-between items-center p-2 bg-header overflow-hidden scrollbar-stable border-b">
                <div className="flex flex-row min-width-0 items-center gap-1 px-2 overflow-hidden">
                    <div className="flex-1 nowrap overflow-hidden ellipsis" title={`${notebookFilename}`}>
                        <span className="text-muted text-smaller-2">Notebook: </span>{notebookFilename}
                    </div>
                    <div
                        className="flex flex-row justify-center items-center width-6 height-6 opacity-50"
                        style={{visibility: providerStatus === 'connected' && providerIsSynced && persistenceEverSynced ? 'hidden' : 'visible'}}
                        title={`persistenceEverSynced: ${persistenceEverSynced}\nproviderStatus: ${providerStatus}\nproviderIsSynced: ${providerIsSynced}\nproviderEverSynced: ${providerEverSynced}`}
                    >
                        <i className="fa-solid fa-bolt fa-fade line-height-inherit scale-80"></i>
                    </div>
                </div>
                <div className="flex flex-row gap-2">
                    <button className="flex flex-row items-center gap-1 p-1 overflow-hidden text-smaller-2" onClick={createCell} disabled={!initialized || !valid}>
                        <i className="fa-solid fa-plus line-height-inherit scale-80"></i>
                        <div>Add Cell</div>
                    </button>
                    <FileSyncDialog
                        notebookId={notebookId}
                        notebookAbsPath={notebookAbsPath}
                        notebookSyncedAt={notebookSyncedAt}
                        disabled={!initialized || !valid}
                        saveNotebook={saveNotebook}
                        reloadNotebook={reloadNotebook}
                    />
                </div>
            </div>
            <div
                ref={cellsContainerRef}
                className="flex-1 flex flex-col min-0 gap-2 py-4 pl-4 mobile-pl-1 overflow-hidden-auto scrollbar-stable mask-top-2"
                onScroll={onContainerScroll}
            >
                {
                    (() => {
                        if (!initialized) {
                            return (
                                <div>&nbsp;</div>
                            )
                        }
                        if (!valid) {
                            return (
                                <div>Invalid notebook.</div>
                            );
                        }
                        return cellsOrder.map((cellId, index) => {
                            const isLast = index === cellsOrder.length - 1;
                            return (
                                <Cell
                                    key={cellId}
                                    theme={theme}
                                    yProvider={yProvider}
                                    notebookId={notebookId}
                                    yRequests={yRequests}
                                    yCells={yCells}
                                    cellsOrder={cellsOrder}
                                    yNotebookRequests={yNotebookRequests}
                                    cellId={cellId}
                                    cellIndex={index}
                                    resizeAnnounce={isLast ? onContainerResize : null}
                                    executeCell={executeCell}
                                    deleteCell={deleteCell}
                                    reorderCell={reorderCell}
                                />
                            );
                        })
                    })()
                }
            </div>
        </>
    );
};
