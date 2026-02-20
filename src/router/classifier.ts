import type { ModelCapability } from "../providers/interface.js";

export type ComplexityLevel = "simple" | "moderate" | "complex";

export interface ClassificationResult {
  complexity: ComplexityLevel;
  requiredCapabilities: ModelCapability[];
  estimatedTokens: number;
  reasoning: string;
}

const CODE_PATTERNS = [
  /\b(function|class|interface|import|export|const|let|var|return|async|await)\b/,
  /\b(def |for .* in |lambda |print\()/,
  /[{}\[\]();]/,
  /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i,
  /```[\s\S]*```/,
  /\b(write|code|implement|debug|fix|refactor|program|script)\b/i,
];

const MATH_PATTERNS = [
  /\b(calculate|compute|solve|equation|formula|integral|derivative|matrix|vector)\b/i,
  /\b(sum|product|average|mean|median|probability|statistics)\b/i,
  /[+\-*/^=<>]+.*\d+/,
  /\b\d+\s*[+\-*/^]\s*\d+\b/,
];

const CREATIVE_PATTERNS = [
  /\b(write|compose|create|generate|draft|story|poem|essay|article|blog)\b/i,
  /\b(creative|imaginative|fiction|narrative|character|plot)\b/i,
];

const SIMPLE_PATTERNS = [
  /^(hi|hello|hey|sup|yo|greetings|good (morning|afternoon|evening))\b/i,
  /^(what is|who is|when was|where is|how old)\b/i,
  /^(yes|no|ok|okay|sure|thanks|thank you)\b/i,
  /\?$/,
];

export function classifyRequest(
  messages: Array<{ role: string; content: string }>
): ClassificationResult {
  const lastUserMessage = messages.filter((m) => m.role === "user").pop()?.content ?? "";
  const fullText = messages.map((m) => m.content).join("\n");
  const totalLength = fullText.length;
  const messageCount = messages.length;

  const capabilities: ModelCapability[] = ["general"];
  let complexityScore = 0;
  const reasons: string[] = [];

  // Check for code-related content
  const codeMatches = CODE_PATTERNS.filter((p) => p.test(fullText)).length;
  if (codeMatches >= 2) {
    capabilities.push("code");
    complexityScore += 3;
    reasons.push("code-related content detected");
  } else if (codeMatches === 1) {
    capabilities.push("code");
    complexityScore += 1;
  }

  // Check for math content
  const mathMatches = MATH_PATTERNS.filter((p) => p.test(fullText)).length;
  if (mathMatches >= 1) {
    capabilities.push("math");
    complexityScore += 2;
    reasons.push("mathematical content detected");
  }

  // Check for creative content
  const creativeMatches = CREATIVE_PATTERNS.filter((p) => p.test(lastUserMessage)).length;
  if (creativeMatches >= 1) {
    capabilities.push("creative");
    complexityScore += 1;
    reasons.push("creative task detected");
  }

  // Check conversation depth
  if (messageCount > 6) {
    complexityScore += 2;
    reasons.push("deep conversation");
  } else if (messageCount > 3) {
    complexityScore += 1;
  }

  // Check token length
  const estimatedTokens = Math.ceil(totalLength / 4);
  if (estimatedTokens > 2000) {
    complexityScore += 2;
    reasons.push("long context");
  } else if (estimatedTokens > 500) {
    complexityScore += 1;
  }

  // Check for simple patterns
  const isSimpleQuery = SIMPLE_PATTERNS.some((p) => p.test(lastUserMessage));
  if (isSimpleQuery && messageCount <= 2 && estimatedTokens < 100) {
    complexityScore = Math.max(0, complexityScore - 2);
    reasons.push("simple query pattern");
  }

  // Determine complexity level
  let complexity: ComplexityLevel;
  if (complexityScore <= 1) {
    complexity = "simple";
  } else if (complexityScore <= 4) {
    complexity = "moderate";
  } else {
    complexity = "complex";
  }

  capabilities.push("instruction-following");

  return {
    complexity,
    requiredCapabilities: [...new Set(capabilities)],
    estimatedTokens,
    reasoning: reasons.length > 0 ? reasons.join(", ") : "default classification",
  };
}
