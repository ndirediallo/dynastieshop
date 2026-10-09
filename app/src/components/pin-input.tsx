"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

// Saisie de code à 4 chiffres en cases séparées — remplace un simple champ
// texte avec letter-spacing forcé (ancien login-form.tsx) : plus lisible,
// plus rapide à saisir au clavier numérique mobile, et ça montre d'un coup
// d'œil combien de chiffres restent à saisir. Un seul <input> réel caché
// derrière les cases garde toute la logique de validation/autofill native.
export function PinInput({
  id,
  length = 4,
  value,
  onChange,
  onComplete,
  masked = true,
  autoFocus = false,
  disabled = false,
  invalid = false,
}: {
  id?: string;
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  masked?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const commit = (next: string) => {
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const chars = value.split("");
    chars[index] = digit;
    const next = chars.join("").slice(0, length);
    commit(next);
    if (digit && index < length - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < length - 1) refs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    commit(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="flex gap-2.5" role="group" aria-label="Mot de passe à 4 chiffres">
      {digits.map((digit, i) => (
        <input
          key={i}
          id={i === 0 ? id : undefined}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type={masked ? "password" : "text"}
          inputMode="numeric"
          autoComplete={i === 0 ? "current-password" : "off"}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "font-figures size-12 rounded-xl border-2 bg-transparent text-center text-xl font-bold tabular-nums outline-none transition-colors sm:size-14",
            "focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20",
            invalid
              ? "border-destructive text-destructive"
              : "border-input text-foreground",
            disabled && "cursor-not-allowed opacity-50"
          )}
        />
      ))}
    </div>
  );
}
