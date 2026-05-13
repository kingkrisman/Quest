import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface AuthUser {
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  setEmail: (email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: false, setEmail: () => {}, logout: () => {} });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('userEmail');
    if (savedEmail) {
      setUser({ email: savedEmail });
    }
  }, []);

  const setEmail = (email: string) => {
    if (email.trim()) {
      setUser({ email });
      localStorage.setItem('userEmail', email);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('userEmail');
  };

  return (
    <AuthContext.Provider value={{ user, loading, setEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
