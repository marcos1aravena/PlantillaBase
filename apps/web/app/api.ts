import type { LoginInput, CreateUserInput, UpdateUserInput, ProfileInput, UserResponse, UsersResponse, ProfileResponse, ConfigResponse, ErrorResponse } from '@base/contracts';
const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export class ApiError extends Error {
  constructor(message: string, public status: number, public retryAfter?: number, public fieldErrors: Record<string, string[]> = {}) { super(message); }
}
let csrfToken: string | null = null;
let pendingToken: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!pendingToken) {
    pendingToken = globalThis.fetch(`${api}/api/auth/csrf`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new ApiError('No se pudo conectar con el servidor.', response.status);
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
    try { return await globalThis.fetch(input, { ...init, headers, credentials: 'include' }); }
    catch { throw new ApiError('No se pudo conectar con el servidor.', 0); }
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

async function request<T>(path: string, method = 'GET', body?: unknown, anonymous = false): Promise<T> {
  let response: Response;
  try {
    response = await apiFetch(`${api}/api${path}`, {
      method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('No se pudo conectar con el servidor.', 0);
  }
  if (!response.ok) {
    const data: Partial<ErrorResponse> = await response.json().catch(() => ({}));
    if (response.status === 401 && !anonymous && typeof window !== 'undefined') window.dispatchEvent(new Event('auth-expired'));
    const fallback = response.status === 403 ? 'No tienes permisos para esta acción.' : response.status === 401 ? 'Sesión expirada o inválida.' : 'Error interno del servidor.';
    throw new ApiError(data.error || fallback, response.status, data.retryAfter, data.fieldErrors);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const client = {
  config: () => request<ConfigResponse>('/config', 'GET', undefined, true),
  login: (body: LoginInput) => request<UserResponse>('/auth/login', 'POST', body, true),
  me: () => request<UserResponse>('/auth/me'),
  logout: () => request<void>('/auth/logout', 'POST'),
  revokeSessions: () => request<void>('/auth/revoke-sessions', 'POST'),
  updateProfile: (body: ProfileInput) => request<ProfileResponse>('/auth/profile', 'PATCH', body),
  users: (page = 1, limit = 20) => request<UsersResponse>(`/users?page=${page}&limit=${limit}`),
  createUser: (body: CreateUserInput) => request<UserResponse>('/users', 'POST', body),
  updateUser: (id: string, body: UpdateUserInput) => request<UserResponse>(`/users/${encodeURIComponent(id)}`, 'PATCH', body),
  deleteUser: (id: string) => request<void>(`/users/${encodeURIComponent(id)}`, 'DELETE'),
};
