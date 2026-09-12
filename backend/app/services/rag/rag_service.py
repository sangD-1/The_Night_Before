import uuid
import re
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

from app.config import (
    DEFAULT_TOP_K,
    RETRIEVAL_SIMILARITY_THRESHOLD,
    MAX_CONTEXT_CHUNKS,
)
from app.models.chat import ChatResponse, CitationModel
from app.services.retrieval import vector_store
from app.services.document_service import DocumentService
from app.services.rag.prompt_service import prompt_service
from app.services.rag.llm_service import llm_service
from app.services.rag.citation_service import citation_service
from app.services.rag.conversation_service import conversation_service

logger = logging.getLogger("rag.orchestrator")


COMMON_STOPWORDS = {
    "what", "is", "are", "was", "were", "the", "a", "an", "and", "or", "how",
    "does", "do", "did", "why", "when", "where", "which", "who", "whom", "can",
    "could", "would", "should", "of", "in", "to", "for", "with", "on", "at",
    "by", "from", "its", "it", "this", "that", "these", "those", "explain",
    "describe", "define", "discuss", "summary", "give", "tell", "me", "about",
    "between", "using", "uses", "used", "differ", "difference", "differences",
    "compare", "contrast", "according", "my", "your", "our", "their", "course",
    "material", "materials", "notes", "lecture", "document", "documents",
    "algorithm", "algorithms", "time", "complexity", "method", "methods",
    "system", "systems", "search", "rule", "rules", "set", "model", "models", "say", "saying", "phase", "phases"
}

GENERIC_DOMAIN_TERMS = {
    "database", "databases", "dbms", "operating", "memory", "virtual",
    "page", "pages", "data", "table", "tables", "unit", "section",
    "slide", "slides", "topic", "topics", "question", "questions",
    "processing", "scale", "large", "small"
}




def get_word_stem(w: str) -> str:
    """Basic morphological stemmer for English inflections (e.g. avoided -> avoid)."""
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 4 and w.endswith("ed"):
        return w[:-2]
    if len(w) > 4 and w.endswith("ing"):
        return w[:-3]
    if len(w) > 3 and w.endswith("s"):
        return w[:-1]
    return w


def has_topic_coverage(question: str, retrieved_chunks: List[Dict[str, Any]]) -> bool:
    """
    Verifies that key non-generic topic terms from the student's question
    actually appear in the retrieved course context.
    Separates primary specialized subject terms from ubiquitous generic domain terms
    (e.g. 'virtual memory', 'database', 'system') to guarantee mandatory refusal
    when an out-of-scope query (e.g. 'thrashing', 'A*', 'Paxos') scores deceptively
    high similarity against general lecture slides.
    """
    if not retrieved_chunks:
        return False

    combined_text = " ".join([
        f"{c.get('document_name', '')} {c.get('section_title', '')} {c.get('text', '')}"
        for c in retrieved_chunks
    ]).lower()

    # Look for compound patterns like A* or 3NF or normal terms
    tokens = re.findall(r'[a-zA-Z0-9\*\+\#\-]+', question.lower())
    non_stopwords = [t for t in tokens if t not in COMMON_STOPWORDS and (len(t) > 1 or t in {"a*"})]

    if not non_stopwords:
        return True

    # Primary subject terms: non-stopwords that are not broad generic domain nouns
    primary_terms = [t for t in non_stopwords if t not in GENERIC_DOMAIN_TERMS]
    terms_to_check = primary_terms if primary_terms else non_stopwords

    # Check if at least one primary topic term (or its stem) is present in the retrieved text
    for t in terms_to_check:
        stem = get_word_stem(t)
        if t in combined_text or (len(stem) >= 3 and stem in combined_text):
            return True

    return False


GENERIC_DOC_REFERENCE_TERMS = {
    "course", "material", "materials", "notes", "lecture", "lectures",
    "syllabus", "textbook", "guide", "class", "prof", "professor",
    "my notes", "course material", "course materials", "the lecture",
    "the slides", "the document", "the file", "the notes", "exam checklist",
    "process management unit", "exam rules", "all materials"
}


