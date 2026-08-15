"use client";

import { useState, useMemo } from "react";
import { Pet } from "@/types/pet";
import { PetFormInput } from "@/lib/validations/pet";
import { usePetStore } from "@/lib/petStore";
import { exportPetsToCsv } from "@/lib/exportCsv";
import {
  createPet as serverCreatePet,
  updatePet as serverUpdatePet,
  deletePet as serverDeletePet,
  updatePetStatus as serverUpdatePetStatus,
} from "@/actions/pets";
import { SortingState } from "@tanstack/react-table";

export function usePetTableController(initialPets?: Pet[]) {
  const {
    pets: storePets,
    addPet,
    updatePet,
    updatePetStatus,
    deletePet,
    resetToDefaultPets,
  } = usePetStore();

  const pets = initialPets || storePets;

  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [speciesFilter, setSpeciesFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([]);

  // Modals & Selection
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Pet | null>(null);

  const filteredData = useMemo(() => {
    return pets.filter((pet) => {
      if (statusFilter !== "all" && pet.status !== statusFilter) return false;
      if (speciesFilter !== "all" && pet.species !== speciesFilter) return false;
      if (globalFilter.trim() !== "") {
        const q = globalFilter.toLowerCase();
        const matchName = pet.name.toLowerCase().includes(q);
        const matchBreed = pet.breed.toLowerCase().includes(q);
        const matchTags = pet.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchBreed && !matchTags) return false;
      }
      return true;
    });
  }, [pets, statusFilter, speciesFilter, globalFilter]);

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
      serverUpdatePet(editingPet.id, data).catch((err) =>
        console.warn("Background server update sync:", err)
      );
    } else {
      addPet(data);
      serverCreatePet(data).catch((err) =>
        console.warn("Background server create sync:", err)
      );
    }
    setIsFormOpen(false);
    setEditingPet(null);
  };

  const handleConfirmDelete = () => {
    if (deleteCandidate) {
      deletePet(deleteCandidate.id);
      serverDeletePet(deleteCandidate.id).catch((err) =>
        console.warn("Background server delete sync:", err)
      );
      setDeleteCandidate(null);
    }
  };

  const handleStatusChange = (id: string, newStatus: Pet["status"]) => {
    updatePetStatus(id, newStatus);
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
      sorting,
      isFormOpen,
      editingPet,
      deleteCandidate,
    },
    handlers: {
      setGlobalFilter,
      setStatusFilter,
      setSpeciesFilter,
      setSorting,
      setIsFormOpen,
      setEditingPet,
      setDeleteCandidate,
      handleOpenCreate,
      handleOpenEdit,
      handleFormSubmit,
      handleConfirmDelete,
      handleStatusChange,
      handleExportCsv,
      resetToDefaultPets,
    },
  };
}
