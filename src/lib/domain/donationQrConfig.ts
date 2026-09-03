import { cache } from "react";
import { getServerSettingsAsync } from "@/lib/server/settingsRepository";
import type { DonationQrConfig } from "@/components/providers/DonationQrProvider";

/**
 * Reads the shelter QR configuration for the root layout.
 *
 * Never throws. The layout wraps every page, so a database blip must degrade to
 * the decorative placeholder rather than blanking the whole site.
 *
 * Wrapped in React's `cache` so the read is deduplicated within a request
 * rather than repeated by every consumer that asks.
 */
export const getDonationQrConfig = cache(async (): Promise<DonationQrConfig> => {
  try {
    const settings = await getServerSettingsAsync();
    return {
      duitNowQrUrl: settings.duitNowQrUrl ?? "",
      tngQrUrl: settings.tngQrUrl ?? "",
      bankQrUrl: settings.bankQrUrl ?? "",
      paymentPayload: settings.paymentPayload ?? "",
      shelterName: settings.shelterName ?? "",
    };
  } catch {
    return {
      duitNowQrUrl: "",
      tngQrUrl: "",
      bankQrUrl: "",
      paymentPayload: "",
      shelterName: "",
    };
  }
});
