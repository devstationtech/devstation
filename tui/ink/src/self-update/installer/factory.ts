/**
 * The single composition point that picks the per-OS swap strategy.
 * Everything else in self-update is OS-agnostic.
 */
import { BinaryInstaller } from "@ui/self-update/installer/installer.ts";
import { PosixSwapStrategy } from "@ui/self-update/installer/posix-installer.ts";
import { WindowsSwapStrategy } from "@ui/self-update/installer/windows-installer.ts";
import { denoRuntime, type OsKind } from "@ui/shared/platform/mod.ts";

export function createInstaller(os: OsKind = denoRuntime.env.os): BinaryInstaller {
  if (os === "windows") {
    return new BinaryInstaller(new WindowsSwapStrategy(), "devstation.exe");
  }
  return new BinaryInstaller(new PosixSwapStrategy(), "devstation");
}