def resolve_query_document_context(
    question: str,
    all_docs: List[Dict[str, Any]],
) -> Tuple[Optional[List[str]], Optional[str], Optional[str], str]:
    """
    Detects if the user question explicitly targets one or more uploaded documents.
    Prevents cross-document leakage and guarantees strict isolation to the requested document.

    Returns:
        (target_doc_ids, matched_doc_name, missing_doc_name, focused_question)
    """
    q_lower = question.lower().strip()

    # If question explicitly requests synthesis or comparison across topics/documents,
    # do not isolate/constrict retrieval to a single document!
    comparison_cues = [
        "synthesize", "compare", "contrast", "differ", "difference", "between",
        "both", "across", "relate", "with the", "and the", "trade-off", "tradeoff"
    ]
    if any(c in q_lower for c in comparison_cues):
        return None, None, None, question.strip()

    matched_docs: List[Dict[str, Any]] = []

    # 1. Exact match on full original filename (e.g. "Stack n Queue.pptx" or "real_os_multipage.pdf")
    for doc in all_docs:
        fn = doc.get("original_filename", "")
        if fn and fn.lower() in q_lower:
            if not any(d["id"] == doc["id"] for d in matched_docs):
                matched_docs.append(doc)


    # 2. Check stem match when accompanied by document reference cues
    if not matched_docs:
        for doc in all_docs:
            fn = doc.get("original_filename", "")
            if not fn:
                continue
            stem = Path(fn).stem.lower()
            stem_clean = re.sub(r'^(?:real_|sample_)', '', stem).strip()
            stem_words = stem_clean.replace('_', ' ').replace('-', ' ').strip()
            candidates = {stem, stem_clean, stem_words}

            matched = False
            for cand in candidates:
                if len(cand) < 4:
                    continue
                cues = [
                    f"according to {cand}",
                    f"based on {cand}",
                    f"per {cand}",
                    f"in {cand}",
                    f"from {cand}",
                    f"refer to {cand}",
                    f"{cand} slides",
                    f"{cand} document",
                    f"{cand} file",
                    f"{cand} presentation",
                    f"{cand} notes",
                    f"{cand} note",
                    f"professor's {cand}",
                    f"prof's {cand}",
                    f"prof {cand}",
                    f"the {cand}",
                ]
                if any(c in q_lower for c in cues) or (
                    cand in q_lower
                    and cand not in GENERIC_DOC_REFERENCE_TERMS
                    and len(cand.split()) >= 2
                ):
                    matched = True
                    break

            if matched and not any(d["id"] == doc["id"] for d in matched_docs):
                matched_docs.append(doc)


    # 3. If no uploaded document matched, check if query explicitly asked for an unknown/non-existent document
    missing_doc_name = None
    # A) Check for filename with standard document extension
    ext_matches = re.findall(
        r'\b([A-Za-z0-9_\-]+\.(?:pdf|pptx?|docx?|txt|md|png|jpe?g))\b',
        question,
        re.IGNORECASE,
    )
    for m in ext_matches:
        if not any(d.get("original_filename", "").lower() == m.lower() for d in all_docs):
            missing_doc_name = m
            break

    # B) Check for explicit "according to <X>" or "in file <X>" reference cues
    if not missing_doc_name:
        cue_matches = re.findall(
            r'(?:according to|based on|per|in the file|in the document|from the file|from the document)\s+["\'`]?([A-Za-z0-9_\-\.\s]{3,40}?)["\'`]?(?:,|\.|\?|!|\s+what|\s+how|\s+explain|\s+is|\s+are|\s+can|\s+does|\s*$)',
            question,
            re.IGNORECASE,
        )
        for c in cue_matches:
            c_clean = c.strip()
            if (
                c_clean.lower() not in GENERIC_DOC_REFERENCE_TERMS
                and not any(
                    d.get("original_filename", "").lower() in c_clean.lower()
                    or Path(d.get("original_filename", "")).stem.lower() in c_clean.lower()
                    for d in all_docs
                )
            ):
                missing_doc_name = c_clean
                break

    doc_to_strip = None
    if matched_docs:
        doc_to_strip = matched_docs[0].get("original_filename", "")
    elif missing_doc_name:
        doc_to_strip = missing_doc_name

    # Compute focused question by stripping reference to the specific document
    focused_q = question.strip()
    if doc_to_strip:
        stem = Path(doc_to_strip).stem
        pattern_names = f"(?:{re.escape(doc_to_strip)}|{re.escape(stem)})"
        # Strip leading "According to <doc>, " or "In <doc>, "
        focused_q = re.sub(
            rf'^\s*(?:according to|based on|per|refer to|\bin\b|\bfrom\b)\s+["\'`]?{pattern_names}["\'`]?[,;]?\s*',
            '',
            focused_q,
            flags=re.IGNORECASE,
        ).strip()
        # Strip trailing " according to <doc>?" or " in <doc>?"
        focused_q = re.sub(
            rf'[,;]?\s*(?:according to|based on|per|refer to|\bin\b|\bfrom\b)\s+["\'`]?{pattern_names}["\'`]?\s*(\?|\!|\.|$)',
            r'\1',
            focused_q,
            flags=re.IGNORECASE,
        ).strip()

    if len(focused_q) < 5:
        focused_q = question.strip()

    # If matched docs found in course library
    if matched_docs:
        indexed_ids = [d["id"] for d in matched_docs if d.get("processing_status") == "indexed"]
        doc_name = matched_docs[0].get("original_filename", "Specified Document")
        if not indexed_ids:
            # Document exists in repository but is not indexed or failed processing
            return None, doc_name, doc_name, focused_q
        return indexed_ids, doc_name, None, focused_q

    if missing_doc_name:
        return None, None, missing_doc_name, focused_q

    return None, None, None, focused_q


