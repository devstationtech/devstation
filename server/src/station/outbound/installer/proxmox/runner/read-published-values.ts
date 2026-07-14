import type { Ssh } from "@server/blueprint/index.ts";
import type { Event } from "@server/blueprint/contracts/step/event/event.ts";
import type { Publish } from "@server/blueprint/domain/models/step/publish.ts";
import { readPublishedValue } from "@server/station/outbound/installer/proxmox/runner/read-published-value.ts";

/**
 * After a step's shell finishes, gathers every value declared under `publish`
 * and yields one `secret`/`fact` event per entry. Secret values trip an
 * additional remote read when sourced from `file:`; stdout-line values are
 * scanned in-memory. The `ssh` must be a quiet (sink-less) transport — see
 * `readPublishedValue`.
 */
export async function* readPublishedValues(
  { ssh, publish, stdout }: { ssh: Ssh; publish: Publish; stdout: string },
): AsyncGenerator<Event> {
  for (const [name, source] of Object.entries(publish.secrets)) {
    const value = await readPublishedValue({ ssh, source, stdout });
    yield { type: "secret", name, value };
  }
  for (const [name, source] of Object.entries(publish.facts)) {
    const value = await readPublishedValue({ ssh, source, stdout });
    yield { type: "fact", name, value };
  }
}
