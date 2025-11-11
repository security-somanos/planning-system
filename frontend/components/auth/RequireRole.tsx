'use client';
import { ReactNode, useEffect, useState } from "react";
import { getRole, Role } from "../../lib/session";
import { useRouter } from "next/navigation";

export function RequireRole(props: { role: Role; children: ReactNode }) {
  const { role, children } = props;
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const r = getRole();
    if (r !== role) {
      router.replace("/login");
      return;
    }
    setOk(true);
  }, [router, role]);

  if (!ok) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-zinc-600">
        Checking access…
      </div>
    );
  }
  return <>{children}</>;
}


