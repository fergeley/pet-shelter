"use client";

import React, { useState } from "react";
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
        <div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h2>
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
      {itemsToDisplay.length > 0 ? (
        <div className={`grid gap-6 ${compact ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 lg:grid-cols-2"} items-stretch`}>
          {itemsToDisplay.map((bulletin) => {
            const catInfo = CATEGORY_LABELS[bulletin.category] || CATEGORY_LABELS.announcement;

            return (
              <article
                key={bulletin.id}
                className={`flex flex-col justify-between border bg-card overflow-hidden transition-all ${
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
