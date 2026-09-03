"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sponsorLogoutAction } from "@/actions/sponsors";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function SponsorLogoutButton() {
  const { isMs } = useLanguage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await sponsorLogoutAction();
          router.replace("/sponsor/login");
          router.refresh();
        })
      }
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <LogOut className="size-3.5" aria-hidden />
      )}
      {isMs ? "Log keluar" : "Sign out"}
    </Button>
  );
}
