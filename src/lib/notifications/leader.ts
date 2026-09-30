/**
 * Minimal BroadcastChannel leader election so only one tab shows browser
 * notifications. Each tab heartbeats its id; the lowest id seen within the
 * timeout is leader. Without BroadcastChannel every tab considers itself
 * leader (acceptable degradation).
 */
const HEARTBEAT_MS = 2000;
const TIMEOUT_MS = 5000;

export function createLeaderElection(channelName = "vortex-notify-leader") {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const peers = new Map<string, number>();
  if (typeof BroadcastChannel === "undefined") {
    return { isLeader: () => true, close: () => undefined };
  }
  const channel = new BroadcastChannel(channelName);
  const beat = () => channel.postMessage({ type: "hb", id });
  channel.onmessage = (e: MessageEvent<{ type: string; id: string }>) => {
    if (e.data?.type === "hb") peers.set(e.data.id, Date.now());
    if (e.data?.type === "bye") peers.delete(e.data.id);
  };
  beat();
  const timer = setInterval(beat, HEARTBEAT_MS);
  return {
    isLeader: () => {
      const cutoff = Date.now() - TIMEOUT_MS;
      for (const [peer, seen] of peers) {
        if (seen >= cutoff && peer < id) return false;
      }
      return true;
    },
    close: () => {
      clearInterval(timer);
      channel.postMessage({ type: "bye", id });
      channel.close();
    },
  };
}
