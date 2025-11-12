'use client';

import { getToken, clearAuth } from './auth';

// Get API URL from environment, remove trailing slash
const getApiUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  return url.replace(/\/+$/, '');
};

async function request<T>(
  method: string,
  path: string,
  body?: any,
  requireAuth: boolean = true
): Promise<T> {
  const apiUrl = getApiUrl();
  const url = `${apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add Authorization header if auth is required
  if (requireAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  // Handle 401 Unauthorized - clear auth and throw error
  if (response.status === 401) {
    clearAuth();
    // Redirect will be handled by the component
    throw new Error('Unauthorized - Please login again');
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error) {
        errorMessage = errorJson.error;
      }
    } catch {
      if (errorText) {
        errorMessage = errorText;
      }
    }
    throw new Error(errorMessage);
  }

  // Handle empty responses (e.g., DELETE 204)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {} as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return response.text() as unknown as T;
}

export const api = {
  async get<T = unknown>(path: string, requireAuth: boolean = true): Promise<T> {
    return request<T>('GET', path, undefined, requireAuth);
  },

  async post<T = unknown>(path: string, body?: any, requireAuth: boolean = true): Promise<T> {
    return request<T>('POST', path, body, requireAuth);
  },

  async put<T = unknown>(path: string, body?: any, requireAuth: boolean = true): Promise<T> {
    return request<T>('PUT', path, body, requireAuth);
  },

  async delete<T = unknown>(path: string, requireAuth: boolean = true): Promise<T> {
    return request<T>('DELETE', path, undefined, requireAuth);
  },
};

