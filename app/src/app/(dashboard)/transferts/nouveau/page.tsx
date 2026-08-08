import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { TransferForm } from "../transfer-form";

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} — ${details}` : product.name;
}

export default async function NouveauTransfertPage() {
  await requirePageAccess("transferts");

  const [boutiques, variants] = await Promise.all([
    prisma.boutique.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.productVariant.findMany({
      where: { active: true },
      include: { product: { select: { name: true } } },
      orderBy: { product: { name: "asc" } },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nouveau transfert
        </h1>
        <p className="text-sm text-muted-foreground">
          Le stock ne sera déplacé qu&apos;à la confirmation de réception.
        </p>
      </div>
      <TransferForm
        boutiques={boutiques.map((b) => ({ id: b.id, label: b.name }))}
        variants={variants.map((v) => ({ id: v.id, label: variantLabel(v.product, v) }))}
      />
    </div>
  );
}
