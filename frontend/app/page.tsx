'use client';
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getRole } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();
  
  useEffect(() => {
    if (loading) return;
    
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    
    const role = getRole();
    if (role === "admin") router.replace("/admin");
    else if (role === "participant") router.replace("/portal");
    else router.replace("/login");
  }, [router, loading, isAuthenticated]);
  
  return null;
}
