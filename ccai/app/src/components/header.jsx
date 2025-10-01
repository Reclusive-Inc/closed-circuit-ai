export const Header = ({theme, persistenceEverSynced, providerStatus, providerIsSynced, providerEverSynced}) => {
    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        window.setTheme(newTheme);
    };
    return (
        <header className="flex flex-row justify-between items-center p-2 border-b">
            <div className="text-smaller-2 text-muted nowrap">closed-circuit-ai</div>
            <div className="flex flex-row justify-end items-center gap-1">
                <div
                    className="flex flex-row justify-center items-center width-6 height-6 opacity-50"
                    style={{visibility: providerStatus === 'connected' && providerIsSynced && persistenceEverSynced ? 'hidden' : 'visible'}}
                    title={`persistenceEverSynced: ${persistenceEverSynced}\nproviderStatus: ${providerStatus}\nproviderIsSynced: ${providerIsSynced}\nproviderEverSynced: ${providerEverSynced}`}
                >
                    <i className="fa-solid fa-bolt fa-fade line-height-inherit scale-80"></i>
                </div>
                <button className="flex flex-row justify-center items-center width-6 height-6 overflow-hidden" onClick={toggleTheme}>
                    {
                        (() => {
                            if (theme === 'dark') {
                                return (<i className="fa-solid fa-sun line-height-inherit scale-80"></i>);
                            } else {
                                return (<i className="fa-solid fa-moon line-height-inherit scale-80"></i>);
                            }
                        })()
                    }
                </button>
            </div>
        </header>
    );
};
