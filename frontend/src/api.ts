const BASE = '/api';

interface ErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

const authHeader = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: 'Bearer ' + token } : {};
};

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(BASE + path, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && path !== '/login') {
    localStorage.removeItem('token');
    window.location.reload();
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = data as ErrorBody | null;
    const firstError = error?.errors ? Object.values(error.errors).flat()[0] : null;
    throw new Error(firstError || error?.message || 'Something went wrong');
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T = unknown>(path: string, body?: unknown) => request<T>(path, 'POST', body),
  remove: (path: string) => request<void>(path, 'DELETE'),
};

export async function download(path: string, filename: string): Promise<void> {
  const response = await fetch(BASE + path, { headers: authHeader() });
  if (!response.ok) throw new Error('Download failed');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
