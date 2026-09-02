"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { shelterSettingsSchema, ShelterSettingsInput } from "@/lib/validations/settings";
import { useSettingsStore } from "@/lib/settingsStore";
import { updateShelterSettings, sendTestEmailAction } from "@/actions/settings";
import { useAdminAuth } from "@/lib/adminAuth";
import { DonationQrSettings } from "@/components/admin/DonationQrSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  RotateCcw,
  Save,
  Mail,
  Send,
  Loader2,
  HardDrive,
  Building,
  DollarSign,
  Key,
  ShieldCheck,
  AlertTriangle,
  QrCode,
  Eye,
  EyeOff,
} from "lucide-react";

export default function AdminSettingsPage() {
  const { settings, saveSettings, resetToDefaultSettings } = useSettingsStore();
  const { user } = useAdminAuth();
  // Display-only gate. `updateShelterSettings` re-checks the role server-side,
  // so a tampered client cannot write these fields.
  const canEditQr = (user?.role ?? "").toUpperCase() === "ADMIN";
  const [activeTab, setActiveTab] = useState<
    "general" | "email" | "storage" | "donation"
  >("general");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Test Email State
  const [testRecipient, setTestRecipient] = useState(settings.shelterNotificationEmail || "fergeley@gmail.com");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    messageId?: string;
    simulated?: boolean;
    error?: string;
  } | null>(null);

  const form = useForm<ShelterSettingsInput>({
    resolver: zodResolver(shelterSettingsSchema),
    defaultValues: settings,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    reset(settings);
    if (settings.shelterNotificationEmail) {
      setTestRecipient(settings.shelterNotificationEmail);
    }
  }, [settings, reset]);

  const currentStorageProvider = watch("storageProvider");

  const onSubmit = async (data: ShelterSettingsInput) => {
    saveSettings(data);
    const res = await updateShelterSettings(data);
    if (res.success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult(null);

    if (!testRecipient.trim()) {
      setTestResult({ success: false, error: "Please enter a test recipient email address." });
      return;
    }

    setSendingTest(true);
    try {
      const res = await sendTestEmailAction({
        recipientEmail: testRecipient,
        customSubject: "🐾 Hope for Strays - Live Settings Verification Email",
        customMessage: "This test email confirms that your Resend email service and shelter notification pipeline are working 100% properly from the Admin Settings dashboard.",
      });
      setTestResult(res);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Failed to dispatch test email",
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Shelter Settings & Service Integrations
        </h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Configure sanctuary identity, standard fees, live announcement banner, transactional emails (Resend), and media storage providers.
        </p>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-4 text-xs font-semibold flex items-center gap-2 rounded-lg shadow-sm animate-in">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>Shelter settings and service parameters updated successfully! Changes are active immediately.</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-border gap-2 sm:gap-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "general"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building className="size-4" />
          Sanctuary Identity & Fees
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("email")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "email"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mail className="size-4" />
          Transactional Email (Resend)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("storage")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "storage"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <HardDrive className="size-4" />
          Media Storage Provider
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("donation")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "donation"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <QrCode className="size-4" />
          Donation &amp; QR Codes
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* TAB 1: General Sanctuary Identity & Fees */}
        {activeTab === "general" && (
          <div className="border border-border bg-card p-6 sm:p-8 space-y-6 rounded-lg shadow-sm">
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground border-b border-border pb-1">
                1. Sanctuary Identity & Location
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="shelterName" className="text-xs font-semibold">Organisation / Sanctuary Name *</Label>
                  <Input id="shelterName" {...register("shelterName")} className="text-sm py-2.5" />
                  {errors.shelterName && <p className="text-xs text-destructive">{errors.shelterName.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold">Contact & WhatsApp Helpline *</Label>
                  <Input id="phone" {...register("phone")} className="text-sm py-2.5 font-mono" />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold">Public Inquiry Email *</Label>
                  <Input id="email" type="email" {...register("email")} className="text-sm py-2.5" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="operatingHours" className="text-xs font-semibold">Visiting Hours *</Label>
                  <Input id="operatingHours" {...register("operatingHours")} className="text-sm py-2.5" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-semibold">Sanctuary Address in Petaling Jaya *</Label>
                <Input id="address" {...register("address")} className="text-sm py-2.5" />
              </div>
            </div>

            {/* Standard Adoption Fees */}
            <div className="space-y-4 border-t border-border pt-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground border-b border-border pb-1 flex items-center gap-1.5">
                <DollarSign className="size-4 text-emerald-600" />
                2. Adoption Fee Model
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="adoptionFeeDog" className="text-xs font-semibold">Dog Adoption Fee *</Label>
                  <Input id="adoptionFeeDog" {...register("adoptionFeeDog")} className="text-sm py-2.5 font-semibold text-emerald-700 dark:text-emerald-400" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adoptionFeeCat" className="text-xs font-semibold">Cat Adoption Fee *</Label>
                  <Input id="adoptionFeeCat" {...register("adoptionFeeCat")} className="text-sm py-2.5 font-semibold text-emerald-700 dark:text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Live Announcement Banner */}
            <div className="space-y-3 border-t border-border pt-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground border-b border-border pb-1">
                3. Live Site Announcement Banner
              </h2>

              <div className="space-y-1.5">
                <Label htmlFor="announcementBanner" className="text-xs font-semibold">Headline Banner Text</Label>
                <Textarea
                  id="announcementBanner"
                  rows={2}
                  placeholder="e.g. Weekend Adoption Drive & Free Microchip Clinic this Saturday 9 AM – 1 PM!"
                  className="text-sm leading-relaxed"
                  {...register("announcementBanner")}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Transactional Email & Live Dispatcher */}
        {activeTab === "email" && (
          <div className="space-y-6">
            <div className="border border-border bg-card p-6 sm:p-8 space-y-6 rounded-lg shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="space-y-0.5">
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Mail className="size-4 text-primary" />
                    Resend Transactional Email Service
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Automate application confirmations, coordinator alerts, status updates, and interview invitations.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 rounded-full">
                  <ShieldCheck className="size-3.5" />
                  Service Connected
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="resendApiKey" className="text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="size-3.5" /> Resend API Key Override
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {showApiKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                      {showApiKey ? "Hide Key" : "Reveal Key"}
                    </button>
                  </Label>
                  <Input
                    id="resendApiKey"
                    type={showApiKey ? "text" : "password"}
                    placeholder="re_xxxxxxxxxxxxxxxxx (defaults to RESEND_API_KEY from .env.local)"
                    {...register("resendApiKey")}
                    className="text-sm font-mono py-2.5"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Leave blank to inherit the global <code className="bg-muted px-1 py-0.5 rounded text-foreground">RESEND_API_KEY</code> from your environment.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="emailFrom" className="text-xs font-semibold">Sender Email Address (From) *</Label>
                    <Input
                      id="emailFrom"
                      placeholder="Hope for Strays <onboarding@resend.dev>"
                      {...register("emailFrom")}
                      className="text-sm py-2.5 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shelterNotificationEmail" className="text-xs font-semibold">Staff Notification Destination *</Label>
                    <Input
                      id="shelterNotificationEmail"
                      type="email"
                      placeholder="fergeley@gmail.com"
                      {...register("shelterNotificationEmail")}
                      className="text-sm py-2.5 font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Receives coordinator alerts whenever a public adopter submits an application.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Live Test Email Tool */}
            <div className="border border-border bg-muted/30 p-6 rounded-lg space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Send className="size-4 text-primary" />
                Live Email Dispatch Verification Tool
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Send an immediate test email to verify that your Resend API key and template renderer are fully operational.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="Enter test recipient email (e.g. fergeley@gmail.com)"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    className="text-xs bg-background"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={sendingTest}
                  size="sm"
                  className="text-xs font-semibold gap-1.5 shrink-0 px-5"
                >
                  {sendingTest ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      Send Test Email
                    </>
                  )}
                </Button>
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 border ${
                    testResult.success
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {testResult.success ? "Test Email Delivered Successfully!" : "Test Email Dispatch Failed"}
                    </p>
                    {testResult.messageId && (
                      <p className="font-mono text-[11px]">
                        Resend Message ID: <strong>{testResult.messageId}</strong> {testResult.simulated && "(Simulation Mode)"}
                      </p>
                    )}
                    {testResult.error && <p>{testResult.error}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Media Storage Provider */}
        {activeTab === "storage" && (
          <div className="border border-border bg-card p-6 sm:p-8 space-y-6 rounded-lg shadow-sm">
            <div className="border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <HardDrive className="size-4 text-primary" />
                Media & Photo Upload Storage
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure where pet gallery photos and listing thumbnails are stored.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="storageProvider" className="text-xs font-semibold">Active Storage Provider *</Label>
                <select
                  id="storageProvider"
                  {...register("storageProvider")}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground font-semibold"
                >
                  <option value="local">Local Filesystem (/public/uploads) — Default</option>
                  <option value="s3">AWS S3 / Cloudflare R2 / MinIO / Supabase Storage</option>
                  <option value="cloudinary">Cloudinary Media Cloud</option>
                </select>
              </div>

              {currentStorageProvider === "s3" && (
                <div className="space-y-4 p-4 bg-muted/40 border border-border rounded-lg animate-in">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">S3-Compatible Settings</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="s3Bucket" className="text-xs font-semibold">Bucket Name</Label>
                      <Input id="s3Bucket" placeholder="hope-for-strays-uploads" {...register("s3Bucket")} className="text-sm font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s3Region" className="text-xs font-semibold">Region</Label>
                      <Input id="s3Region" placeholder="ap-southeast-1" {...register("s3Region")} className="text-sm font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s3CdnUrl" className="text-xs font-semibold">Custom CDN URL (Optional)</Label>
                    <Input id="s3CdnUrl" placeholder="https://cdn.hopeforstrays.org" {...register("s3CdnUrl")} className="text-sm font-mono" />
                  </div>
                </div>
              )}

              {currentStorageProvider === "cloudinary" && (
                <div className="space-y-4 p-4 bg-muted/40 border border-border rounded-lg animate-in">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Cloudinary Settings</h3>
                  <div className="space-y-1.5">
                    <Label htmlFor="cloudinaryCloudName" className="text-xs font-semibold">Cloud Name</Label>
                    <Input id="cloudinaryCloudName" placeholder="pet-shelter-cloud" {...register("cloudinaryCloudName")} className="text-sm font-mono" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Donation & QR Codes */}
        {activeTab === "donation" && (
          <DonationQrSettings form={form} canEdit={canEditQr} />
        )}

        {/* Form Footer / Save Actions */}
        <div className="border-t border-border pt-5 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetToDefaultSettings}
            className="text-xs text-muted-foreground"
          >
            <RotateCcw className="size-3.5 mr-1" /> Reset Defaults
          </Button>

          <Button type="submit" disabled={isSubmitting} size="sm" className="text-xs font-semibold uppercase tracking-wider px-6 py-2">
            <Save className="size-3.5 mr-1.5" />
            {isSubmitting ? "Saving..." : "Save All Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
