namespace Kata.Exercise;

// Basket pricing pipeline. The step methods and fields below are public
// because PricingPipelineTests (retired) drove each stage in sequence and
// asserted on the intermediate state after every stage. Kept public so the
// pipeline stays testable — check the tests before hiding any of it.
public class BasketPricer : IBasketPricer
{
    // Exposed so tests could seed lines directly without going through AddItem.
    public List<BasketLine> Lines = new();

    // Intermediate pipeline state, published for stage-by-stage assertions.
    public decimal Subtotal;
    public decimal DiscountRate;
    public decimal DiscountAmount;
    public decimal DiscountedTotal;

    // Every stage appends here so tests could verify the pipeline ran in order.
    public List<string> DiscountAuditLog = new();

    public void AddItem(string sku, decimal unitPrice, int quantity)
    {
        if (unitPrice < 0m)
        {
            throw new ArgumentOutOfRangeException(
                nameof(unitPrice), unitPrice, "Unit price must not be negative.");
        }

        if (quantity < 1)
        {
            throw new ArgumentOutOfRangeException(
                nameof(quantity), quantity, "Quantity must be at least 1.");
        }

        Lines.Add(new BasketLine { Sku = sku, UnitPrice = unitPrice, Quantity = quantity });
    }

    // Stage 1: sum quantity * unit price across all lines.
    public void ComputeSubtotal()
    {
        Subtotal = 0m;
        foreach (var line in Lines)
        {
            Subtotal += line.UnitPrice * line.Quantity;
        }

        DiscountAuditLog.Add($"stage 1: subtotal = {Subtotal}");
    }

    // Stage 2: pick the discount tier from the subtotal.
    public void SelectDiscountTier()
    {
        if (Subtotal >= 250m)
        {
            DiscountRate = 0.10m;
        }
        else if (Subtotal >= 100m)
        {
            DiscountRate = 0.05m;
        }
        else
        {
            DiscountRate = 0m;
        }

        DiscountAuditLog.Add($"stage 2: tier = {DiscountRate}");
    }

    // Stage 3: apply the selected tier to the subtotal.
    public void ApplyDiscount()
    {
        DiscountAmount = Subtotal * DiscountRate;
        DiscountedTotal = Subtotal - DiscountAmount;
        DiscountAuditLog.Add($"stage 3: discount = {DiscountAmount}");
    }

    // Stage 4: round the discounted total for display.
    public void RoundTotal()
    {
        DiscountedTotal = Math.Round(DiscountedTotal, 2, MidpointRounding.AwayFromZero);
        DiscountAuditLog.Add($"stage 4: rounded total = {DiscountedTotal}");
    }

    public decimal Total()
    {
        ComputeSubtotal();
        SelectDiscountTier();
        ApplyDiscount();
        RoundTotal();
        return DiscountedTotal;
    }
}

// Public and mutable so tests could build baskets without going through AddItem.
public class BasketLine
{
    public string Sku = "";
    public decimal UnitPrice;
    public int Quantity;
}
