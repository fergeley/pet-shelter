import Link from "next/link";
import Image from "next/image";
import { Heart, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="border-b border-border bg-muted/20">
      <div className="w-full px-6 py-14 sm:px-8 sm:py-18 lg:px-12 lg:py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          
          {/* Left Text Content */}
          <div className="space-y-6 lg:col-span-7">
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.15]">
              Adopt a dog or cat from your local shelter.
            </h1>

            <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
              We take in strays, owner surrenders, and transfers from overcrowded shelters across the county. Every animal receives a thorough veterinary examination, vaccinations, and spay/neuter surgery before going to their new home.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <Link
                href="/pets"
                className={buttonVariants({
                  size: "lg",
                  className: "gap-2 px-7 text-sm font-semibold tracking-wide shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2",
                })}
              >
                <Heart className="size-4 fill-current" />
                Browse Adoptable Pets
                <ArrowRight className="size-4 ml-0.5" />
              </Link>

              <Link
                href="/#support"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "gap-2 px-7 text-sm font-semibold tracking-wide focus-visible:ring-2 focus-visible:ring-offset-2",
                })}
              >
                Foster or Donate
              </Link>
            </div>

            <div className="border-t border-border pt-4 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Visiting Hours: </span>
              Tuesday through Sunday, 11:00 AM – 5:00 PM. Walk-ins welcome.
            </div>
          </div>

          {/* Right Image */}
          <div className="lg:col-span-5">
            <div className="relative aspect-4/3 w-full overflow-hidden border border-border bg-muted shadow-sm">
              <Image
                src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1000&q=80"
                alt="Two rescued shelter dogs playing together outdoors in the exercise yard"
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
