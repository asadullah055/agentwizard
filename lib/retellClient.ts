// Minimal singleton wrapper for Retell Web SDK to use across pages without SSR issues
// No comments inside code

let retellWebClient: any = null;
let listeners: Record<string, Set<Function>> = {
  call_started: new Set(),
  call_ended: new Set(),
  error: new Set(),
  update: new Set(),
  metadata: new Set(),
};
let ready = false;
let initializing = false;
let callActive = false;

export async function getRetellClient(): Promise<any> {
  if (retellWebClient) return retellWebClient;
  if (initializing) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (retellWebClient) {
          clearInterval(interval);
          resolve(retellWebClient);
        }
      }, 50);
    });
  }
  if (typeof window === "undefined") return null;
  initializing = true;
  const { RetellWebClient } = await import("retell-client-js-sdk");
  retellWebClient = new RetellWebClient();

  retellWebClient.on("call_started", () => {
    callActive = true;
    listeners.call_started.forEach((fn) => fn());
  });
  retellWebClient.on("call_ended", () => {
    callActive = false;
    listeners.call_ended.forEach((fn) => fn());
  });
  retellWebClient.on("error", (e: any) => {
    callActive = false;
    listeners.error.forEach((fn) => fn(e));
  });
  retellWebClient.on("update", (u: any) => {
    listeners.update.forEach((fn) => fn(u));
  });
  retellWebClient.on("metadata", (m: any) => {
    listeners.metadata.forEach((fn) => fn(m));
  });

  (window as any).retellWebClient = retellWebClient;
  ready = true;
  initializing = false;
  return retellWebClient;
}

export function isClientReady(): boolean {
  return ready && !!retellWebClient;
}

export function isCallActive(): boolean {
  return callActive;
}

export async function startCall(options: {
  accessToken: string;
  sampleRate?: number;
  captureDeviceId?: string;
  playbackDeviceId?: string;
  emitRawAudioSamples?: boolean;
}): Promise<void> {
  const client = await getRetellClient();
  if (!client) throw new Error("Retell client unavailable");
  await client.startCall(options);
}

export async function stopCall(): Promise<void> {
  const client = await getRetellClient();
  if (!client) return;
  try {
    client.stopCall();
  } catch {}
}

export function on(
  event: "call_started" | "call_ended" | "error" | "update" | "metadata",
  handler: Function
): void {
  listeners[event].add(handler);
}

export function off(
  event: "call_started" | "call_ended" | "error" | "update" | "metadata",
  handler: Function
): void {
  listeners[event].delete(handler);
}
