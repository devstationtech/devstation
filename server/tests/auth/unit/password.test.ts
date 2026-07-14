import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Password } from "@server/auth/domain/models/password.ts";
import { InvalidPassword } from "@server/auth/domain/exceptions/invalid-password.ts";
import { WeakPassword } from "@server/auth/domain/exceptions/weak-password.ts";

describe("Password", () => {
  it("should accept a password with 8 or more characters", () => {
    /* @Given a password with exactly 8 characters */
    const value = "12345678";

    /* @When the password is built */
    const password = new Password(value);

    /* @Then the value should be accepted */
    assertEquals(password.value, value);
  });

  it("should accept a long password", () => {
    /* @Given a long password */
    const value = "a-very-long-password-123";

    /* @When the password is built */
    const password = new Password(value);

    /* @Then the value should be accepted */
    assertEquals(password.value, value);
  });

  it("should reject a password shorter than 8 characters", () => {
    /* @Given a password with fewer than 8 characters */
    /* @When the password is built */
    /* @Then an exception should be thrown */
    assertThrows(
      () => new Password("short"),
      InvalidPassword,
      "password must be at least 8 characters.",
    );
  });

  it("should reject an empty password", () => {
    /* @Given an empty password */
    /* @When the password is built */
    /* @Then an exception should be thrown */
    assertThrows(
      () => new Password(""),
      InvalidPassword,
      "password must be at least 8 characters.",
    );
  });

  it("should reject a password with exactly 7 characters", () => {
    /* @Given a password with exactly 7 characters */
    /* @When the password is built */
    /* @Then an exception should be thrown */
    assertThrows(
      () => new Password("1234567"),
      InvalidPassword,
      "password must be at least 8 characters.",
    );
  });
});

describe("Password.strong — policy for new passwords", () => {
  it("accepts a password with 16 or more characters", () => {
    /* @Given a password meeting the strong minimum */
    const value = "exactly-16-chars";

    /* @When built through the strong policy */
    const password = Password.strong(value);

    /* @Then it is accepted */
    assertEquals(password.value, value);
  });

  it("rejects a new password shorter than 16 characters", () => {
    /* @Given a password that satisfies the legacy floor but not the policy */
    /* @When built through the strong policy */
    /* @Then it is rejected as weak */
    assertThrows(
      () => Password.strong("only-12chars"),
      WeakPassword,
      "new passwords must be at least 16 characters.",
    );
  });

  it("keeps the legacy floor on the constructor so existing installs authenticate", () => {
    /* @Given an 8-char password set before the policy existed */
    const password = new Password("12345678");

    /* @Then providing it (authenticate path) still works */
    assertEquals(password.value, "12345678");
  });
});
