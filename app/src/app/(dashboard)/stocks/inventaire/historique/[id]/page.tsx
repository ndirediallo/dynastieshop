import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { cn } from "@/lib/utils";
import { DownloadPdfButton } from "./download-pdf-button";

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} · ${details}` : product.name;
}

export default async function InventorySessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("stocks");
  const { id } = await params;

  const [session, settings] = await Promise.all([
    prisma.inventorySession.findUnique({
      where: { id },
      include: {
        boutique: { select: { name: true } },
        user: { select: { name: true } },
        lines: {
          include: { variant: { include: { product: { select: { name: true } } } } },
          orderBy: { id: "asc" },
        },
      },
    }),
    getSettings(),
  ]);

  if (!session) notFound();

  const lines = session.lines
    .map((l) => ({
      label: variantLabel(l.variant.product, l.variant),
      theoreticalQuantity: l.theoreticalQuantity,
      countedQuantity: l.countedQuantity,
      delta: l.delta,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="max-w-3xl space-y-6">
      <BackButton label="Historique" />

      <PageHeader
        icon={ClipboardList}
        title={`Inventaire ${session.reference}`}
        description={`${session.boutique.name} · ${new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
        }).format(session.createdAt)}`}
        tint="amber"
        actions={
          <DownloadPdfButton
            session={{
              reference: session.reference,
              boutiqueName: session.boutique.name,
              userName: session.user?.name ?? "—",
              createdAt: session.createdAt.toISOString(),
            }}
            lines={lines}
            company={{ name: settings.companyName, address: settings.address, phone: settings.phone }}
          />
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Comptés par</p>
          <p className="mt-1 font-semibold">{session.user?.name ?? "—"}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Produits comptés</p>
          <p className="mt-1 font-figures text-xl font-bold tabular-nums">{session.lineCount}</p>
        </div>
        <div
          className={cn(
            "rounded-xl border p-4",
            session.changeCount > 0
              ? "border-amber-500/20 bg-amber-500/5"
              : "border-emerald-500/20 bg-emerald-500/5"
          )}
        >
          <p
            className={cn(
              "text-xs font-bold",
              session.changeCount > 0
                ? "text-amber-700 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
            )}
          >
            Écarts
          </p>
          <p
            className={cn(
              "mt-1 font-figures text-xl font-bold tabular-nums",
              session.changeCount > 0
                ? "text-amber-700 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {session.changeCount}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail du comptage</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Théorique</TableHead>
                <TableHead>Compté</TableHead>
                <TableHead>Écart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => (
                <TableRow
                  key={index}
                  className={cn(
                    line.delta > 0 && "bg-amber-500/5",
                    line.delta < 0 && "bg-destructive/5"
                  )}
                >
                  <TableCell className="font-medium">{line.label}</TableCell>
                  <TableCell className="font-figures tabular-nums text-muted-foreground">
                    {line.theoreticalQuantity}
                  </TableCell>
                  <TableCell className="font-figures tabular-nums">
                    {line.countedQuantity}
                  </TableCell>
                  <TableCell>
                    {line.delta === 0 ? (
                      <span className="font-figures text-muted-foreground">0</span>
                    ) : (
                      <Badge
                        variant={line.delta > 0 ? "secondary" : "destructive"}
                        className={cn(
                          "font-figures",
                          line.delta > 0 &&
                            "bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                        )}
                      >
                        {line.delta > 0 ? `+${line.delta}` : line.delta}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
