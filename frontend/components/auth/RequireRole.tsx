'use client';
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

type Role = 'admin' | 'participant';

export function RequireRole(props: { role: Role; children: ReactNode }) {
  const { role, children } = props;
  const { loading, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const userRole = user ? (user.role === 'admin' ? 'admin' : 'participant') : null;

  useEffect(() => {
    if (!loading && (!isAuthenticated || userRole !== role)) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (userRole === 'admin' && role === 'participant') {
        router.replace('/admin');
      } else if (userRole === 'participant' && role === 'admin') {
        router.replace('/portal');
      }
    }
  }, [loading, isAuthenticated, userRole, role, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-zinc-600">
        Checking access…
      </div>
    );
  }

  if (!isAuthenticated || userRole !== role) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-zinc-600">
        Access denied. Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}


