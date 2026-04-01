import { runtimeConfig } from '@greenwave/config';
import type { Route, RoutingRequest } from '@greenwave/types';

const ROUTING_TIMEOUT_MS = 9_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 300;

export class RoutingHttpError extends Error {
  readonly status: number;
  readonly requestId: string | null;

  constructor(status: number, requestId: string | null, message?: string) {
    super(message ?? `Routing failed with status ${status}`);
    this.name = 'RoutingHttpError';
    this.status = status;
    this.requestId = requestId;
  }
}

export class RoutingTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Routing timed out after ${timeoutMs}ms`);
    this.name = 'RoutingTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class RoutingParseError extends Error {
  readonly requestId: string | null;

  constructor(requestId: string | null, message = 'Invalid routing response payload') {
    super(message);
    this.name = 'RoutingParseError';
    this.requestId = requestId;
  }
}

const isRetryableHttpStatus = (status: number): boolean =>
  status === 429 || (status >= 500 && status <= 599);

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  (error as { name?: string }).name === 'AbortError';

const isTransientRoutingError = (error: unknown): boolean => {
  if (error instanceof RoutingTimeoutError) {
    return true;
  }

  if (error instanceof RoutingHttpError) {
    return isRetryableHttpStatus(error.status);
  }

  if (error instanceof TypeError) {
    // RN/fetch network layer failures are often surfaced as TypeError and should be retried.
    return true;
  }

  return false;
};

const wait = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const ERROR_BODY_LOG_LIMIT = 2_000;

const tryFetchRoutes = async (input: RoutingRequest): Promise<Route[]> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ROUTING_TIMEOUT_MS);

  try {
    const response = await fetch(`${runtimeConfig.routingBaseUrl}/routes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    const requestId = response.headers.get('x-request-id');
    if (requestId) {
      console.info(`[routing] x-request-id=${requestId}`);
    }

    if (!response.ok) {
      if (response.status >= 400) {
        let errorBody = '<unavailable>';
        try {
          const rawBody = await response.text();
          errorBody = rawBody.length > 0 ? rawBody : '<empty>';
        } catch {
          errorBody = '<failed-to-read>';
        }

        const normalizedBody =
          errorBody.length > ERROR_BODY_LOG_LIMIT
            ? `${errorBody.slice(0, ERROR_BODY_LOG_LIMIT)}…<truncated>`
            : errorBody;
        console.error(
          `[routing] request failed status=${response.status} request-id=${requestId ?? '<none>'} body=${normalizedBody}`,
        );
      }
      throw new RoutingHttpError(response.status, requestId);
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new RoutingParseError(requestId, 'Failed to parse routing response JSON');
    }

    const routes = (parsed as { routes?: unknown }).routes;
    if (!Array.isArray(routes)) {
      throw new RoutingParseError(requestId);
    }

    return routes as Route[];
  } catch (error) {
    if (isAbortError(error) && controller.signal.aborted) {
      throw new RoutingTimeoutError(ROUTING_TIMEOUT_MS);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const fetchRoutes = async (input: RoutingRequest): Promise<Route[]> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await tryFetchRoutes(input);
    } catch (error) {
      lastError = error;

      if (!isTransientRoutingError(error) || attempt === MAX_RETRIES) {
        throw error;
      }

      const retryDelay = RETRY_BASE_DELAY_MS * 2 ** attempt;
      console.warn(
        `[routing] transient error, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        error,
      );
      await wait(retryDelay);
    }
  }

  throw lastError;
};
