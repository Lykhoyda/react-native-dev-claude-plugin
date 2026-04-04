import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ToolResult } from './utils.js';
import type { SessionState } from './types.js';
import { okResult, failResult } from './utils.js';

const execFile = promisify(execFileCb);
const SESSION_FILE = '/tmp/rn-dev-agent-session.json';
const EXEC_TIMEOUT = 30_000;
const DAEMON_TIMEOUT = 30_000;

// --- Direct Daemon Socket Client ---

interface DaemonInfo {
  port: number;
  token: string;
}

let cachedDaemonInfo: DaemonInfo | null = null;

function loadDaemonInfo(): DaemonInfo | null {
  if (cachedDaemonInfo) return cachedDaemonInfo;
  const daemonPath = join(homedir(), '.agent-device', 'daemon.json');
  try {
    if (!existsSync(daemonPath)) return null;
    const raw = JSON.parse(readFileSync(daemonPath, 'utf-8')) as { port?: number; token?: string };
    if (!raw.port || !raw.token) return null;
    cachedDaemonInfo = { port: raw.port, token: raw.token };
    return cachedDaemonInfo;
  } catch {
    return null;
  }
}

function sendToDaemon(command: string, positionals: string[], session: string, timeoutMs = DAEMON_TIMEOUT): Promise<{ ok: boolean; data?: unknown; error?: { code: string; message: string; hint?: string } }> {
  const info = loadDaemonInfo();
  if (!info) return Promise.reject(new Error('daemon not available'));

  const req = {
    token: info.token,
    session,
    command,
    positionals,
    flags: {},
  };

  return new Promise((resolve, reject) => {
    const sock = createConnection({ host: '127.0.0.1', port: info.port }, () => {
      sock.write(JSON.stringify(req) + '\n');
    });

    let data = '';
    sock.setEncoding('utf8');
    const timer = setTimeout(() => { sock.destroy(); reject(new Error('daemon timeout')); }, timeoutMs);

    sock.on('data', (chunk: string) => {
      data += chunk;
      const nl = data.indexOf('\n');
      if (nl !== -1) {
        clearTimeout(timer);
        sock.end();
        try {
          resolve(JSON.parse(data.slice(0, nl).trim()));
        } catch {
          reject(new Error('invalid daemon response'));
        }
      }
    });
    sock.on('error', (err: Error) => { clearTimeout(timer); reject(err); });
  });
}

async function runViaDaemon(command: string, positionals: string[], session: string): Promise<ToolResult> {
  try {
    const resp = await sendToDaemon(command, positionals, session);
    if (resp.ok) {
      return okResult(resp.data ?? {});
    }
    const e = resp.error!;
    return failResult(e.message, { code: e.code, ...(e.hint ? { hint: e.hint } : {}) });
  } catch (err) {
    return failResult(`Daemon error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

let activeSession: SessionState | null = null;

try {
  const raw = readFileSync(SESSION_FILE, 'utf8');
  activeSession = JSON.parse(raw) as SessionState;
} catch {
  // No persisted session or invalid JSON — start fresh
}

export function getActiveSession(): SessionState | null {
  return activeSession;
}

export function setActiveSession(info: SessionState): void {
  activeSession = info;
  try { writeFileSync(SESSION_FILE, JSON.stringify(info), 'utf8'); } catch { /* ignore */ }
}

export function clearActiveSession(): void {
  activeSession = null;
  try { unlinkSync(SESSION_FILE); } catch { /* ignore */ }
}

export function hasActiveSession(): boolean {
  return activeSession !== null;
}

interface AgentDeviceJsonSuccess {
  success: true;
  data: unknown;
}

interface AgentDeviceJsonError {
  success: false;
  error: { code: string; message: string; hint?: string };
}

type AgentDeviceJson = AgentDeviceJsonSuccess | AgentDeviceJsonError;

export async function runAgentDevice(
  cliArgs: string[],
  opts: { skipSession?: boolean } = {},
): Promise<ToolResult> {
  const sessionName = (!opts.skipSession && activeSession) ? activeSession.name : '';

  // Fast path: direct daemon socket (eliminates ~300ms CLI spawn)
  if (sessionName && loadDaemonInfo()) {
    const command = cliArgs[0];
    const positionals = cliArgs.slice(1);
    try {
      return await runViaDaemon(command, positionals, sessionName);
    } catch {
      // Daemon unavailable — fall through to CLI
    }
  }

  const args = [...cliArgs, '--json'];
  if (sessionName) {
    args.push('--session', sessionName);
  }

  try {
    const { stdout } = await execFile('agent-device', args, {
      timeout: EXEC_TIMEOUT,
      encoding: 'utf8',
    });

    let parsed: AgentDeviceJson;
    try {
      parsed = JSON.parse(stdout) as AgentDeviceJson;
    } catch {
      return failResult(`agent-device returned non-JSON: ${stdout.slice(0, 300)}`);
    }

    if (!parsed.success) {
      const e = parsed.error;
      return failResult(
        e.message,
        { code: e.code, ...(e.hint ? { hint: e.hint } : {}) },
      );
    }

    return okResult(parsed.data ?? {});
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('ENOENT') || msg.includes('not found')) {
      return failResult(
        'agent-device CLI not found. Install with: npm install -g agent-device',
      );
    }

    // Detect timeout (SIGTERM from execFile timeout)
    if (typeof err === 'object' && err !== null && 'killed' in err && (err as { killed?: boolean }).killed) {
      return failResult(`agent-device timed out after ${EXEC_TIMEOUT / 1000}s`);
    }

    // Try to parse JSON from stdout on non-zero exit
    if (typeof err === 'object' && err !== null && 'stdout' in err) {
      const stdout = (err as { stdout: string }).stdout;
      if (stdout) {
        try {
          const parsed = JSON.parse(stdout) as AgentDeviceJson;
          if (parsed.success) {
            return okResult(parsed.data ?? {});
          }
          const e = parsed.error;
          return failResult(
            e.message,
            { code: e.code, ...(e.hint ? { hint: e.hint } : {}) },
          );
        } catch {
          // Not JSON — fall through
        }
      }
    }

    return failResult(`agent-device error: ${msg}`);
  }
}
