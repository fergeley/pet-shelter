import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import crypto from "node:crypto";
import petsData from "../src/data/pets.json";
import applicationsData from "../src/data/applications.json";
import { FAQ_SEED_CONTENT } from "../src/lib/domain/faq";

function hashPasswordSync(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgrespassword@localhost:5432/pet_shelter?schema=public";

  const isSsl = connectionString.includes("sslmode=require") || connectionString.includes("neon.tech");
  const pool = new Pool({
    connectionString,
    ssl: isSsl ? { rejectUnauthorized: false } : undefined,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("🌱 Starting Hope for Strays database seeding...");

  // 1. Seed Staff Users
  const staffUsers = [
    {
      id: "usr-admin-01",
      email: "admin@hopeforstrays.org",
      name: "Dr. Sarah Tan",
      role: "ADMIN" as const,
      password: "admin123",
    },
    {
      id: "usr-coord-01",
      email: "coordinator@hopeforstrays.org",
      name: "Priya Devi",
      role: "COORDINATOR" as const,
      password: "coord123",
    },
    {
      id: "usr-staff-01",
      email: "staff@hopeforstrays.org",
      name: "Ahmad Razak",
      role: "STAFF" as const,
      password: "staff123",
    },
    {
      id: "usr-vol-01",
      email: "volunteer@hopeforstrays.org",
      name: "Mei Ling",
      role: "VOLUNTEER" as const,
      password: "vol123",
    },
  ];

  for (const user of staffUsers) {
    const passwordHash = hashPasswordSync(user.password);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash,
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
      },
    });
    console.log(`  ✓ Staff user seeded: ${user.email} (${user.role})`);
  }

  // 2. Seed Shelter Settings
  await prisma.shelterSettings.upsert({
    where: { id: "default-settings" },
    update: {},
    create: {
      id: "default-settings",
      shelterName: "Hope for Strays",
      email: "info@hopeforstrays.org",
      phone: "03-7876 5432",
      address: "No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia",
      operatingHours: "Tuesday – Sunday: 10:00 AM – 5:00 PM",
      announcementBanner: "Adoption Drive this weekend in SS2! Meet our rescued dogs and cats.",
      adoptionFeeDog: "Free",
      adoptionFeeCat: "Free",
    },
  });
  console.log("  ✓ Shelter settings seeded.");

  // 3. Seed Pets
  for (const pet of petsData) {
    await prisma.pet.upsert({
      where: { id: pet.id },
      update: {
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        age: pet.age,
        ageCategory: pet.ageCategory,
        gender: pet.gender,
        size: pet.size,
        weight: pet.weight,
        status: pet.status,
        adoptionFee: pet.adoptionFee,
        description: pet.description,
        rescueStory: pet.rescueStory,
        image: pet.image,
        galleryImages: pet.galleryImages || [],
        tags: pet.tags || [],
        featured: pet.featured || false,
        intakeDate: pet.intakeDate,
        vaccinated: pet.medical?.vaccinated ?? true,
        microchipped: pet.medical?.microchipped ?? true,
        spayedNeutered: pet.medical?.spayedNeutered ?? true,
        specialNeeds: pet.medical?.specialNeeds || null,
        goodWithDogs: pet.compatibility?.goodWithDogs ?? true,
        goodWithCats: pet.compatibility?.goodWithCats ?? true,
        goodWithKids: pet.compatibility?.goodWithKids ?? true,
        energyLevel: pet.compatibility?.energyLevel || "Moderate",
        isArchived: false,
        deletedAt: null,
      },
      create: {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        age: pet.age,
        ageCategory: pet.ageCategory,
        gender: pet.gender,
        size: pet.size,
        weight: pet.weight,
        status: pet.status,
        adoptionFee: pet.adoptionFee,
        description: pet.description,
        rescueStory: pet.rescueStory,
        image: pet.image,
        galleryImages: pet.galleryImages || [],
        tags: pet.tags || [],
        featured: pet.featured || false,
        intakeDate: pet.intakeDate,
        vaccinated: pet.medical?.vaccinated ?? true,
        microchipped: pet.medical?.microchipped ?? true,
        spayedNeutered: pet.medical?.spayedNeutered ?? true,
        specialNeeds: pet.medical?.specialNeeds || null,
        goodWithDogs: pet.compatibility?.goodWithDogs ?? true,
        goodWithCats: pet.compatibility?.goodWithCats ?? true,
        goodWithKids: pet.compatibility?.goodWithKids ?? true,
        energyLevel: pet.compatibility?.energyLevel || "Moderate",
        isArchived: false,
        deletedAt: null,
      },
    });
  }
  console.log(`  ✓ ${petsData.length} shelter pets seeded.`);

  // 4. Seed Applications
  for (const app of applicationsData) {
    await prisma.adoptionApplication.upsert({
      where: { id: app.id },
      update: {
        petId: app.petId,
        petName: app.petName,
        petBreed: app.petBreed || null,
        applicantName: app.applicantName,
        email: app.email,
        phone: app.phone,
        address: app.address,
        housingType: app.housingType,
        hasFencedYard: app.hasFencedYard,
        currentPets: app.currentPets,
        currentPetDetails: app.currentPetDetails || null,
        householdExperience: app.householdExperience,
        applicantNotes: app.applicantNotes || null,
        status: app.status,
        adminReviewNotes: app.adminReviewNotes || null,
      },
      create: {
        id: app.id,
        petId: app.petId,
        petName: app.petName,
        petBreed: app.petBreed || null,
        applicantName: app.applicantName,
        email: app.email,
        phone: app.phone,
        address: app.address,
        housingType: app.housingType,
        hasFencedYard: app.hasFencedYard,
        currentPets: app.currentPets,
        currentPetDetails: app.currentPetDetails || null,
        householdExperience: app.householdExperience,
        applicantNotes: app.applicantNotes || null,
        status: app.status,
        adminReviewNotes: app.adminReviewNotes || null,
      },
    });
  }
  console.log(`  ✓ ${applicationsData.length} adoption applications seeded.`);

  // 5. Seed the public FAQ knowledge base.
  // Upserted by stable id so re-running the seed refreshes the launch copy
  // without duplicating entries or clobbering staff-authored FAQs.
  for (const faq of FAQ_SEED_CONTENT) {
    await prisma.faq.upsert({
      where: { id: faq.id },
      update: {
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
        questionMs: faq.questionMs,
        answerMs: faq.answerMs,
        displayOrder: faq.displayOrder,
      },
      create: {
        id: faq.id,
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
        questionMs: faq.questionMs,
        answerMs: faq.answerMs,
        displayOrder: faq.displayOrder,
        isPublished: true,
      },
    });
  }
  console.log(`  ✓ ${FAQ_SEED_CONTENT.length} FAQ entries seeded.`);

  // 6. Initial Audit Log
  await prisma.auditLog.create({
    data: {
      action: "DATABASE_SEEDED",
      actorId: "system",
      actorEmail: "system@hopeforstrays.org",
      actorRole: "SYSTEM",
      targetEntity: "System",
      details: "Initial database seed completed successfully.",
      metadata: {
        seededPets: petsData.length,
        seededApplications: applicationsData.length,
        seededStaff: staffUsers.length,
        seededFaqs: FAQ_SEED_CONTENT.length,
      },
    },
  });
  console.log("  ✓ Initial system audit log created.");

  await prisma.$disconnect();
  await pool.end();
  console.log("🎉 Database seeding completed successfully!");
}

main().catch((e) => {
  console.error("Seeding failed:", e);
  process.exit(1);
});
