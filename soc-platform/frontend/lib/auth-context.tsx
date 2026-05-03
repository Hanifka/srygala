"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { testAuth } from "@/lib/api";
import type { Credentials } from "@/lib/types";

interface AuthContextValue {
  creds: Credentials | null;
  isAuthed: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  creds: null,
  isAuthed: false,
  login: async () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [creds, setCreds] = useState<Credentials | null>(null);

  const login = useCallback(async (username: string, password: string) => {
    const ok = await testAuth({ username, password });
    if (ok) {
      setCreds({ username, password });
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setCreds(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ creds, isAuthed: !!creds, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
