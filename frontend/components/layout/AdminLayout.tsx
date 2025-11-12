'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { Calendar, Users, Car, MapPin, FileText, UserCog, LogOut, LucideIcon, Menu, X } from "lucide-react";
import { RequireRole } from "../../components/auth/RequireRole";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "../ui/Button";

const nav: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/admin", label: "Days", icon: Calendar },
  { href: "/admin/participants", label: "Participants", icon: Users },
  { href: "/admin/users", label: "Users", icon: UserCog },
  { href: "/admin/vehicles", label: "Vehicles", icon: Car },
  { href: "/admin/locations", label: "Locations", icon: MapPin },
  { href: "/admin/itinerary", label: "Itinerary", icon: FileText },
];

function NavLink({ href, label, icon: Icon, onNavigate }: { href: string; label: string; icon: LucideIcon; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active =
    href === "/admin"
      ? pathname === "/admin" || pathname.startsWith("/admin/days/")
      : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function AdminLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const SidebarContent = () => (
    <>
      <div className="border-b border-zinc-200 p-4 flex-shrink-0">
        <div className="font-semibold text-zinc-900">Admin</div>
      </div>
      <nav className="flex-1 overflow-y-auto space-y-1 p-3">
        {nav.map((n) => (
          <NavLink key={n.href} href={n.href} label={n.label} icon={n.icon} />
        ))}
      </nav>
      <div className="border-t border-zinc-200 p-3 flex-shrink-0">
        <Button variant="secondary" onClick={logout} className="w-full flex items-center justify-center gap-2">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <RequireRole role="admin">
      <div className="flex h-screen bg-zinc-50 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 border-r border-zinc-200 bg-white h-screen flex-shrink-0">
          <div className="flex flex-col h-full w-full">
            <SidebarContent />
          </div>
        </aside>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <aside className="fixed left-0 top-0 h-full w-64 border-r border-zinc-200 bg-white z-50">
              <div className="flex flex-col h-full w-full">
                <div className="border-b border-zinc-200 p-4 flex items-center justify-between flex-shrink-0">
                  <div className="font-semibold text-zinc-900">Admin</div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 hover:bg-zinc-100 rounded-md"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="flex-1 overflow-y-auto space-y-1 p-3">
                  {nav.map((n) => (
                    <NavLink key={n.href} href={n.href} label={n.label} icon={n.icon} onNavigate={() => setMobileMenuOpen(false)} />
                  ))}
                </nav>
                <div className="border-t border-zinc-200 p-3 flex-shrink-0">
                  <Button variant="secondary" onClick={logout} className="w-full flex items-center justify-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="mx-auto max-w-6xl p-4 md:p-6">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between mb-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 hover:bg-zinc-100 rounded-md"
              >
                <Menu className="h-6 w-6" />
              </button>
              {title && <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>}
              <div className="w-10" /> {/* Spacer for centering */}
            </div>
            {title && <h1 className="hidden md:block mb-6 text-2xl font-semibold text-zinc-900">{title}</h1>}
            {children}
          </div>
        </main>
      </div>
    </RequireRole>
  );
}


