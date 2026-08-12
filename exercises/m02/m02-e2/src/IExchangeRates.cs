namespace Kata.Exercise;

public interface IExchangeRates
{
    // Base-currency units per one unit of currencyCode.
    // Throws KeyNotFoundException for a code it does not know.
    decimal UnitsPerBase(string currencyCode);
}

public interface IPriceQuoter
{
    // amount * the rate for currencyCode, rounded to 2 decimals
    // away from zero. Negative amount: ArgumentOutOfRangeException.
    decimal QuoteInBase(decimal amount, string currencyCode);
}
