"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
}: {
  idleTimeoutMinutes: number;
  idleTimeoutMode: "LOCK" | "LOGOUT";
  userName: string;
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-6 shadow-lg">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="size-5" />
          </div>
          <div>
            <p className="font-semibold">Session verrouillée</p>
            <p className="text-sm text-muted-foreground">
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

        {error && (
          <div className="flex items-start justify-center gap-2 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

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
