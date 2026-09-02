"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { FaqFormDialog } from "@/components/admin/FaqFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createFaq,
  updateFaq,
  deleteFaq,
  toggleFaqPublished,
  reorderFaq,
} from "@/actions/faqs";
import {
  FAQ_CATEGORIES,
  FaqEntry,
  faqMatchesQuery,
  sortFaqs,
} from "@/lib/domain/faq";
import type { FaqCategoryValue } from "@/lib/validations/faq";
import type { FaqFormInput } from "@/lib/validations/faq";
import { cn } from "@/lib/utils";

type CategoryFilter = FaqCategoryValue | "all";
type PublishedFilter = "all" | "published" | "draft";

const selectClass =
  "bg-background border border-input px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-foreground";

export function FaqDataTable({ initialFaqs }: { initialFaqs: FaqEntry[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [published, setPublished] = useState<PublishedFilter>("all");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FaqEntry | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<FaqEntry | null>(null);
  /** Row-action failures, shown in the page banner. */
  const [error, setError] = useState<string | null>(null);
  /** Create/edit failures, shown inside the dialog that is covering the banner. */
  const [saveError, setSaveError] = useState<string | null>(null);

  const faqs = initialFaqs;

  const filtered = useMemo(() => {
    return faqs.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (published === "published" && !f.isPublished) return false;
      if (published === "draft" && f.isPublished) return false;
      if (search.trim() && !faqMatchesQuery(f, search)) return false;
      return true;
    });
  }, [faqs, category, published, search]);

  /**
   * Rows are grouped by category because `displayOrder` — and therefore the
   * move up/down buttons — is scoped to a category, not the whole table.
   */
  const groups = useMemo(
    () =>
      FAQ_CATEGORIES.map((meta) => ({
        meta,
        rows: sortFaqs(filtered.filter((f) => f.category === meta.value)),
        // Boundary checks use the unfiltered set so a hidden neighbour is
        // still recognised as a valid swap target.
        fullOrder: sortFaqs(faqs.filter((f) => f.category === meta.value)),
      })).filter((g) => g.rows.length > 0),
    [filtered, faqs]
  );

  /** Runs a server action, surfaces its error, and refreshes the table data. */
  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "The operation failed.");
        return;
      }
      router.refresh();
    });
  }

  function handleOpenCreate() {
    setEditingFaq(null);
    setSaveError(null);
    setIsFormOpen(true);
  }

  function handleOpenEdit(faq: FaqEntry) {
    setEditingFaq(faq);
    setSaveError(null);
    setIsFormOpen(true);
  }

  async function handleSave(data: FaqFormInput) {
    // A failed save reports into the dialog, not the page banner: the banner
    // sits behind the still-open modal, so routing errors there showed the
    // admin nothing while the Save button silently re-enabled.
    setSaveError(null);
    const result = editingFaq
      ? await updateFaq(editingFaq.id, data)
      : await createFaq(data);

    if (!result.success) {
      setSaveError(result.error ?? "Could not save the FAQ entry.");
      return;
    }

    setIsFormOpen(false);
    setEditingFaq(null);
    router.refresh();
  }

  /** Next free slot at the end of the currently selected category. */
  const nextDisplayOrder = useMemo(() => {
    const scope = category === "all" ? faqs : faqs.filter((f) => f.category === category);
    return scope.length === 0 ? 0 : Math.max(...scope.map((f) => f.displayOrder)) + 1;
  }, [faqs, category]);

  const publishedCount = faqs.filter((f) => f.isPublished).length;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex items-center border-b border-input focus-within:border-b-ring transition-colors sm:max-w-xs flex-1">
            <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions and answers…"
              className="pl-3 border-b-transparent focus-visible:border-b-transparent"
              aria-label="Search FAQ entries"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryFilter)}
            className={selectClass}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {FAQ_CATEGORIES.map((meta) => (
              <option key={meta.value} value={meta.value}>
                {meta.pillLabel}
              </option>
            ))}
          </select>

          <select
            value={published}
            onChange={(e) => setPublished(e.target.value as PublishedFilter)}
            className={selectClass}
            aria-label="Filter by publication status"
          >
            <option value="all">Published & drafts</option>
            <option value="published">Published only</option>
            <option value="draft">Drafts only</option>
          </select>
        </div>

        <Button onClick={handleOpenCreate} className="shrink-0">
          <Plus className="size-4" />
          Add FAQ
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {faqs.length} total · {publishedCount} published · {faqs.length - publishedCount} draft
        {filtered.length !== faqs.length && ` · ${filtered.length} matching filters`}
      </p>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 border border-destructive/40 bg-destructive/10 px-4 py-3 rounded-xl text-sm text-destructive"
        >
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grouped table */}
      {groups.length === 0 ? (
        <div className="border border-border rounded-2xl bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No FAQ entries match the current filters.
          </p>
        </div>
      ) : (
        <div className={cn("space-y-8", isPending && "opacity-60 pointer-events-none")}>
          {groups.map((group) => (
            <section key={group.meta.value}>
              <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {group.meta.pillLabel}
                <span className="ml-2 font-normal normal-case tracking-normal">
                  ({group.rows.length})
                </span>
              </h2>

              <div className="border border-border rounded-xl overflow-hidden bg-background divide-y divide-border">
                {group.rows.map((faq) => {
                  const positionInCategory = group.fullOrder.findIndex(
                    (f) => f.id === faq.id
                  );
                  const isFirst = positionInCategory === 0;
                  const isLast = positionInCategory === group.fullOrder.length - 1;

                  return (
                    <div
                      key={faq.id}
                      className="flex flex-col sm:flex-row sm:items-start gap-3 p-4"
                    >
                      {/* Reorder controls */}
                      <div className="flex sm:flex-col gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="icon-xs"
                          disabled={isFirst || isPending}
                          onClick={() => run(() => reorderFaq(faq.id, "up"))}
                          aria-label={`Move "${faq.question}" up`}
                          title="Move up"
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-xs"
                          disabled={isLast || isPending}
                          onClick={() => run(() => reorderFaq(faq.id, "down"))}
                          aria-label={`Move "${faq.question}" down`}
                          title="Move down"
                        >
                          <ArrowDown />
                        </Button>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground tabular-nums border border-border px-1.5 py-0.5 rounded">
                            #{faq.displayOrder}
                          </span>
                          {!faq.isPublished && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded">
                              Draft
                            </span>
                          )}
                          {!faq.questionMs && (
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider bg-muted/60 text-muted-foreground px-2 py-0.5 rounded"
                              title="No Bahasa Malaysia translation; Malay visitors see the English copy"
                            >
                              EN only
                            </span>
                          )}
                        </div>

                        <p className="font-semibold text-sm text-foreground break-words">
                          {faq.question}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 break-words">
                          {faq.answer}
                        </p>
                      </div>

                      {/* Row actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() =>
                            run(() => toggleFaqPublished(faq.id, !faq.isPublished))
                          }
                          disabled={isPending}
                          title={faq.isPublished ? "Unpublish" : "Publish"}
                        >
                          {faq.isPublished ? <Eye /> : <EyeOff />}
                          {faq.isPublished ? "Live" : "Draft"}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-xs"
                          onClick={() => handleOpenEdit(faq)}
                          disabled={isPending}
                          aria-label={`Edit "${faq.question}"`}
                          title="Edit"
                        >
                          <Edit2 />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-xs"
                          onClick={() => setDeleteCandidate(faq)}
                          disabled={isPending}
                          aria-label={`Delete "${faq.question}"`}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {isPending && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Saving…
        </p>
      )}

      <FaqFormDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setSaveError(null);
        }}
        editingFaq={editingFaq}
        nextDisplayOrder={nextDisplayOrder}
        error={saveError}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteCandidate}
        onOpenChange={(open) => !open && setDeleteCandidate(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this FAQ entry?</DialogTitle>
            <DialogDescription>
              &ldquo;{deleteCandidate?.question}&rdquo; will be removed from the public
              FAQ page permanently. This cannot be undone — unpublish it instead if you
              only want to hide it for now.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCandidate(null)}>
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const target = deleteCandidate;
                setDeleteCandidate(null);
                if (target) run(() => deleteFaq(target.id));
              }}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
