namespace Kata.Exercise;

public interface IRentalLedger
{
    void RecordCheckout(string rentalId, DateTime dueBackUtc);
    void RecordReturn(string rentalId, DateTime returnedAtUtc);

    // 0m when returned at or before the due moment; then 2.50m per
    // started 24h period late, capped at 50m. Throws for a rentalId
    // never checked out or not yet returned.
    decimal LateFeeFor(string rentalId);
}
