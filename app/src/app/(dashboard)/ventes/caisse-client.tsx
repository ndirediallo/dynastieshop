"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  X,
  Minus,
  Plus,
  Check,
  ShoppingCart,
  Banknote,
  Smartphone,
  Waves,
  CreditCard,
  Landmark,
  ClipboardList,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionIcon } from "@/components/section-icon";
import { AmountInput } from "@/components/amount-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createSale } from "./actions";
import { createCustomer } from "../clients/actions";

interface VariantForSale {
  id: string;
  detail: string;
  sku: string | null;
  barcode: string | null;
  sellingPrice: number;
  alertThreshold: number;
  stockByBoutique: Record<string, number>;
}

interface ProductForSale {
  id: string;
  name: string;
  photoUrl: string | null;
  categoryId: string | null;
  variants: VariantForSale[];
}

interface CartLine {
  productId: string;
  variantId: string;
  label: string;
  quantity: number;
  unitPrice: number;
  maxStock: number;
}

const NO_CUSTOMER = "__none__";
const CREATE_CUSTOMER = "__create__";
const QUICK_DISCOUNTS = [5, 10, 15, 20];

const PAYMENT_OPTIONS = [
  { value: "ESPECES", label: "Espèces", icon: Banknote },
  { value: "ORANGE_MONEY", label: "Orange Money", icon: Smartphone },
  { value: "MTN_MONEY", label: "MTN Mobile Money", icon: Smartphone },
  { value: "WAVE", label: "Wave", icon: Waves },
  { value: "CARTE", label: "Carte Bancaire", icon: CreditCard },
  { value: "VIREMENT", label: "Virement", icon: Landmark },
] as const;

type PaymentMethodValue = (typeof PAYMENT_OPTIONS)[number]["value"];

interface PaymentRow {
  key: string;
  method: PaymentMethodValue | null;
  amount: string;
  cashReceived: string;
}

// Coupures courantes en GNF, utilisées pour proposer des montants reçus en
// un clic plutôt que de tout taper au clavier.
const COMMON_DENOMINATIONS = [5000, 10000, 20000, 50000, 100000, 200000, 500000];

