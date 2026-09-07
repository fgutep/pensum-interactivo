import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CatalogEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalog = await prisma.catalog.findUnique({ where: { slug } });
  if (!catalog) notFound();

  return (
    <>
      <p className="admin-sub">
        <Link href="/administrador">← Catálogos</Link>
      </p>
      <h1>{catalog.programName}{catalog.variantLabel ? ` · ${catalog.variantLabel}` : ""}</h1>
      <p className="admin-sub">
        <code>{catalog.slug}</code> · {catalog.term} · {catalog.status}
      </p>
      <p>Editor de catálogo — en construcción (P2.2).</p>
    </>
  );
}
