import { NextResponse } from "next/server";
import {
  getGatedPetGallery,
  getGatedPetVideoDiary,
} from "@/lib/domain/sponsorAccess";

/**
 * Per-sponsor exclusive media for one pet.
 *
 * This exists as a Route Handler rather than as part of the pet profile page for one
 * structural reason: `src/app/pets/[id]/page.tsx` declares `generateStaticParams`, so
 * every pet profile is prerendered. Reading `cookies()` anywhere in that render tree
 * would force all of them to become per-request renders and throw away the static
 * profile pages for the sake of one gated panel.
 *
 * Keeping the gate here means the locked media never enters the page's HTML or RSC
 * payload at all — the page ships without it, and the panel asks for it afterwards.
 *
 * Route Handlers are uncached by default, and this one reads cookies via
 * `getGatedPet*`, so it always runs at request time.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ petId: string }> }
) {
  const { petId } = await context.params;

  // Both readers resolve the sponsor's standing before touching the media catalogue,
  // and their locked branch carries no `items` field to serialize.
  const [gallery, videoDiary] = await Promise.all([
    getGatedPetGallery(petId),
    getGatedPetVideoDiary(petId),
  ]);

  return NextResponse.json(
    { gallery, videoDiary },
    {
      headers: {
        // Per-sponsor content: never store it in a shared or browser cache.
        "Cache-Control": "private, no-store",
      },
    }
  );
}
