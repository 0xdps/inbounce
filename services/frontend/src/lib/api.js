async function req(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const json = await res.json().catch(() => ({ error: res.statusText }));

  if (!res.ok) {
    const err = new Error(json.error || 'Request failed');
    err.status = res.status;
    throw err;
  }

  return json;
}

export const api = {
  // Auth
  me:     ()      => req('GET',    '/api/auth/me'),
  login:  (key)   => req('POST',   '/api/auth/login',  { key }),
  logout: ()      => req('DELETE', '/api/auth/logout'),

  // Apps
  getApps:    ()          => req('GET',    '/api/apps'),
  createApp:  (data)      => req('POST',   '/api/apps',  data),
  getApp:     (id)        => req('GET',    `/api/apps/${id}`),
  updateApp:  (id, data)  => req('PUT',    `/api/apps/${id}`, data),
  deleteApp:  (id)        => req('DELETE', `/api/apps/${id}`),
  rotateKey:  (id)        => req('POST',   `/api/apps/${id}/rotate-key`),

  // Schema
  getSchema:  (id)          => req('GET', `/api/apps/${id}/schema`),
  saveSchema: (id, fields)  => req('PUT', `/api/apps/${id}/schema`, { fields }),

  // Submissions
  getStats:              (id)              => req('GET',    `/api/apps/${id}/submissions/stats`),
  getFieldDistribution:  (id, field, after) => req('GET',   `/api/apps/${id}/submissions/distribution?${new URLSearchParams({ field, ...(after ? { after } : {}) })}`),
  getSubmissions:        (id, params = {})  => req('GET',    `/api/apps/${id}/submissions?${new URLSearchParams(params)}`),
  deleteSubmission:      (appId, sid)       => req('DELETE', `/api/apps/${appId}/submissions/${sid}`),
  clearSubmissions:      (appId)            => req('DELETE', `/api/apps/${appId}/submissions`, { confirm: true }),
};
