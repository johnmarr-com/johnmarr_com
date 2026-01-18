"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** Force refresh the ID token to get updated claims (e.g., after admin status changes) */
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  refreshClaims: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider - Manages Firebase authentication state including admin roles
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<Omit<AuthContextValue, "refreshClaims">>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    isAdmin: false,
  });

  // Function to check admin claim from ID token
  const checkAdminClaim = useCallback(async (user: User | null): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Get the ID token result which includes custom claims
      const idTokenResult = await user.getIdTokenResult();
      return idTokenResult.claims["admin"] === true;
    } catch (error) {
      console.error("Failed to get ID token claims:", error);
      return false;
    }
  }, []);

  // Function to refresh claims (force token refresh)
  const refreshClaims = useCallback(async () => {
    if (!state.user) return;
    
    try {
      // Force refresh the ID token to get updated claims
      await state.user.getIdToken(true);
      const isAdmin = await checkAdminClaim(state.user);
      setState(prev => ({ ...prev, isAdmin }));
    } catch (error) {
      console.error("Failed to refresh claims:", error);
    }
  }, [state.user, checkAdminClaim]);

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

        unsubscribe = onAuthStateChanged(auth, async (user) => {
          const isAdmin = await checkAdminClaim(user);
          setState({
            user,
            isLoading: false,
            isAuthenticated: !!user,
            isAdmin,
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
  }, [checkAdminClaim]);

  return (
    <AuthContext.Provider value={{ ...state, refreshClaims }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth state including admin status
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