export function CaisseClient({
  boutiques,
  products,
  categories,
  customers,
  currency,
  activeMethods = PAYMENT_OPTIONS.map((o) => o.value),
  maxDiscountPercent = 100,
  defaultDeliveryFee = 0,
}: {
  boutiques: { id: string; name: string }[];
  products: ProductForSale[];
  categories: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  currency: string;
  // Paramètres → Méthodes de paiement actives — par défaut toutes, pour ne
  // jamais casser un appelant qui ne passe pas (encore) cette prop.
  activeMethods?: string[];
  // Plafond déjà résolu côté serveur (100 = pas de limite, cas du Super
  // Admin — voir ventes/page.tsx) : ce composant n'a pas besoin de
  // connaître le rôle, juste la valeur effective à respecter.
  maxDiscountPercent?: number;
  // Paramètres → Livraison : pré-remplit le champ livraison, toujours
  // modifiable vente par vente (voir discussion avec l'utilisateur : pas de
  // grille de tarifs par zone, juste un défaut éditable).
  defaultDeliveryFee?: number;
}) {
  const router = useRouter();
  const paymentOptions = useMemo(
    () => PAYMENT_OPTIONS.filter((o) => activeMethods.includes(o.value)),
    [activeMethods]
  );
  const [boutiqueId, setBoutiqueId] = useState(boutiques[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pickerProduct, setPickerProduct] = useState<ProductForSale | null>(null);
  const [customerList, setCustomerList] = useState(customers);
  const [customerId, setCustomerId] = useState<string>(NO_CUSTOMER);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerPhone, setQuickCustomerPhone] = useState("");
  const [quickCustomerSubmitting, setQuickCustomerSubmitting] = useState(false);
  const [discountMode, setDiscountMode] = useState<"PERCENT" | "AMOUNT">("PERCENT");
  const [discountValue, setDiscountValue] = useState(0);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(defaultDeliveryFee);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [clearCartDialogOpen, setClearCartDialogOpen] = useState(false);
  const [saleMode, setSaleMode] = useState<"NORMAL" | "CREDIT">("NORMAL");
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { key: "row-1", method: null, amount: "", cashReceived: "" },
  ]);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<PaymentMethodValue | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (activeCategoryId && p.categoryId !== activeCategoryId) return false;
      if (!q) return true;
      if (p.name.toLowerCase().includes(q)) return true;
      return p.variants.some(
        (v) =>
          v.sku?.toLowerCase().includes(q) ||
          v.barcode?.toLowerCase().includes(q) ||
          v.detail.toLowerCase().includes(q)
      );
    });
    // Les produits en rupture dans la boutique sélectionnée sont relégués en
    // fin de grille — jamais masqués, juste écartés de la zone de lecture
    // principale pour que l'œil se concentre sur ce qui est vendable tout
    // de suite. Le tri par groupe (en stock / rupture) est stable : l'ordre
    // d'origine est conservé à l'intérieur de chaque groupe.
    return [...filtered].sort((a, b) => {
      const stockA = a.variants.reduce((sum, v) => sum + (v.stockByBoutique[boutiqueId] ?? 0), 0);
      const stockB = b.variants.reduce((sum, v) => sum + (v.stockByBoutique[boutiqueId] ?? 0), 0);
      return (stockA <= 0 ? 1 : 0) - (stockB <= 0 ? 1 : 0);
    });
  }, [query, activeCategoryId, products, boutiqueId]);

  const productCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (!p.categoryId) continue;
      map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const cartQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) {
      map.set(line.productId, (map.get(line.productId) ?? 0) + line.quantity);
    }
    return map;
  }, [cart]);

  const subtotal = cart.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const discountAmount =
    subtotal <= 0
      ? 0
      : discountMode === "PERCENT"
        ? Math.round((subtotal * Math.min(Math.max(discountValue, 0), 100)) / 100)
        : Math.min(Math.max(discountValue, 0), subtotal);
  const effectiveDeliveryFee = deliveryEnabled ? Math.max(0, deliveryFee) : 0;
  const total = subtotal - discountAmount + effectiveDeliveryFee;
  const cashSuggestions = useMemo(() => {
    const extras = COMMON_DENOMINATIONS.filter((d) => d > total).slice(0, 3);
    return [total, ...extras];
  }, [total]);
  const deposit = Math.min(Number(depositAmount) || 0, total);
  const creditBalance = Math.max(0, total - deposit);

  // Paiement mixte : tant qu'il n'y a qu'une seule ligne, son montant est
  // implicitement le total (comportement identique à avant) — l'utilisateur
  // ne voit un champ montant éditable qu'à partir du moment où il ajoute une
  // deuxième ligne. C'est uniquement à ce moment que "amount" devient réel.
  const isSplit = paymentRows.length > 1;
  const rowAmount = (row: PaymentRow) => (isSplit ? Number(row.amount) || 0 : total);
  const paymentRowsTotal = paymentRows.reduce((sum, r) => sum + rowAmount(r), 0);
  const remainingToAllocate = Math.round((total - paymentRowsTotal) * 100) / 100;
  const splitAmountsValid = !isSplit || Math.abs(remainingToAllocate) <= 0.01;
  const allRowsHaveMethod = paymentRows.every((r) => !!r.method);
  const rowChangeDue = (row: PaymentRow) =>
    Math.max(0, (Number(row.cashReceived) || 0) - rowAmount(row));
  const rowCashOk = (row: PaymentRow) =>
    row.method !== "ESPECES" || (Number(row.cashReceived) || 0) >= rowAmount(row);

  const canValidatePayment =
    total > 0 &&
    (saleMode === "CREDIT"
      ? customerId !== NO_CUSTOMER && (deposit === 0 || !!depositMethod)
      : allRowsHaveMethod && splitAmountsValid && paymentRows.every(rowCashOk));

  function updatePaymentRow(key: string, patch: Partial<PaymentRow>) {
    setPaymentRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // Bascule en mode "paiement mixte" : fige le montant de la ligne en cours
  // (jusque-là implicite = total) puis ajoute une ligne vide pour le reste.
  function addPaymentRow() {
    setPaymentRows((prev) => {
      const withExplicitAmount = prev.map((r) =>
        r.amount === "" ? { ...r, amount: String(total) } : r
      );
      const used = withExplicitAmount.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const remaining = Math.max(0, Math.round((total - used) * 100) / 100);
      return [
        ...withExplicitAmount,
        {
          key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          method: null,
          amount: remaining > 0 ? String(remaining) : "",
          cashReceived: "",
        },
      ];
    });
  }

  // En repassant à une seule ligne, on efface son montant pour revenir au
  // mode simple (montant de nouveau implicite = total).
  function removePaymentRow(key: string) {
    setPaymentRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      if (next.length === 0) return prev;
      return next.length === 1 ? [{ ...next[0], amount: "" }] : next;
    });
  }

  // Le stock affiché et vérifié (maxStock de chaque ligne, tuiles produits)
  // dépend entièrement de la boutique sélectionnée — un panier constitué
  // pour une boutique n'a aucun sens pour une autre. On le vide donc dès
  // qu'on change d'emplacement plutôt que de risquer une vente qui
  // décrémente le mauvais stock.
  function handleBoutiqueChange(nextId: string) {
    if (nextId === boutiqueId) return;
    setBoutiqueId(nextId);
    if (cart.length > 0) {
      setCart([]);
      toast.info("Panier vidé, le stock dépend de la boutique sélectionnée.");
    }
  }

  function addVariantToCart(product: ProductForSale, variant: VariantForSale) {
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
          productId: product.id,
          variantId: variant.id,
          label: variant.detail === "Standard" ? product.name : `${product.name} · ${variant.detail}`,
          quantity: 1,
          unitPrice: variant.sellingPrice,
          maxStock: stock,
        },
      ];
    });
  }

  function handleTileClick(product: ProductForSale) {
    const stock = product.variants.reduce(
      (sum, v) => sum + (v.stockByBoutique[boutiqueId] ?? 0),
      0
    );
    if (stock <= 0) {
      toast.error("Aucun stock disponible pour ce produit dans cette boutique.");
      return;
    }
    if (product.variants.length === 1) {
      addVariantToCart(product, product.variants[0]);
      return;
    }
    setPickerProduct(product);
  }

  function incrementLine(variantId: string) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.variantId !== variantId) return l;
        if (l.quantity + 1 > l.maxStock) {
          toast.error("Stock insuffisant pour cette quantité.");
          return l;
        }
        return { ...l, quantity: l.quantity + 1 };
      })
    );
  }

  function decrementLine(variantId: string) {
    setCart((prev) => {
      const line = prev.find((l) => l.variantId === variantId);
      if (line && line.quantity <= 1) {
        return prev.filter((l) => l.variantId !== variantId);
      }
      return prev.map((l) =>
        l.variantId === variantId ? { ...l, quantity: l.quantity - 1 } : l
      );
    });
  }

  function removeLine(variantId: string) {
    setCart((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  function clearCart() {
    setCart([]);
    setClearCartDialogOpen(false);
    toast.info("Panier vidé.");
  }

  async function handleQuickCustomerSubmit() {
    if (quickCustomerName.trim().length < 2) {
      toast.error("Le nom doit contenir au moins 2 caractères.");
      return;
    }
    setQuickCustomerSubmitting(true);
    try {
      const customer = await createCustomer({
        name: quickCustomerName.trim(),
        phone: quickCustomerPhone.trim() || undefined,
      });
      setCustomerList((prev) =>
        [...prev, { id: customer.id, name: customer.name }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setCustomerId(customer.id);
      setQuickCustomerOpen(false);
      setQuickCustomerName("");
      setQuickCustomerPhone("");
      toast.success("Client créé et sélectionné");
    } catch {
      toast.error("Impossible de créer ce client.");
    } finally {
      setQuickCustomerSubmitting(false);
    }
  }

  // La remise est saisie une seule fois pour tout le panier, puis répartie
  // au prorata sur chaque article au moment d'envoyer la vente — le serveur
  // ne connaît qu'une remise par ligne (voir lib/schemas.ts), donc c'est ici
  // qu'on traduit "une remise globale" en données compatibles, sans rien
  // changer côté serveur. Le dernier article absorbe l'arrondi pour que la
  // somme corresponde exactement au total affiché.
  function buildItemsWithDistributedDiscount() {
    if (discountAmount <= 0 || subtotal <= 0) {
      return cart.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: 0,
      }));
    }
    let allocated = 0;
    return cart.map((l, index) => {
      const isLast = index === cart.length - 1;
      const lineSubtotal = l.quantity * l.unitPrice;
      const lineDiscount = isLast
        ? Math.round((discountAmount - allocated) * 100) / 100
        : Math.round(((lineSubtotal / subtotal) * discountAmount) * 100) / 100;
      if (!isLast) allocated += lineDiscount;
      return {
        variantId: l.variantId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: lineDiscount,
      };
    });
  }

  async function handleSubmit() {
    const isCredit = saleMode === "CREDIT";

    if (cart.length === 0) {
      toast.error("Le panier est vide.");
      return;
    }
    if (total <= 0) {
      toast.error("Le total de la vente doit être supérieur à 0.");
      return;
    }
    if (isCredit && customerId === NO_CUSTOMER) {
      toast.error("Un client est requis pour une vente à crédit.");
      return;
    }
    if (!isCredit && !allRowsHaveMethod) {
      toast.error("Choisissez un moyen de paiement pour chaque ligne.");
      return;
    }
    if (!isCredit && !splitAmountsValid) {
      toast.error("La somme des paiements doit correspondre exactement au total.");
      return;
    }

    const payments = isCredit
      ? deposit > 0 && depositMethod
        ? [{ method: depositMethod, amount: deposit }]
        : []
      : paymentRows.map((r) => ({ method: r.method!, amount: rowAmount(r) }));

    setIsSubmitting(true);
    try {
      const result = await createSale({
        boutiqueId,
        customerId: customerId === NO_CUSTOMER ? null : customerId,
        isCredit,
        items: buildItemsWithDistributedDiscount(),
        payments,
        deliveryFee: effectiveDeliveryFee,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(
        isCredit ? `Vente à crédit ${result.data.reference} enregistrée` : `Vente ${result.data.reference} enregistrée`
      );
      router.push(isCredit ? `/credits/${result.data.id}` : `/ventes/${result.data.id}`);
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Entrée valide la vente pendant que la fenêtre de paiement est ouverte —
  // le caissier n'a pas à lâcher le clavier pour aller cliquer "Valider la
  // vente" une fois le montant reçu saisi. Sans effet tant que le paiement
  // n'est pas complet (mêmes conditions que le bouton).
  useEffect(() => {
    if (!paymentDialogOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" || !canValidatePayment || isSubmitting) return;
      e.preventDefault();
      handleSubmit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paymentDialogOpen, canValidatePayment, isSubmitting, handleSubmit]);

  return (
    <>
      <div className="grid gap-6 pb-24 lg:grid-cols-3 lg:pb-0">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {boutiques.length > 1 && (
            <div className="max-w-xs space-y-2">
              <Label>Boutique</Label>
              <Select
                value={boutiqueId}
                onValueChange={(v) => handleBoutiqueChange(v ?? boutiques[0]?.id ?? "")}
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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Produit, SKU ou code-barres..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveCategoryId(null)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  !activeCategoryId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                Tous
                <span className="font-figures ml-1 tabular-nums opacity-70">
                  {products.length}
                </span>
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategoryId(c.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    activeCategoryId === c.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {c.name}
                  <span className="font-figures ml-1 tabular-nums opacity-70">
                    {productCountByCategory.get(c.id) ?? 0}
                  </span>
                </button>
              ))}
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-10 text-center">
              <Search className="mb-1 size-8 text-muted-foreground/40" />
              {query.trim() ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Aucun produit ne correspond à « {query.trim()} ».
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Essayez le nom complet, le SKU ou le code-barres exact.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun produit dans cette catégorie.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((p) => {
                const stock = p.variants.reduce(
                  (sum, v) => sum + (v.stockByBoutique[boutiqueId] ?? 0),
                  0
                );
                const lowThreshold = p.variants.reduce((sum, v) => sum + v.alertThreshold, 0);
                const prices = p.variants.map((v) => v.sellingPrice);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                const priceLabel =
                  minPrice === maxPrice
                    ? `${minPrice.toLocaleString()} ${currency}`
                    : `dès ${minPrice.toLocaleString()} ${currency}`;
                const outOfStock = stock <= 0;
                const isLow = !outOfStock && stock <= lowThreshold;
                const qtyInCart = cartQtyByProduct.get(p.id) ?? 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleTileClick(p)}
                    disabled={outOfStock}
                    className="group relative flex flex-col overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {qtyInCart > 0 && (
                      <span className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white shadow">
                        {qtyInCart}
                      </span>
                    )}
                    <div className="relative aspect-square w-full bg-muted">
                      <ProductThumbnail
                        name={p.name}
                        photoUrl={p.photoUrl}
                        rounded=""
                        className="absolute inset-0 text-4xl"
                      />
                      {outOfStock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                          <span className="text-xs font-semibold text-destructive">Rupture</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 p-2.5">
                      <p className="line-clamp-2 text-sm font-medium leading-tight">{p.name}</p>
                      <p className="font-figures text-sm font-semibold tabular-nums text-primary">
                        {priceLabel}
                      </p>
                      {!outOfStock && (
                        <p
                          className={cn(
                            "font-figures text-xs tabular-nums",
                            isLow ? "text-destructive" : "text-muted-foreground"
                          )}
                        >
                          Stock : {stock}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:border-l lg:pl-6">
          <Card className="border-primary/20 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 rounded-t-xl border-b bg-primary/5">
              <CardTitle className="flex items-center gap-2.5 text-base font-bold">
                <SectionIcon icon={ShoppingCart} tint="pink" />
                Panier
              </CardTitle>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setClearCartDialogOpen(true)}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                    Vider
                  </button>
                )}
                <Badge variant="secondary" className="font-figures">
                  {cart.length} art.
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Cliquez sur un produit pour l&apos;ajouter au panier.
                  </p>
                ) : (
                  cart.map((line) => (
                    <div key={line.variantId} className="rounded-lg border bg-muted/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{line.label}</p>
                        <button
                          type="button"
                          onClick={() => removeLine(line.variantId)}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => decrementLine(line.variantId)}
                            className="flex size-7 items-center justify-center rounded-md border hover:bg-muted"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="font-figures w-6 text-center text-sm font-medium tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => incrementLine(line.variantId)}
                            className="flex size-7 items-center justify-center rounded-md border hover:bg-muted"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <span className="font-figures font-semibold tabular-nums text-primary">
                          {(line.quantity * line.unitPrice).toLocaleString()} {currency}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label className="text-sm text-muted-foreground">Client (optionnel)</Label>
                <Select
                  value={customerId}
                  onValueChange={(v) => {
                    if (v === CREATE_CUSTOMER) {
                      setQuickCustomerOpen(true);
                      return;
                    }
                    setCustomerId(v ?? NO_CUSTOMER);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v: string) =>
                        v === NO_CUSTOMER
                          ? "Client de passage"
                          : customerList.find((c) => c.id === v)?.name
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CUSTOMER}>Client de passage</SelectItem>
                    <SelectItem value={CREATE_CUSTOMER}>+ Créer un nouveau client</SelectItem>
                    {customerList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span className="font-figures font-medium tabular-nums">
                    {subtotal.toLocaleString()} {currency}
                  </span>
                </div>

                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Remise</Label>
                    <div className="flex overflow-hidden rounded-md border text-xs">
                      <button
                        type="button"
                        onClick={() => setDiscountMode("PERCENT")}
                        className={cn(
                          "px-2.5 py-1 font-medium transition-colors",
                          discountMode === "PERCENT"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        )}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountMode("AMOUNT")}
                        className={cn(
                          "px-2.5 py-1 font-medium transition-colors",
                          discountMode === "AMOUNT"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {currency}
                      </button>
                    </div>
                  </div>
                  {discountMode === "PERCENT" ? (
                    <Input
                      type="number"
                      min={0}
                      max={maxDiscountPercent}
                      className="font-figures tabular-nums"
                      value={discountValue || ""}
                      onChange={(e) =>
                        setDiscountValue(
                          Math.min(Number(e.target.value) || 0, maxDiscountPercent)
                        )
                      }
                      placeholder="0"
                    />
                  ) : (
                    <AmountInput
                      value={discountValue ? String(discountValue) : ""}
                      onValueChange={(digits) =>
                        setDiscountValue(
                          Math.min(Number(digits) || 0, (maxDiscountPercent / 100) * subtotal)
                        )
                      }
                      placeholder="0"
                    />
                  )}
                  {discountMode === "PERCENT" && (
                    <div className="flex gap-1.5">
                      {QUICK_DISCOUNTS.filter((p) => p <= maxDiscountPercent).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDiscountValue(p)}
                          className={cn(
                            "flex-1 rounded-md border py-1 text-xs font-medium transition-colors",
                            discountValue === p
                              ? "border-primary bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  )}
                  {maxDiscountPercent < 100 && (
                    <p className="text-[11px] text-muted-foreground">
                      Remise maximale autorisée : {maxDiscountPercent}%
                    </p>
                  )}
                </div>

                <div className="space-y-2 rounded-lg border p-3">
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-sm">Livraison</span>
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={deliveryEnabled}
                      onChange={(e) => {
                        setDeliveryEnabled(e.target.checked);
                        // Repart du tarif par défaut à chaque activation,
                        // plutôt que de garder une valeur à 0 ou obsolète
                        // laissée par une vente précédente de la session.
                        if (e.target.checked && deliveryFee === 0) {
                          setDeliveryFee(defaultDeliveryFee);
                        }
                      }}
                    />
                  </label>
                  {deliveryEnabled && (
                    <AmountInput
                      value={deliveryFee ? String(deliveryFee) : ""}
                      onValueChange={(digits) => setDeliveryFee(Number(digits) || 0)}
                      placeholder="0"
                    />
                  )}
                </div>

                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span className="font-figures tabular-nums text-primary">
                    {total.toLocaleString()} {currency}
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={cart.length === 0}
                onClick={() => setPaymentDialogOpen(true)}
              >
                Encaisser
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bouton toujours accessible sur mobile, sans avoir à faire défiler
          jusqu'en bas (surtout utile avec une longue grille de produits) —
          ouvre la même fenêtre "Finaliser la vente". */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur-sm lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-figures text-lg font-semibold tabular-nums">
              {total.toLocaleString()} {currency}
            </p>
          </div>
          <Button size="lg" disabled={cart.length === 0} onClick={() => setPaymentDialogOpen(true)}>
            Encaisser
          </Button>
        </div>
      </div>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finaliser la vente</DialogTitle>
            <DialogDescription>
              Choisissez la méthode de paiement pour encaisser cette vente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
              <p className="text-sm text-muted-foreground">Montant à payer</p>
              <p className="font-figures mt-1 text-3xl font-bold tabular-nums text-primary">
                {total.toLocaleString()} {currency}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Méthode de paiement
              </Label>

              {!isSplit ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {paymentOptions.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setSaleMode("NORMAL");
                          updatePaymentRow(paymentRows[0].key, { method: value });
                        }}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors",
                          saleMode === "NORMAL" && paymentRows[0].method === value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="size-5" />
                        {label}
                      </button>
                    ))}
                  </div>
                  {saleMode === "NORMAL" && paymentRows[0].method && (
                    <button
                      type="button"
                      onClick={addPaymentRow}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      + Ajouter un autre moyen de paiement
                    </button>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  {paymentRows.map((row) => (
                    <div key={row.key} className="space-y-1.5 rounded-lg border p-2.5">
                      <div className="flex items-center gap-2">
                        <Select
                          value={row.method ?? ""}
                          onValueChange={(v) =>
                            updatePaymentRow(row.key, {
                              method: (v || null) as PaymentMethodValue | null,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 flex-1">
                            <SelectValue placeholder="Méthode">
                              {(v: string) =>
                                paymentOptions.find((o) => o.value === v)?.label ?? "Méthode"
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {paymentOptions.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <AmountInput
                          className="h-8 w-28"
                          placeholder="Montant"
                          value={row.amount}
                          onValueChange={(digits) => updatePaymentRow(row.key, { amount: digits })}
                        />
                        <button
                          type="button"
                          onClick={() => removePaymentRow(row.key)}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      {row.method === "ESPECES" && (
                        <div className="flex items-center gap-2 pl-1">
                          <Label className="shrink-0 text-xs text-muted-foreground">Reçu</Label>
                          <AmountInput
                            className="h-7"
                            placeholder="0"
                            value={row.cashReceived}
                            onValueChange={(digits) =>
                              updatePaymentRow(row.key, { cashReceived: digits })
                            }
                          />
                          {rowChangeDue(row) > 0 && (
                            <span className="font-figures shrink-0 whitespace-nowrap text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                              Monnaie : {rowChangeDue(row).toLocaleString()} {currency}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={addPaymentRow}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      + Ajouter un autre moyen de paiement
                    </button>
                    <span
                      className={cn(
                        "font-figures text-xs font-semibold tabular-nums",
                        splitAmountsValid
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive"
                      )}
                    >
                      {splitAmountsValid
                        ? "Montant réparti ✓"
                        : `Reste à répartir : ${remainingToAllocate.toLocaleString()} ${currency}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Une vente à crédit exige toujours un client identifié — pas
                  de crédit anonyme (voir schemas.ts / createSale). */}
              <button
                type="button"
                onClick={() => {
                  if (customerId === NO_CUSTOMER) {
                    toast.error("Sélectionnez un client avant de choisir la vente à crédit.");
                    return;
                  }
                  setSaleMode("CREDIT");
                }}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                  saleMode === "CREDIT"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <ClipboardList className="size-4" />
                Crédit
              </button>
            </div>

            {!isSplit && saleMode === "NORMAL" && paymentRows[0].method === "ESPECES" && (
              <div className="space-y-2">
                <Label
                  htmlFor="cash-received"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Montant reçu ({currency})
                </Label>
                <AmountInput
                  id="cash-received"
                  className="text-center text-lg font-semibold"
                  placeholder="0"
                  value={paymentRows[0].cashReceived}
                  onValueChange={(digits) =>
                    updatePaymentRow(paymentRows[0].key, { cashReceived: digits })
                  }
                />
                <div className="grid grid-cols-4 gap-2">
                  {cashSuggestions.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() =>
                        updatePaymentRow(paymentRows[0].key, { cashReceived: String(amount) })
                      }
                      className="font-figures rounded-md border py-1.5 text-xs font-medium tabular-nums transition-colors hover:bg-muted"
                    >
                      {amount.toLocaleString()} {currency}
                    </button>
                  ))}
                </div>
                {rowChangeDue(paymentRows[0]) > 0 && (
                  <p className="font-figures text-center text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                    Monnaie à rendre : {rowChangeDue(paymentRows[0]).toLocaleString()} {currency}
                  </p>
                )}
              </div>
            )}

            {saleMode === "CREDIT" && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm">
                  Vente à crédit pour{" "}
                  <span className="font-medium">
                    {customerList.find((c) => c.id === customerId)?.name ?? "—"}
                  </span>
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="deposit-amount" className="text-xs text-muted-foreground">
                    Acompte (optionnel)
                  </Label>
                  <AmountInput
                    id="deposit-amount"
                    placeholder="0"
                    value={depositAmount}
                    onValueChange={setDepositAmount}
                  />
                </div>
                {deposit > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Méthode de l&apos;acompte</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {paymentOptions.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setDepositMethod(value)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                            depositMethod === value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <Icon className="size-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-sm font-medium">
                  Solde restant dû :{" "}
                  <span
                    className={cn(
                      "font-figures tabular-nums",
                      creditBalance > 0 ? "text-destructive" : "text-emerald-600"
                    )}
                  >
                    {creditBalance.toLocaleString()} {currency}
                  </span>
                </p>
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={!canValidatePayment || isSubmitting}
              onClick={handleSubmit}
            >
              <Check className="mr-2 size-4" />
              {isSubmitting ? "Enregistrement..." : "Valider la vente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pickerProduct}
        onOpenChange={(open) => {
          if (!open) setPickerProduct(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pickerProduct?.name}</DialogTitle>
            <DialogDescription>Choisissez la variante à ajouter au panier.</DialogDescription>
          </DialogHeader>
          <div className="divide-y">
            {pickerProduct?.variants.map((v) => {
              const stock = v.stockByBoutique[boutiqueId] ?? 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={stock < 1}
                  onClick={() => {
                    addVariantToCart(pickerProduct, v);
                    setPickerProduct(null);
                  }}
                  className="flex w-full items-center justify-between py-3 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="font-medium">{v.detail}</span>
                  <span className="font-figures text-xs tabular-nums text-muted-foreground">
                    {stock} en stock · {v.sellingPrice.toLocaleString()} {currency}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={clearCartDialogOpen} onOpenChange={setClearCartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vider le panier ?</DialogTitle>
            <DialogDescription>
              {cart.length} article{cart.length > 1 ? "s" : ""}{" "}
              {cart.length > 1 ? "seront retirés" : "sera retiré"} du panier. Cette action ne peut
              pas être annulée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearCartDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={clearCart}>
              <Trash2 className="mr-2 size-4" />
              Vider le panier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quickCustomerOpen} onOpenChange={setQuickCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
            <DialogDescription>
              Ajoutez rapidement un client sans quitter la vente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-customer-name">Nom</Label>
              <Input
                id="quick-customer-name"
                value={quickCustomerName}
                onChange={(e) => setQuickCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-customer-phone">Téléphone (optionnel)</Label>
              <Input
                id="quick-customer-phone"
                type="tel"
                value={quickCustomerPhone}
                onChange={(e) => setQuickCustomerPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={quickCustomerSubmitting}
              onClick={handleQuickCustomerSubmit}
            >
              {quickCustomerSubmitting ? "Création..." : "Créer et sélectionner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
