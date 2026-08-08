"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSale } from "./actions";

interface VariantForSale {
  id: string;
  label: string;
  sku: string | null;
  barcode: string | null;
  sellingPrice: number;
  stockByBoutique: Record<string, number>;
}

interface CartLine {
  variantId: string;
  label: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  maxStock: number;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  ORANGE_MONEY: "Orange Money",
  WAVE: "Wave",
  CARTE: "Carte",
  VIREMENT: "Virement",
};

const NO_CUSTOMER = "__none__";

export function CaisseClient({
  boutiques,
  variants,
  customers,
  currency,
}: {
  boutiques: { id: string; name: string }[];
  variants: VariantForSale[];
  customers: { id: string; name: string }[];
  currency: string;
}) {
  const router = useRouter();
  const [boutiqueId, setBoutiqueId] = useState(boutiques[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>(NO_CUSTOMER);
  const [payments, setPayments] = useState<{ method: string; amount: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return variants
      .filter(
        (v) =>
          v.label.toLowerCase().includes(q) ||
          v.sku?.toLowerCase().includes(q) ||
          v.barcode?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, variants]);

  const total = cart.reduce(
    (sum, l) => sum + l.quantity * l.unitPrice - l.discount,
    0
  );
  const paidTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const remaining = Math.round((total - paidTotal) * 100) / 100;

  function addToCart(variant: VariantForSale) {
    const stock = variant.stockByBoutique[boutiqueId] ?? 0;
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) {
        if (existing.quantity + 1 > stock) {
          toast.error("Stock insuffisant pour cette quantité.");
          return prev;
        }
        return prev.map((l) =>
          l.variantId === variant.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      if (stock < 1) {
        toast.error("Aucun stock disponible pour cet article dans cette boutique.");
        return prev;
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          label: variant.label,
          quantity: 1,
          unitPrice: variant.sellingPrice,
          discount: 0,
          maxStock: stock,
        },
      ];
    });
    setQuery("");
  }

  function updateLine(variantId: string, patch: Partial<CartLine>) {
    setCart((prev) =>
      prev.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l))
    );
  }

  function removeLine(variantId: string) {
    setCart((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  function addPaymentLine() {
    setPayments((prev) => [
      ...prev,
      { method: "ESPECES", amount: Math.max(remaining, 0) },
    ]);
  }

  async function handleSubmit() {
    if (cart.length === 0) {
      toast.error("Le panier est vide.");
      return;
    }
    // Une ligne à 0 (ex. bouton "Ajouter" cliqué deux fois par erreur) ne
    // doit pas être envoyée : elle passerait la vérification de somme
    // ci-dessous tout en étant rejetée par la validation stricte du
    // serveur (chaque paiement doit être strictement positif).
    const nonZeroPayments = payments.filter((p) => p.amount > 0);
    if (nonZeroPayments.length === 0) {
      toast.error("Ajoutez au moins un moyen de paiement.");
      return;
    }
    if (Math.abs(remaining) > 0.01) {
      toast.error("Le total des paiements doit correspondre au total du panier.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createSale({
        boutiqueId,
        customerId: customerId === NO_CUSTOMER ? null : customerId,
        items: cart.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
        })),
        payments: nonZeroPayments.map((p) => ({
          method: p.method as
            | "ESPECES"
            | "ORANGE_MONEY"
            | "WAVE"
            | "CARTE"
            | "VIREMENT",
          amount: p.amount,
        })),
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`Vente ${result.data.reference} enregistrée`);
      router.push(`/ventes/${result.data.id}`);
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {boutiques.length > 1 && (
          <div className="max-w-xs space-y-2">
            <Label>Boutique</Label>
            <Select
              value={boutiqueId}
              onValueChange={(v) => setBoutiqueId(v ?? boutiques[0]?.id ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {() => boutiques.find((b) => b.id === boutiqueId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {boutiques.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recherche produit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Nom, SKU ou code-barres..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {results.length > 0 && (
              <div className="mt-2 divide-y rounded-md border">
                {results.map((v) => {
                  const stock = v.stockByBoutique[boutiqueId] ?? 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => addToCart(v)}
                      disabled={stock < 1}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>{v.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {stock} en stock · {v.sellingPrice} {currency}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Panier</CardTitle>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Recherchez un produit ci-dessus pour l&apos;ajouter au panier.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Qté</TableHead>
                      <TableHead>Prix unit.</TableHead>
                      <TableHead>Remise</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((line) => (
                      <TableRow key={line.variantId}>
                        <TableCell className="font-medium">{line.label}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={line.maxStock}
                            className="w-16"
                            value={line.quantity}
                            onChange={(e) =>
                              updateLine(line.variantId, {
                                quantity: Math.min(
                                  Number(e.target.value) || 1,
                                  line.maxStock
                                ),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            className="w-24"
                            value={line.unitPrice}
                            onChange={(e) =>
                              updateLine(line.variantId, {
                                unitPrice: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            className="w-20"
                            value={line.discount}
                            onChange={(e) =>
                              updateLine(line.variantId, {
                                discount: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {(line.quantity * line.unitPrice - line.discount).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(line.variantId)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client (optionnel)</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={customerId}
              onValueChange={(v) => setCustomerId(v ?? NO_CUSTOMER)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) =>
                    v === NO_CUSTOMER
                      ? "Client de passage"
                      : customers.find((c) => c.id === v)?.name
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CUSTOMER}>Client de passage</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Paiement</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addPaymentLine}>
              <Plus className="mr-1 size-4" />
              Ajouter
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.map((p, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={p.method}
                  onValueChange={(v) =>
                    setPayments((prev) =>
                      prev.map((x, i) =>
                        i === index ? { ...x, method: v ?? x.method } : x
                      )
                    )
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue>
                      {(v: string) => PAYMENT_METHOD_LABELS[v]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  className="flex-1"
                  value={p.amount}
                  onChange={(e) =>
                    setPayments((prev) =>
                      prev.map((x, i) =>
                        i === index ? { ...x, amount: Number(e.target.value) || 0 } : x
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setPayments((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {payments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ajoutez un ou plusieurs moyens de paiement.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">
                {total.toLocaleString()} {currency}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payé</span>
              <span>{paidTotal.toLocaleString()} {currency}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>Reste à payer</span>
              <span className={remaining !== 0 ? "text-destructive" : "text-emerald-600"}>
                {remaining.toLocaleString()} {currency}
              </span>
            </div>
            <Button
              className="mt-3 w-full"
              disabled={isSubmitting || cart.length === 0}
              onClick={handleSubmit}
            >
              {isSubmitting ? "Enregistrement..." : "Valider la vente"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
