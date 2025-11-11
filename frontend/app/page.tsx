'use client';
import { useEffect } from "react";
import { getRole } from "../lib/session";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const role = getRole();
    if (role === "admin") router.replace("/admin");
    else if (role === "participant") router.replace("/portal");
    else router.replace("/login");
  }, [router]);
  return null;
}
