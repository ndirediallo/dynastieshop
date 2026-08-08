"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FolderCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  categorySchema,
  subCategorySchema,
  type CategoryInput,
  type SubCategoryInput,
} from "@/lib/schemas";
import { createCategory, createSubCategory } from "./actions";

interface CategoryWithSubs {
  id: string;
  name: string;
  subCategories: { id: string; name: string }[];
}

export function CategoryManagerDialog({
  categories,
}: {
  categories: CategoryWithSubs[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FolderCog className="mr-2 size-4" />
        Gérer les catégories
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catégories & sous-catégories</DialogTitle>
          <DialogDescription>
            Organisez votre catalogue. Les catégories existantes ne peuvent
            pas être renommées ou supprimées pour l&apos;instant.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-48 space-y-3 overflow-y-auto rounded-md border p-3">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune catégorie pour le moment.
            </p>
          ) : (
            categories.map((category) => (
              <div key={category.id}>
                <p className="text-sm font-medium">{category.name}</p>
                {category.subCategories.length > 0 && (
                  <p className="pl-3 text-xs text-muted-foreground">
                    {category.subCategories.map((s) => s.name).join(", ")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        <Separator />

        <NewCategoryForm />

        <Separator />

        <NewSubCategoryForm categories={categories} />
      </DialogContent>
    </Dialog>
  );
}

function NewCategoryForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryInput>({ resolver: zodResolver(categorySchema) });

  const onSubmit = async (values: CategoryInput) => {
    setIsSubmitting(true);
    try {
      await createCategory(values);
      toast.success("Catégorie créée");
      reset();
    } catch {
      toast.error("Impossible de créer la catégorie (nom déjà utilisé ?)");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <Label htmlFor="new-category">Nouvelle catégorie</Label>
      <div className="flex gap-2">
        <Input
          id="new-category"
          placeholder="Ex: Robes"
          {...register("name")}
        />
        <Button type="submit" disabled={isSubmitting} size="sm">
          Ajouter
        </Button>
      </div>
      {errors.name && (
        <p className="text-sm text-destructive">{errors.name.message}</p>
      )}
    </form>
  );
}

function NewSubCategoryForm({
  categories,
}: {
  categories: CategoryWithSubs[];
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SubCategoryInput>({
    resolver: zodResolver(subCategorySchema),
    defaultValues: { categoryId: "", name: "" },
  });

  const onSubmit = async (values: SubCategoryInput) => {
    setIsSubmitting(true);
    try {
      await createSubCategory(values);
      toast.success("Sous-catégorie créée");
      reset();
    } catch {
      toast.error("Impossible de créer la sous-catégorie");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <Label>Nouvelle sous-catégorie</Label>
      <div className="flex gap-2">
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Catégorie">
                  {(value: string) =>
                    categories.find((c) => c.id === value)?.name ?? "Catégorie"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <Input placeholder="Ex: Robes de soirée" {...register("name")} />
        <Button
          type="submit"
          disabled={isSubmitting || categories.length === 0}
          size="sm"
        >
          Ajouter
        </Button>
      </div>
      {(errors.categoryId || errors.name) && (
        <p className="text-sm text-destructive">
          {errors.categoryId?.message || errors.name?.message}
        </p>
      )}
    </form>
  );
}
