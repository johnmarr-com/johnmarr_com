"use client";

import { FirebaseProvider, AuthProvider, AuthGate } from "@/lib";
import type { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <FirebaseProvider>
      <AuthProvider>
        <AuthGate>{children}</AuthGate>
      </AuthProvider>
    </FirebaseProvider>
  );
}

