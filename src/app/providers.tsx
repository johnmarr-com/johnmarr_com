"use client";

import { FirebaseProvider } from "@/lib";
import type { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <FirebaseProvider>{children}</FirebaseProvider>;
}

