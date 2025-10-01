import {Fragment} from 'react';
import {Tab} from './tab';
import {TabsDialog} from './tabs-dialog';

export const Tabs = ({
                         persistenceEverSynced,
                         providerEverSynced,
                         tabsOrder,
                         activeTabId,
                         workspacePath,
                         workspaceFiles,
                         workspaceLoadedAt,
                         selectTab,
                         closeTab,
                         openTab,
                         reorderTab,
                         reloadWorkspace
                     }) => {
    return (
        <div className="flex flex-row gap-2 border-b">
            {
                (() => {
                    if (!persistenceEverSynced || !providerEverSynced || !tabsOrder) {
                        return (
                            <div className="px-2 py-3">
                                <div>&nbsp;</div>
                            </div>
                        );
                    }
                    return (
                        <>
                            {
                                tabsOrder.map((tabId, tabIndex) => {
                                    const isActive = tabId === activeTabId;
                                    return (
                                        <Tab
                                            key={tabId}
                                            tabId={tabId}
                                            tabIndex={tabIndex}
                                            isActive={isActive}
                                            selectTab={selectTab}
                                            closeTab={closeTab}
                                            reorderTab={reorderTab}
                                        />
                                    );
                                })
                            }
                            <div className="flex flex-row items-center p-2">
                                <TabsDialog
                                    tabsOrder={tabsOrder}
                                    workspacePath={workspacePath}
                                    workspaceFiles={workspaceFiles}
                                    workspaceLoadedAt={workspaceLoadedAt}
                                    openTab={openTab}
                                    reloadWorkspace={reloadWorkspace}
                                />
                            </div>
                        </>
                    );
                })()
            }
        </div>
    );
};
