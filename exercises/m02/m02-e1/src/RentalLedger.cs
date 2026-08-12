namespace Kata.Exercise;

// The rental late-fee policy, backed by a simple append-only CSV file.
public class RentalLedger : IRentalLedger
{
    private readonly CsvFileStore _store;

    public RentalLedger()
        : this(Path.Combine(Path.GetTempPath(), "kata-rental-ledger-" + Guid.NewGuid().ToString("N") + ".csv"))
    {
    }

    public RentalLedger(string csvFilePath)
    {
        _store = new CsvFileStore(csvFilePath);
    }

    public void RecordCheckout(string rentalId, DateTime dueBackUtc)
    {
        _store.AppendLine("CHECKOUT," + rentalId + "," + dueBackUtc.Ticks);
    }

    public void RecordReturn(string rentalId, DateTime returnedAtUtc)
    {
        _store.AppendLine("RETURN," + rentalId + "," + returnedAtUtc.Ticks);
    }

    public decimal LateFeeFor(string rentalId)
    {
        string csvFilePath = _store.FilePath;

        string? checkoutCsvLine = FindLatestCsvLine(csvFilePath, "CHECKOUT", rentalId);
        if (checkoutCsvLine == null)
        {
            throw new InvalidOperationException(
                "Rental '" + rentalId + "' was never checked out: no CHECKOUT row in " + csvFilePath);
        }

        string? returnCsvLine = FindLatestCsvLine(csvFilePath, "RETURN", rentalId);
        if (returnCsvLine == null)
        {
            throw new InvalidOperationException(
                "Rental '" + rentalId + "' has not been returned yet: no RETURN row in " + csvFilePath);
        }

        return FeeFromCsvLines(checkoutCsvLine, returnCsvLine);
    }

    private static string? FindLatestCsvLine(string csvFilePath, string rowKind, string rentalId)
    {
        if (!File.Exists(csvFilePath))
        {
            return null;
        }

        string? latestCsvLine = null;
        foreach (string csvLine in File.ReadAllLines(csvFilePath))
        {
            string[] csvFields = csvLine.Split(',');
            if (csvFields.Length == 3 && csvFields[0] == rowKind && csvFields[1] == rentalId)
            {
                latestCsvLine = csvLine;
            }
        }

        return latestCsvLine;
    }

    private static decimal FeeFromCsvLines(string checkoutCsvLine, string returnCsvLine)
    {
        long dueBackTicks = long.Parse(checkoutCsvLine.Split(',')[2]);
        long returnedAtTicks = long.Parse(returnCsvLine.Split(',')[2]);

        if (returnedAtTicks <= dueBackTicks)
        {
            return 0m;
        }

        long lateTicks = returnedAtTicks - dueBackTicks;
        long periodTicks = TimeSpan.FromHours(24).Ticks;
        long startedPeriods = (lateTicks + periodTicks - 1) / periodTicks;

        decimal fee = 2.50m * startedPeriods;
        return fee > 50m ? 50m : fee;
    }
}
