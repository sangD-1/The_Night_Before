import time
from typing import List, Dict, Any
from app.services.retrieval import vector_store

TEST_CASES = [
    # 1. Exact Course Questions
    {
        "category": "Exact Query",
        "query": "What are the four Coffman conditions for deadlock?",
        "expected_doc": "real_os_multipage.pdf",
        "expected_page": 2,
        "should_retrieve": True,
    },
    {
        "category": "Exact Query",
        "query": "How does virtual memory paging handle page faults?",
        "expected_doc": "real_os_multipage.pdf",
        "expected_page": 3,
        "should_retrieve": True,
    },
    {
        "category": "Exact Query",
        "query": "What is a process control block PCB and process states?",
        "expected_doc": "real_os_multipage.pdf",
        "expected_page": 1,
        "should_retrieve": True,
    },

    # 2. Paraphrased Questions
    {
        "category": "Paraphrased Query",
        "query": "How can an operating system break circular wait to stop deadlocks?",
        "expected_doc": "real_os_multipage.pdf",
        "expected_page": 2,
        "should_retrieve": True,
    },
    {
        "category": "Paraphrased Query",
        "query": "What algorithm uses a queue to visit neighbor vertices level by level?",
        "expected_doc": "real_graph_slides.pptx",
        "expected_slide": 2,
        "should_retrieve": True,
    },
    {
        "category": "Paraphrased Query",
        "query": "Why do we eliminate transitive functional dependencies in database schemas?",
        "expected_doc": "real_dbms_normalization.md",
        "expected_page": 4,
        "should_retrieve": True,
    },

    # 3. Slide-Specific Questions
    {
        "category": "Slide Specific",
        "query": "Breadth-First Search time complexity O(V + E) using FIFO queue",
        "expected_doc": "real_graph_slides.pptx",
        "expected_slide": 2,
        "should_retrieve": True,
    },
    {
        "category": "Slide Specific",
        "query": "Depth-First Search topological sorting and cycle detection via LIFO stack",
        "expected_doc": "real_graph_slides.pptx",
        "expected_slide": 3,
        "should_retrieve": True,
    },

    # 4. Markdown/Text Heading Questions
    {
        "category": "Markdown / Text Notes",
        "query": "First Normal Form 1NF requires each attribute column to contain atomic values",
        "expected_doc": "real_dbms_normalization.md",
        "expected_page": 2,
        "should_retrieve": True,
    },
    {
        "category": "Markdown / Text Notes",
        "query": "Second Normal Form 2NF eliminate partial functional dependencies on composite primary keys",
        "expected_doc": "real_dbms_normalization.md",
        "expected_page": 3,
        "should_retrieve": True,
    },
    {
        "category": "Markdown / Text Notes",
        "query": "CS301 Course Syllabus Exam Checklist Monolithic Microkernel",
        "expected_doc": "real_syllabus_review.txt",
        "should_retrieve": True,
    },

    # 5. Scanned / Image Note Questions
    {
        "category": "Scanned Note",
        "query": "Handwritten course note summary formula diagram",
        "expected_doc": "real_handwritten_note.png",
        "should_retrieve": True,
    },

    # 6. Out-of-Domain / Negative Queries (Must be rejected under threshold 0.35)
    {
        "category": "Negative / Out-of-Domain",
        "query": "How to bake a chocolate chip sourdough bread recipe with yeast?",
        "should_retrieve": False,
    },
    {
        "category": "Negative / Out-of-Domain",
        "query": "Photosynthesis light-dependent reactions in chloroplast thylakoid membrane",
        "should_retrieve": False,
    },
    {
        "category": "Negative / Out-of-Domain",
        "query": "Tennis court oath and storming of the bastille in french revolution 1789",
        "should_retrieve": False,
    },
    {
        "category": "Negative / Out-of-Domain",
        "query": "Offside rule violation penalties in association football FIFA soccer",
        "should_retrieve": False,
    },
]


