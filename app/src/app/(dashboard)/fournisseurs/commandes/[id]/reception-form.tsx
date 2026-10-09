"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { cn } from "@/lib/utils";
import { receivePurchaseOrder } from "../../actions";

interface ReceptionLine {
  itemId: string;
  label: string;
  quantityOrdered: number;
  quantityReceived: number;
}

const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ReceptionForm({
  purchaseOrderId,
  lines,
  cancelled,
  canReceive = true,
}: {
  purchaseOrderId: string;
  lines: ReceptionLine[];
  cancelled: boolean;
  // Recevoir de la marchandise modifie le stock de l'entrepôt central :
  // réservé à Logistique/Super Admin côté serveur (voir fournisseurs/actions.ts).
  // Un Caissier avec l'accès "fournisseurs" en plus peut consulter la
  // commande mais ne voit ici qu'un état en lecture seule, jamais les
  // contrôles de saisie.
  canReceive?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(
      lines.map((l) => [l.itemId, Math.max(l.quantityOrdered - l.quantityReceived, 0)])
    )
  );

  const totalOrdered = lines.reduce((s, l) => s + l.quantityOrdered, 0);
  const totalReceived = lines.reduce((s, l) => s + l.quantityReceived, 0);
  const pendingLines = lines.filter((l) => l.quantityReceived < l.quantityOrdered);
  const pct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
  const isComplete = pendingLines.length === 0;
  const remaining = totalOrdered - totalReceived;

  const manualLinesToSend = pendingLines
    .map((l) => ({
      itemId: l.itemId,
      label: l.label,
      quantityReceivedNow: values[l.itemId] || 0,
    }))
    .filter((l) => l.quantityReceivedNow > 0);

  const allLinesToSend = pendingLines.map((l) => ({
    itemId: l.itemId,
    label: l.label,
    quantityReceivedNow: l.quantityOrdered - l.quantityReceived,
  }));

  async function submitLines(
    linesToSend: { itemId: string; quantityReceivedNow: number }[]
  ) {
    await receivePurchaseOrder(purchaseOrderId, { lines: linesToSend });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Résumé : avancement visible immédiatement, action principale mise en avant */}
      {cancelled ? (
        <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          Cette commande est annulée, aucune réception possible.
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="relative size-20 shrink-0">
            <svg width="80" height="80" viewBox="0 0 100 100" className="-rotate-90">
              <circle
                cx="50"
                cy="50"
                r={RING_RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-primary/15"
              />
              <circle
                cx="50"
                cy="50"
                r={RING_RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                className={isComplete ? "text-emerald-500" : "text-primary"}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-base font-extrabold text-primary">
              {pct}%
            </div>
          </div>
          <div className="min-w-48 flex-1">
            <p className="text-xl font-extrabold">
              {totalReceived} / {totalOrdered} article{totalOrdered > 1 ? "s" : ""} reçus
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isComplete
                ? "Tous les articles ont été reçus."
                : `${remaining} article${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""} sur ${pendingLines.length} ligne${pendingLines.length > 1 ? "s" : ""}.`}
            </p>
          </div>
          {!isComplete && canReceive && (
            <ConfirmActionButton
              trigger={
                <>
                  <Zap className="mr-2 size-4" />
                  Tout recevoir en un clic
                </>
              }
              triggerSize="lg"
              title="Confirmer la réception complète"
              description="Ces quantités seront ajoutées au stock de l'entrepôt et la dette fournisseur sera mise à jour en conséquence."
              confirmLabel="Confirmer la réception"
              pendingLabel="Enregistrement..."
              successMessage="Réception enregistrée avec succès"
              onConfirm={() =>
                submitLines(
                  allLinesToSend.map(({ itemId, quantityReceivedNow }) => ({
                    itemId,
                    quantityReceivedNow,
                  }))
                )
              }
            >
              <div className="max-h-56 space-y-1.5 overflow-y-auto">
                {allLinesToSend.map((l) => (
                  <div
                    key={l.itemId}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{l.label}</span>
                    <span className="font-figures font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{l.quantityReceivedNow}
                    </span>
                  </div>
                ))}
              </div>
            </ConfirmActionButton>
          )}
        </div>
      )}

      {/* Table unifiée : commandé / déjà reçu / avancement / reçu maintenant — une seule source de vérité */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b p-4">
          <p className="text-sm font-bold">Lignes de la commande</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Produit</th>
                <th className="px-4 py-2.5 text-center">Commandé</th>
                <th className="px-4 py-2.5 text-center">Déjà reçu</th>
                <th className="w-40 px-4 py-2.5">Avancement</th>
                <th className="px-4 py-2.5 text-center">Reçu maintenant</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const lineComplete = line.quantityReceived >= line.quantityOrdered;
                const linePct =
                  line.quantityOrdered > 0
                    ? Math.round((line.quantityReceived / line.quantityOrdered) * 100)
                    : 0;
                const max = line.quantityOrdered - line.quantityReceived;
                return (
                  <tr key={line.itemId} className="border-t">
                    <td className="px-4 py-3 font-semibold">{line.label}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {line.quantityOrdered}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {line.quantityReceived}
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            lineComplete ? "bg-emerald-500" : "bg-amber-500"
                          )}
                          style={{ width: `${linePct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Input
                        type="number"
                        min={0}
                        max={max}
                        disabled={cancelled || lineComplete || !canReceive}
                        className="mx-auto w-20 text-center font-semibold disabled:opacity-40"
                        value={lineComplete ? 0 : (values[line.itemId] ?? 0)}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [line.itemId]: Math.min(Number(e.target.value) || 0, max),
                          }))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!cancelled && !isComplete && canReceive && (
          <div className="flex justify-end border-t p-4">
            <ConfirmActionButton
              trigger={
                <>
                  <Check className="mr-2 size-4" />
                  Enregistrer la réception
                </>
              }
              triggerSize="lg"
              disabled={manualLinesToSend.length === 0}
              title="Confirmer la réception"
              description="Ces quantités seront ajoutées au stock de l'entrepôt et la dette fournisseur sera mise à jour en conséquence."
              confirmLabel="Confirmer la réception"
              pendingLabel="Enregistrement..."
              successMessage="Réception enregistrée avec succès"
              onConfirm={() =>
                submitLines(
                  manualLinesToSend.map(({ itemId, quantityReceivedNow }) => ({
                    itemId,
                    quantityReceivedNow,
                  }))
                )
              }
            >
              <div className="max-h-56 space-y-1.5 overflow-y-auto">
                {manualLinesToSend.map((l) => (
                  <div
                    key={l.itemId}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{l.label}</span>
                    <span className="font-figures font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{l.quantityReceivedNow}
                    </span>
                  </div>
                ))}
              </div>
            </ConfirmActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
