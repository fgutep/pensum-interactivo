import { prisma } from "@/lib/db";
import ElectiveTable, {
  type EditorElective,
} from "@/components/admin/ElectiveTable";

export const dynamic = "force-dynamic";

export default async function ElectivasPage() {
  const rows = await prisma.elective.findMany({ orderBy: { name: "asc" } });
  const electives: EditorElective[] = rows.map((e) => ({
    id: e.id,
    name: e.name,
    code: e.code ?? "",
    level: e.level,
    ciclo: e.ciclo ?? "",
    isCursoIntegrador: e.isCursoIntegrador,
    offeredTerms: ((e.offeredTerms as unknown as string[] | null) ?? []).join(", "),
    roles: (e.roles as unknown as EditorElective["roles"]) ?? {
      eleFrom2024: { norm: null, raw: "" },
      elcFrom2024: { norm: null, raw: "" },
      eleUntil2023: { norm: null, raw: "" },
      elcUntil2023: { norm: null, raw: "" },
    },
  }));

  return (
    <>
      <h1>Electivas</h1>
      <p className="admin-sub">
        Bolsa de electivas ({electives.length}). Los 4 roles indican para qué
        cuenta cada electiva por programa y era del pensum.
      </p>
      <ElectiveTable electives={electives} />
    </>
  );
}
