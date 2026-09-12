// Sample/mock data for frontend demonstration and visual prototyping.
// This structure is designed to be cleanly replaced by backend API payloads in future steps.

export const SAMPLE_MATERIALS = [
  {
    id: 'doc-os-unit1',
    title: 'Operating Systems - Unit 1',
    filename: 'OS_Unit_1_Core_Concepts.pdf',
    type: 'pdf',
    pageCount: 42,
    size: '4.2 MB',
    uploadedAt: 'Yesterday at 4:15 PM',
    status: 'Ready', // 'Ready' | 'Processing' | 'Needs Review'
    summary: 'Covers process lifecycle, CPU scheduling algorithms, and IPC synchronization primitives.',
    tags: ['Processes', 'CPU Scheduling', 'Deadlocks'],
  },
  {
    id: 'doc-prof-notes',
    title: "Professor's Handwritten Notes - Concurrency",
    filename: 'Prof_Chaudhry_Notes_Oct12.jpg',
    type: 'handwritten',
    pageCount: 6,
    size: '8.7 MB',
    uploadedAt: 'Yesterday at 6:40 PM',
    status: 'Needs Review',
    confidenceScore: 92,
    summary: 'Handwritten classroom annotations detailing deadlock prevention vs avoidance and Banker\'s algorithm.',
    tags: ['Handwritten Scan', 'Deadlock Avoidance', 'Banker Algorithm'],
  },
  {
    id: 'doc-graph-algos',
    title: 'Graph Algorithms & Traversal Slides',
    filename: 'CS204_Lecture_06_Graphs.pptx',
    type: 'pptx',
    pageCount: 28,
    size: '6.1 MB',
    uploadedAt: '2 days ago',
    status: 'Ready',
    summary: 'Slide deck on BFS, DFS, cycle detection, topological sorting, and shortest path fundamentals.',
    tags: ['BFS/DFS', 'Graph Theory', 'Time Complexity'],
  },
  {
    id: 'doc-dbms-norm',
    title: 'DBMS Lecture Notes - Normalization',
    filename: 'DBMS_Module_3_Normalization.md',
    type: 'markdown',
    pageCount: 14,
    size: '142 KB',
    uploadedAt: '3 days ago',
    status: 'Ready',
    summary: 'Relational design anomalies, functional dependencies, 1NF, 2NF, 3NF, and BCNF decomposition proofs.',
    tags: ['Functional Dependency', '3NF', 'BCNF'],
  },
]

export const SAMPLE_CITATIONS = {
  'cit-os-p18': {
    id: 'cit-os-p18',
    docId: 'doc-os-unit1',
    docTitle: 'Operating Systems - Unit 1',
    type: 'pdf',
    pageOrSlide: 'Page 18',
    sectionTitle: 'Section 3.2: Coffman Conditions for Deadlock',
    excerpt:
      'A deadlock state can arise if and only if all four Coffman conditions hold simultaneously in the system: (1) Mutual Exclusion, (2) Hold and Wait, (3) No Preemption, and (4) Circular Wait. If any single condition is invalidated, deadlock becomes mathematically impossible.',
    highlights: ['Mutual Exclusion', 'Hold and Wait', 'No Preemption', 'Circular Wait'],
    confidence: 100,
    isHandwritten: false,
  },
  'cit-hw-p2': {
    id: 'cit-hw-p2',
    docId: 'doc-prof-notes',
    docTitle: "Professor's Handwritten Notes - Concurrency",
    type: 'handwritten',
    pageOrSlide: 'Page 2',
    sectionTitle: 'Exam Margin Note: Prevention vs Avoidance',
    excerpt:
      'IMPORTANT FOR EXAM: Prevention eliminates at least ONE Coffman condition statically before runtime (e.g. strict global resource ordering breaks circular wait). Avoidance dynamically inspects resource request vectors (Banker\'s Algorithm) to never enter an unsafe state.',
    highlights: ['Prevention eliminates at least ONE', 'Avoidance dynamically inspects', "Banker's Algorithm"],
    confidence: 92,
    isHandwritten: true,
    originalSnippetText:
      '[Scan: Ruled engineering notebook with dark blue ink]\n"NOTE FOR EXAM:\n- Prevention = eliminate 1 condition statically (e.g., resource ordering!)\n- Avoidance = dynamically check safety state (Banker alg)"',
    extractedOcrText:
      'NOTE FOR EXAM: Prevention = eliminate 1 condition statically (e.g., resource ordering!). Avoidance = dynamically check safety state (Banker alg).',
  },
  'cit-graph-p7': {
    id: 'cit-graph-p7',
    docId: 'doc-graph-algos',
    docTitle: 'Graph Algorithms & Traversal Slides',
    type: 'pptx',
    pageOrSlide: 'Slide 7',
    sectionTitle: 'Slide 7: BFS vs DFS Core Trade-offs',
    excerpt:
      'BFS guarantees finding the shortest path on unweighted graphs using a FIFO queue (Space: O(V)). DFS dives to leaf nodes first using a LIFO stack / recursion, requiring only O(h) space where h is tree height, making it far more memory efficient for deep search trees.',
    highlights: ['BFS guarantees shortest path', 'DFS dives to leaf nodes', 'O(V) vs O(h) space'],
    confidence: 99,
    isHandwritten: false,
  },
}

