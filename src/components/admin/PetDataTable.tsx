"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { Pet } from "@/types/pet";
import { PetFormDialog } from "@/components/admin/PetFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Home,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { usePetTableController } from "@/hooks/usePetTableController";

export function PetDataTable({ initialPets }: { initialPets?: Pet[] } = {}) {
  const { state, handlers } = usePetTableController(initialPets);
  const {
    pets,
    filteredData,
    globalFilter,
    statusFilter,
    speciesFilter,
    sorting,
    isFormOpen,
    editingPet,
    deleteCandidate,
  } = state;
  const {
    setGlobalFilter,
    setStatusFilter,
    setSpeciesFilter,
    setSorting,
    setIsFormOpen,
    setDeleteCandidate,
    handleOpenCreate,
    handleOpenEdit,
    handleFormSubmit,
    handleConfirmDelete,
    handleStatusChange,
    resetToDefaultPets,
  } = handlers;

  const columns = useMemo<ColumnDef<Pet>[]>(
    () => [
      {
        accessorKey: "image",
        header: "Photo",
        cell: ({ row }) => (
          <div className="relative size-12 overflow-hidden border border-border bg-muted shrink-0">
            <Image
              src={row.original.image}
              alt={row.original.name}
              fill
              className="object-cover"
              sizes="48px"
            />
          </div>
        ),
      },
      {
        accessorKey: "name",
        header: "Name & Breed",
        cell: ({ row }) => {
          const pet = row.original;
          return (
            <div>
              <div className="flex items-center gap-1.5 font-heading text-base font-bold text-foreground">
                <span>{pet.name}</span>
                {pet.featured && (
                  <span title="Featured on Homepage" className="inline-flex">
                    <Sparkles className="size-3.5 text-amber-500 fill-amber-500/20" />
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                {pet.breed} • <span className="font-mono">{pet.weight}</span>
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "species",
        header: "Species",
        cell: ({ row }) => (
          <span className="capitalize text-xs font-semibold px-2.5 py-1 bg-secondary text-secondary-foreground border border-border">
            {row.original.species}
          </span>
        ),
      },
      {
        accessorKey: "age",
        header: "Age & Gender",
        cell: ({ row }) => (
          <div className="text-xs text-foreground font-medium">
            <p>{row.original.gender}</p>
            <p className="text-muted-foreground">{row.original.age}</p>
          </div>
        ),
      },
      {
        accessorKey: "adoptionFee",
        header: "Fee",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold text-foreground">
            {row.original.adoptionFee}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Adoption Status",
        cell: ({ row }) => {
          const pet = row.original;
          const status = pet.status;
          
          let badgeClass = "bg-emerald-800 text-white dark:bg-emerald-950 dark:text-emerald-200 dark:border dark:border-emerald-800";
          let Icon = CheckCircle2;

          if (status === "Pending") {
            badgeClass = "bg-amber-800 text-white dark:bg-amber-950 dark:text-amber-200 dark:border dark:border-amber-800";
            Icon = Clock;
          } else if (status === "Adopted") {
            badgeClass = "bg-zinc-700 text-white dark:bg-zinc-800 dark:text-zinc-300 dark:border dark:border-zinc-700";
            Icon = Home;
          }

          return (
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${badgeClass}`}>
                <Icon className="size-3" />
                {status}
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const pet = row.original;
          return (
            <div className="flex items-center gap-1.5 justify-end">
              {/* Quick Status Dropdown */}
              <select
                value={pet.status}
                onChange={(e) => handleStatusChange(pet.id, e.target.value as Pet["status"])}
                className="bg-background border border-input text-xs font-medium px-2 py-1 focus:ring-1 focus:ring-foreground"
                aria-label={`Change status for ${pet.name}`}
              >
                <option value="Available">Available</option>
                <option value="Pending">Pending</option>
                <option value="Adopted">Adopted</option>
              </select>

              <Button
                variant="outline"
                size="xs"
                onClick={() => handleOpenEdit(pet)}
                className="text-xs"
                title="Edit pet details"
              >
                <Edit2 className="size-3 mr-1" /> Edit
              </Button>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => setDeleteCandidate(pet)}
                className="text-xs text-destructive hover:text-destructive"
                title="Delete pet record"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          );
        },
      },
    ],
    [handleStatusChange, handleOpenEdit, setDeleteCandidate]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 8 },
    },
  });

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="border border-border bg-card p-4 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        
        {/* Search & Filters */}
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Filter by name or breed..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 text-xs sm:text-sm py-2"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="filter-pet-status" className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Status:
            </label>
            <select
              id="filter-pet-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-background border border-input text-xs font-semibold px-3 py-2 text-foreground focus:ring-1 focus:ring-foreground"
            >
              <option value="all">All Statuses ({pets.length})</option>
              <option value="Available">Available ({pets.filter(p => p.status === "Available").length})</option>
              <option value="Pending">Pending ({pets.filter(p => p.status === "Pending").length})</option>
              <option value="Adopted">Adopted ({pets.filter(p => p.status === "Adopted").length})</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="filter-pet-species" className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Species:
            </label>
            <select
              id="filter-pet-species"
              value={speciesFilter}
              onChange={(e) => setSpeciesFilter(e.target.value)}
              className="bg-background border border-input text-xs font-semibold px-3 py-2 text-foreground focus:ring-1 focus:ring-foreground"
            >
              <option value="all">All Species</option>
              <option value="dog">Dogs</option>
              <option value="cat">Cats</option>
            </select>
          </div>

          {(globalFilter || statusFilter !== "all" || speciesFilter !== "all") && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setGlobalFilter("");
                setStatusFilter("all");
                setSpeciesFilter("all");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3 mr-1" /> Reset
            </Button>
          )}
        </div>

        {/* Add Pet Button */}
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="text-xs font-semibold uppercase tracking-wider px-4 py-2 gap-1.5"
          >
            <Plus className="size-4" />
            Add New Pet
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={resetToDefaultPets}
            title="Reset to 8 default Petaling Jaya rescue animals"
            className="text-xs text-muted-foreground"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* TanStack Table Container */}
      <div className="border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="p-3.5 sm:p-4">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border/60">
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-3.5 sm:p-4 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                    <SlidersHorizontal className="size-6 mx-auto mb-2 text-muted-foreground/60" />
                    <p className="text-sm font-medium">No animals match the selected filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="border-t border-border p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground bg-background">
          <div>
            Showing <strong className="text-foreground">{table.getRowModel().rows.length}</strong> of{" "}
            <strong className="text-foreground">{filteredData.length}</strong> total records
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="text-xs"
            >
              <ChevronLeft className="size-3.5 mr-0.5" /> Previous
            </Button>
            <span className="font-mono px-2">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
            </span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="text-xs"
            >
              Next <ChevronRight className="size-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      <PetFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        editingPet={editingPet}
        onSave={handleFormSubmit}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteCandidate} onOpenChange={(o) => !o && setDeleteCandidate(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive">
              Confirm Delete Pet Record
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Are you sure you want to remove <strong>{deleteCandidate?.name}</strong> ({deleteCandidate?.breed}) from the sanctuary database? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteCandidate(null)} className="text-xs">
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete} className="text-xs font-semibold">
              Yes, Delete Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
