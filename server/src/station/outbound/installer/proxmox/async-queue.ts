/**
 * Single-consumer async queue for interleaving multiple producers (e.g. SSH log
 * stream + step generator events) into a single FIFO sequence consumed in
 * real-time by the installer.
 */
export class AsyncQueue<T> {
  private buffer: T[] = [];
  private waiter: ((value: IteratorResult<T>) => void) | null = null;
  private closed = false;

  push(item: T): void {
    if (this.closed) return;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve({ value: item, done: false });
    } else {
      this.buffer.push(item);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve({ value: undefined as unknown as T, done: true });
    }
  }

  async *drain(): AsyncIterableIterator<T> {
    while (true) {
      if (this.buffer.length > 0) {
        yield this.buffer.shift()!;
        continue;
      }
      if (this.closed) return;
      const result = await new Promise<IteratorResult<T>>((resolve) => {
        this.waiter = resolve;
      });
      if (result.done) return;
      yield result.value;
    }
  }
}
