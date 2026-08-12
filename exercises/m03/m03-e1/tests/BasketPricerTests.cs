using System.Globalization;
using Xunit;
using Kata.Exercise;

namespace Kata.Exercise.Tests;

// Written against IBasketPricer alone: every test drives AddItem and Total
// and nothing else. If a behavior is not observable at the Target Interface,
// it is not tested here.
public class BasketPricerTests
{
    private static IBasketPricer NewPricer() => new BasketPricer();

    private static decimal Dec(string value) =>
        decimal.Parse(value, CultureInfo.InvariantCulture);

    [Fact]
    public void EmptyBasket_TotalIsZero()
    {
        var pricer = NewPricer();
        Assert.Equal(0m, pricer.Total());
    }

    [Fact]
    public void SingleLine_TotalIsQuantityTimesUnitPrice()
    {
        var pricer = NewPricer();
        pricer.AddItem("SKU-1", 3.50m, 2);
        Assert.Equal(7.00m, pricer.Total());
    }

    [Fact]
    public void SeparateAddItemCallsAccumulate()
    {
        var pricer = NewPricer();
        pricer.AddItem("SKU-1", 10.00m, 1);
        pricer.AddItem("SKU-2", 20.00m, 2);
        Assert.Equal(50.00m, pricer.Total());
    }

    [Fact]
    public void SameSkuAddedTwiceAccumulates()
    {
        var pricer = NewPricer();
        pricer.AddItem("SKU-1", 10.00m, 1);
        pricer.AddItem("SKU-1", 10.00m, 1);
        Assert.Equal(20.00m, pricer.Total());
    }

    [Theory]
    [InlineData("99.99", "99.99")]   // just under the 5% tier
    [InlineData("100.00", "95.00")]  // 5% starts at exactly 100
    [InlineData("249.99", "237.49")] // still 5% just under 250
    [InlineData("250.00", "225.00")] // 10% starts at exactly 250
    [InlineData("300.00", "270.00")] // comfortably in the 10% tier
    public void TierDiscountSwitchesAtSubtotalBoundaries(string unitPrice, string expectedTotal)
    {
        var pricer = NewPricer();
        pricer.AddItem("SKU-1", Dec(unitPrice), 1);
        Assert.Equal(Dec(expectedTotal), pricer.Total());
    }

    [Fact]
    public void TierComesFromTheAccumulatedSubtotal_NotFromAnySingleLine()
    {
        var pricer = NewPricer();
        pricer.AddItem("SKU-1", 60.00m, 1);
        pricer.AddItem("SKU-2", 60.00m, 1);
        // 120 crosses the 5% tier only when the lines are summed together.
        Assert.Equal(114.00m, pricer.Total());
    }

    [Fact]
    public void QuantityCountsTowardTheTier()
    {
        var pricer = NewPricer();
        pricer.AddItem("SKU-1", 50.00m, 5); // subtotal 250 => 10% tier
        Assert.Equal(225.00m, pricer.Total());
    }

    [Fact]
    public void MidpointsRoundAwayFromZero()
    {
        var pricer = NewPricer();
        pricer.AddItem("SKU-1", 100.30m, 1); // 100.30 * 0.95 = 95.285
        Assert.Equal(95.29m, pricer.Total());
    }

    [Fact]
    public void TotalIsRepeatable()
    {
        var pricer = NewPricer();
        pricer.AddItem("SKU-1", 100.00m, 2);
        Assert.Equal(190.00m, pricer.Total());
        Assert.Equal(190.00m, pricer.Total());
    }

    [Fact]
    public void ZeroUnitPriceIsAllowed()
    {
        var pricer = NewPricer();
        pricer.AddItem("FREEBIE", 0m, 3);
        pricer.AddItem("SKU-1", 10.00m, 1);
        Assert.Equal(10.00m, pricer.Total());
    }

    [Fact]
    public void NegativeUnitPrice_ThrowsArgumentOutOfRange()
    {
        var pricer = NewPricer();
        Assert.Throws<ArgumentOutOfRangeException>(
            () => pricer.AddItem("SKU-1", -0.01m, 1));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public void QuantityBelowOne_ThrowsArgumentOutOfRange(int quantity)
    {
        var pricer = NewPricer();
        Assert.Throws<ArgumentOutOfRangeException>(
            () => pricer.AddItem("SKU-1", 10.00m, quantity));
    }

    [Fact]
    public void RejectedAddItemLeavesTheTotalUnchanged()
    {
        var pricer = NewPricer();
        pricer.AddItem("SKU-1", 10.00m, 1);
        Assert.Throws<ArgumentOutOfRangeException>(
            () => pricer.AddItem("SKU-2", 10.00m, 0));
        Assert.Equal(10.00m, pricer.Total());
    }
}
