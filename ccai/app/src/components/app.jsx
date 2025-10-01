import {useEffect, useState, Fragment} from 'react';
import {v4 as uuidv4} from 'uuid';
import * as Y from 'yjs';
import {WebsocketProvider} from 'y-websocket';
import {IndexeddbPersistence} from 'y-indexeddb';
import {Header} from './header';
import {Tabs} from './tabs';
import {TabsContent} from './tabs-content';
import {useTheme} from '../hooks/theme';
import {useFadeIn} from '../hooks/fade';

const docId = 'ccai';
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.host}/documents`;

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

    // tabs
    const [yTabs, setYTabs] = useState(null);
    const [tabsOrder, setTabsOrder] = useState(null);
    const [tabsOrderStable, setTabsOrderStable] = useState(null);
    const [activeTabId, setActiveTabId] = useState(null);

    // workspace
    const [workspacePath, setWorkspacePath] = useState(null);
    const [workspaceFiles, setWorkspaceFiles] = useState(null);
    const [workspaceLoadedAt, setWorkspaceLoadedAt] = useState(null);

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

                const updateTabsOrder = () => {
                    const updatedTabsOrder = yData.get('tabs_order');
                    setTabsOrder(updatedTabsOrder);
                    if (!updatedTabsOrder) {
                        setTabsOrderStable(null);
                        setActiveTabId(null);
                        return;
                    }
                    setTabsOrderStable((prev) => {
                        if (!prev) return [...updatedTabsOrder];
                        const keepTabs = prev.filter(id => updatedTabsOrder.includes(id));
                        const newTabs = updatedTabsOrder.filter(id => !prev.includes(id));
                        return [...keepTabs, ...newTabs];
                    });
                    setActiveTabId((prev) => {
                        if (prev) return prev;
                        return updatedTabsOrder[0];
                    });
                };

                // observe data
                yDataObserver = (event) => {
                    if (event.keysChanged.has('id')) {
                        const updatedDataId = yData.get('id');
                        if (!dataId) {
                            dataId = updatedDataId;
                        } else {
                            console.log('ccai: clearing database');

                            setProviderEverSynced(false);
                            setPersistenceEverSynced(false);

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
                    if (event.keysChanged.has('tabs')) setYTabs(yData.get('tabs'));
                    if (event.keysChanged.has('tabs_order')) updateTabsOrder();
                    if (event.keysChanged.has('workspace_path')) setWorkspacePath(yData.get('workspace_path'));
                    if (event.keysChanged.has('workspace_files')) setWorkspaceFiles(yData.get('workspace_files'));
                    if (event.keysChanged.has('workspace_loaded_at')) setWorkspaceLoadedAt(yData.get('workspace_loaded_at'));
                    if (event.keysChanged.has('requests')) setYRequests(yData.get('requests'));
                    if (event.keysChanged.has('requests_order')) setYRequestsOrder(yData.get('requests_order'));
                };
                yData.observe(yDataObserver);

                // initialize data
                setYTabs(yData.get('tabs'));
                updateTabsOrder();
                setWorkspacePath(yData.get('workspace_path'));
                setWorkspaceFiles(yData.get('workspace_files'));
                setWorkspaceLoadedAt(yData.get('workspace_loaded_at'));
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

    const selectTab = (tabId) => {
        setActiveTabId(tabId);
    };

    const closeTab = (tabId) => {
        const updatedTabsOrder = tabsOrder.filter(id => id !== tabId);
        if (tabId === activeTabId) {
            const currentIndex = tabsOrder.indexOf(tabId);
            const newIndex = Math.min(currentIndex, updatedTabsOrder.length - 1);
            const newActiveTab = updatedTabsOrder[newIndex];
            setActiveTabId(newActiveTab);
        }
        yData.set('tabs_order', updatedTabsOrder);
    };

    const reorderTab = (dragIndex, dropIndex) => {
        const updatedTabsOrder = [...tabsOrder];
        const [removed] = updatedTabsOrder.splice(dragIndex, 1);
        dropIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
        updatedTabsOrder.splice(dropIndex, 0, removed);
        yData.set('tabs_order', updatedTabsOrder);
    };

    const openTab = (tabId) => {
        const yTab = yTabs.get(tabId);
        if (!yTab) return;
        yData.set('tabs_order', [...tabsOrder, tabId]);
        setActiveTabId(tabId);
    };

    const reloadWorkspace = () => {
        yDoc.transact(() => {
            const id = uuidv4();
            const request = new Y.Map(Object.entries({
                'id': id,
                'type': 'reload_workspace',
                'priority': 0,
            }));
            yRequests.set(id, request);
            yRequestsOrder.push([id]);
        });
    };

    return (
        <>
            <Header
                theme={theme}
                persistenceEverSynced={persistenceEverSynced}
                providerStatus={providerStatus}
                providerIsSynced={providerIsSynced}
                providerEverSynced={providerEverSynced}
            />
            <Tabs
                persistenceEverSynced={persistenceEverSynced}
                providerEverSynced={providerEverSynced}
                tabsOrder={tabsOrder}
                activeTabId={activeTabId}
                workspacePath={workspacePath}
                workspaceFiles={workspaceFiles}
                workspaceLoadedAt={workspaceLoadedAt}
                selectTab={selectTab}
                closeTab={closeTab}
                openTab={openTab}
                reorderTab={reorderTab}
                reloadWorkspace={reloadWorkspace}
            />
            <TabsContent
                persistenceEverSynced={persistenceEverSynced}
                providerEverSynced={providerEverSynced}
                tabsOrderStable={tabsOrderStable}
                activeTabId={activeTabId}
            />
        </>
    );
};
