using Xunit;
using Kata.Exercise;

namespace Kata.Exercise.Tests;

public class RentalLedgerTests
{
    // A fixed due moment; every test derives its return moment from this.
    private static readonly DateTime DueBackUtc = new DateTime(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc);

    private static IRentalLedger CreateLedger() => new RentalLedger();

    [Fact]
    public void ReturnedBeforeTheDueMoment_ChargesNoFee()
    {
        IRentalLedger ledger = CreateLedger();
        ledger.RecordCheckout("r-1", DueBackUtc);
        ledger.RecordReturn("r-1", DueBackUtc.AddHours(-3));

        Assert.Equal(0m, ledger.LateFeeFor("r-1"));
    }

    [Fact]
    public void ReturnedExactlyAtTheDueMoment_ChargesNoFee()
    {
        IRentalLedger ledger = CreateLedger();
        ledger.RecordCheckout("r-1", DueBackUtc);
        ledger.RecordReturn("r-1", DueBackUtc);

        Assert.Equal(0m, ledger.LateFeeFor("r-1"));
    }

    [Theory]
    [InlineData(1, 2.50)]      // any lateness at all starts the first 24h period
    [InlineData(1440, 2.50)]   // exactly 24h late: still only the first started period
    [InlineData(1441, 5.00)]   // one minute into the second period
    [InlineData(2880, 5.00)]   // exactly 48h late
    [InlineData(2881, 7.50)]   // one minute into the third period
    [InlineData(14400, 25.00)] // 10 days late
    public void LateReturn_ChargesTwoFiftyPerStarted24HourPeriod(int minutesLate, double expectedFee)
    {
        IRentalLedger ledger = CreateLedger();
        ledger.RecordCheckout("r-1", DueBackUtc);
        ledger.RecordReturn("r-1", DueBackUtc.AddMinutes(minutesLate));

        Assert.Equal((decimal)expectedFee, ledger.LateFeeFor("r-1"));
    }

    [Theory]
    [InlineData(28800)]  // exactly 20 started periods: 20 * 2.50 reaches the cap
    [InlineData(28801)]  // one minute into the 21st period
    [InlineData(525600)] // a full year late
    public void LateFee_IsCappedAtFifty(int minutesLate)
    {
        IRentalLedger ledger = CreateLedger();
        ledger.RecordCheckout("r-1", DueBackUtc);
        ledger.RecordReturn("r-1", DueBackUtc.AddMinutes(minutesLate));

        Assert.Equal(50m, ledger.LateFeeFor("r-1"));
    }

    [Fact]
    public void LateFeeForARentalNeverCheckedOut_Throws()
    {
        IRentalLedger ledger = CreateLedger();

        Assert.ThrowsAny<Exception>(() => ledger.LateFeeFor("never-seen"));
    }

    [Fact]
    public void LateFeeForARentalNotYetReturned_Throws()
    {
        IRentalLedger ledger = CreateLedger();
        ledger.RecordCheckout("r-1", DueBackUtc);

        Assert.ThrowsAny<Exception>(() => ledger.LateFeeFor("r-1"));
    }

    [Fact]
    public void EachRentalIsChargedIndependently()
    {
        IRentalLedger ledger = CreateLedger();
        ledger.RecordCheckout("r-1", DueBackUtc);
        ledger.RecordCheckout("r-2", DueBackUtc);
        ledger.RecordReturn("r-1", DueBackUtc.AddMinutes(30));
        ledger.RecordReturn("r-2", DueBackUtc.AddDays(-1));

        Assert.Equal(2.50m, ledger.LateFeeFor("r-1"));
        Assert.Equal(0m, ledger.LateFeeFor("r-2"));
    }
}
