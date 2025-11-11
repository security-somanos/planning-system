'use client';

// Get API URL from environment, remove trailing slash
const getApiUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  return url.replace(/\/+$/, '');
};

async function request<T>(
  method: string,
  path: string,
  body?: any
): Promise<T> {
  const apiUrl = getApiUrl();
  const url = `${apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

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
  async get<T = unknown>(path: string): Promise<T> {
    return request<T>('GET', path);
  },

  async post<T = unknown>(path: string, body?: any): Promise<T> {
    return request<T>('POST', path, body);
  },

  async put<T = unknown>(path: string, body?: any): Promise<T> {
    return request<T>('PUT', path, body);
  },

  async delete<T = unknown>(path: string): Promise<T> {
    return request<T>('DELETE', path);
  },
};

