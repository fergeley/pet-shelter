export type Species = 'dog' | 'cat' | 'other';
export type Gender = 'Male' | 'Female';
export type PetSize = 'Small' | 'Medium' | 'Large';
export type PetStatus = 'Available' | 'Pending' | 'Adopted';
export type AgeCategory = 'puppy_kitten' | 'young' | 'adult' | 'senior';
export type EnergyLevel = 'Low' | 'Moderate' | 'High';

export interface PetMedicalInfo {
  vaccinated: boolean;
  microchipped: boolean;
  spayedNeutered: boolean;
  specialNeeds?: string;
}

export interface PetCompatibility {
  goodWithDogs: boolean;
  goodWithCats: boolean;
  goodWithKids: boolean;
  energyLevel: EnergyLevel;
}

export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed: string;
  age: string; // e.g. "2 years", "4 months"
  ageCategory: AgeCategory;
  gender: Gender;
  size: PetSize;
  weight: string; // e.g. "45 lbs"
  tags: string[]; // e.g. ["Kid-friendly", "House-trained", "Gentle"]
  description: string;
  rescueStory: string;
  image: string;
  galleryImages?: string[];
  status: PetStatus;
  medical: PetMedicalInfo;
  compatibility: PetCompatibility;
  intakeDate: string;
  adoptionFee: string;
  featured?: boolean;
}

export interface PetFilterState {
  searchQuery: string;
  species: string; // 'all' | 'dog' | 'cat'
  ageCategory: string; // 'all' | 'puppy_kitten' | 'young' | 'adult' | 'senior'
  size: string; // 'all' | 'Small' | 'Medium' | 'Large'
  status: string; // 'all' | 'Available' | 'Pending'
}

export interface AdoptionFormData {
  petId: string;
  petName: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  applicantAddress: string;
  housingType: 'own_house_yard' | 'rent_house_yard' | 'apartment' | 'condo' | 'other';
  hasFencedYard: 'yes' | 'no' | 'not_applicable';
  currentPets: 'none' | 'dogs' | 'cats' | 'both' | 'other';
  currentPetDetails?: string;
  householdExperience: 'first_time' | 'some_experience' | 'experienced';
  applicantNotes?: string;
  agreeToTerms: boolean;
}