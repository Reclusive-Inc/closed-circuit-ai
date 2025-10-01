import {TabFrame} from './tab-frame';

export const TabsContent = ({persistenceEverSynced, providerEverSynced, tabsOrderStable, activeTabId}) => {
    return (
        <div className="flex-1 min-0 relative bg">
            {
                (() => {
                    if (!persistenceEverSynced || !providerEverSynced || !tabsOrderStable) {
                        return (<div>&nbsp;</div>);
                    }
                    return tabsOrderStable.map((tabId) => {
                        const url = `${window.location.origin}/workspace/${encodeURI(tabId)}`;
                        const isActive = tabId === activeTabId;
                        return (
                            <TabFrame key={tabId} url={url} isActive={isActive}/>
                        );
                    });
                })()
            }
        </div>
    );
};
