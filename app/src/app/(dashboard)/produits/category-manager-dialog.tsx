"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FolderCog, Folder, FolderPlus, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
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
import {
  createCategory,
  createSubCategory,
  updateCategory,
  deleteCategory,
  updateSubCategory,
  deleteSubCategory,
} from "./actions";

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catégories & sous-catégories</DialogTitle>
          <DialogDescription>
            Organisez votre catalogue. Une catégorie encore utilisée par un
            produit ne peut pas être supprimée.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-2">
          {categories.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              Aucune catégorie pour le moment.
            </p>
          ) : (
            categories.map((category) => (
              <CategoryRow key={category.id} category={category} />
            ))
          )}
        </div>

        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
            <FolderPlus className="size-3.5" />
            Nouvelle catégorie
          </p>
          <NewCategoryForm />
        </div>

        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-violet-700 dark:text-violet-400">
            <FolderPlus className="size-3.5" />
            Nouvelle sous-catégorie
          </p>
          <NewSubCategoryForm categories={categories} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({ category }: { category: CategoryWithSubs }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (name.trim().length < 2) {
      toast.error("Le nom doit contenir au moins 2 caractères.");
      return;
    }
    setIsSaving(true);
    try {
      await updateCategory(category.id, { name: name.trim() });
      toast.success("Catégorie renommée");
      setIsEditing(false);
    } catch {
      toast.error("Impossible de renommer (nom déjà utilisé ?)");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="flex items-center justify-between gap-2">
        {isEditing ? (
          <div className="flex flex-1 items-center gap-1.5">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8"
              autoFocus
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isSaving}
              onClick={save}
            >
              <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setName(category.name);
                setIsEditing(false);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Folder className="size-4" />
              </span>
              <p className="truncate text-sm font-bold">{category.name}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="size-4" />
              </Button>
              <ConfirmDeleteButton
                size="icon"
                onConfirm={deleteCategory.bind(null, category.id)}
                title={`Supprimer "${category.name}" ?`}
                description="Ses sous-catégories seront supprimées avec elle. Impossible si un produit l'utilise encore."
              />
            </div>
          </>
        )}
      </div>
      {category.subCategories.length > 0 && (
        <div className="mt-2 space-y-1.5 border-l-2 border-violet-500/20 pl-3">
          {category.subCategories.map((sub) => (
            <SubCategoryRow key={sub.id} subCategory={sub} categoryId={category.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubCategoryRow({
  subCategory,
  categoryId,
}: {
  subCategory: { id: string; name: string };
  categoryId: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(subCategory.name);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (name.trim().length < 2) {
      toast.error("Le nom doit contenir au moins 2 caractères.");
      return;
    }
    setIsSaving(true);
    try {
      await updateSubCategory(subCategory.id, { name: name.trim(), categoryId });
      toast.success("Sous-catégorie renommée");
      setIsEditing(false);
    } catch {
      toast.error("Impossible de renommer (nom déjà utilisé ?)");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
      {isEditing ? (
        <div className="flex flex-1 items-center gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-sm"
            autoFocus
          />
          <Button type="button" variant="ghost" size="icon-sm" disabled={isSaving} onClick={save}>
            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setName(subCategory.name);
              setIsEditing(false);
            }}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <p className="truncate text-sm font-medium text-muted-foreground">
            {subCategory.name}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <ConfirmDeleteButton
              size="icon-sm"
              onConfirm={deleteSubCategory.bind(null, subCategory.id)}
              title={`Supprimer "${subCategory.name}" ?`}
              description="Impossible si un produit l'utilise encore."
            />
          </div>
        </>
      )}
    </div>
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
      <Label htmlFor="new-category" className="sr-only">
        Nom de la catégorie
      </Label>
      <div className="flex gap-2">
        <Input
          id="new-category"
          placeholder="Ex: Robes"
          className="bg-card"
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
      <div className="flex flex-wrap gap-2">
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-36 bg-card">
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
        <Input
          placeholder="Ex: Robes de soirée"
          className="min-w-32 flex-1 bg-card"
          {...register("name")}
        />
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
