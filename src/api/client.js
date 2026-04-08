import { apiRequest } from './http';

function listQuery(sort, limit) {
  const params = new URLSearchParams();
  if (sort) params.set('sort', sort);
  if (limit != null && limit !== '') params.set('limit', String(limit));
  const q = params.toString();
  return q ? `?${q}` : '';
}

/** Local API client (same shape as former Base44 SDK usage). */
export const api = {
  auth: {
    me: () => apiRequest('/auth/me'),
    logout() {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem('greetease_access_token');
      window.localStorage.removeItem('access_token');
      window.localStorage.removeItem('base44_access_token');
    },
    logoutRedirect() {
      api.auth.logout();
      window.location.reload();
    },
    redirectToLogin() {
      // No hosted login; reload clears optional token
      api.auth.logout();
      window.location.reload();
    },
  },
  entities: {
    Contact: {
      list: (sort) => apiRequest(`/contacts${listQuery(sort)}`),
      create: (data) => apiRequest('/contacts', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, data) => apiRequest(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id) => apiRequest(`/contacts/${id}`, { method: 'DELETE' }),
    },
    Holiday: {
      list: (sort) => apiRequest(`/holidays${listQuery(sort)}`),
      create: (data) => apiRequest('/holidays', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, data) => apiRequest(`/holidays/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id) => apiRequest(`/holidays/${id}`, { method: 'DELETE' }),
    },
    UserSettings: {
      list: () => apiRequest('/user-settings'),
      create: (data) => apiRequest('/user-settings', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, data) => apiRequest(`/user-settings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    },
    NotificationLog: {
      list: (sort, limit) => apiRequest(`/notification-logs${listQuery(sort, limit)}`),
      create: (data) => apiRequest('/notification-logs', { method: 'POST', body: JSON.stringify(data) }),
    },
    ScheduledMessage: {
      list: (sort) => apiRequest(`/scheduled-messages${listQuery(sort)}`),
      create: (data) => apiRequest('/scheduled-messages', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, data) => apiRequest(`/scheduled-messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id) => apiRequest(`/scheduled-messages/${id}`, { method: 'DELETE' }),
    },
  },
  integrations: {
    Core: {
      InvokeLLM: async ({ prompt }) => {
        const data = await apiRequest('/llm', { method: 'POST', body: JSON.stringify({ prompt }) });
        if (typeof data === 'string') return data;
        if (data && typeof data.text === 'string') return data.text;
        return String(data?.result ?? '');
      },
    },
  },
  telegram: {
    send: (body) => apiRequest('/telegram/send', { method: 'POST', body: JSON.stringify(body) }),
    listInbound: (sort, limit) => apiRequest(`/telegram/inbound${listQuery(sort, limit)}`),
    syncInbound: () => apiRequest('/telegram/sync-inbound', { method: 'POST', body: '{}' }),
  },
  workspace: {
    get: () => apiRequest('/workspace'),
    patch: (body) =>
      apiRequest('/workspace', { method: 'PATCH', body: JSON.stringify(body) }),
    refreshTelegramBot: () =>
      apiRequest('/workspace/refresh-telegram-bot', { method: 'POST', body: '{}' }),
  },
};
