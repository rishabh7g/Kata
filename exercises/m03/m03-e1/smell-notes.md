## Where the Smell is planted

Everything lives in `src/BasketPricer.cs`. The pricer is behaviorally correct, but its surface was widened for a retired test suite:

- **Public step methods** — `ComputeSubtotal`, `SelectDiscountTier`, `ApplyDiscount`, `RoundTotal`: the pipeline stages the old tests called one at a time, in order.
- **Public mutable fields** — `Lines`, `Subtotal`, `DiscountRate`, `DiscountAmount`, `DiscountedTotal`: intermediate pipeline state published purely for stage-by-stage assertions. `BasketLine` is likewise a public mutable class so tests could build baskets without `AddItem`.
- **`DiscountAuditLog`** — a public log every stage appends to, existing only so tests could verify the stages ran in order. Nothing in the product reads it, and it grows on every `Total()` call.

Comments in the file claim the retired `PricingPipelineTests` depend on all of this — the classic reason a test-widened surface never gets shrunk. Renaming any stage would have broken those tests while every price stayed identical.

## What the Test Suite pins down

Only what `IBasketPricer` promises: accumulation across calls (repeated skus and quantity included), the 100m/250m tier boundaries applied to the *accumulated* subtotal, away-from-zero midpoint rounding (`100.30 → 95.285 → 95.29`, which a `ToEven` implementation fails), empty basket = `0m`, zero unit price allowed, a repeatable `Total()` (catches refactors that cache or mutate state destructively), and the `ArgumentOutOfRangeException` contract — including a rejected `AddItem` leaving the total unchanged. No test touches a step method, a field, or the audit log, so every hiding move keeps the suite green.

## What a good solution hides

The public surface shrinks to exactly `IBasketPricer`: the four stages collapse into private helpers or plain locals inside `Total()`, the five published fields become locals (only the line list survives as private state), `BasketLine` becomes a private or file-scoped detail, and `DiscountAuditLog` is deleted outright. The learner should be able to run `dotnet test` after every single hiding step and see it stay green — that feedback loop is the point of the exercise.
