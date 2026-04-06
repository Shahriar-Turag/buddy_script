export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** HMAC CSRF token from /api/auth/me (or login/register); sent on mutating requests. */
let csrfToken: string | null = null;

export function setApiCsrfToken(token: string | null) {
  csrfToken = token;
}

function attachCsrf(headers: Headers, method: string) {
  const m = method.toUpperCase();
  if (
    csrfToken &&
    (m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE")
  ) {
    headers.set("X-CSRF-Token", csrfToken);
  }
}

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/** fetch with credentials + CSRF header (use for multipart / custom bodies). */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  attachCsrf(headers, init.method || "GET");
  return fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });
}

export async function apiJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  attachCsrf(headers, init.method || "GET");
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers,
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new ApiError(msg || "Request failed", res.status, data);
  }
  return data as T;
}
