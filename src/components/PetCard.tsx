"use client";

import Image from "next/image";
import { Info, Heart } from "lucide-react";
import { Pet } from "@/types/pet";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PetCardProps {
  pet: Pet;
  onSelectPet: (pet: Pet) => void;
  onAdoptPet?: (pet: Pet) => void;
}

export function PetCard({ pet, onSelectPet, onAdoptPet }: PetCardProps) {
  const isAvailable = pet.status === "Available";

  return (
    <Card className="group flex h-full flex-col justify-between overflow-hidden border border-border bg-card transition-all duration-200 hover:border-foreground/40 hover:shadow-xs">
      <div>
        {/* Pet Image Container */}
        <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
          <Image
            src={pet.image}
            alt={`${pet.name}, ${pet.breed}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-102"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          
          {/* Status Badge - WCAG AAA Compliant */}
          <div className="absolute top-3 left-3 flex gap-2">
            <span
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider text-white ${
                isAvailable
                  ? "bg-emerald-800 dark:bg-emerald-900"
                  : "bg-amber-800 dark:bg-amber-900"
              }`}
            >
              {pet.status}
            </span>
          </div>

          {/* Gender & Age Pill */}
          <div className="absolute top-3 right-3 bg-black/85 px-3 py-1 text-xs font-semibold text-white">
            {pet.gender} • {pet.age}
          </div>
        </div>

        {/* Pet Name & Breed */}
        <CardHeader className="p-5 pb-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {pet.name}
            </h3>
            <span className="font-mono text-sm font-semibold text-muted-foreground">
              {pet.weight}
            </span>
          </div>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            {pet.breed}
          </p>
        </CardHeader>

        {/* Description & Characteristic Tags */}
        <CardContent className="p-5 pt-1 space-y-3">
          <p className="text-sm text-foreground/90 leading-relaxed line-clamp-2">
            {pet.description}
          </p>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {pet.tags.map((tag, idx) => (
              <span
                key={idx}
                className="bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground border border-border"
              >
                {tag}
              </span>
            ))}
          </div>
        </CardContent>
      </div>

      {/* Footer Actions */}
      <CardFooter className="p-5 pt-0 border-t border-border/60 mt-3 grid grid-cols-2 gap-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectPet(pet)}
          className="w-full text-sm font-semibold py-2 focus-visible:ring-2"
        >
          <Info className="size-4 mr-1" />
          Details
        </Button>

        <Button
          size="sm"
          disabled={!isAvailable}
          onClick={() => {
            if (onAdoptPet) {
              onAdoptPet(pet);
            } else {
              onSelectPet(pet);
            }
          }}
          className="w-full text-sm font-semibold py-2 focus-visible:ring-2"
        >
          <Heart className="size-4 fill-current mr-1" />
          {isAvailable ? "Adopt" : "Pending"}
        </Button>
      </CardFooter>
    </Card>
  );
}
