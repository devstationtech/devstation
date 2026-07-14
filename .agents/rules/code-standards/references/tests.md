# Tests

- **Coverage goal:** 100% on domain and application layers. Run with `deno task test:coverage`.
- **Every fix ships a regression test** in the existing pattern of the touched
  layer — a bug fix without a test that would have caught it is incomplete.
- **No mocks** in integration tests: use real adapters and a real temp directory via the `Persistence` helper.
- **Gherkin language:** annotations (`@Given`, `@When`, `@Then`) and prose both in **English**;
  always use business terms and never reference containers, adapters, or infrastructure.
- **Gherkin structure:** variables declared inside the `@Given` block; blank lines between phases;
  consecutive lines when no data needs to be declared.

## Single Pattern: `describe/it`

Use `describe/it/beforeAll/afterAll` from `@std/testing/bdd` in all unit and integration tests.
`Deno.test + t.step` is deprecated for this project. Do not write new tests in the old pattern.

```ts
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

describe("HelpBar", () => {
  it("should render the provided text", () => {
    /* @Given a HelpBar instance with text */
    const text = "quit";

    /* @When the frame is captured */
    const frame = text;

    /* @Then the text appears */
    assertEquals(frame.includes("quit"), true);
  });
});
```

## Test Doubles - Naming And Location

| Prefix | When to use | Example |
|---|---|---|
| `Stub<X>` | Canned/no-op; ignores input or returns fixed values | `StubLogger` |
| `Fake<X>` | In-memory functional implementation | `FakeSshCli` |
| `Test<X>` | Spy/recorder only | `TestEventBus` |

Locations:

- BC-specific double: `server/tests/<bc>/fixtures/<name>.ts`
- Cross-BC double: `server/tests/shared/fixtures/<name>.ts` (alias `@shared/`)
- Sample SUT classes inline in a test file are acceptable when they exist only for that test.

## UI Tests With `ink-testing-library`

- `import { render } from "ink-testing-library"`
- Always call `unmount()` at the end of each `it()`.
- Tests live in `tui/ink/tests/` or the existing UI test location for that slice.

See the `low-level-design` skill (`references/tests.md`) for implementation patterns.
