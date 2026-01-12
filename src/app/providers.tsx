"use client";

import { FirebaseProvider, AuthProvider, AuthGate } from "@/lib";
import { JMStyleProvider } from "@/JMStyle";
import type { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <JMStyleProvider>
      <FirebaseProvider>
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </FirebaseProvider>
    </JMStyleProvider>
  );
}

