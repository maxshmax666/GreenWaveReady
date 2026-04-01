import { runtimeConfig } from '@greenwave/config';
import type { Route, RoutingRequest } from '@greenwave/types';

const ROUTING_TIMEOUT_MS = 9_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 300;
const ROUTING_ENDPOINT_PATH = '/routes';
const ROUTING_EVENT_NAME = 'routing_request';

export type RoutingErrorType =
  | 'TIMEOUT'
  | 'NETWORK'
  | 'HTTP_4XX'
  | 'HTTP_5XX'
  | 'PARSE'
  | 'UNKNOWN';

type RoutingRequestEvent = {
  url: string;
  latencyMs: number;
  status: number | null;
  errorType: RoutingErrorType | null;
  requestId: string | null;
  attempt: number;
};

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
  readonly requestId: string | null;

  constructor(timeoutMs: number, requestId: string | null = null) {
    super(`Routing timed out after ${timeoutMs}ms`);
    this.name = 'RoutingTimeoutError';
    this.timeoutMs = timeoutMs;
    this.requestId = requestId;
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
  status >= 500 && status <= 599;

const getRoutingUrl = (): string =>
  `${runtimeConfig.routingBaseUrl}${ROUTING_ENDPOINT_PATH}`;

const getRoutingErrorType = (error: unknown): RoutingErrorType => {
  if (error instanceof RoutingTimeoutError) {
    return 'TIMEOUT';
  }

  if (error instanceof RoutingParseError) {
    return 'PARSE';
  }

  if (error instanceof RoutingHttpError) {
    return error.status >= 500 ? 'HTTP_5XX' : 'HTTP_4XX';
  }

  if (error instanceof TypeError) {
    return 'NETWORK';
  }

  return 'UNKNOWN';
};

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

  return false;
};

const wait = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const ERROR_BODY_LOG_LIMIT = 2_000;

const reportRoutingEvent = (event: RoutingRequestEvent): void => {
  console.info('[routing.event]', event);

  const sentry = (globalThis as { Sentry?: { addBreadcrumb?: (payload: unknown) => void } }).Sentry;
  sentry?.addBreadcrumb?.({
    category: 'routing',
    level: event.errorType ? 'error' : 'info',
    message: ROUTING_EVENT_NAME,
    data: event,
  });

  const datadog = (
    globalThis as {
      DD_RUM?: { addAction?: (name: string, context?: Record<string, unknown>) => void };
    }
  ).DD_RUM;
  datadog?.addAction?.(ROUTING_EVENT_NAME, event);
};

const tryFetchRoutes = async (input: RoutingRequest, attempt: number): Promise<Route[]> => {
  const url = getRoutingUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ROUTING_TIMEOUT_MS);
  const startedAt = Date.now();
  let requestId: string | null = null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    requestId = response.headers.get('x-request-id');
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

    reportRoutingEvent({
      url,
      latencyMs: Date.now() - startedAt,
      status: response.status,
      errorType: null,
      requestId,
      attempt,
    });

    return routes as Route[];
  } catch (error) {
    if (isAbortError(error) && controller.signal.aborted) {
      const timeoutError = new RoutingTimeoutError(ROUTING_TIMEOUT_MS, requestId);
      reportRoutingEvent({
        url,
        latencyMs: Date.now() - startedAt,
        status: null,
        errorType: 'TIMEOUT',
        requestId,
        attempt,
      });
      throw timeoutError;
    }

    reportRoutingEvent({
      url,
      latencyMs: Date.now() - startedAt,
      status: error instanceof RoutingHttpError ? error.status : null,
      errorType: getRoutingErrorType(error),
      requestId: error instanceof RoutingHttpError || error instanceof RoutingParseError || error instanceof RoutingTimeoutError ? error.requestId : requestId,
      attempt,
    });

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const getRetryDelayMs = (attempt: number): number => {
  const exponentialDelay = RETRY_BASE_DELAY_MS * 2 ** attempt;
  const jitter = Math.random() * exponentialDelay;
  return Math.floor(exponentialDelay + jitter);
};

export const fetchRoutes = async (input: RoutingRequest): Promise<Route[]> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await tryFetchRoutes(input, attempt + 1);
    } catch (error) {
      lastError = error;

      if (!isTransientRoutingError(error) || attempt === MAX_RETRIES) {
        throw error;
      }

      const retryDelay = getRetryDelayMs(attempt);
      console.warn(
        `[routing] transient error, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        error,
      );
      await wait(retryDelay);
    }
  }

  throw lastError;
};
