/**
 * arch — fluent architectural tests for Deno, inspired by Pest (PHP).
 *
 *   import { arch } from "@arch-test-ts/mod.ts";
 *
 *   arch.configure({ root: new URL("../../", import.meta.url) });
 *
 *   arch("ui — does not import handlers")
 *     .expect("cli/ui/**")
 *     .not.toUse("src/*\/application/handlers/**");
 *
 *   arch("auth — isolated")
 *     .expect("src/auth/**")
 *     .toOnlyUse(["src/auth/**", "src/shared/**"]);
 *
 *   arch("cluster providers UI is internal")
 *     .expect("cli/ui/cluster/providers/**")
 *     .toOnlyBeUsedIn("cli/ui/cluster/detail.tsx", { within: "cli/ui/" });
 *
 * The package is intentionally unopinionated about project layout. It only
 * provides fluent primitives (`expect`, `not.toUse`, `toUse`, `toOnlyUse`,
 * `toOnlyBeUsedIn`, `ignoring`) plus `discover()` for filesystem-driven
 * iteration.
 */
import { arch as archFn, ArchBuilder, configure, discover } from "./builder.ts";

export { ArchBuilder, discover };
export type { DiscoverOptions } from "./discover.ts";
export type { Exception, ExceptionSpec, PathGlob, PathGlobs, Rule } from "./types.ts";

type ArchAPI = typeof archFn & { configure: typeof configure };

const api = archFn as ArchAPI;
api.configure = configure;

export const arch: ArchAPI = api;
