import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  ArrowRight, 
  FileText, 
  Users, 
  Home as HomeIcon, 
  CheckCircle2, 
  Phone,
  Loader2,
  HeartHandshake,
} from "lucide-react";
import { Hero } from "@/components/Hero";
import { PetGallery } from "@/components/PetGallery";
import { BulletinFeed } from "@/components/BulletinFeed";
import { buttonVariants } from "@/components/ui/button";
import { getPublicPets } from "@/actions/pets";

export default async function HomePage() {
  const initialPets = await getPublicPets();
  const steps = [
    {
      num: "01",
      title: "Browse & Apply",
      description:
        "Browse our adoptable animals online or visit our sanctuary in Petaling Jaya. Submit an adoption application online or directly at our front desk.",
      icon: FileText,
    },
    {
      num: "02",
      title: "Meet the Animal",
      description:
        "Spend time interacting in our outdoor compound or cat room. If you have resident pets, bring them along for a structured, supervised introduction.",
      icon: Users,
    },
    {
      num: "03",
      title: "Bring Them Home",
      description:
        "Complete adoption paperwork and receive full vaccination cards, registered microchip details, and starter care guidelines.",
      icon: HomeIcon,
    },
  ];

  const stories = [
    {
      quote:
        "We visited Hope for Strays in Petaling Jaya looking for a calm adult dog. Barnaby was resting quietly in his kennel, and as soon as we went to the play yard, we knew he was the right companion. The adoption process was thorough and smooth.",
      adopter: "Sarah & Mark T.",
      pet: "Adopted Barnaby (SS2, Petaling Jaya)",
      image: "https://images.unsplash.com/photo-1544568100-847a948585b9?auto=format&fit=crop&w=400&q=80",
    },
    {
      quote:
        "Milo was healthy, playful, and well-adjusted from the day we brought him home. The shelter team provided complete vaccination history and clear post-adoption tips.",
      adopter: "Elena R.",
      pet: "Adopted Milo (Damansara)",
      image: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&w=400&q=80",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Featured Pets Gallery */}
      <section className="bg-card py-12 sm:py-16">
        <div className="w-full px-6 sm:px-8 lg:px-12">
          <Suspense
            fallback={
              <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
                <Loader2 className="size-8 animate-spin mr-2" />
                <span>Loading featured animals...</span>
              </div>
            }
          >
            <PetGallery
              initialPets={initialPets}
              featuredOnly={true}
              title="Featured Animals"
              showFilters={false}
              syncUrl={false}
            />
          </Suspense>
          <div className="mt-8 text-center">
            <Link
              href="/pets"
              className={buttonVariants({
                size: "lg",
                className: "gap-2 px-8 text-sm font-semibold uppercase tracking-wider shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2",
              })}
            >
              See All Adoptable Pets
              <ArrowRight className="size-4.5 ml-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Shelter Notices & Video Updates (Admin Manageable) */}
      <section className="border-t border-border bg-muted/30 py-12 sm:py-16">
        <div className="w-full px-6 sm:px-8 lg:px-12">
          <BulletinFeed
            targetPage="home"
            title="Shelter Notices & Updates"
            compact={true}
            maxItems={2}
          />
          <div className="mt-8 text-center">
            <Link
              href="/bulletins"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "text-sm font-semibold gap-1.5 focus-visible:ring-2 px-6 py-2.5",
              })}
            >
              View All Bulletins & Video Updates
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Adoption Process */}
      <section id="how-it-works" className="border-t border-border bg-card py-14 sm:py-18">
        <div className="w-full px-6 sm:px-8 lg:px-12">
          <div className="max-w-2xl mb-8">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              How Adoption Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div
                  key={idx}
                  className="flex flex-col justify-between border border-border bg-background p-6 sm:p-7"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-heading text-3xl font-bold text-muted-foreground/60">
                        {step.num}
                      </span>
                      <div className="flex size-11 items-center justify-center bg-primary text-primary-foreground">
                        <Icon className="size-5" />
                      </div>
                    </div>
                    <h3 className="font-heading text-xl font-bold text-foreground mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Shelter Policies & Community Testimonials */}
      <section id="mission" className="border-t border-border bg-muted/30 py-14 sm:py-18">
        <div className="w-full px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
            <div className="space-y-4">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                What to Expect at Hope for Strays
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                We are a registered animal rescue sanctuary based in Petaling Jaya, Selangor. Our mission is to rescue, treat, rehabilitate, and rehome stray dogs and cats across the Klang Valley into caring permanent homes.
              </p>

              <div className="space-y-3.5 pt-2">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-emerald-800 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
                    <strong>Veterinary Care Included:</strong> All animals are spayed/neutered, microchipped, dewormed, and current on core vaccinations prior to adoption.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-emerald-800 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
                    <strong>Post-Adoption Advice:</strong> Our volunteer team and veterinarian advisors provide support and behavioral guidance during your pet&apos;s transition.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-emerald-800 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
                    <strong>Lifetime Shelter Safety Net:</strong> If an adoption cannot be continued for any unforeseen reason, we will always welcome the animal back into our care.
                  </p>
                </div>
              </div>
            </div>

            {/* Testimonials */}
            <div className="space-y-4">
              {stories.map((story, idx) => (
                <div key={idx} className="border border-border bg-background p-6 space-y-4">
                  <p className="text-sm sm:text-base italic text-foreground/90 leading-relaxed">
                    &ldquo;{story.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-3.5 pt-3 border-t border-border/60">
                    <div className="relative size-11 overflow-hidden rounded-full bg-muted border border-border">
                      <Image
                        src={story.image}
                        alt={story.adopter}
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{story.adopter}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">{story.pet}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Foster & Support Section */}
      <section id="support" className="border-t border-border bg-card py-14 sm:py-18">
        <div className="w-full px-6 sm:px-8 lg:px-12">
          <div className="border border-border bg-background p-6 sm:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-3.5">
                <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Foster, Volunteer, or Donate
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
                  We supply pet food, crates, and all veterinary expenses for our temporary foster homes in Petaling Jaya and Selangor. If you have room in your home, fostering helps us save more vulnerable strays.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link
                    href="/donate"
                    className={buttonVariants({
                      size: "sm",
                      className: "text-sm font-semibold uppercase tracking-wider focus-visible:ring-2 px-5 py-2.5 gap-1.5",
                    })}
                  >
                    <HeartHandshake className="size-4" />
                    Donate & Sponsor Care
                  </Link>

                  <Link
                    href="/pets"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "text-sm font-semibold uppercase tracking-wider focus-visible:ring-2 px-5 py-2.5",
                    })}
                  >
                    Browse Pets
                  </Link>

                  <a
                    href="tel:+60378765432"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "text-sm font-semibold uppercase tracking-wider focus-visible:ring-2 px-5 py-2.5",
                    })}
                  >
                    <Phone className="size-4 mr-1.5" />
                    Call Shelter: 03-7876 5432
                  </a>
                </div>
              </div>

              <div className="lg:col-span-4 bg-muted/40 border border-border p-5 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Current Shelter Needs
                </h3>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside leading-relaxed">
                  <li>Dry puppy & kitten kibbles (unopened)</li>
                  <li>Clean towels and fleece blankets</li>
                  <li>Kongs and durable chew toys</li>
                  <li>Standard 6ft nylon dog leashes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
