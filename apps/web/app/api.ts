const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
let csrfToken: string | null = null;
let pendingToken: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!pendingToken) {
    pendingToken = globalThis.fetch(`${api}/api/auth/csrf`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not initialize request security.');
        const data = await response.json();
        csrfToken = data.token;
        return data.token as string;
      }).finally(() => { pendingToken = null; });
  }
  return pendingToken;
}

/** All cookie-authenticated writes must include the signed CSRF token. */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const request = async () => {
    const headers = new Headers(init.headers);
    if (write) headers.set('X-CSRF-Token', await getCsrfToken());
    return globalThis.fetch(input, { ...init, headers, credentials: 'include' });
  };
  let response = await request();
  // Another tab may have rotated the CSRF cookie. Retry only explicitly rejected writes.
  if (write && response.status === 403) {
    const data = await response.clone().json().catch(() => null);
    if (data?.code === 'CSRF_INVALID') {
      csrfToken = null;
      response = await request();
    }
  }
  return response;
}
