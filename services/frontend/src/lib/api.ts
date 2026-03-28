interface ApiError extends Error {
  status?: number;
}

async function req<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null as T;

  const json = (await res.json().catch(() => ({ error: res.statusText }))) as Record<string, unknown>;

  if (!res.ok) {
    const err = new Error((json.error as string) || 'Request failed') as ApiError;
    err.status = res.status;
    throw err;
  }

  return json as T;
}

export const api = {
  // Auth
  me: () => req<{ admin: boolean }>('GET', '/api/auth/me'),
  login: (key: string) => req<{ admin: boolean; message: string }>('POST', '/api/auth/login', { key }),
  logout: () => req('DELETE', '/api/auth/logout'),

  // Apps
  getApps: () => req<unknown[]>('GET', '/api/apps'),
  createApp: (data: unknown) => req<unknown>('POST', '/api/apps', data),
  getApp: (id: string) => req<unknown>('GET', `/api/apps/${id}`),
  updateApp: (id: string, data: unknown) => req<unknown>('PUT', `/api/apps/${id}`, data),
  deleteApp: (id: string) => req<unknown>('DELETE', `/api/apps/${id}`),
  rotateKey: (id: string) => req<{ api_key: string }>('POST', `/api/apps/${id}/rotate-key`),

  // Schema
  getSchema: (id: string) => req<unknown[]>('GET', `/api/apps/${id}/schema`),
  saveSchema: (id: string, fields: unknown[]) => req<unknown>('PUT', `/api/apps/${id}/schema`, { fields }),

  // Submissions
  getStats: (id: string) => req<unknown>('GET', `/api/apps/${id}/submissions/stats`),
  getFieldDistribution: (id: string, field: string, after?: number) =>
    req<unknown>(
      'GET',
      `/api/apps/${id}/submissions/distribution?${new URLSearchParams({ field, ...(after ? { after: String(after) } : {}) })}`
    ),
  getSubmissions: (id: string, params: Record<string, unknown> = {}) =>
    req<unknown>('GET', `/api/apps/${id}/submissions?${new URLSearchParams(params as Record<string, string>)}`),
  deleteSubmission: (appId: string, sid: string) => req<unknown>('DELETE', `/api/apps/${appId}/submissions/${sid}`),
  clearSubmissions: (appId: string) => req<unknown>('DELETE', `/api/apps/${appId}/submissions`, { confirm: true }),
};
