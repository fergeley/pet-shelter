"use client";

import { useState, useMemo } from "react";
import { SortingState } from "@tanstack/react-table";
import { AdoptionApplicationRecord, ApplicationStatus } from "@/types/application";
import { useApplicationStore } from "@/lib/applicationStore";
import { exportApplicationsToCsv } from "@/lib/exportCsv";
import {
  updateApplicationStatus as serverUpdateStatus,
  deleteApplication as serverDeleteApplication,
} from "@/actions/applications";

export function useApplicationTableController(initialApplications?: AdoptionApplicationRecord[]) {
  const {
    applications: storeApplications,
    updateApplicationStatus,
    deleteApplication,
    resetToDefaultApplications,
  } = useApplicationStore();

  const applications = initialApplications || storeApplications;

  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([]);

  // Modals & Selection
  const [activeAppForDetail, setActiveAppForDetail] = useState<AdoptionApplicationRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<AdoptionApplicationRecord | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    return applications.filter((app) => {
      if (statusFilter !== "all" && app.status !== statusFilter) return false;
      if (globalFilter.trim() !== "") {
        const q = globalFilter.toLowerCase();
        const matchApplicant = app.applicantName.toLowerCase().includes(q);
        const matchPet = app.petName.toLowerCase().includes(q);
        const matchEmail = app.email.toLowerCase().includes(q);
        if (!matchApplicant && !matchPet && !matchEmail) return false;
      }
      return true;
    });
  }, [applications, statusFilter, globalFilter]);

  const handleQuickStatus = (id: string, nextStatus: ApplicationStatus) => {
    setStatusError(null);
    const res = updateApplicationStatus(id, nextStatus);
    if (res && !res.success) {
      setStatusError(res.error || "Failed to update application status.");
    } else {
      serverUpdateStatus({ id, status: nextStatus }).catch((err) =>
        console.warn("Background server action sync:", err)
      );
    }
  };

  const handleUpdateStatusWithNotes = (
    id: string,
    status: ApplicationStatus,
    notes: string
  ) => {
    const res = updateApplicationStatus(id, status, notes);
    if (res && res.success) {
      serverUpdateStatus({ id, status, adminReviewNotes: notes }).catch((err) =>
        console.warn("Background server update sync:", err)
      );
    }
    return res;
  };

  const confirmDelete = () => {
    if (deleteCandidate) {
      deleteApplication(deleteCandidate.id);
      serverDeleteApplication(deleteCandidate.id).catch((err) =>
        console.warn("Background server delete sync:", err)
      );
      setDeleteCandidate(null);
    }
  };

  const handleExportCsv = () => {
    exportApplicationsToCsv(filteredData);
  };

  return {
    state: {
      applications,
      filteredData,
      globalFilter,
      statusFilter,
      sorting,
      activeAppForDetail,
      isDetailOpen,
      deleteCandidate,
      statusError,
    },
    handlers: {
      setGlobalFilter,
      setStatusFilter,
      setSorting,
      setActiveAppForDetail,
      setIsDetailOpen,
      setDeleteCandidate,
      setStatusError,
      handleQuickStatus,
      handleUpdateStatusWithNotes,
      confirmDelete,
      handleExportCsv,
      resetToDefaultApplications,
    },
  };
}
