"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { CheckIcon, SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface ComboboxOption {
  id: string
  label: string
}

// Variante "recherchable" de Select : utile dès qu'une liste dépasse une
// vingtaine d'éléments (catalogue produit...) et qu'un menu déroulant classique
// devient pénible à parcourir.
function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Rechercher...",
  emptyMessage = "Aucun résultat.",
  disabled,
  className,
}: {
  options: ComboboxOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  placeholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}) {
  const labels = React.useMemo(
    () => Object.fromEntries(options.map((o) => [o.id, o.label])),
    [options]
  )
  const ids = React.useMemo(() => options.map((o) => o.id), [options])

  return (
    <ComboboxPrimitive.Root
      items={ids}
      value={value}
      onValueChange={(v) => onValueChange((v as string | null) ?? null)}
      itemToStringLabel={(id: string) => labels[id] ?? ""}
      disabled={disabled}
    >
      <ComboboxPrimitive.InputGroup
        className={cn(
          "flex w-full items-center gap-1.5 rounded-lg border border-input bg-transparent pr-2 pl-2.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          className
        )}
      >
        <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <ComboboxPrimitive.Input
          placeholder={placeholder}
          className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </ComboboxPrimitive.InputGroup>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner className="isolate z-50" sideOffset={4}>
          <ComboboxPrimitive.Popup className="max-h-64 w-(--anchor-width) min-w-48 overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <ComboboxPrimitive.Empty className="px-2 py-3 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List>
              {(id: string) => (
                <ComboboxPrimitive.Item
                  key={id}
                  value={id}
                  className="relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  {labels[id]}
                  <ComboboxPrimitive.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                    <CheckIcon className="size-3.5" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}

export { Combobox }
export type { ComboboxOption }
