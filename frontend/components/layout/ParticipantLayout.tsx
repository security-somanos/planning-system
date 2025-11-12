'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Calendar, FileText, LogOut, LucideIcon } from "lucide-react";
import { RequireRole } from "../../components/auth/RequireRole";
import { Button } from "../ui/Button";
import { useAuth } from "@/contexts/AuthContext";

const nav: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/portal", label: "My Agenda", icon: Calendar },
  { href: "/portal/itinerary", label: "Itinerary", icon: FileText },
];

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function ParticipantLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { logout } = useAuth();
  return (
    <RequireRole role="participant">
      <div className="flex min-h-screen bg-zinc-50">
        {/* Sidebar */}
        <aside className="w-64 border-r border-zinc-200 bg-white">
          <div className="flex h-full flex-col">
            <div className="border-b border-zinc-200 p-4">
              <div className="font-semibold text-zinc-900">My Portal</div>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {nav.map((n) => (
                <NavLink key={n.href} href={n.href} label={n.label} icon={n.icon} />
              ))}
            </nav>
            <div className="border-t border-zinc-200 p-3">
              <Button variant="secondary" onClick={logout} className="w-full flex items-center justify-center gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl p-6">
            {title && <h1 className="mb-6 text-2xl font-semibold text-zinc-900">{title}</h1>}
            {children}
          </div>
        </main>
      </div>
    </RequireRole>
  );
}


