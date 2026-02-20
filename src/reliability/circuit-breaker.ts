export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 3,
};

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private config: CircuitBreakerConfig;

  constructor(
    readonly providerId: string,
    config?: Partial<CircuitBreakerConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getState(): CircuitState {
    if (this.state === "open") {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.state = "half-open";
        this.halfOpenAttempts = 0;
      }
    }
    return this.state;
  }

  canExecute(): boolean {
    const state = this.getState();
    if (state === "closed") return true;
    if (state === "half-open") return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
    return false; // open
  }

  recordSuccess(): void {
    if (this.state === "half-open") {
      this.successCount++;
      if (this.successCount >= this.config.halfOpenMaxAttempts) {
        this.reset();
      }
    } else {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "half-open") {
      this.halfOpenAttempts++;
      this.trip();
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = "open";
    this.successCount = 0;
    this.halfOpenAttempts = 0;
  }

  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
  }

  getStats(): {
    state: CircuitState;
    failureCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  getBreaker(providerId: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let breaker = this.breakers.get(providerId);
    if (!breaker) {
      breaker = new CircuitBreaker(providerId, config);
      this.breakers.set(providerId, breaker);
    }
    return breaker;
  }

  canExecute(providerId: string): boolean {
    const breaker = this.breakers.get(providerId);
    return breaker ? breaker.canExecute() : true;
  }

  recordSuccess(providerId: string): void {
    this.getBreaker(providerId).recordSuccess();
  }

  recordFailure(providerId: string): void {
    this.getBreaker(providerId).recordFailure();
  }

  getAllStats(): Map<string, ReturnType<CircuitBreaker["getStats"]>> {
    const stats = new Map<string, ReturnType<CircuitBreaker["getStats"]>>();
    for (const [id, breaker] of this.breakers) {
      stats.set(id, breaker.getStats());
    }
    return stats;
  }
}

export const circuitBreakerManager = new CircuitBreakerManager();
