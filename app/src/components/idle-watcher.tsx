"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { Lock, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PinInput } from "@/components/pin-input";
import { verifyUnlockPin } from "@/app/(dashboard)/idle-actions";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];
// Persiste l'état verrouillé : un rechargement de page pendant que l'écran
// est verrouillé ne doit pas faire réapparaître les données en clair sans
// ressaisir le code.
const LOCK_STORAGE_KEY = "dynastie-idle-locked";

export function IdleWatcher({
  idleTimeoutMinutes,
  idleTimeoutMode,
  userName,
  logoUrl,
  companyName,
}: {
  idleTimeoutMinutes: number;
  idleTimeoutMode: "LOCK" | "LOGOUT";
  userName: string;
  logoUrl: string | null;
  companyName: string;
}) {
  // Lecture directe de sessionStorage dans l'initialiseur (plutôt qu'un
  // useEffect qui ferait un setState juste après le premier rendu) : c'est
  // une lecture synchrone d'une API navigateur, pas un abonnement à un
  // système externe.
  const initiallyLocked =
    typeof window !== "undefined" &&
    idleTimeoutMode === "LOCK" &&
    sessionStorage.getItem(LOCK_STORAGE_KEY) === "1";

  const [locked, setLocked] = useState(initiallyLocked);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  // Change à chaque échec, utilisé comme `key` sur PinInput : force un
  // remontage pour que `autoFocus` reporte le focus sur la première case
  // (sinon il reste sur la dernière case saisie, là où l'échec a eu lieu,
  // et retaper le code écrit silencieusement au mauvais endroit).
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(initiallyLocked);

  const triggerTimeout = useCallback(() => {
    if (idleTimeoutMode === "LOGOUT") {
      signOut({ callbackUrl: "/login" });
      return;
    }
    lockedRef.current = true;
    setLocked(true);
    sessionStorage.setItem(LOCK_STORAGE_KEY, "1");
  }, [idleTimeoutMode]);

  const resetTimer = useCallback(() => {
    if (!idleTimeoutMinutes || lockedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(triggerTimeout, idleTimeoutMinutes * 60 * 1000);
  }, [idleTimeoutMinutes, triggerTimeout]);

  useEffect(() => {
    if (!idleTimeoutMinutes) return;
    resetTimer();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, resetTimer, { passive: true });
    }
    return () => {
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, resetTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [idleTimeoutMinutes, resetTimer]);

  const handleUnlock = async (value: string) => {
    setIsVerifying(true);
    setError(null);
    const result = await verifyUnlockPin(value);
    setIsVerifying(false);

    if (result.ok) {
      lockedRef.current = false;
      setLocked(false);
      setPin("");
      sessionStorage.removeItem(LOCK_STORAGE_KEY);
      resetTimer();
      return;
    }
    if (result.lockedOut) {
      signOut({ callbackUrl: "/login" });
      return;
    }
    setError("Code incorrect.");
    setPin("");
    setAttempt((n) => n + 1);
  };

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-primary p-4 sm:p-6">
      {/* Même langage visuel que le panneau de marque de la page de
          connexion (voir src/app/login/page.tsx) : un fond uni de marque,
          pas un flou laissant deviner les données en dessous — plus sûr
          (rien de sensible ne transparaît sur un poste verrouillé sans
          surveillance) et plus habillé qu'un simple voile blanc. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1.5px 1.5px, white 1.5px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden
        className="absolute -top-24 -right-24 size-80 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-16 size-96 rounded-full bg-black/10 blur-3xl"
      />

      <div className="animate-in fade-in-0 zoom-in-95 relative w-full max-w-sm space-y-6 rounded-3xl bg-card p-6 shadow-2xl duration-150 sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={companyName}
                width={64}
                height={64}
                className="size-16 rounded-2xl object-contain"
                priority
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
                {companyName.slice(0, 1)}
              </div>
            )}
            <span className="absolute -right-1.5 -bottom-1.5 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-card">
              <Lock className="size-3.5" />
            </span>
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">Session verrouillée</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {userName}, entrez votre code pour continuer
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <PinInput
            key={attempt}
            value={pin}
            onChange={setPin}
            onComplete={handleUnlock}
            autoFocus
            invalid={!!error}
            disabled={isVerifying}
          />
        </div>

        <div className="flex min-h-5 items-start justify-center gap-2 text-center text-sm">
          {error ? (
            <div className="flex items-start gap-1.5 text-destructive">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : (
            isVerifying && <p className="text-muted-foreground">Vérification...</p>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 size-4" />
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
