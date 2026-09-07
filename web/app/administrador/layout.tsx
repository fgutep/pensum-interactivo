import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Administración — Pensum Interactivo",
  robots: { index: false, follow: false },
};

// Pass-through: the real shell lives in (panel)/layout.tsx so the login page
// (also under /administrador) renders without the sidebar.
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="admin-root">{children}</div>;
}
