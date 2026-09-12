from datetime import datetime, timezone
from typing import Dict, List, Optional
from app.config import MAX_CONVERSATION_TURNS
from app.models.chat import ConversationHistoryMessage


class ConversationService:
    """
    Manages multi-turn conversation context per session.
    Enforces a strict sliding-window limit to prevent unbounded context growth,
    while treating uploaded course materials as the sole source of truth.
    """

    def __init__(self, max_turns: int = MAX_CONVERSATION_TURNS):
        self.max_turns = max_turns
        # session_id -> list of message dicts
        self._sessions: Dict[str, List[Dict[str, str]]] = {}

    def get_history(self, session_id: Optional[str]) -> List[Dict[str, str]]:
        """Returns the recent conversation turns for a session within max_turns limit."""
        if not session_id or session_id not in self._sessions:
            return []
        return self._sessions[session_id][-self.max_turns:]

    def add_message(
        self,
        session_id: Optional[str],
        role: str,
        content: str,
        status: Optional[str] = None,
    ) -> None:
        """Appends a turn to the session history, trimming to max_turns."""
        if not session_id:
            return

        if session_id not in self._sessions:
            self._sessions[session_id] = []

        now = datetime.now(timezone.utc).isoformat()
        self._sessions[session_id].append({
            "role": role,
            "content": content,
            "timestamp": now,
            "status": status or "grounded",
        })

        # Trim old messages to keep memory bounded
        if len(self._sessions[session_id]) > (self.max_turns * 2):
            self._sessions[session_id] = self._sessions[session_id][-(self.max_turns * 2):]

    def clear_session(self, session_id: str) -> bool:
        """Clears conversation history for a given session."""
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

    def clear_history(self, session_id: str) -> bool:
        """Alias for clear_session."""
        return self.clear_session(session_id)

    def get_formatted_history(self, session_id: str) -> List[ConversationHistoryMessage]:
        """Returns Pydantic formatted history messages for API responses."""
        history = self.get_history(session_id)
        return [
            ConversationHistoryMessage(
                role=m["role"],
                content=m["content"],
                timestamp=m.get("timestamp", ""),
                status=m.get("status"),
            )
            for m in history
        ]


# Global singleton instance
conversation_service = ConversationService()
