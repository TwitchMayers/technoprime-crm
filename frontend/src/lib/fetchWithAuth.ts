const inFlightGetRequests = new Map<string, Promise<any>>();

const AUTH_REDIRECT_COOLDOWN_MS = 5_000;
const AUTH_LOGOUT_COOLDOWN_MS = 3_000;

let lastAuthRedirectAt = 0;
let lastLogoutRequestAt = 0;

function clearSessionHintCookieClient() {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `tp_session=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return { ...(headers as Record<string, string>) };
}

function buildRequestTimeoutMs(method: string) {
  if (method === 'GET') return 18_000;
  if (method === 'DELETE') return 25_000;
  return 40_000;
}

function shouldRedirectToLogin(pathname: string) {
  return !pathname.startsWith('/login') && !pathname.startsWith('/logout');
}

function buildInFlightKey(method: string, fullUrl: string) {
  return `${method}:${fullUrl}`;
}

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<any> {
  const debugFetch =
    process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEBUG_FETCH === 'true';

  let fullUrl: string;

  if (url.startsWith('http')) {
    fullUrl = url;
  } else if (url.startsWith('/api/')) {
    fullUrl = url;
  } else {
    fullUrl = `/api/${url.startsWith('/') ? url.slice(1) : url}`;
  }

  const method = String(options.method || 'GET').toUpperCase();
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const baseHeaders = normalizeHeaders(options.headers);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...baseHeaders,
  };
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const attachMeta = (response: Response, value: any) => {
    if (value && (typeof value === 'object' || typeof value === 'function')) {
      const target = value as Record<string, any>;
      if (!Object.prototype.hasOwnProperty.call(target, 'ok')) {
        target.ok = response.ok;
      }
      if (!Object.prototype.hasOwnProperty.call(target, 'status')) {
        target.status = response.status;
      }
      if (!Object.prototype.hasOwnProperty.call(target, 'statusText')) {
        target.statusText = response.statusText;
      }
      if (!Object.prototype.hasOwnProperty.call(target, 'json')) {
        target.json = async () => value;
      }
      if (!Object.prototype.hasOwnProperty.call(target, 'text')) {
        target.text = async () =>
          typeof value === 'string' ? value : JSON.stringify(value);
      }
      if (!Object.prototype.hasOwnProperty.call(target, '__http')) {
        target.__http = {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
        };
      }
      return value;
    }

    return {
      data: value ?? null,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      json: async () => value ?? null,
      text: async () => (value == null ? '' : String(value)),
    };
  };

  const execute = async () => {
    if (debugFetch) {
      console.log(`🔍 Fetch: ${method} ${fullUrl}`);
    }

    const timeoutMs = buildRequestTimeoutMs(method);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    const externalSignal = options.signal;

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    try {
      const response = await fetch(fullUrl, {
        ...options,
        method,
        headers,
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });

      if (debugFetch) {
        console.log(`📡 Response: ${response.status} ${response.statusText}`);
      }

      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          const now = Date.now();

          if (now - lastLogoutRequestAt > AUTH_LOGOUT_COOLDOWN_MS) {
            lastLogoutRequestAt = now;
            fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
          }

          localStorage.removeItem('token');
          localStorage.removeItem('user');
          clearSessionHintCookieClient();

          if (
            shouldRedirectToLogin(window.location.pathname) &&
            now - lastAuthRedirectAt > AUTH_REDIRECT_COOLDOWN_MS
          ) {
            lastAuthRedirectAt = now;
            window.location.replace('/login');
          }
        }

        throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          }
        } catch {
          // Keep default message.
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return attachMeta(response, null);
      }

      const data = await response.json();
      return attachMeta(response, data);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Сервер отвечает слишком долго. Попробуйте снова.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  };

  const canDeduplicateGet = method === 'GET';
  if (!canDeduplicateGet) {
    return execute();
  }

  const inFlightKey = buildInFlightKey(method, fullUrl);
  const existing = inFlightGetRequests.get(inFlightKey);
  if (existing) {
    return existing;
  }

  const promise = execute().finally(() => {
    inFlightGetRequests.delete(inFlightKey);
  });
  inFlightGetRequests.set(inFlightKey, promise);
  return promise;
}
