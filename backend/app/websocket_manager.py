"""
WebSocket Connection Manager for ultrAIment.

Maintains a mapping of user_id -> set of active WebSocket connections.
Used to push real-time events (notifications, doubt comments) to connected clients.
"""

import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._rooms: dict[str, set[str]] = {}

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

    def is_connected(self, user_id: str) -> bool:
        return bool(self._connections.get(user_id))

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

    def join_room(self, room_code: str, user_id: str) -> None:
        if room_code not in self._rooms:
            self._rooms[room_code] = set()
        self._rooms[room_code].add(user_id)

    def leave_room(self, room_code: str, user_id: str) -> None:
        members = self._rooms.get(room_code)
        if members:
            members.discard(user_id)
            if not members:
                del self._rooms[room_code]

    def clear_room(self, room_code: str) -> None:
        self._rooms.pop(room_code, None)

    def room_members(self, room_code: str) -> list[str]:
        return list(self._rooms.get(room_code, set()))

    async def send_to_room(self, room_code: str, event: dict) -> None:
        await self.send_to_users(self.room_members(room_code), event)


manager = ConnectionManager()
