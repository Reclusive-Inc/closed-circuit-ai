import asyncio
import json
import logging
import mimetypes
import os
import queue
import sys
import traceback
import uuid
import warnings
import webbrowser
from contextlib import asynccontextmanager
from datetime import datetime
from importlib.metadata import version
from operator import itemgetter
from pathlib import Path
from textwrap import dedent
from typing import Any, Callable
import filelock
import nbformat
import platformdirs
import uvicorn
import websockets
from fastapi import FastAPI, Header, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from jupyter_client import AsyncKernelManager, AsyncKernelClient
from nbformat import NotebookNode
from pycrdt import Doc, Text, Array, Map, YMessageType, YSyncMessageType, Subscription, MapEvent, read_message
from pycrdt.store import SQLiteYStore, YDocNotFound
from pycrdt.websocket import YRoom
from starlette.websockets import WebSocket, WebSocketState, WebSocketDisconnect
from ccai.args import Args
from ccai.resources import resources
from ccai.ws import WebSocketChannel

class Server:
    def __init__(self):
        self._serving = False
        self._alive = False
        self._workspace_path: Path | None = None
        self._workspace_path_str: str | None = None
        self._lock_path: str | None = None

        self._session_id: str | None = None
        self._protocol: str | None = None
        self._host: str | None = None
        self._port: int | None = None
        self._app_url: str | None = None
        self._ssl_keyfile: str | None = None
        self._ssl_certfile: str | None = None
        self._overwrite_workspace: bool = False
        self._dont_open_browser: bool = False
        self._dont_reset_cells: bool = False
        self._kernel_connection_file: str | None = None
        self._kernel_api_ws_protocol: str | None = None
        self._kernel_api_host: str | None = None
        self._kernel_api_port: int | None = None
        self._kernel_api_ws_url: str | None = None
        self._kernel_api_ssl_keyfile: str | None = None
        self._kernel_api_ssl_certfile: str | None = None

        self._document_db_path: str | None = None
        self._y_store: SQLiteYStore | None = None
        self._y_room: YRoom | None = None
        self._y_document: Doc | None = None
        self._y_data: Map | None = None
        self._data_id: str | None = None
        self._y_notebooks: Map | None = None
        self._y_tabs: Map | None = None
        self._y_requests: Map | None = None
        self._y_requests_order: Array | None = None
        self._y_requests_order_subscription: Subscription | None = None
        self._requests_event = asyncio.Event()
        self._request_handler_task: asyncio.Task | None = None

        self._kernel_manager: AsyncKernelManager | None = None
        self._kernel: AsyncKernelClient | None = None
        self._kernel_task: asyncio.Task | None = None
        self._kernel_lock = asyncio.Lock()
        self._kernel_output_hook: Callable | None = None

        self._uvicorn_server: uvicorn.Server | None = None
        self._ws_tasks: list[asyncio.Task] = []

        self._app = FastAPI(lifespan=self._lifespan, dependencies=[Depends(self._auth)])
        self._app.add_api_route('/', self._serve_index, methods=['GET'])
        self._app.add_api_route('/index.html', self._serve_index, methods=['GET'])
        self._app.add_api_route('/favicon.ico', self._serve_favicon, methods=['GET'])
        self._app.add_api_route('/favicon.svg', self._serve_favicon_svg, methods=['GET'])
        self._app.add_api_route('/workspace/{path:path}', self._serve_workspace, methods=['GET'])
        self._app.add_api_websocket_route('/documents/{id:path}', self._ws_document)
        self._app.add_api_websocket_route('/kernel/{path:path}', self._ws_kernel)
        self._app.mount('/static', StaticFiles(directory=str(resources['app'] / 'static')), name='static')

    async def serve(self, args: Args):
        if self._serving:
            raise RuntimeError('ccai: already serving')
        self._serving = True
        try:
            self._workspace_path = Path(args.workspace_path or DEFAULT_WORKSPACE_PATH).resolve()
            self._workspace_path_str = str(self._workspace_path)
            print(f'ccai: workspace {self._workspace_path_str}')
            self._workspace_path.mkdir(parents=True, exist_ok=True)
            os.chdir(self._workspace_path_str)
            self._lock_path = str(self._workspace_path / '.lock')
            print(f'ccai: acquiring {self._lock_path}')
            file_lock = filelock.FileLock(self._lock_path)
            with file_lock.acquire(timeout=2):
                await self._init(args)
                try:
                    await self._serve_app()
                finally:
                    await self._shutdown()
        except filelock.Timeout:
            raise RuntimeError(f'ccai: another process is holding the lock')
        finally:
            self._serving = False

    async def _serve_app(self):
        print(f'ccai: serving at {self._app_url}')
        uvicorn_config = uvicorn.Config(
            self._app,
            loop='asyncio',
            host=self._host,
            port=self._port,
            ssl_keyfile=self._ssl_keyfile,
            ssl_certfile=self._ssl_certfile,
            log_level='critical',
            server_header=False,
        )
        self._uvicorn_server = uvicorn.Server(uvicorn_config)
        await self._uvicorn_server.serve()

    async def _init(self, args: Args):
        self._session_id = str(uuid.uuid4())
        self._protocol = 'https' if (args.ssl_keyfile or args.ssl_certfile) else 'http'
        self._host = EXPOSED_HOST if args.expose else (args.host or LOCALHOST)
        self._port = args.port if args.port else DEFAULT_PORT
        self._app_url = f'{self._protocol}://{LOCALHOST}:{self._port}'
        self._ssl_keyfile = args.ssl_keyfile
        self._ssl_certfile = args.ssl_certfile
        self._overwrite_workspace = args.overwrite_workspace
        self._dont_open_browser = args.dont_open_browser
        self._dont_reset_cells = args.dont_reset_cells
        self._kernel_connection_file = args.kernel_connection_file
        self._kernel_api_ws_protocol = 'wss' if (args.ssl_keyfile or args.ssl_certfile) else 'ws'
        self._kernel_api_host = args.kernel_api_host or LOCALHOST
        self._kernel_api_port = args.kernel_api_port if args.kernel_api_port else DEFAULT_KERNEL_API_PORT
        self._kernel_api_ws_url = f'{self._kernel_api_ws_protocol}://{self._kernel_api_host}:{self._kernel_api_port}'
        self._kernel_api_ssl_keyfile = args.kernel_api_ssl_keyfile
        self._kernel_api_ssl_certfile = args.kernel_api_ssl_certfile

        await self._kernel_start()
        await self._kernel_execute_init()

        # unpack bundled apps into workspace
        print(f'ccai: unpacking resources into workspace')
        self._unpack_resources()

        # initialize store
        self._document_db_path = str(self._workspace_path / DOCUMENT_DB_NAME)
        print(f'ccai: initializing database {self._document_db_path}')
        self._y_store = SQLiteYStore(DOCUMENT_ID)
        self._y_store.db_path = self._document_db_path
        self._y_store.document_ttl = 1800  # condense history when idle for n seconds (1800 seconds = 30 minutes)
        await self._y_store.__aenter__()

        # initialize document
        self._y_document = Doc()
        self._y_data: Map = self._y_document.get('data', type=Map)

        # load stored document
        try:
            await self._y_store.apply_updates(self._y_document)
            print(f'ccai: loaded document "{DOCUMENT_ID}"')
        except YDocNotFound:
            print(f'ccai: creating document "{DOCUMENT_ID}"')

        # initialize data types
        with self._y_document.new_transaction():
            # data id
            self._data_id = self._y_data.get('id')
            if self._data_id is None:
                self._data_id = str(uuid.uuid4())
                self._y_data['id'] = self._data_id

            # session id
            self._y_data['session_id'] = self._session_id

            # notebooks
            self._y_notebooks = self._y_data.get('notebooks')
            if self._y_notebooks is None:
                self._y_notebooks = Map()
                self._y_data['notebooks'] = self._y_notebooks

            # tabs
            self._y_tabs = self._y_data.get('tabs')
            if self._y_tabs is None:
                self._y_tabs = Map()
                self._y_data['tabs'] = self._y_tabs

            # tabs_order
            tabs_order: list[str] = self._y_data.get('tabs_order')
            if tabs_order is None:
                self._y_data['tabs_order'] = []

            # requests
            self._y_requests = self._y_data.get('requests')
            if self._y_requests is None:
                self._y_requests = Map()
                self._y_data['requests'] = self._y_requests

            # requests_order
            self._y_requests_order = self._y_data.get('requests_order')
            if self._y_requests_order is None:
                self._y_requests_order = Array()
                self._y_data['requests_order'] = self._y_requests_order

            # workspace_files
            workspace_files: list[str] = self._y_data.get('workspace_files')
            if workspace_files is None:
                self._y_data['workspace_files'] = []

            # workspace_path
            self._y_data['workspace_path'] = self._workspace_path_str

        # clear stale requests
        with self._y_document.new_transaction():
            for notebook_id, y_notebook in self._y_notebooks.items():
                y_notebook_requests = y_notebook.get('requests')
                y_notebook_requests.clear()
            self._y_requests.clear()
            self._y_requests_order.clear()

        # clear stale execution data
        if not self._dont_reset_cells:
            with self._y_document.new_transaction():
                for notebook_id, y_notebook in self._y_notebooks.items():
                    y_cells: Map = y_notebook.get('cells')
                    for cell_id, y_cell in y_cells.items():
                        y_cell['execution_source'] = None
                        y_cell['execution_count'] = None
                        y_cell['outputs'] = []

        # load workspace files
        self._load_workspace_files()

        # clear obsolete tabs
        with self._y_document.new_transaction():
            for tab_id, y_tab in list(self._y_tabs.items()):
                if tab_id not in self._y_data.get('workspace_files') and tab_id not in self._y_data.get('tabs_order'):
                    print(f'ccai: discarding obsolete tab {tab_id}')
                    del self._y_tabs[tab_id]

        # update metadata
        self._update_notebook_metadata()

        # store document
        await self._y_store.encode_state_as_update(self._y_document)

        # initialize document room
        self._y_room = YRoom(ydoc=self._y_document, ystore=self._y_store, log=logging.root)
        self._y_room.on_message = self._on_room_message
        await self._y_room.__aenter__()

        # listen for incoming requests
        def _y_requests_observer(_event):
            self._requests_event.set()

        self._y_requests_order_subscription = self._y_requests_order.observe(_y_requests_observer)

        # launch request handler task
        self._request_handler_task = asyncio.create_task(self._loop())

    def _unpack_resources(self):
        bundled_workspace_root = resources['apps']
        bundled_workspace_resources = [
            resources['chat/__init__.py'],
            resources['chat/v1/__init__.py'],
            resources['chat/v1/chat.html'],
            resources['chat/v1/chat.ipynb'],
            resources['chat/v1/chat.py'],
            resources['chat/v1/static'],
        ]

        def copy_traversable(src, dest: Path):
            if src.is_dir():
                dest.mkdir(parents=True, exist_ok=True)
                for item in src.iterdir():
                    copy_traversable(item, dest / item.name)
            else:
                if not dest.exists() or self._overwrite_workspace:  # don't overwrite existing files unless flag is set
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(src.read_bytes())

        for resource in bundled_workspace_resources:
            relative_path = resource.relative_to(bundled_workspace_root)
            dest_path = self._workspace_path / relative_path
            copy_traversable(resource, dest_path)

    def _load_workspace_files(self):
        print(f'ccai: loading workspace files')
        workspace_files: list[str] = []
        workspace_notebooks: list[str] = []

        for file_path in self._workspace_path.rglob('*'):
            if file_path.is_file() and (file_path.suffix == '.ipynb' or file_path.suffix == '.html'):
                id = file_path.relative_to(self._workspace_path).as_posix()
                workspace_files.append(id)
                if file_path.suffix == '.ipynb':
                    workspace_notebooks.append(id)

        with self._y_document.new_transaction():
            self._y_data['workspace_files'] = workspace_files
            self._y_data['workspace_loaded_at'] = datetime.now().isoformat()

            # create notebooks for newly discovered .ipynb files
            for notebook_id in workspace_notebooks:
                y_notebook = self._y_notebooks.get(notebook_id)
                if y_notebook:
                    continue
                y_notebook = Map()
                self._y_notebooks[notebook_id] = y_notebook
                filename = Path(notebook_id).name
                y_notebook['filename'] = filename
                abs_path = str(self._workspace_path / notebook_id)
                y_notebook['abs_path'] = abs_path
                y_notebook_cells = Map()
                y_notebook['cells'] = y_notebook_cells
                y_notebook_cells_order = Array()
                y_notebook['cells_order'] = y_notebook_cells_order
                notebook_file_path = self._workspace_path / notebook_id
                notebook_text = notebook_file_path.read_text()
                notebook_node: NotebookNode = nbformat.reads(notebook_text, as_version=4)
                for node_cell in notebook_node.cells:
                    y_notebook_cells[node_cell.id] = Map({
                        'id': node_cell.id or str(uuid.uuid4()),
                        'cell_type': node_cell.cell_type,
                        'execution_source': None,
                        'execution_count': node_cell.execution_count if self._dont_reset_cells else None,
                        'metadata': node_cell.metadata,
                        'source': Text(node_cell.source),
                        'outputs': node_cell.outputs if self._dont_reset_cells and node_cell.outputs else [],
                    })
                    y_notebook_cells_order.append(node_cell.id)
                y_notebook['requests'] = Array()
                y_notebook['synced_at'] = datetime.now().isoformat()

            # create tabs for newly discovered files
            tabs_order: list[str] = self._y_data.get('tabs_order')
            for file_id in workspace_files:
                y_tab = self._y_tabs.get(file_id)
                if y_tab:
                    continue
                print(f'ccai: adding tab {file_id}')
                y_tab = Map({
                    'id': file_id,
                })
                self._y_tabs[file_id] = y_tab
                if file_id not in tabs_order:
                    tabs_order.append(file_id)

            self._y_data['tabs_order'] = tabs_order

    def _update_notebook_metadata(self):
        with self._y_document.new_transaction():
            for notebook_id, y_notebook in self._y_notebooks.items():
                abs_path = str(self._workspace_path / notebook_id)
                if y_notebook.get('abs_path') != abs_path:
                    y_notebook['abs_path'] = abs_path

    async def _shutdown(self):
        print(f'ccai: shutting down')
        self._y_requests_order.unobserve(self._y_requests_order_subscription)
        self._request_handler_task.cancel()
        await asyncio.gather(self._request_handler_task, return_exceptions=True)

        print(f'ccai: stopping kernel')
        stop_kernel_api = dedent('''
            import asyncio
            from ccai.kernel.api import stop
            try:
                await stop()
            except asyncio.CancelledError:
                pass
        ''').strip()
        print(f'ccai: stopping kernel api')
        await self._kernel_execute(stop_kernel_api)
        print(f'ccai: stopping kernel')
        await self._kernel_stop()

        print(f'ccai: stopping crdt tasks')
        await self._y_room.__aexit__(None, None, None)
        await self._y_store.__aexit__(None, None, None)

    # -- request handling --

    async def _loop(self):
        while True:
            # wait for requests
            await self._requests_event.wait()

            # process requests
            while True:
                with self._y_document.new_transaction():
                    if len(self._y_requests_order) == 0:
                        # exit inner loop; back to sleep
                        self._requests_event.clear()
                        break

                    # select next request
                    request_index, request_id, request_type, y_request, session_id = self._next_request()
                    request = y_request.to_py()

                    # validate
                    if not isinstance(request_id, str) or y_request is None:
                        print(f'ccai: discarding invalid request')
                        del self._y_requests_order[request_index]
                        continue
                    if not isinstance(y_request, Map) or request_type is None:
                        print(f'ccai: discarding invalid request: {request_id}')
                        del self._y_requests_order[request_index]
                        del self._y_requests[request_id]
                        continue
                    if session_id and session_id != self._session_id:
                        print(f'ccai: discarding stale request: {request_id}')
                        del self._y_requests_order[request_index]
                        del self._y_requests[request_id]
                        continue

                # observe for cancellation
                cancelled = asyncio.Event()

                def _observer(event):
                    if request_id not in self._y_requests_order:
                        cancelled.set()

                subscription = self._y_requests_order.observe(_observer)

                # handle request
                try:
                    print(f'ccai: handling "{request_type}" request: {request_id}')
                    await self._handle_request(request_id, request_type, request, y_request, cancelled)
                except Exception as e:
                    print(f'ccai: caught request handler exception: {e!r}')
                    traceback.print_exc()

                # delete request
                try:
                    await self._delete_request(request_id, request_type, request, y_request)
                except Exception as e:
                    print(f'ccai: caught request deletion exception: {e!r}')
                    traceback.print_exc()

                self._y_requests_order.unobserve(subscription)

    def _next_request(self):
        # safely flatten requests alongside their priority values
        requests = []
        request_id: Any
        for index, request_id in enumerate(self._y_requests_order):
            y_request: Any = None
            priority: Any = 0
            type: Any = None
            session_id: Any = None
            if isinstance(request_id, str):
                y_request = self._y_requests.get(request_id)
                if isinstance(y_request, Map):
                    type = y_request.get('type')
                    if not isinstance(type, str):
                        type = None
                    priority = y_request.get('priority')
                    if not isinstance(priority, (int, float)):
                        priority = 0
                    session_id = y_request.get('session_id')
                    if not isinstance(session_id, str):
                        session_id = None
            requests.append({
                'request_index': index,
                'request_id': request_id,
                'y_request': y_request,
                'request_type': type,
                'priority': priority,
                'session_id': session_id,
            })

        # stable sort by priority
        requests.sort(key=itemgetter('priority'), reverse=True)

        # return top
        request = requests[0]
        return request['request_index'], request['request_id'], request['request_type'], request['y_request'], request['session_id']

    async def _handle_request(self, request_id: str, request_type: str, request: dict, y_request: Map, cancelled: asyncio.Event):
        match request_type:
            case 'reload_workspace':
                await self._reload_workspace(request, cancelled)
            case 'execute_cell':
                await self._execute_cell(request, cancelled)
            case 'save_notebook':
                await self._save_notebook(request, cancelled)
            case 'reload_notebook':
                await self._reload_notebook(request, cancelled)

    async def _delete_request(self, request_id: str, request_type: str, request: dict, y_request: Map):
        with self._y_document.new_transaction():
            for index, id in enumerate(self._y_requests_order):
                if id == request_id:
                    del self._y_requests_order[index]
                    break

            if request_id in self._y_requests:
                del self._y_requests[request_id]

            match request_type:
                case 'execute_cell' | 'save_notebook' | 'reload_notebook':
                    notebook_id = request.get('notebook_id')
                    if isinstance(notebook_id, str):
                        y_notebook = self._y_notebooks.get(notebook_id)
                        if isinstance(y_notebook, Map):
                            y_notebook_requests = y_notebook.get('requests')
                            if isinstance(y_notebook_requests, Array):
                                for index, id in enumerate(y_notebook_requests):
                                    if id == request_id:
                                        del y_notebook_requests[index]
                                        break

    async def _reload_workspace(self, request: dict, cancelled: asyncio.Event):
        self._load_workspace_files()
        self._update_notebook_metadata()

    async def _execute_cell(self, request: dict, cancelled: asyncio.Event):
        with self._y_document.new_transaction():
            notebook_id: str = request.get('notebook_id')
            cell_id: str = request.get('cell_id')
            y_notebook: Map = self._y_notebooks.get(notebook_id)
            y_cells: Map = y_notebook.get('cells')
            y_cell: Map = y_cells.get(cell_id)
            y_source: Text = y_cell.get('source')
            source = str(y_source)

        execution_count: int | None = None
        outputs = []

        def output_hook(msg_type, content):
            match msg_type:
                case 'stream':
                    outputs.append({
                        'output_type': 'stream',
                        'name': content['name'],
                        'text': content['text'],
                        'metadata': {'id': str(uuid.uuid4())}
                    })
                case 'execute_result':
                    outputs.append({
                        'output_type': 'execute_result',
                        'data': content['data'],
                        'execution_count': content['execution_count'],
                        'metadata': {'id': str(uuid.uuid4())}
                    })
                case 'display_data':
                    outputs.append({
                        'output_type': 'display_data',
                        'data': content['data'],
                        'metadata': {'id': str(uuid.uuid4())}
                    })
                case 'error':
                    outputs.append({
                        'output_type': 'error',
                        'ename': content['ename'],
                        'evalue': content['evalue'],
                        'traceback': content['traceback'],
                        'metadata': {'id': str(uuid.uuid4())}
                    })

        try:
            reply_content = await self._kernel_execute(source, output_hook=output_hook)
            execution_count = reply_content['execution_count']
        except Exception as e:
            print(f'ccai: caught kernel exception: {e!r}')

        with self._y_document.new_transaction():
            y_cell['execution_source'] = source
            y_cell['execution_count'] = execution_count
            y_cell['outputs'] = outputs

    async def _save_notebook(self, request: dict, cancelled: asyncio.Event):
        with self._y_document.new_transaction():
            notebook_id: str = request.get('notebook_id')
            y_notebook: Map = self._y_notebooks.get(notebook_id)
            y_cells: Map = y_notebook.get('cells')
            y_cells_order: Array = y_notebook.get('cells_order')

        print(f'ccai: saving notebook {notebook_id}')
        notebook_node = NotebookNode()
        notebook_node.nbformat = 4
        notebook_node.nbformat_minor = 5
        notebook_node.metadata = {}
        notebook_node.cells = []

        for cell_id in y_cells_order:
            y_cell = y_cells.get(cell_id)
            if y_cell is None:
                continue
            cell_node = NotebookNode()
            cell_node.id = y_cell.get('id')
            cell_node.cell_type = y_cell.get('cell_type')
            cell_node.source = str(y_cell.get('source'))
            cell_node.metadata = y_cell.get('metadata')

            match cell_node.cell_type:
                case 'code':
                    cell_node.execution_count = y_cell['execution_count']
                    outputs = []
                    for output in y_cell['outputs']:
                        output_node = NotebookNode(output)
                        outputs.append(output_node)
                    cell_node.outputs = outputs

            notebook_node.cells.append(cell_node)

        notebook_path = self._workspace_path / notebook_id
        nbformat.write(notebook_node, str(notebook_path), version=4)
        print(f'ccai: saved notebook {notebook_id}')

        with self._y_document.new_transaction():
            y_notebook['synced_at'] = datetime.now().isoformat()

    async def _reload_notebook(self, request: dict, cancelled: asyncio.Event):
        with self._y_document.new_transaction():
            notebook_id: str = request.get('notebook_id')
            y_notebook: Map = self._y_notebooks.get(notebook_id)

        print(f'ccai: reloading notebook {notebook_id}')
        notebook_path = self._workspace_path / notebook_id
        notebook_text = notebook_path.read_text()
        notebook_node: NotebookNode = nbformat.reads(notebook_text, as_version=4)
        notebook_node_cell_ids = {cell.id for cell in notebook_node.cells}
        notebook_node_cells_order = [cell.id for cell in notebook_node.cells]

        with self._y_document.new_transaction():
            y_cells: Map = y_notebook.get('cells')
            y_cells_order: Array = y_notebook.get('cells_order')
            for cell_id in list(y_cells.keys()):
                if cell_id not in notebook_node_cell_ids:
                    del y_cells[cell_id]
            for node_cell in notebook_node.cells:
                if node_cell.id in y_cells:
                    y_cell = y_cells.get(node_cell.id)
                    y_source: Text = y_cell.get('source')
                    y_source.clear()
                    y_source.insert(0, node_cell.source)
                    y_cell['cell_type'] = node_cell.cell_type
                    y_cell['execution_source'] = None
                    y_cell['execution_count'] = node_cell.execution_count if self._dont_reset_cells else None
                    y_cell['metadata'] = node_cell.metadata
                    y_cell['outputs'] = node_cell.outputs if self._dont_reset_cells and node_cell.outputs else []
                else:
                    y_cells[node_cell.id] = Map({
                        'id': node_cell.id,
                        'cell_type': node_cell.cell_type,
                        'execution_source': None,
                        'execution_count': node_cell.execution_count if self._dont_reset_cells else None,
                        'metadata': node_cell.metadata,
                        'source': Text(node_cell.source),
                        'outputs': node_cell.outputs if self._dont_reset_cells and node_cell.outputs else [],
                    })
            y_cells_order.clear()
            y_cells_order += notebook_node_cells_order

        print(f'ccai: reloaded notebook {notebook_id}')

        with self._y_document.new_transaction():
            y_notebook['synced_at'] = datetime.now().isoformat()

    # -- fastapi --

    @asynccontextmanager
    async def _lifespan(self, _app: FastAPI):
        await asyncio.sleep(0)
        await self._server_alive()
        yield
        await self._server_death()

    async def _auth(self, authorization: str | None = Header(None)) -> Any:
        return None

    async def _server_alive(self):
        self._alive = True
        print(f'ccai: listening at: {self._app_url}')
        if not self._dont_open_browser:
            try:
                webbrowser.open(self._app_url)
            except Exception as e:
                print(f'ccai: error opening web browser: {e!r}')

    async def _server_death(self):
        self._alive = False
        print(f'ccai: server dead')
        for task in self._ws_tasks:
            task.cancel()
        await asyncio.gather(*self._ws_tasks, return_exceptions=True)
        print(f'ccai: ws_tasks cancelled')

    async def _ws_document(self, ws: WebSocket, id: str):
        if not self._alive:
            raise HTTPException(status_code=400)

        if id != DOCUMENT_ID:
            raise HTTPException(status_code=404)

        async def _ws_document_loop():
            await ws.accept()

            ws_channel = WebSocketChannel(ws, id)

            try:
                await self._y_room.serve(ws_channel)
            except WebSocketDisconnect:
                pass
            finally:
                if ws.client_state == WebSocketState.CONNECTED:
                    try:
                        await ws.close()
                    except Exception:
                        pass

        task = asyncio.create_task(_ws_document_loop())
        self._ws_tasks.append(task)
        try:
            await task
        finally:
            self._ws_tasks.remove(task)

    async def _ws_kernel(self, ws: WebSocket, path: str):
        if not self._alive:
            raise HTTPException(status_code=400)

        async def _ws_kernel_loop():
            url = f'{self._kernel_api_ws_url}/{path}'
            try:
                async with websockets.connect(url) as kernel_ws:
                    async def _to_kernel():
                        while True:
                            data = await ws.receive_bytes()
                            await kernel_ws.send(data)

                    async def _from_kernel():
                        async for message in kernel_ws:
                            if isinstance(message, bytes):
                                await ws.send_bytes(message)
                            else:
                                await ws.send_text(message)

                    await ws.accept()

                    await asyncio.gather(_to_kernel(), _from_kernel())
            except WebSocketDisconnect:
                pass
            except websockets.exceptions.InvalidStatus:
                await ws.close(1014)
            except BaseException:
                if ws.client_state == WebSocketState.CONNECTED:
                    try:
                        await ws.close(code=1011)
                    except Exception:
                        pass
                raise

        task = asyncio.create_task(_ws_kernel_loop())
        self._ws_tasks.append(task)
        try:
            await task
        finally:
            self._ws_tasks.remove(task)

    def _on_room_message(self, message):
        key_violation = False
        message_type = message[0]
        if message_type == YMessageType.SYNC:
            sync_type = message[1]
            msg = message[2:]

            if sync_type in (YSyncMessageType.SYNC_STEP2, YSyncMessageType.SYNC_UPDATE):
                def _observer(event: MapEvent):
                    if any(key in event.keys for key in PROTECTED_KEYS):
                        nonlocal key_violation
                        key_violation = True

                y_doc = Doc()
                y_data: Map = y_doc.get('data', type=Map)
                subscription = y_data.observe(_observer)
                update = read_message(msg)
                if update != b"\x00\x00":
                    y_doc.apply_update(update)
                y_data.unobserve(subscription)

        if key_violation:
            print('ccai: ignored stale data from client - client will resync')
            return True

        return False

    def _serve_html(self, file_path: Path) -> FileResponse:
        return FileResponse(file_path, media_type='text/html', headers={'Cache-Control': 'no-store'})

    def _serve_index(self):
        return self._serve_html(resources['app/index.html'])

    def _serve_favicon(self):
        return FileResponse(resources['app/favicon.ico'], media_type='image/x-icon')

    def _serve_favicon_svg(self):
        return FileResponse(resources['app/favicon.svg'], media_type='image/svg+xml')

    def _serve_workspace(self, path: str):
        base = self._workspace_path.resolve()
        target = (base / path).resolve()

        if not target.is_relative_to(base):
            raise HTTPException(status_code=403)

        if not target.is_file():
            raise HTTPException(status_code=404)

        relative_path = target.relative_to(base)

        if any(part.startswith('.') for part in relative_path.parts):
            raise HTTPException(status_code=403)

        extension = target.suffix.lower()

        if extension in DONT_SERVE_EXTENSIONS:
            raise HTTPException(status_code=403)

        match extension:
            case '.ipynb':
                return self._serve_html(resources['app/notebook.html'])
            case '.html':
                return self._serve_html(target)
            case _:
                return FileResponse(target)

    # -- kernel --

    async def _kernel_start(self):
        if self._kernel_manager or self._kernel:
            return

        if self._kernel_connection_file:
            print(f'ccai: connecting to existing kernel using: {self._kernel_connection_file}')
            with open(self._kernel_connection_file, 'r') as f:
                connection_info = json.load(f)
            self._kernel = AsyncKernelClient()
            self._kernel.load_connection_info(connection_info)
        else:
            print('ccai: starting kernel')
            self._kernel_manager = AsyncKernelManager()
            await self._kernel_manager.start_kernel(cwd=self._workspace_path_str)
            self._kernel = self._kernel_manager.client()

        self._kernel.start_channels()
        await self._kernel.wait_for_ready()

        self._kernel_task = asyncio.create_task(self._kernel_loop())

    async def _kernel_loop(self):
        while True:
            try:
                msg = await self._kernel.get_iopub_msg(timeout=1)
            except queue.Empty:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f'ccai: caught kernel exception while reading iopub: {e!r}')
                await asyncio.sleep(0.1)
                continue
            self._handle_kernel_message(msg)

    def _handle_kernel_message(self, msg):
        msg_type = msg['header']['msg_type']
        content = msg['content']

        match msg_type:
            case 'status':
                pass
            case 'execute_input':
                pass
            case 'stream':
                match content['name']:
                    case 'stdout':
                        sys.stdout.write(content['text'])
                    case 'stderr':
                        sys.stderr.write(content['text'])
            case 'execute_result':
                pass
            case 'display_data':
                pass
            case 'error':
                sys.stderr.write(f"{content['ename']}: {content['evalue']}\n")
                sys.stderr.write('\n'.join(content['traceback']) + '\n')

        if self._kernel_output_hook:
            match msg_type:
                case 'stream' | 'execute_result' | 'display_data' | 'error':
                    self._kernel_output_hook(msg_type, content)

    async def _kernel_stop(self):
        if self._kernel_task:
            self._kernel_task.cancel()
            try:
                await self._kernel_task
            except asyncio.CancelledError:
                pass
            self._kernel_task = None
        if self._kernel:
            self._kernel.stop_channels()
            self._kernel = None
        if self._kernel_manager:
            await self._kernel_manager.shutdown_kernel()
            self._kernel_manager = None

    async def _kernel_execute_init(self):
        async with self._kernel_lock:
            init = dedent(f'''
                import sys
                from ccai.kernel.api import start
                sys.path.insert(0, r'{self._workspace_path_str}')
                await start({self._kernel_api_host!r}, {self._kernel_api_port!r}, {self._kernel_api_ssl_keyfile!r}, {self._kernel_api_ssl_certfile!r})
            ''').strip()
            await self._kernel.execute(init, reply=True, store_history=False)

    async def _kernel_execute(self, code, output_hook=None):
        async with self._kernel_lock:
            self._kernel_output_hook = output_hook
            execute_reply = await self._kernel.execute(code, reply=True, timeout=KERNEL_TIMEOUT)
            self._kernel_output_hook = None
            return execute_reply['content']

LOCALHOST = 'localhost'
EXPOSED_HOST = '0.0.0.0'
DEFAULT_PORT = 8000
DEFAULT_KERNEL_API_PORT = 8100
DEFAULT_WORKSPACE_PATH = platformdirs.user_data_dir('closed-circuit-ai', False)
DOCUMENT_ID = 'ccai'
DOCUMENT_DB_NAME = 'ccai.db'
PROTECTED_KEYS = ('id', 'notebooks', 'tabs', 'requests', 'requests_order', 'workspace_files', 'workspace_path', 'workspace_loaded_at')
DONT_SERVE_EXTENSIONS = {'.py', '.pyc', '.pyo', '.pyd', '.db', '.db-journal', '.db-wal', '.db-shm'}
KERNEL_TIMEOUT = 30

try:
    PACKAGE_VERSION = version('closed-circuit-ai')
except:
    PACKAGE_VERSION = 'dev'

mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/javascript', '.mjs')

warnings.filterwarnings('ignore', message='.*WindowsSelectorEventLoopPolicy.*')
