'use client';

import { readFromStorage, writeToStorage, removeFromStorage, isBrowser } from './storage';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

const TOKEN_KEY = 'ps:auth:token';
const USER_KEY = 'ps:auth:user';

export function getToken(): string | null {
  if (!isBrowser()) return null;
  return readFromStorage<string | null>(TOKEN_KEY, null);
}

export function getUser(): User | null {
  if (!isBrowser()) return null;
  return readFromStorage<User | null>(USER_KEY, null);
}

export function setAuth(token: string, user: User): void {
  writeToStorage(TOKEN_KEY, token);
  writeToStorage(USER_KEY, user);
  
  // Also set cookie for server-side API routes
  if (isBrowser()) {
    document.cookie = `ps:auth:token=${token}; path=/; max-age=${24 * 60 * 60}; SameSite=Lax`;
  }
}

export function clearAuth(): void {
  removeFromStorage(TOKEN_KEY);
  removeFromStorage(USER_KEY);
  
  // Also clear cookie
  if (isBrowser()) {
    document.cookie = 'ps:auth:token=; path=/; max-age=0';
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// Map API role 'user' to 'participant' for compatibility with existing code
export function getRole(): 'admin' | 'participant' | null {
  const user = getUser();
  if (!user) return null;
  return user.role === 'admin' ? 'admin' : 'participant';
}

