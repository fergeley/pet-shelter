"use client";

import React, { useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Image from "next/image";
import { 
  Pin, 
  Plus, 
  Trash2, 
  Edit3, 
  Lock, 
  Unlock, 
  Calendar, 
  RotateCcw
} from "lucide-react";
import { Bulletin, BulletinCategory, BulletinFormData, BulletinTargetPage } from "@/types/bulletin";
import { useBulletins } from "@/lib/client/bulletinStore";
import { AdminBulletinModal } from "./AdminBulletinModal";
import { Button } from "@/components/ui/button";

interface BulletinFeedProps {
  targetPage?: BulletinTargetPage;
  title?: string;
  subtitle?: string;
  /** "grid" is the default two-up card grid. "lead" shows one large story beside a
   *  thumbnail rail. "carousel" shows one story at a time behind prev/next arrows —
   *  both of the latter keep the copy on the page ground rather than inside a card. */
  layout?: "grid" | "lead" | "carousel";
  maxItems?: number;
  compact?: boolean;
}

/**
 * Bulletin category → design tone, mirroring the mapping in `@/lib/petStatusPresentation`
 * and `@/lib/presentation/medicalTimelinePresentation`. `happy_tail` takes `highlight` rather than `success`
 * because `clinic` already owns green, and two categories sharing a colour makes the
 * badge legend unreadable.
 */
const CATEGORY_LABELS: Record<BulletinCategory, { label: string; toneClass: string }> = {
  urgent_need: { label: "Urgent Foster / Need", toneClass: "tone-danger" },
  clinic: { label: "Clinic / Vaccine", toneClass: "tone-success" },
  event: { label: "Event", toneClass: "tone-info" },
  happy_tail: { label: "Adoption Update", toneClass: "tone-highlight" },
  announcement: { label: "Notice", toneClass: "tone-neutral" },
};

export function BulletinFeed({
  targetPage = "all",
  title = "Shelter Bulletins & Updates",
  subtitle,
  layout = "grid",
  maxItems,
  compact = false,
}: BulletinFeedProps) {
  const {
    bulletins,
    isAdminMode,
    setIsAdminMode,
    addBulletin,
    updateBulletin,
    deleteBulletin,
    togglePinBulletin,
    resetToDefaultBulletins,
  } = useBulletins(targetPage);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBulletin, setEditingBulletin] = useState<Bulletin | null>(null);

  const handleCreate = () => {
    setEditingBulletin(null);
    setIsModalOpen(true);
  };

  const handleEdit = (bulletin: Bulletin) => {
    setEditingBulletin(bulletin);
    setIsModalOpen(true);
  };

  const handleSave = (data: BulletinFormData) => {
    if (editingBulletin) {
      updateBulletin(editingBulletin.id, data);
    } else {
      addBulletin(data);
    }
  };

  const itemsToDisplay = maxItems ? bulletins.slice(0, maxItems) : bulletins;

  return (
    <section className="w-full">
      {/* Header with Admin Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 mb-6">
        <div className="max-w-2xl space-y-3">
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            {title}
          </h2>
          {subtitle && (
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">{subtitle}</p>
          )}
        </div>

        {/* Staff Admin Mode Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdminMode(!isAdminMode)}
            className={`text-xs sm:text-sm gap-1.5 font-semibold ${
              isAdminMode ? "bg-foreground text-background border-foreground font-bold" : ""
            }`}
          >
            {isAdminMode ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
            {isAdminMode ? "Admin Mode Active" : "Staff Admin Access"}
          </Button>

          {isAdminMode && (
            <>
              <Button
                size="sm"
                onClick={handleCreate}
                className="text-xs sm:text-sm gap-1 font-semibold"
              >
                <Plus className="size-3.5" />
                Post Update / Media
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToDefaultBulletins}
                title="Reset to sample announcements"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Admin Notice Banner */}
      {isAdminMode && (
        <div className="mb-6 bg-muted/50 border border-border p-4 text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full bg-success-accent animate-pulse"></span>
            <span className="font-semibold text-foreground">
              Admin Editing Mode: You can publish announcements with photos/videos, edit content, and pin high-priority notices.
            </span>
          </div>
        </div>
      )}

      {/* Bulletins List */}
      {itemsToDisplay.length > 0 && layout === "carousel" && !isAdminMode ? (
        /* One story at a time. The frame holds only the image; the copy sits on the page
           ground beneath it, so this is not a rounded box like everything around it.
           Embla gives touch dragging for free, so the arrows are not the only way through. */
        <Carousel opts={{ loop: itemsToDisplay.length > 1 }} className="w-full">
          <div className="mb-5 flex items-center justify-end gap-2">
            <CarouselPrevious className="static translate-y-0 size-9" />
            <CarouselNext className="static translate-y-0 size-9" />
          </div>
          <CarouselContent>
            {itemsToDisplay.map((bulletin) => {
              const cat = CATEGORY_LABELS[bulletin.category] || CATEGORY_LABELS.announcement;
              return (
                <CarouselItem key={bulletin.id}>
                  <article className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2 lg:gap-10">
                    {bulletin.mediaType === "video" && bulletin.videoEmbedUrl ? (
                      <div className="relative aspect-16/9 w-full overflow-hidden rounded-3xl border border-border bg-black">
                        <iframe
                          src={bulletin.videoEmbedUrl}
                          title={bulletin.title}
                          className="h-full w-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      </div>
                    ) : bulletin.mediaType === "image" && bulletin.mediaUrl ? (
                      <div className="relative aspect-16/9 w-full overflow-hidden rounded-3xl border border-border bg-muted">
                        <Image src={bulletin.mediaUrl} alt={bulletin.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
                      </div>
                    ) : (
                      <div className="aspect-16/9 w-full rounded-3xl border border-border bg-muted" />
                    )}

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`tone-chip px-3 py-1 ${cat.toneClass}`}>{cat.label}</span>
                        <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-muted-foreground">
                          <Calendar className="size-3.5" />
                          {bulletin.createdAt}
                        </span>
                      </div>
                      <h3 className="font-heading text-xl sm:text-2xl font-bold leading-snug tracking-tight text-foreground">
                        {bulletin.title}
                      </h3>
                      <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {bulletin.content}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Posted by <strong className="text-foreground">{bulletin.author}</strong>
                      </p>
                    </div>
                  </article>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      ) : itemsToDisplay.length > 0 && layout === "lead" && !isAdminMode ? (
        (() => {
          const [lead, ...rest] = itemsToDisplay;
          const leadCat = CATEGORY_LABELS[lead.category] || CATEGORY_LABELS.announcement;
          return (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-10">
              {/* Lead story. The frame holds only the image; the copy sits on the page
                  ground beneath it, so the section is not four identical rounded boxes. */}
              <article className="space-y-4">
                {lead.mediaType === "video" && lead.videoEmbedUrl ? (
                  <div className="relative aspect-16/9 w-full overflow-hidden rounded-3xl border border-border bg-black">
                    <iframe
                      src={lead.videoEmbedUrl}
                      title={lead.title}
                      className="h-full w-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                ) : lead.mediaType === "image" && lead.mediaUrl ? (
                  <div className="relative aspect-16/9 w-full overflow-hidden rounded-3xl border border-border bg-muted">
                    <Image src={lead.mediaUrl} alt={lead.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 60vw" />
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`tone-chip px-3 py-1 ${leadCat.toneClass}`}>{leadCat.label}</span>
                    <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-muted-foreground">
                      <Calendar className="size-3.5" />
                      {lead.createdAt}
                    </span>
                  </div>
                  <h3 className="font-heading text-xl sm:text-2xl font-bold leading-snug tracking-tight text-foreground">
                    {lead.title}
                  </h3>
                  <p className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{lead.content}</p>
                  <p className="text-sm text-muted-foreground">
                    Posted by <strong className="text-foreground">{lead.author}</strong>
                  </p>
                </div>
              </article>

              {/* The rest as a rail: thumbnail left, copy right, hairlines instead of cards. */}
              {rest.length > 0 && (
                <div className="lg:border-l lg:border-border lg:pl-8">
                  {rest.map((bulletin) => {
                    const cat = CATEGORY_LABELS[bulletin.category] || CATEGORY_LABELS.announcement;
                    return (
                      <article key={bulletin.id} className="flex gap-3.5 border-b border-border py-4 first:pt-0">
                        {bulletin.mediaType === "image" && bulletin.mediaUrl ? (
                          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                            <Image src={bulletin.mediaUrl} alt={bulletin.title} fill className="object-cover" sizes="80px" />
                          </div>
                        ) : (
                          <div className="size-16 shrink-0 rounded-xl border border-border bg-muted" />
                        )}
                        <div className="min-w-0 space-y-1">
                          <span className={`tone-chip px-2 py-0.5 ${cat.toneClass}`}>{cat.label}</span>
                          <h4 className="font-heading text-sm font-bold leading-snug text-foreground">{bulletin.title}</h4>
                          <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-muted-foreground">
                            <Calendar className="size-3" />
                            {bulletin.createdAt}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()
      ) : itemsToDisplay.length > 0 ? (
        <div className={`grid gap-6 ${compact ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 lg:grid-cols-2"} items-stretch`}>
          {itemsToDisplay.map((bulletin) => {
            const catInfo = CATEGORY_LABELS[bulletin.category] || CATEGORY_LABELS.announcement;

            return (
              <article
                key={bulletin.id}
                className={`flex flex-col justify-between rounded-3xl border bg-card shadow-xs overflow-hidden transition-all ${
                  bulletin.isPinned ? "border-foreground/60 bg-muted/20 shadow-xs" : "border-border"
                }`}
              >
                <div>
                  {/* Media Section (Image or Video) */}
                  {bulletin.mediaType === "video" && bulletin.videoEmbedUrl ? (
                    <div className="relative aspect-16/9 w-full bg-black">
                      <iframe
                        src={bulletin.videoEmbedUrl}
                        title={bulletin.title}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  ) : bulletin.mediaType === "image" && bulletin.mediaUrl ? (
                    <div className="relative aspect-16/9 w-full bg-muted overflow-hidden">
                      <Image
                        src={bulletin.mediaUrl}
                        alt={bulletin.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 500px"
                      />
                    </div>
                  ) : null}

                  {/* Bulletin Content */}
                  <div className="p-6 space-y-3.5">
                    {/* Badges & Date */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`tone-chip px-3 py-1 ${catInfo.toneClass}`}>
                          {catInfo.label}
                        </span>

                        {bulletin.isPinned && (
                          <span className="tone-chip tone-warning px-3 py-1">
                            <Pin className="size-3" /> Pinned
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground font-semibold">
                        <Calendar className="size-3.5" />
                        <span>{bulletin.createdAt}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
                      {bulletin.title}
                    </h3>

                    {/* Content text */}
                    <p className="text-sm sm:text-base text-foreground/90 leading-relaxed whitespace-pre-line">
                      {bulletin.content}
                    </p>
                  </div>
                </div>

                {/* Footer / Author & Admin Actions */}
                <div className="p-6 pt-0 border-t border-border/40 mt-3 flex items-center justify-between text-sm text-muted-foreground">
                  <span>Posted by: <strong className="text-foreground">{bulletin.author}</strong></span>

                  {isAdminMode && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => togglePinBulletin(bulletin.id)}
                        className="text-xs"
                        title={bulletin.isPinned ? "Unpin notice" : "Pin notice to top"}
                      >
                        <Pin className={`size-3.5 ${bulletin.isPinned ? "fill-foreground text-foreground" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleEdit(bulletin)}
                        className="text-xs"
                        title="Edit bulletin"
                      >
                        <Edit3 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => deleteBulletin(bulletin.id)}
                        className="text-xs text-destructive hover:text-destructive"
                        title="Delete bulletin"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="border border-dashed border-border bg-muted/10 p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No updates or bulletins posted for this section.</p>
          {isAdminMode && (
            <Button size="sm" onClick={handleCreate} className="text-sm font-semibold">
              <Plus className="size-3.5 mr-1" /> Post First Update
            </Button>
          )}
        </div>
      )}

      {/* Admin Bulletin Modal */}
      <AdminBulletinModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        editingBulletin={editingBulletin}
        onSave={handleSave}
      />
    </section>
  );
}
