import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.api.models.Collection import Collection

from app.config import (
    CHROMA_PERSIST_DIR,
    CHROMA_COLLECTION_NAME,
    DEFAULT_TOP_K,
    RETRIEVAL_SIMILARITY_THRESHOLD,
)
from app.database import get_db
from app.services.retrieval.chunker import chunker, DocumentChunk
from app.services.retrieval.embedding_service import embedding_service

logger = logging.getLogger("retrieval.vector_store")


class VectorStoreService:
    """
    Persistent ChromaDB vector store manager.
    Coordinates embedding, storage, indexing, and similarity search for course materials.
    """

    def __init__(self):
        self._client: Optional[chromadb.PersistentClient] = None
        self._collection: Optional[Collection] = None

    @property
    def client(self) -> chromadb.PersistentClient:
        if self._client is None:
            logger.info("Connecting to persistent ChromaDB at %s...", CHROMA_PERSIST_DIR)
            self._client = chromadb.PersistentClient(path=str(CHROMA_PERSIST_DIR))
        return self._client

    @property
    def collection(self) -> Collection:
        if self._collection is None:
            logger.info("Initializing ChromaDB collection '%s' with cosine metric...", CHROMA_COLLECTION_NAME)
            self._collection = self.client.get_or_create_collection(
                name=CHROMA_COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
                embedding_function=embedding_service.embedding_function,
            )
        return self._collection

    def index_document(self, document_id: str) -> Dict[str, Any]:
        """
        Extracts sections for the document, chunks them respecting page/slide boundaries,
        removes any existing vectors for this document, and embeds & indexes the new chunks.
        Updates document status in SQLite to 'indexed'.
        """
        # 1. Fetch document and its extracted sections
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM documents WHERE id = ?", (document_id,))
            doc_row = cursor.fetchone()
            if not doc_row:
                raise ValueError(f"Document '{document_id}' not found.")
            doc = dict(doc_row)

            cursor.execute(
                "SELECT * FROM document_sections WHERE document_id = ? ORDER BY section_index ASC",
                (document_id,),
            )
            sections = [dict(r) for r in cursor.fetchall()]

        if not sections:
            raise ValueError(f"Document '{doc['original_filename']}' has no extracted sections to index.")

        # 2. Chunk sections
        chunks: List[DocumentChunk] = chunker.chunk_sections(sections)
        if not chunks:
            raise ValueError(f"No textual content could be chunked for document '{doc['original_filename']}'.")

        # 3. Remove any previous embeddings for this document to maintain idempotence
        self.delete_document_vectors(document_id)

        # 4. Prepare data for ChromaDB
        ids = [chunk.id for chunk in chunks]
        texts = [chunk.text for chunk in chunks]
        metadatas = [chunk.to_metadata() for chunk in chunks]

        # 5. Insert into Chroma collection (Chroma will embed via collection's embedding_function)
        self.collection.add(
            ids=ids,
            documents=texts,
            metadatas=metadatas,
        )

        # 6. Update document status in SQLite
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE documents
                SET processing_status = 'indexed',
                    upload_status = 'indexed'
                WHERE id = ?
                """,
                (document_id,),
            )

        logger.info(
            "Successfully indexed %d chunks for document '%s' (ID: %s)",
            len(chunks),
            doc["original_filename"],
            document_id,
        )

        return {
            "document_id": document_id,
            "original_filename": doc["original_filename"],
            "total_sections": len(sections),
            "total_chunks_indexed": len(chunks),
            "status": "indexed",
            "total_vectors_in_store": self.collection.count(),
        }

    def index_all_documents(self) -> Dict[str, Any]:
        """
        Indexes all processed documents in the database that have extracted sections.
        """
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, original_filename, processing_status FROM documents ORDER BY created_at ASC")
            docs = [dict(r) for r in cursor.fetchall()]

        results = []
        errors = []
        total_chunks = 0

        for doc in docs:
            doc_id = doc["id"]
            try:
                res = self.index_document(doc_id)
                results.append(res)
                total_chunks += res["total_chunks_indexed"]
            except Exception as e:
                errors.append({"document_id": doc_id, "filename": doc["original_filename"], "error": str(e)})

        return {
            "indexed_documents_count": len(results),
            "total_chunks_indexed": total_chunks,
            "failed_count": len(errors),
            "results": results,
            "errors": errors,
            "total_vectors_in_store": self.collection.count(),
        }

    def delete_document_vectors(self, document_id: str) -> int:
        """
        Removes all vectors associated with document_id from ChromaDB.
        """
        try:
            # Query existing IDs first to know count
            existing = self.collection.get(where={"document_id": document_id})
            existing_ids = existing.get("ids", [])
            if existing_ids:
                self.collection.delete(ids=existing_ids)
                logger.info("Deleted %d vectors for document_id %s", len(existing_ids), document_id)
                return len(existing_ids)
            return 0
        except Exception as e:
            logger.warning("Error deleting vectors for document_id %s: %s", document_id, e)
            return 0

    def search(
        self,
        query: str,
        top_k: int = DEFAULT_TOP_K,
        similarity_threshold: float = RETRIEVAL_SIMILARITY_THRESHOLD,
        document_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Executes semantic search over indexed course material chunks.
        Computes cosine similarity (1.0 - cosine_distance).
        Evaluates relevance threshold: if top score is below similarity_threshold,
        marks has_sufficient_evidence = False (triggering refusal / out-of-scope response).
        """
        cleaned_query = query.strip()
        if not cleaned_query:
            return {
                "query": query,
                "total_results": 0,
                "has_sufficient_evidence": False,
                "best_similarity_score": 0.0,
                "similarity_threshold": similarity_threshold,
                "results": [],
            }

        total_in_store = self.collection.count()
        if total_in_store == 0:
            return {
                "query": cleaned_query,
                "total_results": 0,
                "has_sufficient_evidence": False,
                "best_similarity_score": 0.0,
                "similarity_threshold": similarity_threshold,
                "results": [],
                "message": "No course materials are currently indexed.",
            }

        # Query filter if document_ids provided
        where_filter = None
        if document_ids and len(document_ids) == 1:
            where_filter = {"document_id": document_ids[0]}
        elif document_ids and len(document_ids) > 1:
            where_filter = {"document_id": {"$in": document_ids}}

        query_k = min(max(top_k * 4, 16), total_in_store)

        query_kwargs = {
            "query_texts": [cleaned_query],
            "n_results": query_k,
            "include": ["documents", "metadatas", "distances"],
        }
        if where_filter:
            query_kwargs["where"] = where_filter

        query_res = self.collection.query(**query_kwargs)

        retrieved_ids = query_res.get("ids", [[]])[0]
        retrieved_docs = query_res.get("documents", [[]])[0]
        retrieved_metas = query_res.get("metadatas", [[]])[0]
        retrieved_distances = query_res.get("distances", [[]])[0]

        formatted_results = []
        best_similarity = 0.0
        seen_passages = set()

        for i, chunk_id in enumerate(retrieved_ids):
            text = retrieved_docs[i] if i < len(retrieved_docs) else ""
            meta = retrieved_metas[i] if i < len(retrieved_metas) else {}
            distance = float(retrieved_distances[i]) if i < len(retrieved_distances) else 1.0

            # Cosine similarity calculation: similarity = 1 - distance
            # For cosine distance: distance is in [0, 2], so similarity is in [-1, 1], typically [0, 1]
            similarity_score = round(max(0.0, min(1.0, 1.0 - distance)), 4)
            if similarity_score > best_similarity:
                best_similarity = similarity_score

            doc_name = meta.get("document_name", "")
            page_num = meta.get("page_number")
            slide_num = meta.get("slide_number")

            # Deduplicate identical passages across repeated uploads of the same file
            dedup_key = (doc_name, page_num, slide_num, text[:100].strip())
            if dedup_key in seen_passages:
                continue
            seen_passages.add(dedup_key)

            is_relevant = similarity_score >= similarity_threshold

            # Normalize -1 placeholders to None
            page_num_val = int(page_num) if page_num is not None and int(page_num) != -1 else None
            slide_num_val = int(slide_num) if slide_num is not None and int(slide_num) != -1 else None

            formatted_results.append({
                "chunk_id": chunk_id,
                "similarity_score": similarity_score,
                "cosine_distance": round(distance, 4),
                "is_relevant": is_relevant,
                "text": text,
                "document_id": meta.get("document_id", ""),
                "document_name": doc_name,
                "source_type": meta.get("source_type", ""),
                "page_number": page_num_val,
                "slide_number": slide_num_val,
                "section_title": meta.get("section_title") or None,
                "chunk_index": meta.get("chunk_index", 0),
                "citation_label": meta.get("citation_label", ""),
                "original_file_reference": meta.get("original_file_reference", ""),
                "image_preview_path": meta.get("image_preview_path") or None,
                "char_count": meta.get("char_count", len(text)),
                "word_count": meta.get("word_count", len(text.split())),
            })

            if len(formatted_results) >= top_k:
                break

        has_sufficient_evidence = bool(formatted_results and best_similarity >= similarity_threshold)

        return {
            "query": cleaned_query,
            "total_results": len(formatted_results),
            "has_sufficient_evidence": has_sufficient_evidence,
            "best_similarity_score": best_similarity,
            "similarity_threshold": similarity_threshold,
            "results": formatted_results,
        }

    def get_stats(self) -> Dict[str, Any]:
        """Returns collection health, storage directory, and chunk statistics."""
        count = self.collection.count()
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as total FROM documents")
            total_docs = cursor.fetchone()["total"]
            cursor.execute("SELECT COUNT(*) as indexed FROM documents WHERE processing_status = 'indexed'")
            indexed_docs = cursor.fetchone()["indexed"]

        return {
            "collection_name": CHROMA_COLLECTION_NAME,
            "persist_directory": str(CHROMA_PERSIST_DIR),
            "total_chunks_in_vector_store": count,
            "total_documents_in_db": total_docs,
            "indexed_documents_count": indexed_docs,
            "embedding_model": embedding_service.model_name,
            "embedding_dimension": embedding_service.dimension,
            "similarity_threshold": RETRIEVAL_SIMILARITY_THRESHOLD,
            "default_top_k": DEFAULT_TOP_K,
        }


# Global singleton instance
vector_store = VectorStoreService()
