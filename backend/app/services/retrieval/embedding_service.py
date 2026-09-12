import os
import gc
import logging
from typing import List, Optional, Any
from pathlib import Path

# Restrict thread pools and tokenizers parallelism to stay safely within Render 512MB RAM
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("ONNXRUNTIME_NUM_THREADS", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from chromadb.api.types import DefaultEmbeddingFunction, Documents, Embeddings
from chromadb.utils.embedding_functions.onnx_mini_lm_l6_v2 import ONNXMiniLM_L6_V2
from app.config import EMBEDDING_MODEL_NAME

logger = logging.getLogger("retrieval.embedding")


class SafeONNXMiniLM(ONNXMiniLM_L6_V2):
    """
    Memory-optimized, single-instance ONNX MiniLM L6 V2 implementation.
    Limits thread pools, disables arena pre-allocation, and permanently caches
    the InferenceSession and Tokenizer singletons to avoid repeated re-instantiations.
    """
    _cached_session: Optional[Any] = None
    _cached_tokenizer: Optional[Any] = None

    @property
    def tokenizer(self) -> Any:
        if SafeONNXMiniLM._cached_tokenizer is None:
            SafeONNXMiniLM._cached_tokenizer = super().tokenizer
        return SafeONNXMiniLM._cached_tokenizer

    @property
    def model(self) -> Any:
        if SafeONNXMiniLM._cached_session is None:
            self._download_model_if_not_exists()
            so = self.ort.SessionOptions()
            so.intra_op_num_threads = 1
            so.inter_op_num_threads = 1
            so.execution_mode = self.ort.ExecutionMode.ORT_SEQUENTIAL
            so.enable_cpu_mem_arena = False
            so.log_severity_level = 3
            model_path = os.path.join(self.DOWNLOAD_PATH, self.EXTRACTED_FOLDER_NAME, "model.onnx")
            logger.info("Initializing persistent, memory-optimized ONNX InferenceSession (%s)...", model_path)
            SafeONNXMiniLM._cached_session = self.ort.InferenceSession(
                model_path,
                providers=["CPUExecutionProvider"],
                sess_options=so,
            )
        return SafeONNXMiniLM._cached_session


class SafeDefaultEmbeddingFunction(DefaultEmbeddingFunction):
    """
    Drop-in replacement for Chroma's DefaultEmbeddingFunction.
    Preserves name() == 'default' for zero-conflict compatibility with existing collections,
    while reusing a single warm ONNX session across all embedding calls.
    """
    _shared_delegate: Optional[SafeONNXMiniLM] = None

    def __init__(self):
        super().__init__()
        if SafeDefaultEmbeddingFunction._shared_delegate is None:
            SafeDefaultEmbeddingFunction._shared_delegate = SafeONNXMiniLM()

    def __call__(self, input: Documents) -> Embeddings:
        return SafeDefaultEmbeddingFunction._shared_delegate(input)

    def embed_query(self, input: Documents) -> Embeddings:
        return SafeDefaultEmbeddingFunction._shared_delegate(input)


class EmbeddingService:
    """
    Local embedding service leveraging ChromaDB's ONNX-based all-MiniLM-L6-v2 model.
    Runs 100% locally with zero external API calls or costs.
    Embedding dimension: 384.
    """

    def __init__(self, model_name: str = EMBEDDING_MODEL_NAME):
        self.model_name = model_name
        self.dimension = 384
        self._embedding_function: Optional[SafeDefaultEmbeddingFunction] = None

    @property
    def embedding_function(self) -> SafeDefaultEmbeddingFunction:
        if self._embedding_function is None:
            logger.info("Initializing local ONNX embedding function (%s)...", self.model_name)
            self._embedding_function = SafeDefaultEmbeddingFunction()
        return self._embedding_function

    def warmup(self) -> None:
        """
        Eagerly warms up the embedding model at application startup.
        Ensures model is downloaded, extracted, and cached in RAM before accepting requests.
        """
        logger.info("Warming up local ONNX embedding model (%s)...", self.model_name)
        _ = self.embed_text("warmup")
        gc.collect()
        logger.info("Local ONNX embedding model is warm and ready.")

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

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    logger.info("Running embedding service pre-warmup...")
    embedding_service.warmup()
    logger.info("Pre-warmup complete.")
