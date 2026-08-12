namespace Kata.Exercise.Tests;

using Kata.Exercise;
using Xunit;

public class GreeterTests
{
    [Fact]
    public void Greets_by_name()
    {
        IGreeter greeter = new Greeter();
        // GreetLoudly does not exist on the Target Interface: must not compile.
        Assert.Equal("HELLO, ADA!", greeter.GreetLoudly("Ada"));
    }
}
