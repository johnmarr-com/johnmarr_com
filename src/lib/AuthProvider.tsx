"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
});

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider - Manages Firebase authentication state
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthContextValue>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        const [{ getAuth }, { onAuthStateChanged }] = await Promise.all([
          import("./auth"),
          import("firebase/auth"),
        ]);

        const auth = await getAuth();

        unsubscribe = onAuthStateChanged(auth, (user) => {
          setState({
            user,
            isLoading: false,
            isAuthenticated: !!user,
          });
        });
      } catch (error) {
        console.error("Failed to initialize auth:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
        }));
      }
    };

    void init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
  );
}

/**
 * Hook to access auth state
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

