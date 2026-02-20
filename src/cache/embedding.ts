import { env } from "../env.js";

export class EmbeddingService {
  private ollamaUrl: string;
  private model: string;

  constructor(ollamaUrl?: string, model = "nomic-embed-text") {
    this.ollamaUrl = ollamaUrl ?? env.OLLAMA_URL;
    this.model = model;
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt: text }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Embedding error: ${response.status}`);
      }

      const data = (await response.json()) as { embedding: number[] };
      return data.embedding;
    } catch {
      // Fallback: simple hash-based pseudo-embedding for when Ollama isn't available
      return this.fallbackEmbed(text);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fallback pseudo-embedding using character-level hashing.
   * Not as good as real embeddings but allows cache to function without Ollama.
   */
  private fallbackEmbed(text: string): number[] {
    const normalized = text.toLowerCase().trim();
    const dim = 384;
    const embedding = new Float64Array(dim);

    // Simple character n-gram based pseudo-embedding
    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      for (let j = 0; j < 3; j++) {
        const idx = (charCode * (j + 1) + i * 7) % dim;
        embedding[idx] = (embedding[idx] ?? 0) + 1;
      }
    }

    // Normalize to unit vector
    let magnitude = 0;
    for (let i = 0; i < dim; i++) {
      magnitude += (embedding[i] ?? 0) ** 2;
    }
    magnitude = Math.sqrt(magnitude);
    if (magnitude > 0) {
      for (let i = 0; i < dim; i++) {
        embedding[i] = (embedding[i] ?? 0) / magnitude;
      }
    }

    return Array.from(embedding);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
