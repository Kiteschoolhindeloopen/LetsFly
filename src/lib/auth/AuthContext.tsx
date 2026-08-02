"use client";

import { createContext, useContext } from "react";
import type { User } from "@/lib/data/repository";

const AuthContext = createContext<User | null>(null);

export function AuthProvider({ user, children }: { user: User; children: React.ReactNode }) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuthUser(): User {
  const user = useContext(AuthContext);
  if (!user) {
    throw new Error("useAuthUser() must be used within an <AuthGuard>/<AuthProvider> tree");
  }
  return user;
}
