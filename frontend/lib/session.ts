'use client';

import { ID } from "./types";
import { isBrowser, readFromStorage, removeFromStorage, writeToStorage } from "./storage";

export type Role = "admin" | "participant";

export interface Session {
  role: Role;
  participantId?: ID;
}

const SESSION_KEY = "ps:session";

export function getSession(): Session | null {
  return readFromStorage<Session | null>(SESSION_KEY, null);
}

export function setSession(session: Session): void {
  writeToStorage(SESSION_KEY, session);
}

export function clearSession(): void {
  removeFromStorage(SESSION_KEY);
}

export function loginAsAdmin(): Session {
  const session: Session = { role: "admin" };
  setSession(session);
  return session;
}

export function loginAsParticipant(participantId: ID): Session {
  const session: Session = { role: "participant", participantId };
  setSession(session);
  return session;
}

export function isLoggedIn(): boolean {
  return !!getSession();
}

export function logout(): void {
  clearSession();
}

export function getRole(): Role | null {
  return getSession()?.role ?? null;
}

export function getSessionParticipantId(): ID | undefined {
  return getSession()?.participantId;
}

export function onSessionChange(handler: (s: Session | null) => void): () => void {
  if (!isBrowser()) return () => {};
  const cb = (e: StorageEvent) => {
    if (e.key === SESSION_KEY) {
      handler(getSession());
    }
  };
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}


