// Liste canonique des méthodes de paiement — utilisée pour la gestion dans
// Paramètres (cases à cocher "actives/inactives"). Les formulaires de
// vente/crédit/fournisseur gardent chacun leur propre liste de libellés
// (déjà en place avant cette fonctionnalité) ; ils filtrent juste leurs
// options par rapport à `Settings.activePaymentMethods`.
export const PAYMENT_METHODS = [
  "ESPECES",
  "ORANGE_MONEY",
  "MTN_MONEY",
  "WAVE",
  "CARTE",
  "VIREMENT",
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodValue, string> = {
  ESPECES: "Espèces",
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN Mobile Money",
  WAVE: "Wave",
  CARTE: "Carte",
  VIREMENT: "Virement",
};
