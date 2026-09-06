"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PILLARS, getQuickActions, getShelterProtocols } from "@/components/layout/HomeSections";
import { PUBLIC_ROS_REGISTRATION_NO } from "@/lib/domain/shelterIdentity";

/**
 * Alternative layouts for the home page's content sections, rendered side by side at
 * `/preview`. Each trio reads the same exported copy the live sections do, so what is
 * under comparison is composition alone. Delete with the preview route once chosen.
 */

const SHELL = "bg-work-ground py-16 sm:py-20";
const WRAP = "mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-12";

function Header({ title, body }: { title: string; body?: string }) {
  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {body && <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{body}</p>}
    </div>
  );
}

/* ==================================================== Our Work ==================== */

const WORK_TITLE = (isMs: boolean) => (isMs ? "Kerja Kami" : "Our Work");
const WORK_BODY = (isMs: boolean) =>
  isMs
    ? "Kerja kami berteraskan rawatan berperikemanusiaan, pendidikan, dan kewujudan bersama antara haiwan dan komuniti."
    : "Our work focuses on humane care, education and coexistence between animals and communities.";

/** A — image-topped cards, three across. The incumbent. */
export function WorkA() {
  const { isMs } = useLanguage();
  return (
    <section className={SHELL}>
      <div className={`${WRAP} space-y-12`}>
        <Header title={WORK_TITLE(isMs)} body={WORK_BODY(isMs)} />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-3xl border border-border bg-work-panel shadow-xs">
              <div className="relative aspect-4/3 w-full bg-work-ground">
                <Image src={p.image} alt={isMs ? p.altMs : p.altEn} fill className="object-cover" sizes="(max-width:768px) 100vw, 33vw" />
              </div>
              <div className="flex flex-1 flex-col gap-4 p-6 sm:p-7">
                <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                  {isMs ? p.categoryMs : p.categoryEn}
                </p>
                <h3 className="font-heading text-xl font-bold text-foreground">{isMs ? p.titleMs : p.titleEn}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{isMs ? p.descMs : p.descEn}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * B — editorial rows, image and text alternating sides.
 *
 * Each pillar gets a full row rather than a third of one, so the highlights can come back
 * without crushing the description. Three chapters instead of three tiles.
 */
export function WorkB() {
  const { isMs } = useLanguage();
  return (
    <section className={SHELL}>
      <div className={`${WRAP} space-y-14`}>
        <Header title={WORK_TITLE(isMs)} body={WORK_BODY(isMs)} />
        <div className="space-y-14">
          {PILLARS.map((p, i) => (
            <div key={i} className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div className={`relative aspect-16/10 overflow-hidden rounded-3xl border border-border bg-work-panel ${i % 2 ? "lg:order-2" : ""}`}>
                <Image src={p.image} alt={isMs ? p.altMs : p.altEn} fill className="object-cover" sizes="(max-width:1024px) 100vw, 50vw" />
              </div>
              <div className="space-y-4">
                <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                  {isMs ? p.categoryMs : p.categoryEn}
                </p>
                <h3 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {isMs ? p.titleMs : p.titleEn}
                </h3>
                <p className="text-base leading-relaxed text-muted-foreground">{isMs ? p.descMs : p.descEn}</p>
                <div className="space-y-2 pt-1">
                  {(isMs ? p.highlightsMs : p.highlightsEn).map((h) => (
                    <div key={h} className="flex items-start gap-2 text-sm font-medium text-foreground/90">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * C — typographic index, no imagery.
 *
 * The pillar names carry the section at display size and the description sits beside them.
 * Quiet and fast to scan; also the only one of the three that survives without photography.
 */
export function WorkC() {
  const { isMs } = useLanguage();
  return (
    <section className={SHELL}>
      <div className={`${WRAP} space-y-12`}>
        <Header title={WORK_TITLE(isMs)} body={WORK_BODY(isMs)} />
        <div>
          {PILLARS.map((p, i) => (
            <div key={i} className="grid grid-cols-1 gap-4 border-t border-border py-8 lg:grid-cols-12 lg:gap-10">
              <div className="lg:col-span-5">
                <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                  {isMs ? p.categoryMs : p.categoryEn}
                </p>
                <h3 className="mt-2 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {isMs ? p.titleMs : p.titleEn}
                </h3>
              </div>
              <div className="space-y-3 lg:col-span-7">
                <p className="text-base leading-relaxed text-muted-foreground">{isMs ? p.descMs : p.descEn}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(isMs ? p.highlightsMs : p.highlightsEn).map((h) => (
                    <div key={h} className="flex items-start gap-2 text-sm text-foreground/90">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ==================================================== Join us ===================== */

const JOIN_TITLE = (isMs: boolean) => (isMs ? "Sertai kami membawa perubahan" : "Join us in making a difference");
const JOIN_BODY = (isMs: boolean) =>
  isMs
    ? "Sama ada anda mengadopsi, menjadi sukarelawan, menderma atau menaja, setiap tindakan membantu mencipta kehidupan yang lebih baik."
    : "Whether you adopt, volunteer, donate or sponsor, every action helps create better lives.";

/** A — four image cards across. The incumbent. */
export function JoinA() {
  const { isMs } = useLanguage();
  const actions = getQuickActions(isMs);
  return (
    <section className={SHELL}>
      <div className={`${WRAP} space-y-12`}>
        <Header title={JOIN_TITLE(isMs)} body={JOIN_BODY(isMs)} />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-work-panel shadow-xs transition-colors hover:border-primary/40">
              <div className="relative aspect-16/9 w-full bg-work-ground">
                <Image src={a.image} alt={a.alt} fill className="object-cover" sizes="(max-width:640px) 100vw, 25vw" />
              </div>
              <div className="flex flex-1 flex-col gap-3 p-6 sm:p-7">
                <h3 className="font-heading text-xl font-bold text-foreground">{a.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{a.description}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-xs font-bold uppercase tracking-wider text-primary">
                  {a.cta}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * B — quiet list rows, no imagery.
 *
 * Four photographs of stock animals compete with the four decisions being offered. Stripped
 * to rows, the section reads as a menu of actions, which is what it is.
 */
export function JoinB() {
  const { isMs } = useLanguage();
  const actions = getQuickActions(isMs);
  return (
    <section className={SHELL}>
      <div className={`${WRAP} space-y-10`}>
        <Header title={JOIN_TITLE(isMs)} body={JOIN_BODY(isMs)} />
        <div className="grid grid-cols-1 gap-x-14 sm:grid-cols-2">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="group flex items-start gap-5 border-t border-border py-6 transition-colors hover:border-primary">
              <span className="font-heading text-2xl font-bold text-primary">{a.title}</span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm leading-relaxed text-muted-foreground">{a.description}</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                  {a.cta}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * C — asymmetric emphasis.
 *
 * Adopt and Donate are the two decisions that actually change an animal's week, so they get
 * the large frames; Volunteer and Sponsor stay available without pretending to equal weight.
 */
export function JoinC() {
  const { isMs } = useLanguage();
  const actions = getQuickActions(isMs);
  const [lead, second, third, fourth] = actions;
  const big = [lead, third].filter(Boolean);
  const small = [second, fourth].filter(Boolean);
  return (
    <section className={SHELL}>
      <div className={`${WRAP} space-y-12`}>
        <Header title={JOIN_TITLE(isMs)} body={JOIN_BODY(isMs)} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {big.map((a) => (
            <Link key={a.href} href={a.href} className="group relative flex min-h-80 flex-col justify-end overflow-hidden rounded-3xl border border-border shadow-xs">
              <Image src={a.image} alt={a.alt} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width:1024px) 100vw, 33vw" />
              <div className="absolute inset-0 bg-black/60" />
              <div className="relative space-y-2 p-6 sm:p-7">
                <h3 className="font-heading text-2xl font-bold text-white">{a.title}</h3>
                <p className="text-sm leading-relaxed text-white/90">{a.description}</p>
                <span className="inline-flex items-center gap-1.5 pt-1 text-xs font-bold uppercase tracking-wider text-white">
                  {a.cta}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
          <div className="flex flex-col gap-6">
            {small.map((a) => (
              <Link key={a.href} href={a.href} className="group flex flex-1 flex-col justify-between gap-3 rounded-3xl border border-border bg-work-panel p-6 shadow-xs transition-colors hover:border-primary/40">
                <div className="space-y-2">
                  <h3 className="font-heading text-xl font-bold text-foreground">{a.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{a.description}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                  {a.cta}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==================================================== Standards =================== */

const STD_TITLE = (isMs: boolean) =>
  isMs ? "Piawaian Kebajikan & Santuari Haiwan" : "Our Animal Welfare & Sanctuary Standards";
const STD_BODY = (isMs: boolean) =>
  isMs
    ? "Beroperasi di Petaling Jaya dan kampus Universiti Malaya sejak 2016, Hope for Strays menyelamat, memulihkan, dan mencari keluarga baru untuk anjing dan kucing terbiar dengan ketelusan klinikal penuh."
    : "Operating across Petaling Jaya and Universiti Malaya campus since 2016, Hope for Strays rescues, rehabilitates, and rehomes homeless dogs and cats with complete clinical transparency.";

function RosBadge({ isMs }: { isMs: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-work-panel px-3 py-1 text-xs font-semibold text-secondary-foreground">
      <ShieldCheck className="size-3.5 text-foreground" />
      <span>{(isMs ? "Persatuan Berdaftar ROS Malaysia: " : "Malaysian Registered Society: ") + PUBLIC_ROS_REGISTRATION_NO}</span>
    </div>
  );
}

/** A — copy left, protocol cards right. The incumbent. */
export function StandardsA() {
  const { isMs } = useLanguage();
  const protocols = getShelterProtocols(isMs);
  return (
    <section className={SHELL}>
      <div className={WRAP}>
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="space-y-4 lg:col-span-5">
            <RosBadge isMs={isMs} />
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{STD_TITLE(isMs)}</h2>
            <p className="text-base leading-relaxed text-muted-foreground">{STD_BODY(isMs)}</p>
            <div className="pt-2">
              <Link href="/donate" className={buttonVariants({ size: "sm", className: "rounded-xl px-5 py-2.5 text-xs font-semibold uppercase tracking-wider" })}>
                {isMs ? "Sokong Santuari Kami" : "Support Our Sanctuary"}
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-7">
            {protocols.map((p, i) => (
              <div key={i} className="space-y-2 rounded-2xl border border-border bg-work-panel p-5 shadow-xs">
                <h3 className="font-heading text-base font-bold text-foreground">{p.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * B — centred statement, protocols as a four-up row beneath.
 *
 * Closes the page on the credential rather than tucking it into a column, and gives all four
 * protocols equal billing instead of two-by-two.
 */
export function StandardsB() {
  const { isMs } = useLanguage();
  const protocols = getShelterProtocols(isMs);
  return (
    <section className={SHELL}>
      <div className={`${WRAP} space-y-12`}>
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <div className="flex justify-center"><RosBadge isMs={isMs} /></div>
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{STD_TITLE(isMs)}</h2>
          <p className="text-base leading-relaxed text-muted-foreground">{STD_BODY(isMs)}</p>
          <div className="pt-2">
            <Link href="/donate" className={buttonVariants({ size: "lg", className: "rounded-xl px-6 text-sm font-bold uppercase tracking-wider" })}>
              {isMs ? "Sokong Santuari Kami" : "Support Our Sanctuary"}
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {protocols.map((p, i) => (
            <div key={i} className="space-y-2 rounded-2xl border border-border bg-work-panel p-5 shadow-xs">
              <h3 className="font-heading text-base font-bold text-foreground">{p.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * C — protocols as a rules-separated definition list.
 *
 * No cards. A compliance statement reads more credibly as a document than as four tiles, and
 * the rules let each protocol run to whatever length it actually needs.
 */
export function StandardsC() {
  const { isMs } = useLanguage();
  const protocols = getShelterProtocols(isMs);
  return (
    <section className={SHELL}>
      <div className={WRAP}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="space-y-4 lg:col-span-4">
            <RosBadge isMs={isMs} />
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{STD_TITLE(isMs)}</h2>
            <p className="text-base leading-relaxed text-muted-foreground">{STD_BODY(isMs)}</p>
            <div className="pt-2">
              <Link href="/donate" className={buttonVariants({ size: "sm", className: "rounded-xl px-5 py-2.5 text-xs font-semibold uppercase tracking-wider" })}>
                {isMs ? "Sokong Santuari Kami" : "Support Our Sanctuary"}
              </Link>
            </div>
          </div>
          <dl className="lg:col-span-8">
            {protocols.map((p, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 border-t border-border py-6 sm:grid-cols-3 sm:gap-8">
                <dt className="font-heading text-base font-bold text-foreground">{p.title}</dt>
                <dd className="text-sm leading-relaxed text-muted-foreground sm:col-span-2">{p.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
