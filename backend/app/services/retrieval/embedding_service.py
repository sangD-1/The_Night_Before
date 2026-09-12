from typing import List, Optional
import logging
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
from app.config import EMBEDDING_MODEL_NAME

logger = logging.getLogger("retrieval.embedding")


class EmbeddingService:
    """
    Local embedding service leveraging ChromaDB's ONNX-based all-MiniLM-L6-v2 model.
    Runs 100% locally with zero external API calls or costs.
    Embedding dimension: 384.
    """

    def __init__(self, model_name: str = EMBEDDING_MODEL_NAME):
        self.model_name = model_name
        self.dimension = 384
        self._embedding_function: Optional[DefaultEmbeddingFunction] = None

    @property
    def embedding_function(self) -> DefaultEmbeddingFunction:
        if self._embedding_function is None:
            logger.info("Initializing local ONNX embedding function (%s)...", self.model_name)
            self._embedding_function = DefaultEmbeddingFunction()
        return self._embedding_function

    def embed_text(self, text: str) -> List[float]:
        """Generate embedding vector for a single string."""
        if not text or not text.strip():
            return [0.0] * self.dimension
        result = self.embedding_function([text.strip()])
        return result[0]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Batch generate embeddings for a list of document strings."""
        if not texts:
            return []
        cleaned = [t.strip() if t and t.strip() else "empty" for t in texts]
        return self.embedding_function(cleaned)

    def embed_query(self, query: str) -> List[float]:
        """Generate embedding vector for a search query."""
        return self.embed_text(query)


# Global singleton instance
embedding_service = EmbeddingService()
