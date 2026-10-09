// Phrase de confirmation exacte exigée pour déclencher la réinitialisation
// complète. Séparée de factory-reset-actions.ts : un fichier "use server" ne
// peut exporter que des fonctions async, pas des constantes.
export const RESET_CONFIRMATION_PHRASE = "RÉINITIALISER TOUT";
