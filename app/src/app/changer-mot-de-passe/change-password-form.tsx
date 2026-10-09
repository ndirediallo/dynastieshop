"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pinOnlySchema, type PinOnlyInput } from "@/lib/schemas";
import { completePasswordChange } from "./actions";

// Après la mise à jour en base, on se reconnecte avec le nouveau code
// plutôt que de simplement rediriger : un simple redirect laisserait la
// session (JWT) avec l'ancien mustChangePassword=true en cache, ce qui
// renverrait aussitôt ici en boucle (voir middleware.ts). signIn() relance
// authorize() et émet un JWT à jour.
export function ChangePasswordForm({ phone }: { phone: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PinOnlyInput>({
    resolver: zodResolver(pinOnlySchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: PinOnlyInput) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await completePasswordChange(values);
      const result = await signIn("credentials", {
        phone,
        password: values.password,
        redirect: false,
      });
      if (result?.error) {
        setError("Le mot de passe a été enregistré mais la reconnexion a échoué. Reconnectez-vous manuellement.");
        return;
      }
      // Rechargement complet (pas router.push) : nécessaire pour que le
      // reste de l'app reparte avec le cookie de session tout juste émis
      // par signIn() ci-dessus — même choix que login-form.tsx.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
    } catch {
      setError("Une erreur est survenue. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choisissez votre mot de passe</CardTitle>
        <CardDescription>
          Pour la sécurité de votre compte, définissez un nouveau mot de passe à 4 chiffres avant
          de continuer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoComplete="new-password"
              className="tracking-[0.5em]"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <Input
              id="confirmPassword"
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoComplete="new-password"
              className="tracking-[0.5em]"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement..." : "Valider et continuer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
