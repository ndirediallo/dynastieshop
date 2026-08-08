"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadProductImage } from "./actions";

export function ProductImageUpload({
  productId,
  photoUrl,
}: {
  productId: string;
  photoUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(photoUrl);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("image", file);

    startTransition(async () => {
      try {
        const result = await uploadProductImage(productId, formData);
        setPreview(result.photoUrl);
        toast.success("Image mise à jour");
      } catch {
        toast.error("Impossible de mettre à jour l'image.");
      }
    });
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-20 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {preview ? (
          <Image
            src={preview}
            alt="Photo du produit"
            width={80}
            height={80}
            className="size-full object-cover"
          />
        ) : (
          <span className="text-center text-xs text-muted-foreground">
            Aucune image
          </span>
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 size-4" />
          {isPending ? "Envoi..." : "Changer la photo"}
        </Button>
      </div>
    </div>
  );
}
