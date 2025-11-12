'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getToken, getUser, setAuth, clearAuth, User, getRole } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Load auth state from storage on mount
    const storedToken = getToken();
    const storedUser = getUser();
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
      
      // Also set in cookies for server-side API routes (if not already set)
      if (typeof window !== 'undefined') {
        const tokenCookie = document.cookie.split('; ').find(row => row.startsWith('ps:auth:token='));
        if (!tokenCookie) {
          document.cookie = `ps:auth:token=${storedToken}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
          document.cookie = `ps:auth:user=${JSON.stringify(storedUser)}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
        }
      }
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    // Redirect to login if not authenticated and trying to access protected routes
    if (!loading) {
      const isAuthPage = pathname === '/login';
      const isAuthenticated = !!token;

      if (!isAuthenticated && !isAuthPage) {
        router.replace('/login');
      } else if (isAuthenticated && isAuthPage) {
        // Redirect based on role
        const role = getRole();
        if (role === 'admin') {
          router.replace('/admin');
        } else {
          router.replace('/portal');
        }
      }
    }
  }, [token, loading, pathname, router]);

  const login = (newToken: string, newUser: User) => {
    setAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    
    // Redirect based on role
    const role = getRole();
    if (role === 'admin') {
      router.replace('/admin');
    } else {
      router.replace('/portal');
    }
  };

  const logout = () => {
    clearAuth();
    setToken(null);
    setUser(null);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

