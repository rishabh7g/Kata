## Smell: the naive arrow (Dependency Direction, construct)

**Where the temptation lives.** The stub is one empty `CurrencyQuoter`. The naive move when implementing `QuoteInBase` is to reach out to a concrete rates source from inside the calculation — a hard-coded `Dictionary<string, decimal>`, a static cache, or an HTTP client. That points the arrow from policy to volatile detail. The correct arrow: the policy owns the `IExchangeRates` abstraction and receives the concrete source through its constructor (the stub already declares that constructor so the Test Suite compiles from day one).

**What the Test Suite pins down.**
- `Uses_whichever_rates_source_it_was_constructed_with` builds two quoters over two fakes with *different* rates for the same code and expects different quotes — any built-in table or static cache fails one of them. This is the test that makes the wrong arrow impossible.
- `Asks_the_rates_source_for_the_exact_code_it_was_given` (recording fake) pins that the code is passed through unaltered — no normalizing, no bypassing the source.
- `Unknown_code_surfaces_the_rates_sources_KeyNotFoundException` kills fallback/default-rate tables for codes the source doesn't know.
- The rounding Theory includes true midpoints (`2.345 → 2.35`, `1.005 → 1.01`) chosen to fail `Math.Round`'s default banker's rounding — only `MidpointRounding.AwayFromZero` passes.
- Negative amounts must throw `ArgumentOutOfRangeException`; zero is allowed (`0 → 0.00`).

**What a good solution hides.** Everything except the abstraction: a stored `IExchangeRates` field, a guard clause, one multiplication, and `Math.Round(value, 2, MidpointRounding.AwayFromZero)`. The quoter knows nothing about where rates come from — swapping the fake for a real feed is a construction-site change only. Roughly 15 lines; well inside the 200-line budget.
