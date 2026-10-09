"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Phone, ShieldAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PinInput } from "@/components/pin-input";

const loginSchema = z.object({
  phone: z.string().min(1, "Le numéro de téléphone est requis"),
  password: z.string().length(4, "Le mot de passe doit contenir 4 chiffres"),
});

type LoginValues = z.infer<typeof loginSchema>;

// Le bouton "Connexion rapide" pré-remplit et connecte avec un vrai compte
// Super Admin — pratique en développement, mais ça n'a rien à faire sur une
// page de connexion publique une fois en ligne (ce serait une porte
// dérobée visible de tous). NODE_ENV est figé au build par Next.js, donc
// ce bloc entier disparaît du bundle de production.
const isDev = process.env.NODE_ENV !== "production";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });

  const doSignIn = async (values: LoginValues) => {
    setError(null);
    setIsSubmitting(true);
    const result = await signIn("credentials", {
      ...values,
      redirect: false,
    });
    setIsSubmitting(false);

    if (result?.error) {
      setError(
        "Numéro ou code incorrect, ou compte temporairement bloqué après plusieurs essais."
      );
      return;
    }

    window.location.assign(callbackUrl);
  };

  const onSubmit = doSignIn;
  const onQuickConnect = () => doSignIn({ phone: "622269738", password: "1234" });

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Numéro de téléphone</Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              autoFocus
              placeholder="6XX XX XX XX"
              className="h-12 pl-10 text-base"
              {...register("phone")}
            />
          </div>
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {showPin ? (
                <>
                  <EyeOff className="size-3.5" />
                  Masquer
                </>
              ) : (
                <>
                  <Eye className="size-3.5" />
                  Afficher
                </>
              )}
            </button>
          </div>
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <PinInput
                id="password"
                value={field.value}
                onChange={field.onChange}
                masked={!showPin}
                invalid={!!errors.password}
                disabled={isSubmitting}
              />
            )}
          />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Connexion...
            </>
          ) : (
            "Se connecter"
          )}
        </Button>
      </form>

      {isDev && (
        <Button
          type="button"
          variant="secondary"
          className="mt-3 w-full"
          disabled={isSubmitting}
          onClick={onQuickConnect}
        >
          <Zap className="mr-2 size-4" />
          Connexion rapide (dev)
        </Button>
      )}
    </div>
  );
}
