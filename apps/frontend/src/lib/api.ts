export const API = '/api';

interface ErrorPayload {
  message?: string | string[];
  requestId?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
    const rawMessage = payload?.message ?? 'تعذر تنفيذ الطلب';
    const message = Array.isArray(rawMessage) ? rawMessage.join('، ') : rawMessage;
    throw new ApiError(message, response.status, payload?.requestId);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function requestBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...options, headers, cache: 'no-store' });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
    const rawMessage = payload?.message ?? 'تعذر تحميل الصورة';
    throw new ApiError(Array.isArray(rawMessage) ? rawMessage.join('، ') : rawMessage, response.status, payload?.requestId);
  }
  return response.blob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
