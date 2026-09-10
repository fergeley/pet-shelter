# A fan-out without a bound manufactures its own failures

**Learned:** 2026-09-04

Mailing a list with `Promise.allSettled` over the whole audience starts every request
at once. Against a rate-limited provider that earns 429s, which arrive as delivery
failures indistinguishable from bad addresses — so the code invents errors and then
reports them as the provider's. A bounded worker pool fixes it; the sends are off the
request path and have no reason to be simultaneous.

The deadline is real, though, and is the reason not to simply lower the bound: `after()`
work runs inside the route's `maxDuration`, so a full recipient list at low concurrency
can be killed mid-send. The audit row is written *before* the fan-out for that reason —
otherwise a killed invocation leaves no evidence the mailing happened at all.

**Rule:** any loop that talks to a rate-limited service needs a concurrency bound and a
deadline that has been multiplied out, not assumed.
