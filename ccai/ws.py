import asyncio
from starlette.websockets import WebSocket

class WebSocketChannel:
    def __init__(self, ws: WebSocket, path: str):
        self._ws = ws
        self._path = path
        self._send_lock = asyncio.Lock()

    @property
    def path(self) -> str:
        return self._path

    def __aiter__(self):
        return self

    async def __anext__(self) -> bytes:
        try:
            message = await self.recv()
        except Exception:
            raise StopAsyncIteration()
        return message

    async def send(self, message: bytes):
        async with self._send_lock:
            await self._ws.send_bytes(message)

    async def recv(self) -> bytes:
        b = await self._ws.receive_bytes()
        return bytes(b)
