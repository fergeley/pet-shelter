import { Suspense } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  FileText, 
  Users, 
  Home as HomeIcon, 
  Phone,
  Loader2,
  HeartHandshake,
  Clock,
  MapPin,
  MessageCircle,
  Calendar,
  Truck,
  Heart,
  ShieldCheck
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
      title: "Browse & Submit Application",
      description:
        "Browse our adoptable dogs and cats online or visit our Petaling Jaya sanctuary. Submit a straightforward application to register your household interest.",
      icon: FileText,
    },
    {
      num: "02",
      title: "Meet & Socialize",
      description:
        "Spend time interacting with the animal in our outdoor play yard or cat room. If you have resident pets, we arrange a structured, supervised introduction.",
      icon: Users,
    },
    {
      num: "03",
      title: "Finalize & Welcome Home",
      description:
        "Sign our standard adoption agreement with no hidden fees. All animals are already vaccinated, microchipped, and spayed or neutered.",
      icon: HomeIcon,
    },
  ];

  const shelterProtocols = [
    {
      title: "Complete Veterinary Protocol",
      description:
        "Every rescue animal undergoes full veterinary health screening, spay/neuter surgery, core vaccinations (6-in-1 / FVRCP), internal deworming, and microchip registration before rehoming.",
    },
    {
      title: "100% Free Adoption Policy",
      description:
        "We do not sell animals or charge commercial adoption fees. Rescues are placed into qualified homes purely based on lifestyle compatibility and animal welfare.",
    },
    {
      title: "Post-Adoption Guidance & Safety Net",
      description:
        "Our team provides ongoing behavioral transition guidance. If an adopter's life circumstances ever change, we maintain an unconditional open-door policy to welcome the animal back.",
    },
    {
      title: "Structured Premise & Lifestyle Review",
      description:
        "We verify basic living suitability (landed housing vs high-rise pet guidelines, fenced perimeter safety, and household consensus) to ensure a safe, lasting match.",
    },
  ];

  return (
    <div className="flex flex-col">
      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Urgent Notices & Announcements Newsfeed */}
      <section className="border-t border-border bg-background py-10 sm:py-14">
        <div className="w-full px-6 sm:px-8 lg:px-12">
          <BulletinFeed
            targetPage="home"
            title="Shelter Bulletins & Updates"
            maxItems={2}
          />
        </div>
      </section>

      {/* 3. Adoptable Pets Gallery Showcase */}
      <section id="adopt" className="border-t border-border bg-card py-14 sm:py-18">
        <div className="w-full px-6 sm:px-8 lg:px-12">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 mb-8">
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Animals Ready for Adoption
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Health-checked, vaccinated, microchipped, and sterilized before rehoming.
              </p>
            </div>
            <Link
              href="/pets"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "self-start sm:self-auto text-sm font-semibold uppercase tracking-wider focus-visible:ring-2",
              })}
            >
              View All Animals
              <ArrowRight className="size-4 ml-1.5" />
            </Link>
          </div>

          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="size-6 animate-spin mr-2" />
                <span>Loading adoptable animals...</span>
              </div>
            }
          >
            <PetGallery initialPets={initialPets} />
          </Suspense>
        </div>
      </section>

      {/* 4. Adoption Process Steps */}
      <section id="how-it-works" className="border-t border-border bg-background py-14 sm:py-18">
        <div className="w-full px-6 sm:px-8 lg:px-12">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Adoption Protocol
            </span>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
              How Adoption Works
            </h2>
            <p className="text-base text-muted-foreground mt-2 leading-relaxed">
              Our structured adoption process ensures responsible matching between animals and families across Selangor and the Klang Valley.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="border border-border bg-card p-6 sm:p-7 relative flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-2xl font-bold text-foreground">
                        {step.num}
                      </span>
                      <div className="flex size-10 items-center justify-center bg-muted text-foreground">
                        <Icon className="size-5" />
                      </div>
                    </div>
                    <h3 className="font-heading text-lg font-bold tracking-tight text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Shelter Standards & Veterinary Commitments (Editorial & Authentic) */}
      <section id="mission" className="border-t border-border bg-card py-14 sm:py-18">
        <div className="w-full px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary text-secondary-foreground text-xs font-semibold border border-border">
                <ShieldCheck className="size-3.5 text-foreground" />
                <span>Malaysian Registered Society: PPM-012-10-18042016</span>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Our Animal Welfare & Sanctuary Standards
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Operating in Petaling Jaya since 2016, Hope for Strays rescues, rehabilitates, and rehomes homeless dogs and cats. We maintain strict medical transparency and welfare standards for every intake.
              </p>
              <div className="pt-2">
                <Link
                  href="/donate"
                  className={buttonVariants({
                    size: "sm",
                    className: "text-xs font-semibold uppercase tracking-wider px-5 py-2.5",
                  })}
                >
                  Support Our Sanctuary
                </Link>
              </div>
            </div>

            {/* Protocol Grid */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {shelterProtocols.map((protocol, idx) => (
                <div key={idx} className="border border-border bg-background p-5 space-y-2">
                  <h3 className="font-heading text-base font-bold text-foreground">
                    {protocol.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {protocol.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Lean Volunteer, Foster & Community Support Section */}
      <section id="support" className="border-t border-border bg-background py-14 sm:py-18">
        <div className="w-full px-6 sm:px-8 lg:px-12">
          {/* Section Header */}
          <div className="max-w-3xl mb-8 space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Community Action
            </span>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Volunteer, Foster, or Sponsor Care
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              No prior shelter experience is required. We provide 100% of pet food, medical supplies, crates, and veterinary care for all temporary foster parents.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Volunteer & Foster Care Opportunities */}
            <div className="lg:col-span-7 space-y-6">
              <div className="border border-border bg-card p-6 sm:p-7 space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border">
                  <div className="flex size-8 items-center justify-center bg-foreground text-background">
                    <Users className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-bold text-foreground">
                      Active Volunteer & Foster Roles
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Flexible slots available weekly at our Petaling Jaya sanctuary.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-border bg-background p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Heart className="size-4 text-foreground shrink-0" />
                      <h4 className="text-sm font-bold text-foreground">Weekend Dog Walking</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Saturdays & Sundays, 10:00 AM – 12:00 PM. Exercise and socialize dogs in our outdoor yard.
                    </p>
                  </div>

                  <div className="border border-border bg-background p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-foreground shrink-0" />
                      <h4 className="text-sm font-bold text-foreground">Bath & Grooming Days</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Every 2nd & 4th Saturday. Medicated baths, brush-outs, and gentle care for recovering strays.
                    </p>
                  </div>

                  <div className="border border-border bg-background p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Truck className="size-4 text-foreground shrink-0" />
                      <h4 className="text-sm font-bold text-foreground">Clinic Transport</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Weekday transport for veterinary health checkups and spay/neuter clinic appointments.
                    </p>
                  </div>

                  <div className="border border-border bg-background p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <HomeIcon className="size-4 text-foreground shrink-0" />
                      <h4 className="text-sm font-bold text-foreground">Temporary Foster Homes</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Short-term care for nursing litters, kittens, or post-op recovery. All food and vet bills covered.
                    </p>
                  </div>
                </div>

                {/* Pre-filled Direct WhatsApp Action Buttons */}
                <div className="pt-2 border-t border-border flex flex-wrap gap-3">
                  <a
                    href="https://wa.me/60123456789?text=Hi%20Hope%20for%20Strays%2C%20I%20would%20like%20to%20volunteer%20for%20weekend%20dog%20walking%20and%20sanctuary%20care!"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({
                      size: "sm",
                      className: "text-xs sm:text-sm font-semibold uppercase tracking-wider focus-visible:ring-2 px-4 py-2.5 gap-2 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600",
                    })}
                  >
                    <MessageCircle className="size-4" />
                    WhatsApp Volunteer Coordinator
                  </a>

                  <a
                    href="https://wa.me/60123456789?text=Hi%20Hope%20for%20Strays%2C%20I%20am%20interested%20in%20becoming%20a%20temporary%20foster%20parent%20for%20a%20rescue%20pet!"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "text-xs sm:text-sm font-semibold uppercase tracking-wider focus-visible:ring-2 px-4 py-2.5 gap-2",
                    })}
                  >
                    <MessageCircle className="size-4" />
                    WhatsApp Foster Team
                  </a>

                  <Link
                    href="/donate"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "text-xs sm:text-sm font-semibold uppercase tracking-wider focus-visible:ring-2 px-4 py-2.5 gap-2",
                    })}
                  >
                    <HeartHandshake className="size-4" />
                    Donate & Sponsor Care
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Column: Walk-in Sanctuary Hours & Physical Drop-off */}
            <div className="lg:col-span-5 space-y-6">
              {/* Visiting Hours Card */}
              <div className="border border-border bg-card p-6 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Clock className="size-4 text-foreground" />
                  <h3 className="font-heading text-base font-bold text-foreground uppercase tracking-wider">
                    Walk-in Sanctuary Visiting Hours
                  </h3>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-1 border-b border-border/40">
                    <span className="font-semibold text-foreground">Tuesday – Sunday</span>
                    <span className="font-mono font-medium text-foreground">10:00 AM – 5:00 PM</span>
                  </div>
                  <div className="flex justify-between items-center py-1 text-muted-foreground">
                    <span className="font-medium">Mondays</span>
                    <span className="text-xs italic">Closed (Sanctuary Cleaning & Vet Rounds)</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
                  <MapPin className="size-4 text-foreground shrink-0 mt-0.5" />
                  <span>No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia</span>
                </div>

                <div className="pt-2">
                  <a
                    href="tel:+60378765432"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "w-full text-xs font-semibold uppercase tracking-wider gap-1.5",
                    })}
                  >
                    <Phone className="size-3.5" />
                    Call Sanctuary: 03-7876 5432
                  </a>
                </div>
              </div>

              {/* In-Kind Shelter Wishlist */}
              <div className="border border-border bg-muted/30 p-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  In-Kind Donation Drop-offs
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside leading-relaxed">
                  <li>Dry puppy & kitten kibble (unopened bags)</li>
                  <li>Clean towels, fleece blankets & pee pads</li>
                  <li>Kongs, durable chew toys & stainless steel bowls</li>
                  <li>Standard 6ft nylon leashes & martingale collars</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
