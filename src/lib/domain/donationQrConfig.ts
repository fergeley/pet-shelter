import { readShelterSettings } from "@/lib/domain/shelterSettings";
import type { DonationQrConfig } from "@/components/providers/DonationQrProvider";

/**
 * Reads the shelter QR configuration for the root layout.
 *
 * Never throws. The layout wraps every page, so a database blip must degrade to
 * the decorative placeholder rather than blanking the whole site.
 */
export async function getDonationQrConfig(): Promise<DonationQrConfig> {
  try {
    const settings = await readShelterSettings();
    return {
      duitNowQrUrl: settings.duitNowQrUrl ?? "",
      tngQrUrl: settings.tngQrUrl ?? "",
      bankQrUrl: settings.bankQrUrl ?? "",
      paymentPayload: settings.paymentPayload ?? "",
    };
  } catch {
    return { duitNowQrUrl: "", tngQrUrl: "", bankQrUrl: "", paymentPayload: "" };
  }
}
