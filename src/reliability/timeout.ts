export interface TimeoutConfig {
  completionTimeoutMs: number;
  streamFirstTokenTimeoutMs: number;
}

const DEFAULT_TIMEOUTS: Record<string, TimeoutConfig> = {
  ollama: { completionTimeoutMs: 120000, streamFirstTokenTimeoutMs: 30000 },
  openai: { completionTimeoutMs: 60000, streamFirstTokenTimeoutMs: 10000 },
  anthropic: { completionTimeoutMs: 60000, streamFirstTokenTimeoutMs: 10000 },
  groq: { completionTimeoutMs: 30000, streamFirstTokenTimeoutMs: 5000 },
  together: { completionTimeoutMs: 60000, streamFirstTokenTimeoutMs: 10000 },
};

export function getTimeout(providerId: string): TimeoutConfig {
  return DEFAULT_TIMEOUTS[providerId] ?? {
    completionTimeoutMs: 60000,
    streamFirstTokenTimeoutMs: 10000,
  };
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  providerId: string
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(`Provider ${providerId} timed out after ${timeoutMs}ms`));
        });
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}
