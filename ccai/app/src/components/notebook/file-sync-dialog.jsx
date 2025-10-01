import {Dialog, VisuallyHidden} from 'radix-ui';

export const FileSyncDialog = ({notebookId, notebookAbsPath, notebookSyncedAt, disabled, saveNotebook, reloadNotebook}) => {
    return (
        <Dialog.Root>
            <Dialog.Trigger asChild disabled={disabled}>
                <button className="flex flex-row items-center gap-1 p-1 overflow-hidden text-smaller-2">
                    <i className="fa-solid fa-file-code line-height-inherit scale-80"></i>
                    <div>File Sync</div>
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
                        <div className="nowrap overflow-hidden ellipsis mr-6">{notebookId}</div>
                    </Dialog.Title>
                    <VisuallyHidden.Root asChild>
                        <Dialog.Description asChild>
                            <div></div>
                        </Dialog.Description>
                    </VisuallyHidden.Root>
                    <p>Last synced at: {notebookSyncedAt ? new Date(notebookSyncedAt).toLocaleString() : ''}</p>
                    <p>{notebookAbsPath}</p>
                    <div className="flex flex-row gap-2">
                        <button onClick={saveNotebook} className="flex flex-row items-center gap-1 px-2 py-1 overflow-hidden">
                            <i className="fa-solid fa-floppy-disk line-height-inherit scale-80"></i>
                            <div>Save to File</div>
                        </button>
                        <button onClick={reloadNotebook} className="flex flex-row items-center gap-1 px-2 py-1 overflow-hidden">
                            <i className="fa-solid fa-triangle-exclamation line-height-inherit scale-80"></i>
                            <div>Reload File</div>
                        </button>
                    </div>
                    <div className="flex flex-row text-smaller-1 text-muted">
                        <div className="px-2">
                            <i className="fa-solid fa-info line-height-inherit scale-80"></i>
                        </div>
                        <p className="px-2">
                            A workspace .ipynb file is loaded and transformed into a CRDT object, once, upon discovery.
                            Use the options above to synchronize them by either <strong>updating the file</strong>, or <strong>reloading from the file</strong>.
                        </p>
                    </div>
                    <Dialog.Close asChild>
                        <button className="dialog-close flex flex-row justify-center items-center width-4 height-4 overflow-hidden border-transparent"
                                aria-label="close">
                            <i className="fa-solid fa-xmark line-height-inherit scale-80"></i>
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
