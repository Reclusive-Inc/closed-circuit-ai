import asyncio
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI

alive = False
alive_event = asyncio.Event()

@asynccontextmanager
async def _lifespan(_api: FastAPI):
    global alive, alive_event
    await asyncio.sleep(0)
    alive = True
    alive_event.set()
    yield
    alive = False
    alive_event.clear()

api = FastAPI(lifespan=_lifespan)

api_task: asyncio.Task | None = None

async def start(host: str, port: int, ssl_keyfile: str | None = None, ssl_certfile: str | None = None):
    global api_task
    if not api_task:
        api_task = asyncio.create_task(_serve(host, port, ssl_keyfile, ssl_certfile))
        await alive_event.wait()

async def _serve(host: str, port: int, ssl_keyfile: str | None = None, ssl_certfile: str | None = None):
    uvicorn_config = uvicorn.Config(
        api,
        loop='asyncio',
        host=host,
        port=port,
        ssl_keyfile=ssl_keyfile,
        ssl_certfile=ssl_certfile,
        log_level='critical',
        server_header=False,
    )
    uvicorn_server = uvicorn.Server(uvicorn_config)
    await uvicorn_server.serve()

async def is_alive():
    return alive

async def stop():
    global api_task
    if api_task:
        api_task.cancel()
        await api_task
        api_task = None