def evaluate_system():
    print("=" * 80)
    print("THE NIGHT BEFORE - STEP 6 RETRIEVAL EVALUATION BENCHMARK")
    print("=" * 80)

    stats = vector_store.get_stats()
    print(f"Collection Name:       {stats['collection_name']}")
    print(f"ChromaDB Directory:    {stats['persist_directory']}")
    print(f"Total Chunks in DB:    {stats['total_chunks_in_vector_store']}")
    print(f"Indexed Documents:     {stats['indexed_documents_count']}")
    print(f"Embedding Model:       {stats['embedding_model']} ({stats['embedding_dimension']} dim)")
    print(f"Relevance Threshold:   {stats['similarity_threshold']}")
    print("-" * 80)

    positive_queries = [tc for tc in TEST_CASES if tc["should_retrieve"]]
    negative_queries = [tc for tc in TEST_CASES if not tc["should_retrieve"]]

    top1_hits = 0
    top3_hits = 0
    top5_hits = 0
    correct_rejections = 0

    latencies = []

    for i, tc in enumerate(TEST_CASES, 1):
        q = tc["query"]
        start_time = time.perf_counter()
        res = vector_store.search(q, top_k=5)
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        latencies.append(elapsed_ms)

        print(f"\n[{i}/{len(TEST_CASES)}] [{tc['category']}]")
        print(f"Query: \"{q}\"")
        print(f"Latency: {elapsed_ms:.2f} ms | Sufficient Evidence: {res['has_sufficient_evidence']} | Best Score: {res['best_similarity_score']}")

        if tc["should_retrieve"]:
            expected_doc = tc["expected_doc"]
            expected_page = tc.get("expected_page")
            expected_slide = tc.get("expected_slide")

            retrieved = res["results"]
            doc_matches = [
                idx for idx, r in enumerate(retrieved)
                if expected_doc in r["document_name"]
            ]

            is_top1 = False
            is_top3 = False
            is_top5 = False

            if doc_matches:
                first_idx = doc_matches[0]
                if first_idx == 0:
                    is_top1 = True
                    is_top3 = True
                    is_top5 = True
                elif first_idx < 3:
                    is_top3 = True
                    is_top5 = True
                elif first_idx < 5:
                    is_top5 = True

            if is_top1:
                top1_hits += 1
            if is_top3:
                top3_hits += 1
            if is_top5:
                top5_hits += 1

            status_mark = "PASS (Top-1)" if is_top1 else "PASS (Top-3)" if is_top3 else "PASS (Top-5)" if is_top5 else "FAIL"
            print(f"Target Doc: {expected_doc} -> {status_mark}")
            if retrieved:
                top_hit = retrieved[0]
                print(f"  Top-1 Retrieved: {top_hit['citation_label']} (Score: {top_hit['similarity_score']}, Distance: {top_hit['cosine_distance']})")
                print(f"  Snippet: \"{top_hit['text'][:85]}...\"")
        else:
            # Negative case: must have has_sufficient_evidence == False
            if not res["has_sufficient_evidence"]:
                correct_rejections += 1
                status_mark = "PASS (Correctly Rejected Out-of-Domain)"
            else:
                status_mark = "FAIL (False Positive - Exceeded Threshold)"
            print(f"Out-of-Domain Check: {status_mark}")
            if res["results"]:
                print(f"  Top Candidate Score: {res['results'][0]['similarity_score']} (Threshold: {stats['similarity_threshold']})")

    # Metrics computation
    total_pos = len(positive_queries)
    total_neg = len(negative_queries)

    top1_acc = (top1_hits / total_pos) * 100 if total_pos else 0
    top3_acc = (top3_hits / total_pos) * 100 if total_pos else 0
    top5_acc = (top5_hits / total_pos) * 100 if total_pos else 0
    rejection_rate = (correct_rejections / total_neg) * 100 if total_neg else 0
    avg_latency = sum(latencies) / len(latencies) if latencies else 0

    print("\n" + "=" * 80)
    print("FINAL BENCHMARK PERFORMANCE RESULTS")
    print("=" * 80)
    print(f"Total Test Queries:            {len(TEST_CASES)}")
    print(f"In-Domain Test Queries:        {total_pos}")
    print(f"Out-of-Domain Negative Queries:{total_neg}")
    print(f"Top-1 Retrieval Accuracy:      {top1_acc:.1f}% ({top1_hits}/{total_pos})")
    print(f"Top-3 Retrieval Accuracy:      {top3_acc:.1f}% ({top3_hits}/{total_pos})")
    print(f"Top-5 Retrieval Accuracy:      {top5_acc:.1f}% ({top5_hits}/{total_pos})")
    print(f"Negative Rejection Accuracy:   {rejection_rate:.1f}% ({correct_rejections}/{total_neg})")
    print(f"Average Retrieval Latency:     {avg_latency:.2f} ms")
    print("=" * 80)

    assert top1_acc >= 80.0, f"Top-1 accuracy too low: {top1_acc}%"
    assert top3_acc >= 90.0, f"Top-3 accuracy too low: {top3_acc}%"
    assert rejection_rate == 100.0, f"Negative rejection failed: {rejection_rate}%"
    print("\nALL VERIFICATION CRITERIA PASSED SUCCESSFULLY!\n")


if __name__ == "__main__":
    evaluate_system()
