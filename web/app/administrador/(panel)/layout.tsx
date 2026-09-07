import AdminNav from "@/components/admin/AdminNav";

// Middleware already gates /administrador/*; this layout just draws the shell.
export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <AdminNav />
      <main className="admin-main">{children}</main>
    </div>
  );
}
