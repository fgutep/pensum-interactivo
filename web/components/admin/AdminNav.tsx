"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/administrador", label: "Catálogos", exact: true },
  { href: "/administrador/importar", label: "Importar" },
  { href: "/administrador/electivas", label: "Electivas" },
  { href: "/administrador/requisitos", label: "Requisitos de grado" },
  { href: "/administrador/auditoria", label: "Auditoría" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/administrador/login");
    router.refresh();
  }

  return (
    <nav className="admin-side">
      <div className="admin-side-brand">
        Pensum
        <small>administración</small>
      </div>
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`admin-nav-link${active ? " active" : ""}`}
          >
            {l.label}
          </Link>
        );
      })}
      <div className="admin-side-spacer" />
      <button className="admin-logout" onClick={logout}>
        Cerrar sesión
      </button>
    </nav>
  );
}
