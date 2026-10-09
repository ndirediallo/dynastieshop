import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { can, MODULE_LABELS, type Module } from "@/lib/permissions";
import { GUIDE_MODULES } from "@/lib/guide-content";
import { getSettings } from "@/lib/settings";
import { DownloadGuidePdfButton } from "./download-guide-pdf-button";

export default async function GuideModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: moduleKey } = await params;
  const guideModule = GUIDE_MODULES.find((m) => m.key === moduleKey);
  if (!guideModule) notFound();

  const session = await auth();
  const role = session!.user.role;
  const extra = session!.user.extraModules ?? [];
  if (!can(role, guideModule.key as Module, extra)) {
    redirect("/unauthorized");
  }
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <BackButton label="Guide d'utilisation" />

      <PageHeader
        icon={BookOpen}
        title={guideModule.label}
        description={guideModule.description}
        tint="blue"
        actions={
          <DownloadGuidePdfButton
            moduleLabel={guideModule.label}
            topics={guideModule.topics}
            company={{ name: settings.companyName, logoUrl: settings.logoUrl }}
          />
        }
      />

      <div className="space-y-6">
        {guideModule.topics.map((topic, i) => (
          <Card key={topic.slug}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                {topic.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-[1fr_1.3fr]">
              <ol className="list-decimal space-y-2 pl-5 text-sm">
                {topic.steps.map((step, j) => (
                  <li key={j}>{step}</li>
                ))}
              </ol>
              <div className="overflow-hidden rounded-lg border bg-muted">
                <Image
                  src={topic.screenshot}
                  alt={topic.title}
                  width={960}
                  height={600}
                  className="w-full object-contain"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Pour que le titre d'onglet reste correct même partagé/ouvert directement.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: moduleKey } = await params;
  const guideModule = GUIDE_MODULES.find((m) => m.key === moduleKey);
  return { title: guideModule ? `${MODULE_LABELS[guideModule.key]} · Guide · DYNASTIE SHOP` : "Guide" };
}
