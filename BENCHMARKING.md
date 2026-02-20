# LLM Gateway Benchmarking Suite

## What This Is

An automated model evaluation system built into the LLM Gateway that benchmarks every connected LLM provider on standardized tasks — measuring quality, latency, and token efficiency across knowledge, code generation, summarization, reasoning, and instruction following.

This isn't a toy demo. Production LLM systems need to answer: **which model should I route this request to?** The benchmarking suite provides the data to answer that question objectively.

## Why This Matters

### The Problem

Most teams deploying LLMs pick a model based on vibes, marketing, or whatever's trending on X. When you're routing requests across 5+ providers (Ollama, OpenAI, Anthropic, Groq, Together AI), you need actual data:

- Which model handles code generation best?
- Is the 3B parameter local model good enough for simple Q&A, saving you API costs?
- How much latency does each model add?
- Does the "fast" model actually sacrifice quality?

### The Solution

The benchmarking suite runs **14 standardized tasks across 5 categories** against every model in your provider fleet. It scores responses automatically using multiple evaluation strategies, then surfaces the results in a dashboard with comparative charts.

This directly feeds the routing engine — the gateway can use benchmark scores as quality signals when deciding which model handles each request.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                 Benchmark Runner                  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Task     │  │ Provider │  │ Scorer        │  │
│  │ Registry │→ │ Executor │→ │ (4 strategies)│  │
│  │ (14 tasks│  │          │  │               │  │
│  │ 5 cats)  │  │          │  │ contains      │  │
│  └──────────┘  └──────────┘  │ length        │  │
│                              │ format        │  │
│                              │ composite     │  │
│                              └───────┬───────┘  │
│                                      │          │
│  ┌───────────────────────────────────▼────────┐ │
│  │           Result Aggregator                │ │
│  │  Per-model scores, category breakdowns,    │ │
│  │  latency stats, token usage               │ │
│  └────────────────────────────────────────────┘ │
└──────────────────┬───────────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │   REST API         │
         │                    │
         │ GET  /api/benchmarks       │
         │ POST /api/benchmarks/run   │
         │ GET  /api/benchmarks/status│
         │ GET  /api/benchmarks/results│
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │  Dashboard Page    │
         │                    │
         │  - Model scorecards│
         │  - Radar chart     │
         │  - Bar charts      │
         │  - Results table   │
         └────────────────────┘
```

## Benchmark Categories

### 1. Knowledge (MMLU Subset) — 5 tasks

Tests factual recall across disciplines. Modeled after the Massive Multitask Language Understanding benchmark used in academic ML research.

| Task | Tests | Example |
|------|-------|---------|
| Newtonian Mechanics | Physics knowledge | "What is the acceleration due to gravity?" → 9.8 |
| Cell Biology | Science knowledge | "What organelle produces ATP?" → Mitochondria |
| Computer Science | CS fundamentals | "Time complexity of binary search?" → O(log n) |
| Calculus | Math knowledge | "Derivative of x³?" → 3x² |
| World History | Historical facts | "When did WWII end?" → 1945 |

### 2. Code Generation — 3 tasks

Tests the model's ability to write correct, functional code. These are standard interview-level problems.

| Task | Language | Complexity |
|------|----------|------------|
| FizzBuzz | Python | Easy |
| Reverse Linked List | TypeScript | Medium |
| Binary Search | Python | Medium |

### 3. Summarization — 2 tasks

Tests comprehension and concise output. Evaluates both content accuracy and format compliance.

| Task | Input | Expected Output |
|------|-------|-----------------|
| Tech Article | ML paragraph | Exactly 2 sentences |
| Science Summary | Quantum computing text | 3 bullet points |

### 4. Reasoning — 2 tasks

Tests logical deduction and mathematical reasoning.

| Task | Type | Difficulty |
|------|------|------------|
| Logic Puzzle | Syllogism (trick question) | Hard |
| Word Problem | Multi-step arithmetic | Medium |

### 5. Instruction Following — 2 tasks

Tests whether the model follows specific output format constraints.

| Task | Constraint | Scoring |
|------|-----------|---------|
| JSON Output | Must return valid JSON with specific keys | Format validation |
| Numbered List | Must use 1-5 numbered format | Pattern matching |

## Scoring System

Each task uses one of four scoring strategies:

### Contains (most tasks)
Checks if the response contains expected keywords/values. Score = (matched / total expected) * 100.

### Length
Evaluates whether the response meets length/structure requirements (sentence count, word count). Used for summarization tasks.

### Format
Validates structural correctness — parses JSON, checks for required keys, validates output format.

### Composite
Weighted combination of contains (60%) + length (40%). Used when both content accuracy and format matter.

**Scoring formula:**
```
Task Score = 0-100 (per task)
Category Score = average of task scores in that category
Overall Score = average of all task scores
```

## How to Use

### Run from the Dashboard

1. Navigate to `http://localhost:3000/benchmarks`
2. Optionally filter categories using the pill buttons
3. Click "Run Benchmark"
4. Watch the progress bar as models are tested
5. Results appear automatically: scorecards, charts, detailed table

### Run from the API

