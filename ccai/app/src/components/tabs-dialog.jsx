import {Fragment} from 'react';
import {Dialog, VisuallyHidden} from 'radix-ui';

export const TabsDialog = ({tabsOrder, workspacePath, workspaceFiles, workspaceLoadedAt, openTab, reloadWorkspace}) => {
    return (
        <Dialog.Root>
            <Dialog.Trigger asChild>
                <button className="flex flex-row justify-center items-center width-6 height-6 overflow-hidden">
                    <i className="fa-solid fa-plus line-height-inherit scale-80"></i>
                </button>
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="dialog-overlay"/>
                <Dialog.Content
                    className="dialog-content flex flex-col gap-2 p-2"
                    onCloseAutoFocus={(event) => {
                        setTimeout(() => {
                            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                        }, 0);
                    }}
                >
                    <Dialog.Title asChild>
                        <div className="nowrap overflow-hidden ellipsis mr-6">{workspacePath}</div>
                    </Dialog.Title>
                    <VisuallyHidden.Root asChild>
                        <Dialog.Description asChild>
                            <div></div>
                        </Dialog.Description>
                    </VisuallyHidden.Root>
                    <p>
                        Last refresh at: {workspaceLoadedAt ? new Date(workspaceLoadedAt).toLocaleString() : ''}
                    </p>
                    <div>
                        <button onClick={reloadWorkspace} className="flex flex-row items-center gap-1 p-1 overflow-hidden">
                            <i className="fa-solid fa-arrows-rotate line-height-inherit scale-80"></i>
                            <div>Refresh</div>
                        </button>
                    </div>
                    <div
                        className="gap-2 overflow-hidden-auto"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr',
                            maxHeight: '300px',
                        }}
                    >
                        {
                            (workspaceFiles || []).map((fileId) => {
                                const isActiveTab = tabsOrder.includes(fileId);
                                return (
                                    <Fragment key={fileId}>
                                        <Dialog.Close asChild>
                                            <button
                                                className={`flex flex-row justify-center items-center width-6 height-6 overflow-hidden ${isActiveTab ? 'text-muted active' : 'inactive'}`}
                                                onClick={() => openTab(fileId)}
                                                disabled={isActiveTab}
                                            >
                                                {
                                                    (() => {
                                                        if (isActiveTab) {
                                                            return (
                                                                <i className="fa-solid fa-check line-height-inherit scale-80"></i>
                                                            );
                                                        } else {
                                                            return (
                                                                <i className="fa-solid fa-plus line-height-inherit scale-80"></i>
                                                            );
                                                        }
                                                    })()
                                                }
                                            </button>
                                        </Dialog.Close>
                                        <div title={fileId}
                                             className={`min-0 nowrap overflow-hidden ellipsis ${isActiveTab ? 'text-muted active' : 'inactive'}`}>{fileId}</div>
                                    </Fragment>
                                );
                            })
                        }
                    </div>
                    <Dialog.Close asChild>
                        <button
                            className="dialog-close flex flex-row justify-center items-center width-4 height-4 overflow-hidden border-transparent"
                            aria-label="close"
                        >
                            <i className="fa-solid fa-xmark line-height-inherit scale-80"></i>
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
