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

// Crée le bucket s'il n'existe pas encore (idempotent) — évite une étape
// manuelle dans le tableau de bord Supabase avant le tout premier upload.
async function ensureBucket() {
  const supabase = getClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;
  await supabase.storage.createBucket(BUCKET, { public: true });
}

export async function uploadToStorage(
  buffer: Buffer,
  objectPath: string,
  contentType: string
): Promise<string> {
  await ensureBucket();
  const supabase = getClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, buffer, { contentType, upsert: true });
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
