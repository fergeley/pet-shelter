"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Bulletin, BulletinCategory, BulletinFormData, BulletinMediaType, BulletinTargetPage } from "@/types/bulletin";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon, Video, Pin, AlertCircle } from "lucide-react";

interface AdminBulletinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingBulletin?: Bulletin | null;
  onSave: (data: BulletinFormData) => void;
}

export function AdminBulletinModal({
  open,
  onOpenChange,
  editingBulletin,
  onSave,
}: AdminBulletinModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<BulletinCategory>("announcement");
  const [targetPage, setTargetPage] = useState<BulletinTargetPage>("all");
  const [mediaType, setMediaType] = useState<BulletinMediaType>("image");
  const [mediaUrl, setMediaUrl] = useState("");
  const [videoEmbedUrl, setVideoEmbedUrl] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [author, setAuthor] = useState("Hope for Strays Team");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingBulletin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(editingBulletin.title);
      setContent(editingBulletin.content);
      setCategory(editingBulletin.category);
      setTargetPage(editingBulletin.targetPage);
      setMediaType(editingBulletin.mediaType);
      setMediaUrl(editingBulletin.mediaUrl || "");
      setVideoEmbedUrl(editingBulletin.videoEmbedUrl || "");
      setIsPinned(editingBulletin.isPinned || false);
      setAuthor(editingBulletin.author || "Hope for Strays Team");
    } else {
      setTitle("");
      setContent("");
      setCategory("announcement");
      setTargetPage("all");
      setMediaType("image");
      setMediaUrl("https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?auto=format&fit=crop&w=800&q=80");
      setVideoEmbedUrl("");
      setIsPinned(false);
      setAuthor("Hope for Strays Team");
    }
    setError(null);
  }, [editingBulletin, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a title for the update.");
      return;
    }
    if (!content.trim()) {
      setError("Please enter bulletin content.");
      return;
    }

    onSave({
      title: title.trim(),
      content: content.trim(),
      category,
      targetPage,
      mediaType,
      mediaUrl: mediaType === "image" ? mediaUrl.trim() : (mediaType === "video" && mediaUrl ? mediaUrl.trim() : undefined),
      videoEmbedUrl: mediaType === "video" && videoEmbedUrl.trim() ? videoEmbedUrl.trim() : undefined,
      isPinned,
      author: author.trim() || "Hope for Strays Team",
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 bg-card border-border">
        <DialogHeader className="mb-4 pb-2 border-b border-border">
          <DialogTitle className="font-heading text-2xl font-bold">
            {editingBulletin ? "Edit Bulletin / Update" : "Post Shelter Bulletin / Media"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Publish announcements, clinic schedules, urgent foster calls, or video updates to designated pages.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3.5 flex items-center gap-2 border border-destructive/20">
            <AlertCircle className="size-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="b-title" className="text-sm font-semibold">Title *</Label>
            <Input
              id="b-title"
              placeholder="e.g. Low-Cost Vaccination Clinic This Saturday"
              className="text-sm sm:text-base py-2.5"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Category & Target Page */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="b-category" className="text-sm font-semibold">Category *</Label>
              <select
                id="b-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as BulletinCategory)}
                className="w-full bg-background border border-input px-3.5 py-2.5 text-sm sm:text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium"
              >
                <option value="announcement">General Announcement</option>
                <option value="urgent_need">Urgent Need (Fosters/Supplies)</option>
                <option value="clinic">Clinic / Medical Care</option>
                <option value="event">Community Event</option>
                <option value="happy_tail">Happy Tail Adoption Story</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-target" className="text-sm font-semibold">Designated Page Display *</Label>
              <select
                id="b-target"
                value={targetPage}
                onChange={(e) => setTargetPage(e.target.value as BulletinTargetPage)}
                className="w-full bg-background border border-input px-3.5 py-2.5 text-sm sm:text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium"
              >
                <option value="all">All Pages (Home & Pets Directory)</option>
                <option value="home">Home Page Only</option>
                <option value="pets">Adoptable Pets Directory Only</option>
                <option value="bulletins">Bulletins Newsfeed Only</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="b-content" className="text-sm font-semibold">Bulletin Content *</Label>
            <Textarea
              id="b-content"
              rows={4}
              placeholder="Write the update details, dates, items needed, or instructions..."
              className="text-sm sm:text-base leading-relaxed"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          {/* Media Selector */}
          <div className="border border-border bg-muted/30 p-4 space-y-3.5">
            <Label className="text-sm font-bold uppercase tracking-wider text-foreground block">
              Attached Media (Photo or Video)
            </Label>

            {/* Media Type Toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMediaType("image")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold border transition-colors ${
                  mediaType === "image"
                    ? "bg-foreground text-background border-foreground font-bold"
                    : "bg-background text-foreground border-border hover:bg-muted"
                }`}
              >
                <ImageIcon className="size-4" />
                Image
              </button>

              <button
                type="button"
                onClick={() => setMediaType("video")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold border transition-colors ${
                  mediaType === "video"
                    ? "bg-foreground text-background border-foreground font-bold"
                    : "bg-background text-foreground border-border hover:bg-muted"
                }`}
              >
                <Video className="size-4" />
                Video (YouTube / MP4)
              </button>

              <button
                type="button"
                onClick={() => setMediaType("none")}
                className={`flex-1 py-2 text-sm font-semibold border transition-colors ${
                  mediaType === "none"
                    ? "bg-foreground text-background border-foreground font-bold"
                    : "bg-background text-foreground border-border hover:bg-muted"
                }`}
              >
                Text Only
              </button>
            </div>

            {/* Image Input */}
            {mediaType === "image" && (
              <div className="space-y-2 pt-1">
                <Label htmlFor="b-image-url" className="text-sm font-medium">Image URL (Unsplash or direct photo link)</Label>
                <Input
                  id="b-image-url"
                  placeholder="https://images.unsplash.com/photo-..."
                  className="text-sm sm:text-base py-2.5"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                />
                {mediaUrl && (
                  <div className="relative aspect-16/9 w-full max-w-xs overflow-hidden border border-border bg-muted mt-2">
                    <Image
                      src={mediaUrl}
                      alt="Preview"
                      fill
                      className="object-cover"
                      sizes="320px"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Video Input */}
            {mediaType === "video" && (
              <div className="space-y-2.5 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="b-video-embed" className="text-sm font-medium">YouTube Embed URL or Video Link</Label>
                  <Input
                    id="b-video-embed"
                    placeholder="https://www.youtube.com/embed/VIDEO_ID"
                    className="text-sm sm:text-base py-2.5"
                    value={videoEmbedUrl}
                    onChange={(e) => setVideoEmbedUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Tip: Use YouTube embed format: <code className="bg-muted px-1.5 py-0.5 rounded">https://www.youtube.com/embed/VIDEO_ID</code>
                  </p>
                </div>

                <div className="space-y-1 pt-1">
                  <Label htmlFor="b-video-poster" className="text-sm font-medium">Video Thumbnail / Cover Photo URL (Optional)</Label>
                  <Input
                    id="b-video-poster"
                    placeholder="https://images.unsplash.com/photo-..."
                    className="text-sm sm:text-base py-2.5"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                </div>

                {videoEmbedUrl && (
                  <div className="relative aspect-16/9 w-full max-w-sm overflow-hidden border border-border mt-2 bg-black">
                    <iframe
                      src={videoEmbedUrl}
                      title="Video preview"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Author & Pin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 items-center">
            <div className="space-y-1.5">
              <Label htmlFor="b-author" className="text-sm font-semibold">Posted By</Label>
              <Input
                id="b-author"
                placeholder="Shelter Team, Clinic Staff..."
                className="text-sm sm:text-base py-2.5"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2.5 pt-5">
              <input
                type="checkbox"
                id="b-pinned"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="size-4.5 accent-foreground"
              />
              <Label htmlFor="b-pinned" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                <Pin className="size-3.5 text-foreground" />
                Pin as High-Priority Notice
              </Label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-border pt-4 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-sm font-semibold px-4 py-2"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="text-sm font-semibold px-6 py-2">
              {editingBulletin ? "Update Bulletin" : "Publish Bulletin"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
