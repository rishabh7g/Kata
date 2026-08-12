namespace Kata.Exercise;

// Construct stub: build the quoting policy here.
// The Test Suite hands every quoter its rates source through this
// constructor — the policy depends on the IExchangeRates abstraction
// and never reaches out to a concrete table, cache, or client itself.
public sealed class CurrencyQuoter : IPriceQuoter
{
    public CurrencyQuoter(IExchangeRates rates)
    {
        throw new NotImplementedException();
    }

    public decimal QuoteInBase(decimal amount, string currencyCode)
    {
        throw new NotImplementedException();
    }
}
