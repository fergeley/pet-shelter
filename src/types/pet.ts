export type Species = 'dog' | 'cat' | 'other';
export type Gender = 'Male' | 'Female';
export type PetSize = 'Small' | 'Medium' | 'Large';
export type PetStatus = 'Available' | 'Pending' | 'Adopted' | 'In Rehabilitation' | 'Rehabilitation';
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

export type MedicalTimelineCategory =
  | 'intake'
  | 'diagnostic'
  | 'treatment'
  | 'vaccination'
  | 'surgery'
  | 'clearance';

export interface MedicalTimelineEvent {
  id: string;
  date: string; // ISO format: YYYY-MM-DD
  title: string;
  titleMs?: string;
  category: MedicalTimelineCategory;
  description: string;
  descriptionMs?: string;
  veterinarian?: string;
  vetId?: string;
  verified: boolean;
  badge?: string;
  badgeMs?: string;
}

export interface PetUpdate {
  id: string;
  date: string;
  title: string;
  titleMs?: string;
  content: string;
  contentMs?: string;
  image?: string;
  category?: 'medical' | 'rehabilitation' | 'milestone' | 'socialization';
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
  rehabStage?: string;
  rehabStageMs?: string;
  rehabProgressPercent?: number;
  updates?: PetUpdate[];
  medical: PetMedicalInfo;
  medicalTimeline?: MedicalTimelineEvent[];
  compatibility: PetCompatibility;
  intakeDate: string;
  birthDate?: string;
  birthDateIsEstimate?: boolean;
  adoptionFee: string;
  featured?: boolean;
  isArchived?: boolean;
  deletedAt?: string | null;
}

export interface PetFilterState {
  searchQuery: string;
  species: string; // 'all' | 'dog' | 'cat'
  ageCategory: string; // 'all' | 'puppy_kitten' | 'young' | 'adult' | 'senior'
  size: string; // 'all' | 'Small' | 'Medium' | 'Large'
  status: string; // 'all' | 'Available' | 'Pending'
  isArchived?: boolean;
}


