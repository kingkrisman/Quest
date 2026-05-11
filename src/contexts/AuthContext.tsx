import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../lib/supabase";

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAdmin: false });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const authUser: AuthUser = {
          id: session.user.id,
          email: session.user.email || '',
          displayName: session.user.user_metadata?.full_name || "Anonymous Player",
          photoURL: session.user.user_metadata?.avatar_url || null,
        };
        setUser(authUser);

        const { data: existing } = await supabase
          .from('users')
          .select('*')
          .eq('uid', session.user.id)
          .single();

        if (!existing) {
          await supabase.from('users').insert({
            uid: session.user.id,
            display_name: authUser.displayName,
            email: authUser.email,
            photo_url: authUser.photoURL,
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}
