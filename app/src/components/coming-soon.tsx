import { Construction } from "lucide-react";

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
      <Construction className="size-10 text-muted-foreground" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Ce module arrive dans une prochaine phase de développement.
      </p>
    </div>
  );
}
