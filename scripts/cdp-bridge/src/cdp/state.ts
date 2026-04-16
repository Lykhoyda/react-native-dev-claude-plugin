import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CDPClientState, HermesTarget } from '../types.js';

const CDP_ACTIVE_FLAG = join(tmpdir(), 'rn-dev-agent-cdp-active');
const CDP_SESSION_FILE = join(tmpdir(), 'rn-dev-agent-cdp-session.json');

export interface CDPResettableState {
  _state: CDPClientState;
  _helpersInjected: boolean;
  _bridgeDetected: boolean;
  _bridgeVersion: number | null;
  _connectedTarget: HermesTarget | null;
  _logDomainEnabled: boolean;
  _profilerAvailable: boolean;
  _heapProfilerAvailable: boolean;
  _scripts: Map<string, { scriptId: string; url: string; startLine: number; endLine: number }>;
}

const RESET_DEFAULTS: Omit<CDPResettableState, '_scripts'> = {
  _state: 'disconnected' as CDPClientState,
  _helpersInjected: false,
  _bridgeDetected: false,
  _bridgeVersion: null,
  _connectedTarget: null,
  _logDomainEnabled: false,
  _profilerAvailable: false,
  _heapProfilerAvailable: false,
};

export function resetState(s: CDPResettableState): void {
  Object.assign(s, RESET_DEFAULTS);
  s._scripts.clear();
}

export function setActiveFlag(port: number, target: HermesTarget | null): void {
  try { writeFileSync(CDP_ACTIVE_FLAG, String(process.pid)); } catch { /* best-effort */ }
  try {
    writeFileSync(CDP_SESSION_FILE, JSON.stringify({
      port,
      platform: target?.platform ?? null,
      target: target?.title ?? null,
      pid: process.pid,
      connectedAt: new Date().toISOString(),
    }));
  } catch { /* best-effort */ }
}

export function clearActiveFlag(): void {
  try { unlinkSync(CDP_ACTIVE_FLAG); } catch { /* may not exist */ }
  try { unlinkSync(CDP_SESSION_FILE); } catch { /* may not exist */ }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
