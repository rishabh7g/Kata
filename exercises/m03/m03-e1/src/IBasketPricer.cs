namespace Kata.Exercise;

public interface IBasketPricer
{
    // Accumulates quantity * unitPrice per call; the same sku may
    // be added more than once. Negative unitPrice or quantity < 1:
    // ArgumentOutOfRangeException.
    void AddItem(string sku, decimal unitPrice, int quantity);

    // Subtotal minus the tier discount — 5% off subtotals of 100m
    // or more, 10% off 250m or more — rounded to 2 decimals away
    // from zero. Empty basket: 0m.
    decimal Total();
}
