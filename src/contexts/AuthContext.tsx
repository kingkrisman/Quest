import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useStore } from "../lib/store";
import { encodeAvatar } from "../components/ui";
import type { ColorKey } from "../components/icons";

/**
 * Sign-in is temporarily disabled. Everyone is a local guest whose identity
 * (id, name, color) lives in the on-device store. Components keep calling
 * useAuth(), so real auth can be restored later by swapping this provider.
 */

export interface AppUser {
  id: string;
  name: string;
  color: ColorKey;
  /** Stored on live-game participants so other players see the same monogram. */
  avatar: string;
}

interface AuthContextType {
  user: AppUser;
  loading: false;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useIsDark() {
  const { settings } = useStore();
  return settings.theme === "dark" || (settings.theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { profile, settings } = useStore();
  const user: AppUser = { id: profile.id, name: profile.name, color: profile.color, avatar: encodeAvatar(profile.color) };

  // Theme lives here because every page renders inside this provider.
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.classList.toggle("dark", settings.theme === "dark" || (settings.theme === "system" && media.matches));
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);

  return <AuthContext.Provider value={{ user, loading: false }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
