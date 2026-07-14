export interface Logger {
  info(origin: string, message: string): Promise<void>;
  warn(origin: string, message: string): Promise<void>;
  error(origin: string, message: string, cause?: unknown): Promise<void>;
}
