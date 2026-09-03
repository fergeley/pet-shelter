"use client";

import React, { createContext, useContext, useMemo } from "react";

/**
 * Shelter-wide donation QR configuration, published to the client tree.
 *
 * The public donation surfaces are client components reached from five call
 * sites (`/donate`, the pet detail view, the pet gallery, the hero, and the
 * navbar), and two of those live inside the root layout. Prop-drilling the QR
 * config to all of them would mean threading it through components that have no
 * other interest in it, so the layout reads it once on the server and publishes
 * it here.
 *
 * This is deliberately NOT `useSettingsStore`: that store is backed by
 * `localStorage`, so a QR saved there would only ever appear in the browser of
 * the admin who uploaded it.
 */

export interface DonationQrConfig {
  duitNowQrUrl: string;
  tngQrUrl: string;
  bankQrUrl: string;
  paymentPayload: string;
  /** Used for the caption printed under the code. */
  shelterName: string;
}

export const EMPTY_QR_CONFIG: DonationQrConfig = {
  duitNowQrUrl: "",
  tngQrUrl: "",
  bankQrUrl: "",
  paymentPayload: "",
  shelterName: "",
};

const DonationQrContext = createContext<DonationQrConfig>(EMPTY_QR_CONFIG);

export function DonationQrProvider({
  value,
  children,
}: {
  value: DonationQrConfig;
  children: React.ReactNode;
}) {
  const memoized = useMemo(
    () => ({
      duitNowQrUrl: value.duitNowQrUrl ?? "",
      tngQrUrl: value.tngQrUrl ?? "",
      bankQrUrl: value.bankQrUrl ?? "",
      paymentPayload: value.paymentPayload ?? "",
      shelterName: value.shelterName ?? "",
    }),
    [
      value.duitNowQrUrl,
      value.tngQrUrl,
      value.bankQrUrl,
      value.paymentPayload,
      value.shelterName,
    ]
  );

  return (
    <DonationQrContext.Provider value={memoized}>{children}</DonationQrContext.Provider>
  );
}

/**
 * Returns the shelter QR config. Falls back to empty values rather than
 * throwing when no provider is mounted, so the admin preview and unit tests can
 * render a donation panel in isolation.
 */
export function useDonationQrConfig(): DonationQrConfig {
  return useContext(DonationQrContext);
}
