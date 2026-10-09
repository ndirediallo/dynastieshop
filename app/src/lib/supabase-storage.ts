import { createClient } from "@supabase/supabase-js";

// Stockage des fichiers uploadés (logo, photos produits) sur Supabase
// Storage plutôt que sur le disque du serveur — Vercel (serverless) ne
// garantit aucune persistance du système de fichiers entre deux
// invocations, un fichier écrit avec `fs.writeFile` peut disparaître à tout
// moment. Centralisé sur Supabase puisque la base de données y est déjà
// (un seul compte, un seul endroit à surveiller), plutôt qu'un service
// séparé comme Vercel Blob.
const BUCKET = "uploads";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants — nécessaires pour uploader un fichier."
    );
  }
  // La clé service_role contourne les policies RLS du bucket : normal et
  // nécessaire ici, ce code ne tourne que côté serveur (Server Actions),
  // jamais exposé au navigateur.
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function uploadToStorage(
  buffer: Buffer,
  objectPath: string,
  contentType: string
): Promise<string> {
  // Le bucket "uploads" existe déjà (créé au premier upload de cette
  // fonctionnalité) — le revérifier à chaque appel coûtait un aller-retour
  // réseau complet vers l'API Storage de Supabase avant même de commencer
  // l'upload, ce qui ralentissait chaque création de produit avec photo au
  // point de risquer le délai maximum d'une fonction Vercel (signalé par
  // l'utilisateur : "j'arrive pas à ajouter une image").
  const supabase = getClient();
  let { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, buffer, { contentType, upsert: true });

  // Auto-guérison seulement si le bucket a réellement disparu — jamais
  // vérifié par avance, donc aucun coût sur le chemin normal (tous les
  // appels une fois le bucket créé, c'est-à-dire la quasi-totalité).
  if (error && /bucket.*not.*found/i.test(error.message)) {
    await supabase.storage.createBucket(BUCKET, { public: true });
    ({ error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buffer, { contentType, upsert: true }));
  }
  if (error) throw new Error(`Échec de l'upload : ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

// Best-effort : un fichier déjà absent (ou une ancienne URL locale
// `/uploads/...` d'avant la migration vers Supabase Storage) ne doit
// jamais faire échouer l'opération appelante (suppression de produit...).
export async function deleteFromStorage(objectPath: string): Promise<void> {
  try {
    const supabase = getClient();
    await supabase.storage.from(BUCKET).remove([objectPath]);
  } catch {
    // Ignoré volontairement — voir commentaire ci-dessus.
  }
}

// Déduit le chemin d'objet Supabase Storage à partir d'une URL publique
// déjà stockée (ex. `.../storage/v1/object/public/uploads/produits/x.png`
// → `produits/x.png`) — nécessaire pour la suppression, qui ne prend qu'un
// chemin, pas l'URL complète.
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}
