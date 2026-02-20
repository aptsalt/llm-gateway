export interface BenchmarkTask {
  id: string;
  category: "mmlu" | "code-gen" | "summarization" | "reasoning" | "instruction";
  name: string;
  prompt: string;
  systemPrompt?: string;
  expectedContains?: string[];
  maxTokens: number;
  scoring: "contains" | "length" | "format" | "composite";
}

// MMLU-style knowledge questions (subset)
const MMLU_TASKS: BenchmarkTask[] = [
  {
    id: "mmlu-physics-1",
    category: "mmlu",
    name: "Newtonian Mechanics",
    prompt: "What is the acceleration due to gravity near the Earth's surface? Answer with the numerical value in m/s² only.",
    expectedContains: ["9.8"],
    maxTokens: 50,
    scoring: "contains",
  },
  {
    id: "mmlu-biology-1",
    category: "mmlu",
    name: "Cell Biology",
    prompt: "What organelle is responsible for producing ATP in eukaryotic cells? Answer with a single word.",
    expectedContains: ["mitochondri"],
    maxTokens: 50,
    scoring: "contains",
  },
  {
    id: "mmlu-cs-1",
    category: "mmlu",
    name: "Computer Science",
    prompt: "What is the time complexity of binary search on a sorted array? Answer using Big-O notation only.",
    expectedContains: ["O(log n)", "O(log(n))"],
    maxTokens: 50,
    scoring: "contains",
  },
  {
    id: "mmlu-math-1",
    category: "mmlu",
    name: "Calculus",
    prompt: "What is the derivative of x³ with respect to x? Give only the expression.",
    expectedContains: ["3x²", "3x^2", "3*x^2", "3 x^2"],
    maxTokens: 50,
    scoring: "contains",
  },
  {
    id: "mmlu-history-1",
    category: "mmlu",
    name: "World History",
    prompt: "In what year did World War II end? Answer with just the year.",
    expectedContains: ["1945"],
    maxTokens: 50,
    scoring: "contains",
  },
];

// Code generation tasks
const CODE_GEN_TASKS: BenchmarkTask[] = [
  {
    id: "code-fizzbuzz",
    category: "code-gen",
    name: "FizzBuzz",
    prompt: "Write a Python function called fizzbuzz(n) that returns a list of strings from 1 to n where multiples of 3 are 'Fizz', multiples of 5 are 'Buzz', multiples of both are 'FizzBuzz', and others are the number as a string.",
    expectedContains: ["def fizzbuzz", "Fizz", "Buzz"],
    maxTokens: 300,
    scoring: "contains",
  },
  {
    id: "code-reverse-linked-list",
    category: "code-gen",
    name: "Reverse Linked List",
    prompt: "Write a TypeScript function that reverses a singly linked list. Define a ListNode type with val: number and next: ListNode | null.",
    expectedContains: ["ListNode", "next", "null"],
    maxTokens: 300,
    scoring: "contains",
  },
  {
    id: "code-binary-search",
    category: "code-gen",
    name: "Binary Search",
    prompt: "Write a Python function binary_search(arr, target) that returns the index of the target in a sorted array, or -1 if not found. Use iterative approach.",
    expectedContains: ["def binary_search", "while", "mid", "return"],
    maxTokens: 300,
    scoring: "contains",
  },
];

// Summarization tasks
const SUMMARIZATION_TASKS: BenchmarkTask[] = [
  {
    id: "sum-article-1",
    category: "summarization",
    name: "Tech Article Summary",
    prompt: `Summarize the following in exactly 2 sentences:

Machine learning is a subset of artificial intelligence that focuses on building systems that learn from data. Instead of being explicitly programmed to perform a task, these systems are trained using large amounts of data and algorithms that give them the ability to learn how to perform the task. Machine learning is already being used in a wide range of applications, from email filtering and computer vision to recommendation systems used by Netflix and Amazon. Deep learning, a specialized form of machine learning, uses neural networks with many layers and has driven recent breakthroughs in image recognition, natural language processing, and game playing.`,
    maxTokens: 150,
    scoring: "length",
  },
  {
    id: "sum-article-2",
    category: "summarization",
    name: "Science Summary",
    prompt: `Summarize the following in exactly 3 bullet points:

Quantum computing harnesses quantum mechanical phenomena such as superposition and entanglement to process information. Unlike classical computers that use bits (0 or 1), quantum computers use qubits that can be in multiple states simultaneously. This allows quantum computers to solve certain problems exponentially faster than classical computers. Current applications include cryptography, drug discovery, optimization problems, and materials science. However, quantum computers are still in early stages and face challenges like error correction and qubit stability.`,
    expectedContains: ["-", "quantum"],
    maxTokens: 200,
    scoring: "composite",
  },
];

// Reasoning tasks
const REASONING_TASKS: BenchmarkTask[] = [
  {
    id: "reason-logic-1",
    category: "reasoning",
    name: "Logic Puzzle",
    prompt: "If all roses are flowers, and some flowers fade quickly, can we conclude that some roses fade quickly? Answer Yes or No, then explain in one sentence.",
    expectedContains: ["No"],
    maxTokens: 100,
    scoring: "contains",
  },
  {
    id: "reason-math-1",
    category: "reasoning",
    name: "Word Problem",
    prompt: "A train travels at 60 km/h for 2 hours, then at 90 km/h for 1 hour. What is the total distance traveled? Answer with just the number in km.",
    expectedContains: ["210"],
    maxTokens: 100,
    scoring: "contains",
  },
];

// Instruction-following tasks
const INSTRUCTION_TASKS: BenchmarkTask[] = [
  {
    id: "inst-format-1",
    category: "instruction",
    name: "JSON Output",
    prompt: 'Return a JSON object with keys "name" (string), "age" (number), and "hobbies" (array of strings) for a fictional person. Return ONLY the JSON, no other text.',
    expectedContains: ['"name"', '"age"', '"hobbies"', "["],
    maxTokens: 150,
    scoring: "format",
  },
  {
    id: "inst-list-1",
    category: "instruction",
    name: "Numbered List",
    prompt: "List exactly 5 programming languages. Use a numbered list (1. 2. 3. 4. 5.).",
    expectedContains: ["1.", "2.", "3.", "4.", "5."],
    maxTokens: 150,
    scoring: "contains",
  },
];

export const ALL_BENCHMARK_TASKS: BenchmarkTask[] = [
  ...MMLU_TASKS,
  ...CODE_GEN_TASKS,
  ...SUMMARIZATION_TASKS,
  ...REASONING_TASKS,
  ...INSTRUCTION_TASKS,
];

export const CATEGORIES = ["mmlu", "code-gen", "summarization", "reasoning", "instruction"] as const;

export function getTasksByCategory(category: string): BenchmarkTask[] {
  return ALL_BENCHMARK_TASKS.filter((t) => t.category === category);
}
