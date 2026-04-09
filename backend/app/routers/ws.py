"""
WebSocket endpoint for EduTrack real-time events.

Authenticates via JWT token passed as a query parameter.
Starlette's BaseHTTPMiddleware does not intercept WebSocket
connections, so this endpoint bypasses AuthMiddleware naturally.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.utils.jwt import decode_token
from app.websocket_manager import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None):
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_token(token)
    if payload is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    await manager.connect(user_id, websocket)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