```bash
# Run full benchmark on all models
curl -X POST http://localhost:4000/api/benchmarks/run

# Run on specific models
curl -X POST http://localhost:4000/api/benchmarks/run \
  -H "Content-Type: application/json" \
  -d '{"models": ["qwen2.5:3b", "deepseek-r1:latest"]}'

# Run specific categories only
curl -X POST http://localhost:4000/api/benchmarks/run \
  -H "Content-Type: application/json" \
  -d '{"categories": ["code-gen", "reasoning"]}'

# Check progress
curl http://localhost:4000/api/benchmarks/status

# Get results
curl http://localhost:4000/api/benchmarks/results
```

### Run from the OpenAI Python SDK

```python
import requests

# Trigger benchmark
requests.post("http://localhost:4000/api/benchmarks/run", json={
    "models": ["qwen2.5:3b"],
    "categories": ["mmlu", "code-gen"]
})

# Poll for results
import time
while True:
    status = requests.get("http://localhost:4000/api/benchmarks/status").json()
    if status["status"] == "completed":
        break
    print(f"Progress: {status['progress']['completed']}/{status['progress']['total']}")
    time.sleep(2)

# Get results
results = requests.get("http://localhost:4000/api/benchmarks/results").json()
for model in results:
    print(f"{model['modelId']}: {model['overallScore']}/100")
    for cat, score in model["categoryScores"].items():
        print(f"  {cat}: {score}%")
```

## What the Dashboard Shows

### Model Scorecards
Each model gets a card showing:
- Overall score (0-100)
- Per-category progress bars (color-coded: green ≥80, yellow ≥50, red <50)
- Average latency per task
- Total tokens consumed
- "Best" badge for the highest scorer

### Radar Chart
Spider/radar chart showing each model's performance across all 5 categories. Instantly reveals strengths and weaknesses — a model might ace code gen but fail at reasoning.

### Overall Score Bar Chart
Horizontal bar chart ranking all models by overall score. Quick comparison view.

### Latency Comparison
Bar chart showing average response time per task for each model. Critical for deciding routing priorities — a model with 95% quality but 10x latency may not be worth it for real-time applications.

### Detailed Results Table
Every task result for every model: score, latency, pass/fail status, and scoring details (e.g., "Matched 1/1: [9.8]"). Full transparency into what worked and what didn't.

## Design Decisions

### Why these specific tasks?

- **MMLU** is the industry-standard knowledge benchmark (we use a curated subset)
- **Code generation** tests are LeetCode-style problems that represent real LLM use cases
- **Summarization** tests comprehension + conciseness — core LLM skills
- **Reasoning** includes a deliberate trick question (the syllogism) to test logical rigor
- **Instruction following** tests format compliance, which is critical for API integration

### Why automated scoring instead of human eval?

Speed and reproducibility. The scoring strategies are designed to be deterministic — you can run the same benchmark twice and get comparable results. Human evaluation doesn't scale when you're comparing 10+ models across 14 tasks.

### Why run benchmarks from the gateway?

The gateway already has provider connections, model discovery, and health monitoring. Running benchmarks through the same infrastructure means you're testing actual production latency, not synthetic benchmarks. The results reflect real-world performance of your specific deployment.

## Technical Implementation

```
src/benchmark/
├── tasks.ts     # 14 benchmark task definitions with prompts, expected values, scoring types
├── scorer.ts    # 4 scoring strategies + result aggregation
└── runner.ts    # Async benchmark executor with progress tracking
```

- **Zero external dependencies** — uses only the existing provider infrastructure
- **Non-blocking** — benchmarks run in the background, progress is polled via API
- **Auto-discovery** — automatically selects representative models per provider (skips embedding models)
- **Tested** — 23 unit tests covering task definitions, all 4 scoring strategies, aggregation, and runner state machine

## How to Showcase This to Employers

### What it demonstrates

1. **Systems thinking** — This isn't just "call an API and display results." It's a full evaluation pipeline: task design → execution → scoring → aggregation → visualization. Each piece has clear interfaces and responsibilities.

2. **Production awareness** — Building benchmarks into the gateway shows you think about model evaluation as a first-class concern, not an afterthought. In production, models degrade, new models ship, and routing decisions need data.

3. **Evaluation methodology** — The 4 scoring strategies (contains, length, format, composite) show understanding of how LLM outputs differ from traditional software testing. You can't just `assertEquals` — you need fuzzy matching, structural validation, and weighted composites.

4. **Full-stack execution** — Backend (TypeScript benchmark engine + REST API) → Frontend (React dashboard with Recharts visualization) → Testing (23 unit tests) → Documentation (this file). End-to-end delivery.

5. **API design** — Clean REST endpoints with proper status codes (202 for async start, 409 for conflict), progress polling, and structured JSON responses.

### Talking points for interviews

- "I built an automated model evaluation system that benchmarks LLMs across 5 categories. The gateway uses these quality scores as a signal for smart routing — it can route simple questions to cheap local models and complex tasks to capable cloud models, backed by actual benchmark data."

- "The scoring system handles the nuance of LLM evaluation — you can't just check equality. I implemented 4 strategies: keyword matching for factual tasks, structural validation for format-constrained outputs, length analysis for summarization, and weighted composites for mixed evaluation."

- "The benchmarks run through the same provider infrastructure as production traffic, so results reflect real-world latency including model loading, network overhead, and provider-specific quirks."

### Portfolio presentation

1. Show the dashboard with results from multiple models
2. Point out how the radar chart reveals model strengths/weaknesses
3. Explain how benchmark scores feed into routing decisions
4. Walk through the scoring code to show evaluation methodology
5. Show the test suite — 93 tests total, 23 specifically for benchmarking
