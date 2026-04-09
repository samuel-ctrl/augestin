"""
WebSocket Connection Manager for EduTrack.

Maintains a mapping of user_id -> set of active WebSocket connections.
Used to push real-time events (notifications, doubt comments) to connected clients.
"""

import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        conns = self._connections.get(user_id)
        if conns:
            conns.discard(websocket)
            if not conns:
                del self._connections[user_id]

    async def send_to_user(self, user_id: str, event: dict) -> None:
        conns = self._connections.get(user_id)
        if not conns:
            return
        broken: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_json(event)
            except Exception:
                broken.append(ws)
        for ws in broken:
            self.disconnect(user_id, ws)

    async def send_to_users(self, user_ids: list[str], event: dict) -> None:
        for user_id in user_ids:
            await self.send_to_user(user_id, event)


manager = ConnectionManager()
