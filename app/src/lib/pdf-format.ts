// Formatage de montant pour du texte dessiné directement dans un PDF via
// jsPDF (doc.text(...), pas du HTML rendu puis capturé en image). La police
// standard embarquée (helvetica) ne couvre que WinAnsiEncoding — le séparateur
// de milliers produit par `Number.prototype.toLocaleString()` sans locale
// explicite est l'espace fine insécable (U+202F) ou l'espace insécable
// (U+00A0) selon l'environnement, absente de cet encodage : jsPDF la
// remplace alors par un caractère de repli qui s'affichait comme "/" dans
// le PDF généré (bug signalé par l'utilisateur — "59/859/000" au lieu de
// "59 859 000"). Un espace ASCII normal, posé à la main, est garanti
// correct quel que soit le navigateur/l'environnement qui génère le PDF.
export function formatPdfAmount(n: number): string {
  const sign = n < 0 ? "-" : "";
  const grouped = Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped}`;
}