export const INITIAL_CONVERSATION = [
  {
    id: 'msg-1',
    sender: 'user',
    timestamp: '8:42 AM',
    text: 'What are the conditions for deadlock, and what is the difference between deadlock prevention and deadlock avoidance according to our materials?',
  },
  {
    id: 'msg-2',
    sender: 'assistant',
    timestamp: '8:42 AM',
    isGrounded: true,
    isMultiSource: true,
    sourcesCount: 2,
    sourceIds: ['cit-os-p18', 'cit-hw-p2'],
    summary:
      'Deadlocks require four simultaneous Coffman conditions. Prevention statically eliminates at least one condition, whereas avoidance dynamically verifies state safety during resource allocation.',
    content: `According to your course materials, deadlocks require **four simultaneous conditions** to occur, and the two handling strategies operate at different stages of runtime.

### 1. The Four Coffman Conditions
For a deadlock to arise, all four must hold concurrently:
* **Mutual Exclusion:** At least one resource is held in non-shareable mode.
* **Hold and Wait:** A process holds one resource while waiting for another.
* **No Preemption:** Resources can only be released voluntarily by the holding process.
* **Circular Wait:** A closed chain of processes exists where each process waits for a resource held by the next.

### 2. Prevention vs. Avoidance
Your lecture slides and professor's handwritten annotations highlight this fundamental contrast:

| Strategy | Mechanism | Key Approach Cited |
| :--- | :--- | :--- |
| **Deadlock Prevention** | **Static elimination** of at least one Coffman condition before runtime. | Imposing a strict global resource ordering to eliminate Circular Wait. |
| **Deadlock Avoidance** | **Dynamic runtime verification** of resource request vectors. | Using **Banker's Algorithm** to ensure allocations never transition from a safe state to an unsafe state. |`,
  },
]

export const NOT_COVERED_DEMO_THREAD = [
  {
    id: 'msg-nc-1',
    sender: 'user',
    timestamp: '8:45 AM',
    text: 'Can you give me a distributed Raft or Paxos consensus implementation in Python for my exam?',
  },
  {
    id: 'msg-nc-2',
    sender: 'assistant',
    timestamp: '8:45 AM',
    isNotCovered: true,
    queryTopic: 'Distributed Raft / Paxos Consensus Algorithms',
    attemptedDocuments: [
      'Operating Systems - Unit 1',
      "Professor's Handwritten Notes - Concurrency",
      'Graph Algorithms & Traversal Slides',
      'DBMS Lecture Notes - Normalization',
    ],
    reason:
      'None of your 4 uploaded materials cover distributed consensus, Paxos, or Raft protocols.',
    guidance:
      'Because "The Night Before" is designed with strict grounding, the assistant refuses to answer using unverified external knowledge or potential hallucinations.',
    suggestedActions: [
      'Upload a Distributed Systems lecture deck or notes file.',
      'Ask about local OS concurrency, mutual exclusion, or scheduling (covered in OS Unit 1).',
    ],
  },
]

export const SUGGESTED_QUESTIONS = [
  {
    title: 'Explain deadlock conditions & prevention',
    query: 'What are the conditions for deadlock, and how does prevention differ from avoidance?',
    tag: 'Multi-Source Demo',
    badge: '2 Sources',
  },
  {
    title: 'Compare BFS and DFS complexity',
    query: 'Compare BFS and DFS in terms of time and space complexity based on the slides.',
    tag: 'Slides Citation',
    badge: '1 Source',
  },
  {
    title: 'Demonstrate "Not Covered" Refusal',
    query: 'Can you give me a distributed Raft or Paxos consensus implementation in Python for my exam?',
    tag: 'Strict Grounding',
    badge: 'Refusal Demo',
  },
  {
    title: 'Explain 3NF vs BCNF differences',
    query: 'What are the conditions where a relation is in 3NF but not in BCNF according to the DBMS notes?',
    tag: 'DBMS Notes',
    badge: '1 Source',
  },
]
