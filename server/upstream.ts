import { ApiError } from './http.js';

export const SUPABASE_UPSTREAM_TIMEOUT_MS = 12_000;

type Service = 'AUTH' | 'DATA';

function serviceError(service: Service, timedOut: boolean) {
  if (timedOut) {
    return new ApiError(
      504,
      service === 'AUTH' ? 'AUTH_TIMEOUT' : 'DATA_TIMEOUT',
      service === 'AUTH'
        ? 'Authentication service took too long to respond. Try again.'
        : 'Data service took too long to respond. Try again.',
    );
  }
  return new ApiError(
    503,
    service === 'AUTH' ? 'AUTH_UNAVAILABLE' : 'DATA_UNAVAILABLE',
    service === 'AUTH'
      ? 'Authentication service is temporarily unavailable. Try again.'
      : 'Data service is temporarily unavailable. Try again.',
  );
}

export async function fetchUpstream(
  input: string | URL,
  init: RequestInit = {},
  service: Service,
  timeoutMs = SUPABASE_UPSTREAM_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw serviceError(service, controller.signal.aborted);
  } finally {
    clearTimeout(timer);
  }
}

export function isAuthRejection(error: unknown) {
  return error instanceof ApiError && error.code === 'AUTH_REJECTED';
}

export function isAuthSessionRejection(error: unknown) {
  return isAuthRejection(error) && [400, 401, 403, 422].includes((error as ApiError).status);
}
