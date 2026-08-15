"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { shelterSettingsSchema, ShelterSettingsInput } from "@/lib/validations/settings";
import { useSettingsStore } from "@/lib/settingsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, RotateCcw, Save } from "lucide-react";

export default function AdminSettingsPage() {
  const { settings, saveSettings, resetToDefaultSettings } = useSettingsStore();
  const [savedSuccess, setSavedSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ShelterSettingsInput>({
    resolver: zodResolver(shelterSettingsSchema) as any,
    defaultValues: settings,
  });

  useEffect(() => {
    reset(settings);
  }, [settings, reset]);

  const onSubmit = async (data: ShelterSettingsInput) => {
    await new Promise((r) => setTimeout(r, 300));
    saveSettings(data);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Shelter Operations & Public Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Update sanctuary visiting hours, official contact phone, adoption fee guidelines, and live banner alerts.
        </p>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-800 text-white p-4 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>Shelter settings updated successfully! Changes are active immediately.</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="border border-border bg-card p-6 sm:p-8 space-y-6">
        
        {/* 1. Contact & Identity */}
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
              <Label htmlFor="email" className="text-xs font-semibold">Official Email *</Label>
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

        {/* 2. Standard Adoption Fees */}
        <div className="space-y-4 border-t border-border pt-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground border-b border-border pb-1">
            2. Standard Adoption Fee Guidelines
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="adoptionFeeDog" className="text-xs font-semibold">Standard Dog Adoption Fee *</Label>
              <Input id="adoptionFeeDog" {...register("adoptionFeeDog")} className="text-sm py-2.5 font-mono" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adoptionFeeCat" className="text-xs font-semibold">Standard Cat Adoption Fee *</Label>
              <Input id="adoptionFeeCat" {...register("adoptionFeeCat")} className="text-sm py-2.5 font-mono" />
            </div>
          </div>
        </div>

        {/* 3. Live Announcement Banner */}
        <div className="space-y-3 border-t border-border pt-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground border-b border-border pb-1">
            3. Live Site Announcement Banner (Optional)
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="announcementBanner" className="text-xs font-semibold">Banner Message</Label>
            <Textarea
              id="announcementBanner"
              rows={2}
              placeholder="e.g. Weekend Adoption Drive & Free Microchip Clinic this Saturday 9 AM – 1 PM!"
              className="text-sm leading-relaxed"
              {...register("announcementBanner")}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank if no urgent headline banner is needed.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
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
            {isSubmitting ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
