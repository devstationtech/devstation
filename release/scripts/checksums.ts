import { DenoReleaseAdapter } from "./deno-adapter.ts";

const adapter = new DenoReleaseAdapter();
const DIST_DIR = "dist";

// Match every release archive shape we produce today: .tar.gz on POSIX
// targets, .zip on Windows. Adding a new archive extension means
// listing it here so the manifest sees its sha.
const ARCHIVE_EXTS = [".tar.gz", ".zip"];

const explicitFiles = adapter.args;
const files = explicitFiles.length > 0
  ? explicitFiles
  : (await adapter.readDirFiles(DIST_DIR)).filter((file) =>
    ARCHIVE_EXTS.some((ext) => file.endsWith(ext))
  );

if (files.length === 0) {
  throw new Error("No release archives found to checksum");
}

const lines: string[] = [];
for (const file of files) {
  const data = await adapter.readFile(file);
  const hash = await adapter.sha256Hex(data);
  lines.push(`${hash}  ${adapter.basename(file)}`);
}

await adapter.writeTextFile(adapter.join(DIST_DIR, "checksums.txt"), `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
