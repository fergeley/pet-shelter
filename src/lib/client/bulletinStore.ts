"use client";

import { useState, useEffect, useCallback } from "react";
import { Bulletin, BulletinFormData, BulletinTargetPage } from "@/types/bulletin";
import initialBulletins from "@/data/bulletins.json";

const STORAGE_KEY = "hope_for_strays_bulletins_v1";

export function useBulletins(filterTargetPage?: BulletinTargetPage) {
  const [bulletins, setBulletins] = useState<Bulletin[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        console.error("Failed to load bulletins from localStorage", e);
      }
    }
    return initialBulletins as Bulletin[];
  });

  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bulletins));
    } catch (e) {
      console.error("Failed to save bulletins to localStorage", e);
    }
  }, [bulletins]);

  // Add new bulletin
  const addBulletin = useCallback((data: BulletinFormData) => {
    const newBulletin: Bulletin = {
      ...data,
      id: `bulletin-${Date.now()}`,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setBulletins((prev) => [newBulletin, ...prev]);
    return newBulletin;
  }, []);

  // Update existing bulletin
  const updateBulletin = useCallback((id: string, updated: Partial<BulletinFormData>) => {
    setBulletins((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updated } : b))
    );
  }, []);

  // Delete bulletin
  const deleteBulletin = useCallback((id: string) => {
    setBulletins((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // Toggle pin
  const togglePinBulletin = useCallback((id: string) => {
    setBulletins((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isPinned: !b.isPinned } : b))
    );
  }, []);

  // Reset to default initial mock data
  const resetToDefaultBulletins = useCallback(() => {
    setBulletins(initialBulletins as Bulletin[]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Filter bulletins for target page
  const displayedBulletins = bulletins.filter((b) => {
    if (!filterTargetPage || filterTargetPage === "all") return true;
    return b.targetPage === "all" || b.targetPage === filterTargetPage;
  });

  // Sort pinned first, then newest
  const sortedBulletins = [...displayedBulletins].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    bulletins: sortedBulletins,
    allBulletins: bulletins,
    isAdminMode,
    setIsAdminMode,
    addBulletin,
    updateBulletin,
    deleteBulletin,
    togglePinBulletin,
    resetToDefaultBulletins,
  };
}
