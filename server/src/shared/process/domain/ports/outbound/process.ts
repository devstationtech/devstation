export type ProcessRequest = {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  signal?: AbortSignal;
  /**
   * Content written to the child's stdin, which is then closed. When absent
   * the child gets no stdin at all (see the adapter's MCP-stdio rationale).
   * Lets callers move sensitive payloads out of argv — a process list shows
   * arguments, never stdin.
   */
  stdin?: string;
};

export type ProcessEvent =
  | { type: "stdout"; line: string }
  | { type: "stderr"; line: string }
  | { type: "exit"; code: number };

export class ProcessNotFound extends Error {
  constructor(command: string) {
    super(`executable not found: ${command}`);
    this.name = "ProcessNotFound";
  }
}

export interface Process {
  run(request: ProcessRequest): AsyncIterable<ProcessEvent>;
}
