# "The Night Before" - Evaluation Benchmark Suite

This directory contains the standardized evaluation benchmark dataset, evaluation runner, and demonstration checklist for **"The Night Before"** AI study assistant.

---

## 🎯 Benchmark Overview & Composition

The evaluation dataset (`questions.json`) strictly adheres to the competition specifications:

| Category | Count | Primary Objective |
| :--- | :---: | :--- |
| **Single-Document Answerable** | **10** | Verify that direct factual, conceptual, paraphrased, "why", "how", and handwritten questions are answered strictly using one source. |
| **Multi-Document Answerable** | **10** | Verify that questions requiring synthesis across $\ge 2$ documents (e.g. PDF + PPTX, PDF + Syllabus text, PDF + Handwritten notes) correctly retrieve and cite all sources. |
| **Not-Covered (Refusal)** | **10** | Verify that plausible syllabus topics absent from the uploaded corpus are **strictly refused** with `status = "not_covered"` without outside LLM guessing. |
| **Handwritten Notes** | **$\ge 2$** | Verify that questions on handwritten/scanned notes retrieve OCR transcripts and allow visual inspection of original scans. |
| **Multi-Turn Conversations** | **3 Threads** | Verify that follow-up questions ("What data structure does it use?", "How can it be avoided?") maintain context without treating past AI answers as source material. |
| **Total Test Queries** | **30 + 8 turns** | Comprehensive test coverage across all modalities. |

---

## 🚀 How to Run the Benchmark

From the project root:

```powershell
.\backend\.venv\Scripts\python.exe evaluation\run_evaluation.py
```

Or from the `backend/` directory:
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python ..\evaluation\run_evaluation.py
```

---

## 📊 Measured Evaluation Metrics

The benchmark runner tests and reports:

1. **Answerable Question Success ($X / 20$):**
   Percentage of answerable questions that receive a `status = "grounded"` response containing verified factual concepts.
2. **Correct Source Citation ($X / 20$):**
   Percentage of answers where the cited document matches the authoritative ground truth document.
3. **Correct Page/Slide Coordinates ($X / 20$):**
   Verification that page numbers ($\ge 1$) and slide numbers ($\ge 1$) are valid coordinates matching the source document.
4. **Multi-Document Synthesis Success ($X / 10$):**
   Percentage of multi-document queries that retrieve and synthesize $\ge 2$ distinct documents.
5. **Mandatory Refusal Rate ($X / 10$):**
   Percentage of unanswerable/out-of-domain questions that receive `status = "not_covered"` with zero citations.
6. **Handwritten Note Grounding ($X / 4$):**
   Verification that questions targeting scanned notes retrieve `real_handwritten_note.png` with `is_handwritten = True`.
7. **Multi-Turn Conversation Success ($X / 3$ Threads):**
   Verification that context is preserved across sequential turns.
8. **End-to-End Latency:**
   Measured query execution latency (average and per-test).

---

## 🛡️ Grounding Policy: What the System Does When Evidence is Missing

In **"The Night Before"**, course materials uploaded by the student are the **exclusive source of truth**:

1. **Pre-LLM Refusal Gate:**
   - If the vector retrieval similarity score is below the relevance threshold ($0.35$), or
   - If key non-generic topic terms from the student question (e.g. `A*`, `Paxos`, `MapReduce`) do not appear in any retrieved chunk,
   $\rightarrow$ The system refuses **before** calling the LLM. This guarantees $0\%$ hallucination risk and saves API costs.
2. **Post-LLM Safety Gate:**
   - If the LLM indicates that the provided source passages do not adequately cover the specific detail, the status is set to `insufficient_evidence`.
3. **Citation Integrity Gate:**
   - If zero retrieved citations pass metadata and coordinate verification, any answer text is withheld, returning a safe explanation to the student.
4. **Calm UI Experience:**
   - The student sees a calm amber notice explaining that the topic was evaluated across all indexed materials but no authoritative match was found, encouraging them to upload the relevant lecture or reading.
