# "Make it dynamic" is not a licence to count a different population

**Learned:** 2026-09-08

The task said to replace the home page's five impact figures with "cached aggregation queries".
Every one of them was an organisation-lifetime claim, and the schema models none of them: TNRM
animals are returned to their colony and never become `Pet` rows, `Pet.spayedNeutered` is
`@default(true)` so counting it counts every row nobody has touched, `User` is staff-only and
cannot stand in for community volunteers, and there is no corporate-partner model at all. The
aggregate would have replaced "520+ neutered" with the size of a demo pet table — on the public
front page of a real charity, against a `DATABASE_URL` that
[[the dev database is production]] confirms is the production branch.

The instruction was not wrong about wanting staff-editable figures. It was wrong about where the
number lives. Reading it literally would have shipped a confident, well-tested, wrong number.

**Rule:** before replacing a curated figure with a query, name the rows the query counts and check
they are the same population as the claim. If the claim covers animals the system never stored, no
amount of caching makes the query correct — and the failure is invisible in dev, where the small
seeded number looks like a plausible small number.
