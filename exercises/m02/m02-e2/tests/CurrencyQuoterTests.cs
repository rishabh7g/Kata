using Kata.Exercise;
using Xunit;

namespace Kata.Exercise.Tests;

// Written against IPriceQuoter and IExchangeRates alone. Every quoter
// under test is handed a test-owned IExchangeRates: the policy must
// work with whichever rates source it receives.
public class CurrencyQuoterTests
{
    private sealed class FixedRates : IExchangeRates
    {
        private readonly Dictionary<string, decimal> _unitsPerBase;

        public FixedRates(Dictionary<string, decimal> unitsPerBase) =>
            _unitsPerBase = unitsPerBase;

        // Dictionary's indexer throws KeyNotFoundException for a code
        // it does not know, exactly as the Target Interface requires.
        public decimal UnitsPerBase(string currencyCode) =>
            _unitsPerBase[currencyCode];
    }

    private sealed class RecordingRates : IExchangeRates
    {
        public List<string> RequestedCodes { get; } = new();

        public decimal UnitsPerBase(string currencyCode)
        {
            RequestedCodes.Add(currencyCode);
            return 1m;
        }
    }

    private static IPriceQuoter QuoterOver(Dictionary<string, decimal> unitsPerBase) =>
        new CurrencyQuoter(new FixedRates(unitsPerBase));

    public static TheoryData<decimal, decimal, decimal> Quotes => new()
    {
        { 10m, 1.5m, 15.00m },
        { 1m, 2.345m, 2.35m },   // midpoint rounds away from zero, not to-even (2.34)
        { 3m, 0.335m, 1.01m },   // 1.005 rounds away from zero, not banker's 1.00
        { 0m, 9.99m, 0.00m },
        { 100m, 0.001m, 0.10m },
    };

    [Theory]
    [MemberData(nameof(Quotes))]
    public void Quote_is_amount_times_rate_rounded_to_two_decimals_away_from_zero(
        decimal amount, decimal rate, decimal expected)
    {
        var quoter = QuoterOver(new() { ["EUR"] = rate });

        Assert.Equal(expected, quoter.QuoteInBase(amount, "EUR"));
    }

    [Fact]
    public void Uses_whichever_rates_source_it_was_constructed_with()
    {
        var low = QuoterOver(new() { ["USD"] = 0.90m });
        var high = QuoterOver(new() { ["USD"] = 1.10m });

        Assert.Equal(9.00m, low.QuoteInBase(10m, "USD"));
        Assert.Equal(11.00m, high.QuoteInBase(10m, "USD"));
    }

    [Fact]
    public void Asks_the_rates_source_for_the_exact_code_it_was_given()
    {
        var rates = new RecordingRates();
        var quoter = new CurrencyQuoter(rates);

        quoter.QuoteInBase(5m, "sek");

        Assert.Contains("sek", rates.RequestedCodes);
    }

    public static TheoryData<decimal> NegativeAmounts => new() { -0.01m, -100m };

    [Theory]
    [MemberData(nameof(NegativeAmounts))]
    public void Negative_amount_is_rejected(decimal amount)
    {
        var quoter = QuoterOver(new() { ["EUR"] = 1m });

        Assert.Throws<ArgumentOutOfRangeException>(
            () => quoter.QuoteInBase(amount, "EUR"));
    }

    [Fact]
    public void Unknown_code_surfaces_the_rates_sources_KeyNotFoundException()
    {
        var quoter = QuoterOver(new());

        Assert.Throws<KeyNotFoundException>(() => quoter.QuoteInBase(1m, "XXX"));
    }
}