NUMBER_WORDS = {
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "first", "second", "third", "fourth", "fifth", "each", "every", "all", "some",
    "many", "few", "several", "both", "either", "neither", "exact"
}


def resolve_conversational_query(
    question: str,
    history: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[str, bool, List[str]]:
    """
    Intelligently determines whether the current query is an independent topic
    or an anaphoric follow-up continuation of the previous turn.

    Guarantees:
    - Never pollutes an independent query with previous topic keywords.
    - Accurately enhances genuine follow-ups (e.g. 'What are its operations?', 'Why?', 'How can it be avoided?')
      with the primary entity from previous turns.

    Returns:
        (retrieval_query, is_followup, evaluation_terms)
    """
    q_lower = question.lower().strip()
    words = [w.strip("?.!,\"';:") for w in q_lower.split()]
    tokens = [t for t in re.findall(r'[a-zA-Z0-9\*\+\#\-]+', q_lower) if t not in COMMON_STOPWORDS and len(t) > 1]
    specialized = [t for t in tokens if t not in GENERIC_DOMAIN_TERMS and t not in NUMBER_WORDS and not t.isdigit() and len(t) > 2]

    anaphoric_pronouns = {"it", "its", "they", "them", "their", "this", "that", "these", "those"}
    continuation_cues = {"why", "how", "what else", "more", "another", "second", "difference", "differ", "compare", "avoid", "avoided", "prevent"}

    has_anaphora = any(w in anaphoric_pronouns for w in words)
    is_short_continuation = len(words) <= 5 and any(w in continuation_cues for w in words)

    # If query has strong substantive specialized terms and does not use anaphora to replace the subject,
    # it is an INDEPENDENT query and must NOT inherit past conversation context!
    if specialized and not has_anaphora:
        return question, False, specialized

    if not history:
        return question, False, specialized or tokens

    # Retrieve prior user queries to find the antecedent topic entity
    prior_user_questions = [m.get("content", "") for m in history if m.get("role") == "user"]
    if not prior_user_questions:
        return question, False, specialized or tokens

    # Find the nearest substantive topic across prior turns
    prior_entities = []
    for prev_q in reversed(prior_user_questions):
        prev_tokens = [t for t in re.findall(r'[a-zA-Z0-9\*\+\#\-]+', prev_q.lower()) if t not in COMMON_STOPWORDS and len(t) > 1]
        prev_spec = [t for t in prev_tokens if t not in GENERIC_DOMAIN_TERMS and t not in NUMBER_WORDS and not t.isdigit() and len(t) > 2]
        for s in prev_spec:
            if s not in prior_entities:
                prior_entities.append(s)
        if len(prior_entities) >= 2:
            break

    prior_context = " ".join(prior_entities) if prior_entities else ""


    if prior_context and (has_anaphora or is_short_continuation or len(tokens) <= 1):
        enhanced_query = f"{prior_context} {question}"
        eval_terms = list(dict.fromkeys(prior_entities + (specialized or tokens)))
        return enhanced_query, True, eval_terms

    return question, False, specialized or tokens




def hybrid_rerank_and_filter(
    query: str,
    chunks: List[Dict[str, Any]],
    specialized_terms: List[str],
    min_sim: float = RETRIEVAL_SIMILARITY_THRESHOLD,
    top_k: int = 4,
) -> List[Dict[str, Any]]:
    """
    Reranks candidate chunks by combining vector semantic similarity with
    specialized query keyword overlap and title matches.
    Strictly filters out false-positive nearest neighbors that have zero term overlap.
    """
    if not chunks:
        return []

    survivors = []
    for c in chunks:
        base_sim = float(c.get("similarity_score", 0.0))
        if base_sim < min_sim:
            continue

        text = (c.get("section_title", "") + " " + c.get("text", "")).lower()
        title = (c.get("section_title", "") or "").lower()

        overlap_count = 0
        title_matches = 0
        for t in specialized_terms:
            stem = get_word_stem(t)
            if t in title or (len(stem) >= 3 and stem in title):
                title_matches += 1
                overlap_count += 1
            elif t in text or (len(stem) >= 3 and stem in text):
                overlap_count += 1

        # False-positive nearest neighbor filter:
        # If the query contains specialized topic terms, discard candidate chunks that have
        # zero overlap unless base similarity is exceptionally high (>= 0.65)
        if specialized_terms and overlap_count == 0 and base_sim < 0.65:
            continue

        overlap_ratio = overlap_count / len(specialized_terms) if specialized_terms else 0.0
        title_ratio = title_matches / len(specialized_terms) if specialized_terms else 0.0

        rerank_score = 0.4 * base_sim + 0.4 * overlap_ratio + 0.2 * title_ratio
        c_copy = dict(c)
        c_copy["rerank_score"] = rerank_score
        c_copy["is_relevant"] = True
        survivors.append(c_copy)

    survivors.sort(key=lambda x: x["rerank_score"], reverse=True)
    return survivors[:top_k]


class RAGService:
    """
    Core RAG Pipeline Orchestrator.
    Enforces the rule: THE UPLOADED COURSE MATERIAL IS THE EXCLUSIVE SOURCE OF TRUTH.
    Refuses out-of-domain queries without invoking the LLM to prevent hallucinations and save cost.
    """

    def __init__(self):
        self.vector_store = vector_store
        self.prompt_service = prompt_service
        self.llm_service = llm_service
        self.citation_service = citation_service
        self.conversation_service = conversation_service

    def answer_question(
        self,
        question: str,
        session_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,
        top_k: Optional[int] = None,
        similarity_threshold: Optional[float] = None,
    ) -> ChatResponse:
        """
        Executes the complete end-to-end RAG pipeline:
        1. Query retrieval with conversation context expansion
        2. Strict evidence thresholding (Refusal if score < threshold or topic uncovered)
        3. Grounded prompt assembly
        4. LLM synthesis
        5. Citation validation
        """
        cleaned_question = question.strip()
        if not cleaned_question:
            raise ValueError("Question cannot be empty.")

        active_session_id = session_id or str(uuid.uuid4())
        effective_top_k = top_k or MAX_CONTEXT_CHUNKS
        effective_threshold = (
            similarity_threshold
            if similarity_threshold is not None
            else RETRIEVAL_SIMILARITY_THRESHOLD
        )

        now_iso = datetime.now(timezone.utc).isoformat()

        # Step 0: Dynamic Named-Document Resolution & Isolation
        all_docs = DocumentService.get_all_documents()
        (
            named_doc_ids,
            matched_doc_name,
            missing_doc_name,
            focused_question,
        ) = resolve_query_document_context(cleaned_question, all_docs)

        # Requirement 3: If explicitly requested document cannot be retrieved or does not exist,
        # return genuine "Not Covered" refusal immediately instead of using another unrelated document!
        if missing_doc_name:
            logger.info("Query explicitly requested unavailable document '%s'; returning strict refusal.", missing_doc_name)
            refusal_answer = (
                f"I couldn't find the document \"{missing_doc_name}\" in your uploaded course materials, "
                f"so I won't guess. Strict grounding prevents answering from unrelated documents. "
                f"Please upload \"{missing_doc_name}\" in the Materials section to study from it."
            )
            self.conversation_service.add_message(
                session_id=active_session_id,
                role="user",
                content=cleaned_question,
                status="not_covered",
            )
            self.conversation_service.add_message(
                session_id=active_session_id,
                role="assistant",
                content=refusal_answer,
                status="not_covered",
            )
            return ChatResponse(
                status="not_covered",
                answer=refusal_answer,
                query=cleaned_question,
                session_id=active_session_id,
                is_grounded=False,
                is_multi_source=False,
                sources_count=0,
                sources=[],
                best_similarity_score=0.0,
                similarity_threshold=effective_threshold,
                retrieved_chunks_count=0,
                created_at=now_iso,
                has_conflicts=False,
                model_name=self.llm_service.model_name,
                message=f"Document '{missing_doc_name}' is not present or not indexed in course materials.",
            )

        # Determine effective document scoping
        effective_document_ids = document_ids
        if named_doc_ids:
            if effective_document_ids:
                effective_document_ids = [did for did in effective_document_ids if did in named_doc_ids]
                if not effective_document_ids:
                    effective_document_ids = named_doc_ids
            else:
                effective_document_ids = named_doc_ids

        # 1. Fetch recent conversation history
        history = self.conversation_service.get_history(active_session_id)

        # Contextual query resolution (independent topic vs. follow-up)
        retrieval_query, is_followup, eval_terms = resolve_conversational_query(
            focused_question if named_doc_ids else cleaned_question,
            history,
        )

        # 2. Semantic retrieval from ChromaDB (with strict document isolation if document named)
        search_results = self.vector_store.search(
            query=retrieval_query,
            top_k=max(effective_top_k * 2, 8),
            similarity_threshold=effective_threshold,
            document_ids=effective_document_ids,
        )

        has_evidence = search_results.get("has_sufficient_evidence", False)
        best_score = float(search_results.get("best_similarity_score", 0.0))
        retrieved_chunks = search_results.get("results", [])

        # Enforce strict document isolation: never keep chunks outside effective_document_ids
        if effective_document_ids:
            retrieved_chunks = [c for c in retrieved_chunks if c.get("document_id") in effective_document_ids]

        # 3. Hybrid Reranking and False-Positive Nearest Neighbor Filtering
        candidate_chunks = hybrid_rerank_and_filter(
            query=retrieval_query,
            chunks=retrieved_chunks,
            specialized_terms=eval_terms,
            min_sim=effective_threshold,
            top_k=effective_top_k,
        )

        # 4. Strict topic coverage check against current query intent (evaluated on enhanced intent only for genuine follow-ups)
        coverage_query = retrieval_query if is_followup else (focused_question if named_doc_ids else cleaned_question)
        topic_covered = has_topic_coverage(coverage_query, candidate_chunks)


        # 5. Grounding Refusal Check (Threshold & Topic Coverage Enforcement)
        if not has_evidence or not candidate_chunks or not topic_covered:
            target_scope = f"in '{matched_doc_name}'" if matched_doc_name else "in your uploaded course materials"
            logger.info(
                "Refusal triggered: query '%s' has insufficient evidence %s (best score: %.4f < %.2f, covered: %s)",
                cleaned_question,
                target_scope,
                best_score,
                effective_threshold,
                topic_covered,
            )

            refusal_answer = (
                f"I couldn't find enough information about \"{focused_question}\" {target_scope}, "
                f"so I won't guess. Strict grounding ensures you only study verified exam facts. "
                f"You can upload additional lecture slides, readings, or notes covering this topic in the Materials section."
            )

            self.conversation_service.add_message(
                session_id=active_session_id,
                role="user",
                content=cleaned_question,
                status="not_covered",
            )
            self.conversation_service.add_message(
                session_id=active_session_id,
                role="assistant",
                content=refusal_answer,
                status="not_covered",
            )

            return ChatResponse(
                status="not_covered",
                answer=refusal_answer,
                query=cleaned_question,
                session_id=active_session_id,
                is_grounded=False,
                is_multi_source=False,
                sources_count=0,
                sources=[],
                best_similarity_score=best_score,
                similarity_threshold=effective_threshold,
                retrieved_chunks_count=len(candidate_chunks),
                created_at=now_iso,
                has_conflicts=False,
                model_name=self.llm_service.model_name,
                message=f"No sufficiently relevant material found {target_scope}.",
            )

        # 5. Build grounded prompt
        system_prompt = self.prompt_service.get_system_prompt()
        user_prompt = self.prompt_service.build_user_prompt(
            question=cleaned_question,
            retrieved_chunks=candidate_chunks,
            conversation_history=history,
        )

        # 6. Generate answer via LLM
        try:
            raw_answer = self.llm_service.generate_answer(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
        except Exception as err:
            logger.error("LLM generation error: %s", err)
            raise RuntimeError(f"Failed to generate answer from course material: {str(err)}")

        # Sanitize any private-use unicode glyphs from generated response
        raw_answer = re.sub(r'[\ue000-\uf8ff]', '', raw_answer)

        # 7. Post-generation refusal check
        lower_ans = raw_answer.lower()
        if (
            "does not contain sufficient information" in lower_ans
            or "not covered in the provided" in lower_ans
            or "not adequately cover" in lower_ans
        ):
            status = "insufficient_evidence"
            is_grounded = False
        else:
            status = "grounded"
            is_grounded = True

        # 8. Build and validate citations strictly against ChromaDB chunks
        citations: List[CitationModel] = self.citation_service.build_trusted_citations(
            retrieved_chunks=candidate_chunks,
            llm_answer=raw_answer,
        )

        # Enforce strict document isolation: never cite outside effective_document_ids
        if effective_document_ids:
            citations = [c for c in citations if c.document_id in effective_document_ids]

        # Strict validation fallback gate
        if is_grounded and not citations:
            logger.warning("All candidate citations failed integrity verification for '%s'. Downgrading to safe refusal.", cleaned_question)
            status = "insufficient_evidence"
            is_grounded = False
            raw_answer = (
                "Reference materials were retrieved, but citation validation could not verify that "
                "authoritative course passages directly support this specific answer. "
                "To preserve strict exam study reliability, unverified claims have been safely withheld."
            )

        # Check multi-document synthesis
        unique_docs = {c.document_id for c in citations}
        is_multi_source = len(unique_docs) > 1

        # Check for potential contradictions
        has_conflicts = (
            "conflict" in lower_ans
            or "differing information" in lower_ans
            or "discrepancy" in lower_ans
            or "whereas" in lower_ans
        )

        # 9. Update conversation memory
        self.conversation_service.add_message(
            session_id=active_session_id,
            role="user",
            content=cleaned_question,
            status=status,
        )
        self.conversation_service.add_message(
            session_id=active_session_id,
            role="assistant",
            content=raw_answer,
            status=status,
        )

        return ChatResponse(
            status=status,
            answer=raw_answer,
            query=cleaned_question,
            session_id=active_session_id,
            is_grounded=is_grounded,
            is_multi_source=is_multi_source,
            sources_count=len(citations),
            sources=citations,
            best_similarity_score=best_score,
            similarity_threshold=effective_threshold,
            retrieved_chunks_count=len(candidate_chunks),
            created_at=now_iso,
            has_conflicts=has_conflicts,
            model_name=self.llm_service.model_name,
        )


# Global singleton instance
rag_service = RAGService()
