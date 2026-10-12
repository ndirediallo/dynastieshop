"use client";

import { useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Clock, ShieldCheck, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { WORK_HOURS_DAYS, WORK_HOURS_DAY_LABELS, type WorkHoursDay } from "@/lib/work-hours";
import { userWorkHoursSchema, type UserWorkHoursInput } from "@/lib/schemas";
import {
  updateUserWorkHours,
  grantWorkHoursException,
  revokeWorkHoursException,
} from "../actions";

const MODE_LABELS: Record<UserWorkHoursInput["mode"], string> = {
  INHERIT: "Suivre l'horaire global",
  CUSTOM: "Horaire personnalisé",
  UNRESTRICTED: "Aucune restriction",
};

function formatDaysList(days: string[]): string {
  if (days.length === 7) return "tous les jours";
  return days
    .filter((d): d is WorkHoursDay => (WORK_HOURS_DAYS as readonly string[]).includes(d))
    .map((d) => WORK_HOURS_DAY_LABELS[d])
    .join(", ");
}

// Pour l'affichage du <input type="datetime-local"> — besoin de l'heure
// locale du navigateur, pas l'UTC que Date#toISOString() renverrait.
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function WorkHoursCard({
  userId,
  userName,
  mode,
  start,
  end,
  days,
  exceptionUntil,
  globalEnabled,
  globalStart,
  globalEnd,
  globalDays,
}: {
  userId: string;
  userName: string;
  mode: UserWorkHoursInput["mode"];
  start: string | null;
  end: string | null;
  days: string[];
  exceptionUntil: Date | null;
  globalEnabled: boolean;
  globalStart: string;
  globalEnd: string;
  globalDays: string[];
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGranting, setIsGranting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  // +2h, point de départ pratique — calculé une seule fois à
  // l'initialisation (pas à chaque rendu, Date.now() est impur).
  const [exceptionValue, setExceptionValue] = useState(() =>
    toDatetimeLocalValue(new Date(Date.now() + 2 * 60 * 60 * 1000))
  );

  const { control, register, handleSubmit } = useForm<UserWorkHoursInput>({
    resolver: zodResolver(userWorkHoursSchema),
    defaultValues: {
      mode,
      start: start ?? "08:00",
      end: end ?? "20:00",
      days: days.length > 0 ? days : ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
    },
  });

  const watchedMode = useWatch({ control, name: "mode" });

  const onSubmit = async (values: UserWorkHoursInput) => {
    setIsSubmitting(true);
    try {
      await updateUserWorkHours(userId, values);
      toast.success("Horaires de connexion enregistrés");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGrantException = async () => {
    setIsGranting(true);
    try {
      await grantWorkHoursException(userId, { until: exceptionValue });
      toast.success("Connexion exceptionnellement autorisée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue");
    } finally {
      setIsGranting(false);
    }
  };

  const handleRevokeException = async () => {
    setIsRevoking(true);
    try {
      await revokeWorkHoursException(userId);
      toast.success("Dérogation retirée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue");
    } finally {
      setIsRevoking(false);
    }
  };

  const exceptionActive = exceptionUntil && exceptionUntil > new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base font-bold">
          <Clock className="size-4.5 text-muted-foreground" />
          Horaires de connexion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {exceptionActive && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <div className="flex items-start gap-2">
              <Timer className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p>
                Connexion exceptionnellement autorisée jusqu&apos;au{" "}
                <span className="font-semibold">
                  {new Intl.DateTimeFormat("fr-FR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(exceptionUntil)}
                </span>
                , même hors horaire normal.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isRevoking}
              onClick={handleRevokeException}
            >
              <X className="mr-1.5 size-3.5" />
              Retirer
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Mode</Label>
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Suivre l'horaire global">
                      {(value: UserWorkHoursInput["mode"]) => MODE_LABELS[value]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {watchedMode === "INHERIT" && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 shrink-0" />
                {globalEnabled
                  ? `Actuellement : ${globalStart} - ${globalEnd}, ${formatDaysList(globalDays)}.`
                  : "L'horaire global est désactivé — aucune restriction pour le moment."}
              </p>
            )}
            {watchedMode === "UNRESTRICTED" && (
              <p className="text-xs text-muted-foreground">
                Ce compte peut se connecter à toute heure, tous les jours.
              </p>
            )}
          </div>

          {watchedMode === "CUSTOM" && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="userWorkHoursStart" className="text-xs">
                    De
                  </Label>
                  <Input id="userWorkHoursStart" type="time" {...register("start")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="userWorkHoursEnd" className="text-xs">
                    À
                  </Label>
                  <Input id="userWorkHoursEnd" type="time" {...register("end")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Jours autorisés</Label>
                <Controller
                  control={control}
                  name="days"
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-1.5">
                      {WORK_HOURS_DAYS.map((day) => {
                        const checked = field.value.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() =>
                              field.onChange(
                                checked
                                  ? field.value.filter((d) => d !== day)
                                  : [...field.value, day]
                              )
                            }
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {WORK_HOURS_DAY_LABELS[day]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
              </div>
            </div>
          )}

          <Button type="submit" variant="secondary" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>

        {!exceptionActive && (
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="exceptionUntil" className="text-xs">
              Autoriser exceptionnellement {userName} à se connecter jusqu&apos;à...
            </Label>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                id="exceptionUntil"
                type="datetime-local"
                value={exceptionValue}
                onChange={(e) => setExceptionValue(e.target.value)}
                className="w-auto"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isGranting}
                onClick={handleGrantException}
              >
                {isGranting ? "..." : "Autoriser"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              La dérogation redevient caduque toute seule une fois cette date
              passée.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
