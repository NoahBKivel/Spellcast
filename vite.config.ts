import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const lobbyPort = 8787;
const lobbySlot = globalThis as typeof globalThis & {
  __spellcastLobby?: { child?: ChildProcess; hooked?: boolean };
};
lobbySlot.__spellcastLobby ??= {};

async function lobbyReady(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/lobbies`, { method: "OPTIONS" });
    return response.status === 204;
  } catch {
    return false;
  }
}

function stopProcess(child: ChildProcess): void {
  const pid = child.pid;
  if (!pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    return;
  }
  child.kill("SIGTERM");
}

function stopLobby(): void {
  const child = lobbySlot.__spellcastLobby?.child;
  if (!child) return;
  lobbySlot.__spellcastLobby!.child = undefined;
  stopProcess(child);
}

let lobbyStartup: Promise<void> | null = null;

function startLobby(server: { httpServer: { on: (event: string, listener: () => void) => void } | null }): Promise<void> {
  if (lobbyStartup) return lobbyStartup;
  lobbyStartup = (async () => {
    if (await lobbyReady(lobbyPort)) return;
    const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
    const child = spawn(process.execPath, [wrangler, "dev", "--port", String(lobbyPort), "--ip", "127.0.0.1"], {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    });
    lobbySlot.__spellcastLobby!.child = child;
    server.httpServer?.on("close", stopLobby);

    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error("The lobby server exited before it was ready");
      if (await lobbyReady(lobbyPort)) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("The lobby server did not become ready");
  })().finally(() => {
    lobbyStartup = null;
  });
  return lobbyStartup;
}

function spellcastLobby(): Plugin {
  return {
    name: "spellcast-lobby",
    apply: "serve",
    async configureServer(server) {
      if (process.env.VITE_ROOM_HOST) return;
      if (!lobbySlot.__spellcastLobby!.hooked) {
        lobbySlot.__spellcastLobby!.hooked = true;
        process.on("exit", stopLobby);
      }
      await startLobby(server);
    },
  };
}

export default defineConfig({
  plugins: [spellcastLobby(), react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
