# The pet profile's structured-data price deletes every non-digit from free text

**Status:** open · opened 2026-09-16 · latent — every fixture fee is "Free" · from the fifth review of PR #38

`src/app/pets/[id]/page.tsx` builds the JSON-LD `offers.price` as:

    price: pet.adoptionFee.toLowerCase().includes("free")
      ? "0"
      : (pet.adoptionFee.replace(/[^0-9]/g, "") || "0"),

`adoptionFee` is free text. Stripping everything that is not a digit fuses unrelated numbers:

    "RM 150.00"          → "15000"   (a hundred times the fee)
    "RM 150 (2 cats)"    → "1502"
    "RM 80–120"          → "80120"

Google's Product structured data would then advertise that figure on the profile's rich result.

**Latent, not live:** every animal in `src/data/pets.json` has `adoptionFee: "Free"`, so the
fixtures take the `"0"` branch. It starts misreporting the first time staff enter a priced fee with
a decimal point or a second number. Not fixed in PR #38 — pre-existing, unrelated to the catalogue,
and the right shape (a structured fee field, or a parser that takes the first amount) is a decision
about the pet form, not a one-line change.

**Settles when:** the price is read from a structured amount rather than scraped from prose, or a
parser takes exactly one amount with its decimals, with a test over the three inputs above.
