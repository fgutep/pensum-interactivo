import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pensum Interactivo — IELE / IELC",
  description:
    "Explora el pensum sugerido de Ingeniería Eléctrica y Electrónica y planea tu semestre.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (translators, etc.) mutate
    // <html>/<body> attributes before React hydrates; this is the recommended
    // way to stop that from being reported as an app hydration mismatch.
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
