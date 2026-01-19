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

export type UserTier = "free" | "paid";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  userTier: UserTier;
  /** Admin-only: view the app as a different tier (for testing) */
  adminViewAs: UserTier | null;
  setAdminViewAs: (tier: UserTier | null) => void;
  /** The effective tier to use (respects adminViewAs for admins) */
  effectiveTier: UserTier;
  /** Force refresh the ID token to get updated claims (e.g., after admin status changes) */
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  userTier: "free",
  adminViewAs: null,
  setAdminViewAs: () => {},
  effectiveTier: "free",
  refreshClaims: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider - Manages Firebase authentication state including admin roles and user tier
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<Omit<AuthContextValue, "refreshClaims" | "setAdminViewAs" | "effectiveTier">>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    isAdmin: false,
    userTier: "free",
    adminViewAs: null,
  });

  // Set admin view as tier (for testing)
  const setAdminViewAs = useCallback((tier: UserTier | null) => {
    setState(prev => ({ ...prev, adminViewAs: tier }));
  }, []);

  // Calculate effective tier (respects adminViewAs for admins)
  const effectiveTier: UserTier = state.isAdmin && state.adminViewAs 
    ? state.adminViewAs 
    : state.userTier;

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

  // Function to fetch user tier from Firestore
  const fetchUserTier = useCallback(async (user: User | null): Promise<UserTier> => {
    if (!user) return "free";
    
    try {
      const { getFirestore, doc, getDoc } = await import("firebase/firestore");
      const { getFirebaseApp } = await import("./firebase");
      
      const app = await getFirebaseApp();
      if (!app) return "free";
      
      const db = getFirestore(app);
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        return data["tier"] === "paid" ? "paid" : "free";
      }
      return "free";
    } catch (error) {
      console.error("Failed to fetch user tier:", error);
      return "free";
    }
  }, []);

  // Function to refresh claims and tier (force token refresh)
  const refreshClaims = useCallback(async () => {
    if (!state.user) return;
    
    try {
      // Force refresh the ID token to get updated claims
      await state.user.getIdToken(true);
      const [isAdmin, userTier] = await Promise.all([
        checkAdminClaim(state.user),
        fetchUserTier(state.user),
      ]);
      setState(prev => ({ ...prev, isAdmin, userTier }));
    } catch (error) {
      console.error("Failed to refresh claims:", error);
    }
  }, [state.user, checkAdminClaim, fetchUserTier]);

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
          const [isAdmin, userTier] = await Promise.all([
            checkAdminClaim(user),
            fetchUserTier(user),
          ]);
          setState(prev => ({
            ...prev,
            user,
            isLoading: false,
            isAuthenticated: !!user,
            isAdmin,
            userTier,
          }));
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
  }, [checkAdminClaim, fetchUserTier]);

  return (
    <AuthContext.Provider value={{ ...state, refreshClaims, setAdminViewAs, effectiveTier }}>
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

