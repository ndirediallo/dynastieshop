// Redimensionne une image côté navigateur avant envoi au serveur — une
// vraie photo prise au téléphone (3-12 Mo) dépasse la limite de taille de
// requête imposée par l'hébergement (Vercel plafonne autour de 4,5 Mo au
// niveau de la plateforme, indépendamment de toute configuration Next.js :
// une Server Action avec un fichier plus gros échoue avant même d'atteindre
// notre code, voir discussion avec l'utilisateur). Un logo ou une photo de
// produit n'a de toute façon jamais besoin d'être affiché plus grand que
// quelques centaines de pixels ici, donc réduire la taille ne perd rien en
// pratique et accélère aussi l'envoi et l'affichage partout dans l'app.
export async function resizeImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.82
): Promise<File> {
  // Rien à faire sur un fichier déjà petit — évite de repasser par un
  // <canvas> (et donc de perdre la transparence d'un PNG) pour rien.
  if (file.size <= 400 * 1024) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Un PNG reste en PNG (logo à fond transparent, ex. le logo DYNASTIE SHOP
  // sur la barre latérale sombre) — le convertir en JPEG remplirait la
  // transparence d'une couleur unie. Juste réduire les dimensions suffit
  // déjà largement à passer sous la limite. Tout le reste (vraie photo
  // produit prise au téléphone) devient un JPEG compressé, bien plus léger.
  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, outputType, outputType === "image/jpeg" ? quality : undefined)
  );
  if (!blob) return file;

  const ext = outputType === "image/png" ? "png" : "jpg";
  const newName = file.name.replace(/\.[^.]+$/, "") + "." + ext;
  return new File([blob], newName, { type: outputType });
}
