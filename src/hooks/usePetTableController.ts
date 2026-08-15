"use client";

import { useState, useMemo } from "react";
import { Pet } from "@/types/pet";
import { PetFormInput } from "@/lib/validations/pet";
import { usePetStore } from "@/lib/petStore";
import { exportPetsToCsv } from "@/lib/exportCsv";
import {
  createPet as serverCreatePet,
  updatePet as serverUpdatePet,
  toggleArchivePet as serverToggleArchivePet,
  updatePetStatus as serverUpdatePetStatus,
} from "@/actions/pets";
import { SortingState } from "@tanstack/react-table";

export function usePetTableController(initialPets?: (Pet & { applicationCount?: number })[]) {
  const {
    pets: storePets,
    addPet,
    updatePet,
    updatePetStatus,
    toggleArchivePet,
    resetToDefaultPets,
  } = usePetStore();

  const [localPets, setLocalPets] = useState<(Pet & { applicationCount?: number })[] | null>(null);
  const pets = localPets || initialPets || storePets;

  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [speciesFilter, setSpeciesFilter] = useState<string>("all");
  const [archiveFilter, setArchiveFilter] = useState<string>("active"); // "all" | "active" | "archived"
  const [sorting, setSorting] = useState<SortingState>([]);

  // Modals & Selection
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [archiveCandidate, setArchiveCandidate] = useState<{ pet: Pet; archive: boolean } | null>(null);

  const filteredData = useMemo(() => {
    return pets.filter((pet) => {
      // Archive filter
      if (archiveFilter === "active" && pet.isArchived) return false;
      if (archiveFilter === "archived" && !pet.isArchived) return false;

      // Status filter
      if (statusFilter !== "all" && pet.status !== statusFilter) return false;

      // Species filter
      if (speciesFilter !== "all" && pet.species !== speciesFilter) return false;

      // Global search
      if (globalFilter.trim() !== "") {
        const q = globalFilter.toLowerCase();
        const matchName = pet.name.toLowerCase().includes(q);
        const matchBreed = pet.breed.toLowerCase().includes(q);
        const matchTags = pet.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchBreed && !matchTags) return false;
      }
      return true;
    });
  }, [pets, archiveFilter, statusFilter, speciesFilter, globalFilter]);

  const handleOpenCreate = () => {
    setEditingPet(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (pet: Pet) => {
    setEditingPet(pet);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: PetFormInput) => {
    if (editingPet) {
      updatePet(editingPet.id, data);
      setLocalPets((prev) => {
        const base = prev || pets;
        return base.map((p) => (p.id === editingPet.id ? { ...p, ...data } : p));
      });
      serverUpdatePet(editingPet.id, data).catch((err) =>
        console.warn("Background server update sync:", err)
      );
    } else {
      const created = addPet(data);
      setLocalPets((prev) => [created, ...(prev || pets)]);
      serverCreatePet(data).catch((err) =>
        console.warn("Background server create sync:", err)
      );
    }
    setIsFormOpen(false);
    setEditingPet(null);
  };

  const handleConfirmArchive = () => {
    if (archiveCandidate) {
      const { pet, archive } = archiveCandidate;
      toggleArchivePet(pet.id, archive);
      setLocalPets((prev) => {
        const base = prev || pets;
        return base.map((p) =>
          p.id === pet.id ? { ...p, isArchived: archive, deletedAt: archive ? new Date().toISOString() : null } : p
        );
      });
      serverToggleArchivePet(pet.id, archive).catch((err) =>
        console.warn("Background server archive sync:", err)
      );
      setArchiveCandidate(null);
    }
  };

  const handleStatusChange = (id: string, newStatus: Pet["status"]) => {
    updatePetStatus(id, newStatus);
    setLocalPets((prev) => {
      const base = prev || pets;
      return base.map((p) => (p.id === id ? { ...p, status: newStatus } : p));
    });
    serverUpdatePetStatus(id, newStatus).catch((err) =>
      console.warn("Background server status sync:", err)
    );
  };

  const handleExportCsv = () => {
    exportPetsToCsv(filteredData);
  };

  return {
    state: {
      pets,
      filteredData,
      globalFilter,
      statusFilter,
      speciesFilter,
      archiveFilter,
      sorting,
      isFormOpen,
      editingPet,
      archiveCandidate,
    },
    handlers: {
      setGlobalFilter,
      setStatusFilter,
      setSpeciesFilter,
      setArchiveFilter,
      setSorting,
      setIsFormOpen,
      setEditingPet,
      setArchiveCandidate,
      handleOpenCreate,
      handleOpenEdit,
      handleFormSubmit,
      handleConfirmArchive,
      handleStatusChange,
      handleExportCsv,
      resetToDefaultPets,
    },
  };
}
