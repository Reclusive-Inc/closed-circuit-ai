import {useEffect, useState} from 'react';
import * as Y from 'yjs';
import {WebsocketProvider} from 'y-websocket';
import {IndexeddbPersistence} from 'y-indexeddb';
import {Notebook} from './notebook';
import {useTheme} from '../../hooks/theme';
import {useFadeIn} from '../../hooks/fade';

const docId = 'ccai';
const notebookId = decodeURI(window.location.pathname.replace(/^\/workspace\//, ''));
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.host}/documents`;

export const NotebookApp = () => {
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

    // session
    const [sessionId, setSessionId] = useState(null);

    // notebooks
    const [yNotebooks, setYNotebooks] = useState(null);
    const [yNotebook, setYNotebook] = useState(null);

    // requests
    const [yRequests, setYRequests] = useState(null);
    const [yRequestsOrder, setYRequestsOrder] = useState(null);

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

                const updateNotebooks = () => {
                    const yNotebooks = yData.get('notebooks');
                    setYNotebooks(yNotebooks);
                    if (yNotebooks) {
                        setYNotebook(yNotebooks.get(notebookId));
                    }
                };

                // observe data
                yDataObserver = (event) => {
                    if (event.keysChanged.has('id')) {
                        const updatedDataId = yData.get('id');
                        if (!dataId) {
                            dataId = updatedDataId;
                        } else {
                            console.log('notebook: clearing database');

                            setProviderEverSynced(false);
                            setPersistenceEverSynced(false);
                            setYNotebook(null);

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
                    if (event.keysChanged.has('session_id')) setSessionId(yData.get('session_id'));
                    if (event.keysChanged.has('notebooks')) updateNotebooks();
                    if (event.keysChanged.has('requests')) setYRequests(yData.get('requests'));
                    if (event.keysChanged.has('requests_order')) setYRequestsOrder(yData.get('requests_order'));
                };
                yData.observe(yDataObserver);

                // initialize data
                setSessionId(yData.get('session_id'));
                updateNotebooks();
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

    return (
        <Notebook
            key={notebookId}
            theme={theme}
            yDoc={yDoc}
            yProvider={yProvider}
            persistenceEverSynced={persistenceEverSynced}
            providerStatus={providerStatus}
            providerIsSynced={providerIsSynced}
            providerEverSynced={providerEverSynced}
            sessionId={sessionId}
            notebookId={notebookId}
            yNotebook={yNotebook}
            yRequests={yRequests}
            yRequestsOrder={yRequestsOrder}
        />
    );
};
