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
import type { AiImageGenSettings } from "@/lib/bluffbox-ai-image-gen-settings";
import {
  DEFAULT_AI_IMAGE_GEN_SETTINGS,
  mergeAiImageGenSettingsFromUnknown,
} from "@/lib/bluffbox-ai-image-gen-settings";
import { sanitizeIdeogramImageOptions } from "@/app/games/bluffbox/packs/ideogramStyleRules";

export type UserTier = "free" | "pro" | "paid";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  userTier: UserTier;
  gamertag: string | null;
  avatarName: string | null;
  level: number;
  points: number;
  levelledUp: boolean;
  /** Bluff Box / Ideogram: saved on `users/{uid}.aiImageGenSettings` */
  aiImageGenSettings: AiImageGenSettings;
  /** Admin-only: view the app as a different tier (for testing) */
  adminViewAs: UserTier | null;
  setAdminViewAs: (tier: UserTier | null) => void;
  /** The effective tier to use (respects adminViewAs for admins) */
  effectiveTier: UserTier;
  /** Force refresh the ID token to get updated claims (e.g., after admin status changes) */
  refreshClaims: () => Promise<void>;
  /** Re-fetch user data from Firestore (e.g., after gamertag change) */
  refreshUserData: () => Promise<void>;
  /** Persist Bluff Box AI image settings to Firestore and update local state. */
  saveAiImageGenSettings: (next: AiImageGenSettings) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  userTier: "free",
  gamertag: null,
  avatarName: null,
  level: 1,
  points: 0,
  levelledUp: false,
  adminViewAs: null,
  setAdminViewAs: () => {},
  effectiveTier: "free",
  refreshClaims: async () => {},
  refreshUserData: async () => {},
  aiImageGenSettings: DEFAULT_AI_IMAGE_GEN_SETTINGS,
  saveAiImageGenSettings: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider - Manages Firebase authentication state including admin roles and user tier
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<
    Omit<AuthContextValue, "refreshClaims" | "refreshUserData" | "setAdminViewAs" | "effectiveTier" | "saveAiImageGenSettings">
  >({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    isAdmin: false,
    userTier: "free",
    gamertag: null,
    avatarName: null,
    level: 1,
    points: 0,
    levelledUp: false,
    aiImageGenSettings: DEFAULT_AI_IMAGE_GEN_SETTINGS,
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

  interface UserData {
    userTier: UserTier;
    gamertag: string | null;
    avatarName: string | null;
    level: number;
    points: number;
    levelledUp: boolean;
    aiImageGenSettings: AiImageGenSettings;
  }

  const fetchUserData = useCallback(async (user: User | null): Promise<UserData> => {
    const defaults: UserData = {
      userTier: "free",
      gamertag: null,
      avatarName: null,
      level: 1,
      points: 0,
      levelledUp: false,
      aiImageGenSettings: DEFAULT_AI_IMAGE_GEN_SETTINGS,
    };
    if (!user) return defaults;
    
    try {
      const { getFirestore, doc, getDoc } = await import("firebase/firestore");
      const { getFirebaseApp } = await import("./firebase");
      
      const app = await getFirebaseApp();
      if (!app) return defaults;
      
      const db = getFirestore(app);
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          userTier: (data["tier"] === "paid" || data["tier"] === "pro") ? data["tier"] as UserTier : "free",
          gamertag: data["gamertag"] ?? null,
          avatarName: typeof data["avatarName"] === "string" ? data["avatarName"] : null,
          level: typeof data["level"] === "number" ? data["level"] : 1,
          points: typeof data["points"] === "number" ? data["points"] : 0,
          levelledUp: data["levelledUp"] === true,
          aiImageGenSettings: mergeAiImageGenSettingsFromUnknown(data["aiImageGenSettings"]),
        };
      }
      return defaults;
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      return defaults;
    }
  }, []);

  const refreshClaims = useCallback(async () => {
    if (!state.user) return;
    
    try {
      await state.user.getIdToken(true);
      const [isAdmin, userData] = await Promise.all([
        checkAdminClaim(state.user),
        fetchUserData(state.user),
      ]);
      setState(prev => ({ ...prev, isAdmin, ...userData }));
    } catch (error) {
      console.error("Failed to refresh claims:", error);
    }
  }, [state.user, checkAdminClaim, fetchUserData]);

  const refreshUserData = useCallback(async () => {
    if (!state.user) return;
    
    try {
      const userData = await fetchUserData(state.user);
      setState(prev => ({ ...prev, ...userData }));
    } catch (error) {
      console.error("Failed to refresh user data:", error);
    }
  }, [state.user, fetchUserData]);

  const saveAiImageGenSettings = useCallback(async (next: AiImageGenSettings) => {
    if (!state.user) return;
    const sanitized: AiImageGenSettings = {
      ...next,
      ideogram: sanitizeIdeogramImageOptions(next.ideogram),
    };
    const { getFirestore, doc, setDoc, serverTimestamp } = await import("firebase/firestore");
    const { getFirebaseApp } = await import("./firebase");
    const app = await getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    await setDoc(
      doc(db, "users", state.user.uid),
      {
        aiImageGenSettings: sanitized,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    setState((prev) => ({ ...prev, aiImageGenSettings: sanitized }));
  }, [state.user]);

  useEffect(() => {
    import("@/lib/points").then(({ PointsManager }) => {
      PointsManager.registerRefresh(refreshUserData);
    });
  }, [refreshUserData]);

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
          // Flip loading off the INSTANT we know the auth state. Do NOT block
          // the whole app on the secondary reads below: getIdTokenResult and
          // the user-doc getDoc can hang on iOS (ITP blocking the IndexedDB
          // token store, or a wedged Firestore connection) with no timeout,
          // which leaves the app stuck on the loading screen — and only on some
          // devices. Enrich admin/profile in the background and merge when ready.
          setState((prev) => ({
            ...prev,
            user,
            isLoading: false,
            isAuthenticated: !!user,
          }));
          void (async () => {
            const [isAdmin, userData] = await Promise.all([
              checkAdminClaim(user),
              fetchUserData(user),
            ]);
            // Guard against a stale background result clobbering newer state.
            setState((prev) =>
              prev.user?.uid === user?.uid ? { ...prev, isAdmin, ...userData } : prev,
            );
          })();
        });
      } catch (error) {
        console.error("Failed to initialize auth:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
        }));
      }
    };

    // Safety net: if auth init itself hangs (getAuth never resolves, or
    // onAuthStateChanged never fires — e.g. IndexedDB blocked on iOS), don't
    // leave the app stuck loading forever. Drop the loader after a few seconds
    // and treat as signed-out; the user can still use the app / retry login.
    const safety = setTimeout(() => {
      setState((prev) => (prev.isLoading ? { ...prev, isLoading: false } : prev));
    }, 8000);

    void init();

    return () => {
      clearTimeout(safety);
      if (unsubscribe) unsubscribe();
    };
  }, [checkAdminClaim, fetchUserData]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        refreshClaims,
        refreshUserData,
        setAdminViewAs,
        effectiveTier,
        saveAiImageGenSettings,
      }}
    >
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

