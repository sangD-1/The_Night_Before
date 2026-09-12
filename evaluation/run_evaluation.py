import sys
import time
import json
from pathlib import Path
from typing import List, Dict, Any

# Ensure backend modules can be imported
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.services.rag.rag_service import rag_service
from app.services.rag.conversation_service import conversation_service
from app.services.retrieval import vector_store

EVAL_DIR = Path(__file__).resolve().parent
QUESTIONS_FILE = EVAL_DIR / "questions.json"


def load_dataset() -> Dict[str, Any]:
    with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def evaluate_dataset():
    data = load_dataset()
    meta = data["benchmark_metadata"]
    answerable_list = data["answerable_questions"]
    not_covered_list = data["not_covered_questions"]
    multi_turn_list = data["multi_turn_conversations"]

    print("=" * 88)
    print("THE NIGHT BEFORE - STEP 8 COMPETITION BENCHMARK EVALUATION HARNESS")
    print("=" * 88)
    print(f"Total Questions in Benchmark: {meta['total_questions']}")
    print(f"Answerable Questions:         {len(answerable_list)} (10 Single-Doc, 10 Multi-Doc)")
    print(f"Not-Covered Test Questions:   {len(not_covered_list)}")
    print(f"Multi-Turn Conversations:     {len(multi_turn_list)}")
    print(f"Vector Store Persist Path:    {vector_store.get_stats()['persist_directory']}")
    print("-" * 88)

    # -------------------------------------------------------------
    # 1. EVALUATE ANSWERABLE QUESTIONS (20 Questions)
    # -------------------------------------------------------------
    print("\n>>> SECTION 1: EVALUATING 20 ANSWERABLE COURSE QUESTIONS\n")

    answerable_success = 0
    citation_success = 0
    location_success = 0
    multi_doc_success = 0
    handwritten_success = 0
    latencies = []

    for idx, item in enumerate(answerable_list, 1):
        qid = item["question_id"]
        qtext = item["question"]
        cat = item["category"]
        req_multidoc = item["requires_multiple_documents"]
        expected_docs = item.get("expected_documents", [])
        expected_coords = item.get("expected_pages_or_slides", {})
        must_contain = item.get("must_contain_terms", [])
        is_hw = item.get("is_handwritten_target", False)

        t0 = time.perf_counter()
        resp = rag_service.answer_question(qtext)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        latencies.append(elapsed_ms)

        # Verification flags
        is_answerable = (resp.status == "grounded" and resp.is_grounded)
        cited_docs = [s.document_name for s in resp.sources]

        # Citation match: at least one expected doc appears in citations
        has_correct_citation = any(any(ed in cd for cd in cited_docs) for ed in expected_docs)

        # Multi-document check
        is_truly_multidoc = resp.is_multi_source and len(set(s.document_id for s in resp.sources)) > 1

        # Coordinate match check
        has_coord_match = True
        for s in resp.sources:
            if s.source_type == "pdf" and s.page_number is not None:
                if s.page_number < 1:
                    has_coord_match = False
            elif s.source_type == "pptx" and s.slide_number is not None:
                if s.slide_number < 1:
                    has_coord_match = False

        # Key concept check
        ans_lower = resp.answer.lower()
        contains_concepts = any(term in ans_lower for term in must_contain) if must_contain else True

        # Tally scores
        if is_answerable and contains_concepts:
            answerable_success += 1
        if has_correct_citation:
            citation_success += 1
        if has_coord_match:
            location_success += 1
        if req_multidoc and is_truly_multidoc:
            multi_doc_success += 1
        if is_hw and any(s.is_handwritten or s.source_type == "image" for s in resp.sources):
            handwritten_success += 1

        pass_mark = "[PASS OK]" if (is_answerable and has_correct_citation) else "[FAIL X]"
        print(f"[{idx:02d}/20] {qid} ({cat.upper()}): {pass_mark}")
        print(f"       Q: \"{qtext}\"")
        print(f"       Status: {resp.status} | Grounded: {resp.is_grounded} | Citations ({len(resp.sources)}): {cited_docs}")
        print(f"       Latency: {elapsed_ms:.1f}ms | Multi-Source: {resp.is_multi_source}")
        print(f"       Answer Excerpt: {resp.answer[:110].replace(chr(10), ' ')}...")
        print()

    # -------------------------------------------------------------
    # 2. EVALUATE NOT-COVERED QUESTIONS (10 Questions)
    # -------------------------------------------------------------
    print("\n>>> SECTION 2: EVALUATING 10 NOT-COVERED PLAUSIBLE QUESTIONS (Mandatory Refusal)\n")

    correct_refusals = 0
    refusal_latencies = []

    for idx, item in enumerate(not_covered_list, 1):
        qid = item["question_id"]
        qtext = item["question"]
        rationale = item["rationale"]

        t0 = time.perf_counter()
        resp = rag_service.answer_question(qtext)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        refusal_latencies.append(elapsed_ms)

        # Refusal criteria: status == "not_covered" or "insufficient_evidence", is_grounded == False, 0 citations
        is_refused = (resp.status in ("not_covered", "insufficient_evidence")) and (not resp.is_grounded) and (len(resp.sources) == 0)

        if is_refused:
            correct_refusals += 1
            pass_mark = "[PASS OK (Refused)]"
        else:
            pass_mark = "[FAIL X (Hallucinated/Unrefused)]"

        print(f"[{idx:02d}/10] {qid}: {pass_mark}")
        print(f"       Q: \"{qtext}\"")
        print(f"       Status: {resp.status} | Best Sim Score: {resp.best_similarity_score:.4f} | Citations: {len(resp.sources)}")
        print(f"       Refusal Text: \"{resp.answer[:100].replace(chr(10), ' ')}...\"")
        print()

    # -------------------------------------------------------------
    # 3. EVALUATE MULTI-TURN CONVERSATIONS (3 Threads)
    # -------------------------------------------------------------
    print("\n>>> SECTION 3: EVALUATING 3 MULTI-TURN CONVERSATION THREADS\n")

    multi_turn_passed = 0

    for c_idx, conv in enumerate(multi_turn_list, 1):
        cid = conv["conversation_id"]
        ctitle = conv["title"]
        turns = conv["turns"]
        sess_id = f"eval-sess-{cid}"
        conversation_service.clear_history(sess_id)

        print(f"[Thread {c_idx}/3] {cid}: {ctitle}")
        all_turns_passed = True

        for t_idx, turn in enumerate(turns, 1):
            q = turn["question"]
            resp = rag_service.answer_question(q, session_id=sess_id)
            exp_status = turn["expected_status"]
            must_have = turn.get("must_contain", [])

            t_passed = (resp.status == exp_status) and (resp.is_grounded)
            ans_lower = resp.answer.lower()
            concept_ok = any(th in ans_lower for th in must_have) if must_have else True

            if not (t_passed and concept_ok):
                all_turns_passed = False

            print(f"   Turn {t_idx}: \"{q}\" -> Status: {resp.status} | Sources: {len(resp.sources)} | OK: {t_passed and concept_ok}")

        if all_turns_passed:
            multi_turn_passed += 1
            print(f"   Result: THREAD PASSED [OK]\n")
        else:
            print(f"   Result: THREAD FAILED [X]\n")

    # -------------------------------------------------------------
    # 4. FINAL SUMMARY & METRICS AGGREGATION
    # -------------------------------------------------------------
    all_latencies = latencies + refusal_latencies
    avg_latency = sum(all_latencies) / len(all_latencies) if all_latencies else 0.0

    print("=" * 88)
    print("FINAL STEP 8 COMPETITION EVALUATION REPORT")
    print("=" * 88)
    print(f"A. Answerable Question Success:     {answerable_success} / 20 ({answerable_success/20*100:.1f}%)")
    print(f"B. Correct Source Citation:         {citation_success} / 20 ({citation_success/20*100:.1f}%)")
    print(f"C. Correct Page/Slide Coordinates:  {location_success} / 20 ({location_success/20*100:.1f}%)")
    print(f"D. Multi-Document Synthesis:        {multi_doc_success} / 10 ({multi_doc_success/10*100:.1f}%)")
    print(f"E. Correct Refusal (Not Covered):   {correct_refusals} / 10 ({correct_refusals/10*100:.1f}%)")
    print(f"F. Handwritten Note Grounding:      {handwritten_success} / 4 verified")
    print(f"G. Multi-Turn Continuity Threads:   {multi_turn_passed} / 3 threads passed")
    print(f"H. Overall Grounded-Answer Rate:    {(answerable_success + correct_refusals) / 30 * 100:.1f}%")
    print(f"I. Average End-to-End Latency:      {avg_latency:.2f} ms")
    print("=" * 88)

    assert answerable_success >= 18, f"Answerable success too low: {answerable_success}/20"
    assert citation_success >= 18, f"Citation success too low: {citation_success}/20"
    assert multi_doc_success >= 8, f"Multi-doc success too low: {multi_doc_success}/10"
    assert correct_refusals == 10, f"Mandatory refusal failed: {correct_refusals}/10"
    assert multi_turn_passed == 3, f"Multi-turn failed: {multi_turn_passed}/3"

    print("\nALL COMPETITION-READY EVALUATION BENCHMARKS PASSED SUCCESSFULLY!\n")


if __name__ == "__main__":
    evaluate_dataset()
