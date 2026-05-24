import { useEffect, useState } from "react";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin";
  registrationNumber?: string | null;
  status?: string;
};

const TOKEN_KEY = "kuvote_token";
const USER_KEY = "kuvote_user";

const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: StoredUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notify();
}

export function clearSession(): void {
  localStorage.clear();
  notify();
}

export function useAuth() {
  const [snapshot, setSnapshot] = useState(() => ({
    token: getToken(),
    user: getUser(),
  }));
  useEffect(() => {
    const listener = () => setSnapshot({ token: getToken(), user: getUser() });
    listeners.add(listener);
    const onStorage = () => listener();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return {
    token: snapshot.token,
    user: snapshot.user,
    isAuthenticated: Boolean(snapshot.token && snapshot.user),
    isAdmin: snapshot.user?.role === "admin",
    isStudent: snapshot.user?.role === "student",
    login: setSession,
    logout: clearSession,
  };
}
