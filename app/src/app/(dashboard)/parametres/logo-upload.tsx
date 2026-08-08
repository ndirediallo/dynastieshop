"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadLogo } from "./actions";

export function LogoUpload({ logoUrl }: { logoUrl: string | null }) {
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("logo", file);

    startTransition(async () => {
      try {
        const result = await uploadLogo(formData);
        setPreview(result.logoUrl);
        toast.success("Logo mis à jour avec succès");
      } catch {
        toast.error("Impossible de mettre à jour le logo.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Logo</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div className="flex size-20 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {preview ? (
            <Image
              src={preview}
              alt="Logo de l'entreprise"
              width={80}
              height={80}
              className="size-full object-contain"
            />
          ) : (
            <span className="text-xs text-muted-foreground">Aucun logo</span>
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
            {isPending ? "Envoi..." : "Changer le logo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
