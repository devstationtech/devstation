/// <reference types="@types/react" />
import { useSyncExternalStore } from "react";

// Cross-cutting registry of "something is currently running" flags. Provider-
// specific stores (e.g. proxmox provisioning) call setActiveRun/clearActiveRun
// to register their long-running operations. Top-level screens (e.g. topologies
// index) read useAnyRun() to warn before leaving while a run is in progress,
// without needing to reach into provider-specific code.
const active = new Set<string>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export function setActiveRun(scope: string): void {
  if (active.has(scope)) return;
  active.add(scope);
  notify();
}

export function clearActiveRun(scope: string): void {
  if (!active.delete(scope)) return;
  notify();
}

export function activeRuns(): string[] {
  return [...active];
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAnyRun(): boolean {
  return useSyncExternalStore(subscribe, () => active.size > 0);
}

export function useIsActive(scope: string): boolean {
  return useSyncExternalStore(subscribe, () => active.has(scope));
}
