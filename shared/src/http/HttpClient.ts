import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import CircuitBreaker from 'opossum';
import type { Logger } from 'pino';
import { UpstreamServiceError } from '../errors/AppError';
import { CORRELATION_ID_HEADER } from './correlationId';
import { INTERNAL_API_KEY_HEADER } from './internalAuth';

export interface HttpClientOptions {
  baseURL: string;
  serviceName: string;
  logger: Logger;
  timeoutMs?: number;
  maxRetries?: number;
  /** Sent on every outbound request as the internal service-to-service auth header, if provided. */
  internalApiKey?: string;
  /** Consecutive-failure rate (0-1) that trips the circuit breaker open. Default 0.5. */
  circuitBreakerErrorThreshold?: number;
  /** How long the breaker stays open before allowing a trial request through. Default 10s. */
  circuitBreakerResetTimeoutMs?: number;
}

/**
 * Thin wrapper around axios for service-to-service REST calls.
 *
 * Centralizes four concerns every inter-service call needs, so individual
 * services never re-implement them:
 *  1. Correlation-id propagation (for tracing a request across services)
 *  2. Retry with exponential backoff for transient failures within a single
 *     call (timeouts, connection errors, 5xx) - NOT for 4xx, since retrying
 *     a bad request will never succeed.
 *  3. A circuit breaker WRAPPING the retries: if a downstream service is
 *     genuinely down, every incoming request would otherwise still pay the
 *     cost of 3 retries with backoff before failing - hammering a known-dead
 *     service under load. Once enough calls fail, the breaker trips open and
 *     fails fast immediately for a cooldown window, then allows a trial
 *     request through (half-open) to check recovery. Retry and circuit
 *     breaker are complementary, not redundant: retry handles a single
 *     blip, the breaker handles a sustained outage across many callers.
 *  4. Translating axios/breaker errors into our own `UpstreamServiceError`,
 *     so callers deal with one consistent error type regardless of which
 *     downstream service failed or why.
 */
export class HttpClient {
  private readonly client: AxiosInstance;
  private readonly serviceName: string;
  private readonly logger: Logger;
  private readonly maxRetries: number;
  private readonly internalApiKey?: string;
  private readonly breaker: CircuitBreaker<[() => Promise<{ data: unknown }>], { data: unknown }>;

  constructor(options: HttpClientOptions) {
    this.serviceName = options.serviceName;
    this.logger = options.logger;
    this.maxRetries = options.maxRetries ?? 3;
    this.internalApiKey = options.internalApiKey;

    this.client = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeoutMs ?? 5000,
    });

    this.breaker = new CircuitBreaker(
      (request: () => Promise<{ data: unknown }>) => this.executeWithRetry(request),
      {
        errorThresholdPercentage: (options.circuitBreakerErrorThreshold ?? 0.5) * 100,
        resetTimeout: options.circuitBreakerResetTimeoutMs ?? 10000,
        timeout: false, // we already have our own per-call timeout via axios
      },
    );

    this.breaker.on('open', () =>
      this.logger.error({ service: this.serviceName }, 'Circuit breaker OPEN - failing fast'),
    );
    this.breaker.on('halfOpen', () =>
      this.logger.warn({ service: this.serviceName }, 'Circuit breaker HALF-OPEN - trial request'),
    );
    this.breaker.on('close', () =>
      this.logger.info({ service: this.serviceName }, 'Circuit breaker CLOSED - service recovered'),
    );
  }

  async post<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    correlationId?: string,
    config?: AxiosRequestConfig,
  ): Promise<TResponse> {
    const result = await this.fireBreaker(() =>
      this.client.post<TResponse>(path, body, {
        ...config,
        headers: this.buildHeaders(correlationId, config),
      }),
    );
    return result as TResponse;
  }

  async patch<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    correlationId?: string,
    config?: AxiosRequestConfig,
  ): Promise<TResponse> {
    const result = await this.fireBreaker(() =>
      this.client.patch<TResponse>(path, body, {
        ...config,
        headers: this.buildHeaders(correlationId, config),
      }),
    );
    return result as TResponse;
  }

  async get<TResponse>(
    path: string,
    correlationId?: string,
    config?: AxiosRequestConfig,
  ): Promise<TResponse> {
    const result = await this.fireBreaker(() =>
      this.client.get<TResponse>(path, {
        ...config,
        headers: this.buildHeaders(correlationId, config),
      }),
    );
    return result as TResponse;
  }

  private buildHeaders(correlationId?: string, config?: AxiosRequestConfig): Record<string, string> {
    return {
      ...(config?.headers as Record<string, string> | undefined),
      ...(correlationId ? { [CORRELATION_ID_HEADER]: correlationId } : {}),
      ...(this.internalApiKey ? { [INTERNAL_API_KEY_HEADER]: this.internalApiKey } : {}),
    };
  }

  private async fireBreaker(request: () => Promise<{ data: unknown }>): Promise<unknown> {
    try {
      const response = await this.breaker.fire(request);
      return response.data;
    } catch (err) {
      if (err instanceof UpstreamServiceError) {
        throw err;
      }
      // opossum throws its own errors (e.g. "Breaker is open") when short-circuiting.
      throw new UpstreamServiceError(this.serviceName, (err as Error).message);
    }
  }

  private async executeWithRetry<TResponse>(
    request: () => Promise<{ data: TResponse }>,
  ): Promise<{ data: TResponse }> {
    let lastError: AxiosError | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await request();
      } catch (err) {
        const axiosErr = err as AxiosError;
        lastError = axiosErr;

        const status = axiosErr.response?.status;
        const isClientError = status !== undefined && status >= 400 && status < 500;

        if (isClientError) {
          // Don't retry bad requests - they'll fail identically every time.
          throw new UpstreamServiceError(
            this.serviceName,
            axiosErr.message,
            axiosErr.response?.data,
          );
        }

        const isLastAttempt = attempt === this.maxRetries;
        if (isLastAttempt) {
          break;
        }

        const backoffMs = 200 * Math.pow(2, attempt); // 200ms, 400ms, 800ms...
        this.logger.warn(
          { attempt: attempt + 1, backoffMs, service: this.serviceName, error: axiosErr.message },
          'Retrying upstream call after transient failure',
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw new UpstreamServiceError(
      this.serviceName,
      lastError?.message ?? 'Unknown error',
      lastError?.response?.data,
    );
  }
}
