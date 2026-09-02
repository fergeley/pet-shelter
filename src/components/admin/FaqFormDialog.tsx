"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle } from "lucide-react";

import { faqFormSchema, FaqFormInput, FAQ_CATEGORIES } from "@/lib/validations/faq";
import { FAQ_CATEGORY_LABELS } from "@/lib/presentation/categoryTabs";
import { FaqRecord } from "@/types/faq";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface FaqFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingFaq?: FaqRecord | null;
  /** Suggested displayOrder for a new entry (end of its category). */
  nextDisplayOrder?: number;
  /** Server-side save failure, rendered next to the submit button. */
  error?: string | null;
  onSave: (data: FaqFormInput) => Promise<void> | void;
}

const EMPTY: FaqFormInput = {
  category: "general",
  question: "",
  answer: "",
  questionMs: "",
  answerMs: "",
  displayOrder: 0,
  isPublished: true,
};

const selectClass =
  "w-full bg-background border border-input px-3.5 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-foreground";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

export function FaqFormDialog({
  open,
  onOpenChange,
  editingFaq,
  nextDisplayOrder = 0,
  error,
  onSave,
}: FaqFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FaqFormInput>({
    resolver: zodResolver(faqFormSchema),
    defaultValues: EMPTY,
  });

  // Reset whenever the dialog opens on a different record, mirroring the
  // render-phase key comparison used by PetFormDialog.
  const [prevKey, setPrevKey] = useState<string | null>(null);
  const currentKey = open ? (editingFaq ? `edit-${editingFaq.id}` : "create-new") : null;

  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    if (editingFaq) {
      reset({
        category: editingFaq.category,
        question: editingFaq.question,
        answer: editingFaq.answer,
        // The unresolved values: the editor must not present the English
        // fallback as if it were a translation, or saving would freeze it into
        // the Malay column.
        questionMs: editingFaq.questionMs ?? "",
        answerMs: editingFaq.answerMs ?? "",
        displayOrder: editingFaq.displayOrder,
        isPublished: editingFaq.isPublished,
      });
    } else if (open) {
      reset({ ...EMPTY, displayOrder: nextDisplayOrder });
    }
  }

  const submit = handleSubmit(async (values) => {
    await onSave(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingFaq ? "Edit FAQ Entry" : "Add a New FAQ Entry"}</DialogTitle>
          <DialogDescription>
            Published entries appear immediately on the public FAQ page. The Bahasa
            Malaysia fields are optional — visitors reading in Malay see the English
            copy until a translation is supplied.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="faq-category">Category</Label>
              <select id="faq-category" {...register("category")} className={selectClass}>
                {FAQ_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {FAQ_CATEGORY_LABELS[value].labelEn}
                  </option>
                ))}
              </select>
              <FieldError message={errors.category?.message} />
            </div>

            <div>
              <Label htmlFor="faq-order">Display order</Label>
              <Input id="faq-order" type="number" min={0} {...register("displayOrder")} />
              <FieldError message={errors.displayOrder?.message} />
            </div>
          </div>

          <div>
            <Label htmlFor="faq-question">Question (English)</Label>
            <Input
              id="faq-question"
              placeholder="How much does it cost to adopt a pet?"
              {...register("question")}
            />
            <FieldError message={errors.question?.message} />
          </div>

          <div>
            <Label htmlFor="faq-answer">Answer (English)</Label>
            <Textarea
              id="faq-answer"
              rows={6}
              placeholder="Leave a blank line between paragraphs to break the answer up."
              {...register("answer")}
            />
            <FieldError message={errors.answer?.message} />
          </div>

          <div className="border-t border-border pt-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bahasa Malaysia (optional)
            </p>

            <div>
              <Label htmlFor="faq-question-ms">Soalan</Label>
              <Input
                id="faq-question-ms"
                placeholder="Berapakah kos untuk mengadopsi haiwan?"
                {...register("questionMs")}
              />
              <FieldError message={errors.questionMs?.message} />
            </div>

            <div>
              <Label htmlFor="faq-answer-ms">Jawapan</Label>
              <Textarea id="faq-answer-ms" rows={5} {...register("answerMs")} />
              <FieldError message={errors.answerMs?.message} />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              {...register("isPublished")}
              className="size-4 accent-foreground"
            />
            Published — visible on the public FAQ page
          </label>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 border border-destructive/40 bg-destructive/10 px-4 py-3 rounded-xl text-sm text-destructive"
            >
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editingFaq ? "Save Changes" : "Create FAQ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
