// Adressen im Heimnetz (gleiches WLAN). Der Server nennt sie beim Start und, nur für den eigenen PC,
// unter /api/lan-addresses, damit die Lobby einen Link zeigt, den Freunde im WLAN öffnen können.
// Viele PCs haben zusätzliche virtuelle Adapter (VirtualBox, VMware, WSL …) mit eigenen Adressen.
// Die richtige ist die, über die der PC ins Internet geht (routeAddress); sie kommt zuerst.
import { createSocket } from "node:dgram";
import type { NetworkInterfaceInfo } from "node:os";

type Interfaces = NodeJS.Dict<NetworkInterfaceInfo[]>;

/** Adapter, die sicher nicht das WLAN sind (am Namen erkennbar). */
const VIRTUAL = /virtualbox|vmware|vmnet|vethernet|hyper-v|wsl|docker|loopback|bluetooth/i;

/** Private IPv4-Adresse (192.168/16, 10/8, 172.16/12)? */
export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const [a, b] = parts;
  if (parts.length !== 4 || a === undefined || b === undefined) return false;
  return (a === 192 && b === 168) || a === 10 || (a === 172 && b >= 16 && b <= 31);
}

/**
 * Adressen, unter denen andere Geräte im Heimnetz den Server erreichen, z. B. http://192.168.1.23:3001.
 * `preferred` (Adresse des Wegs ins Internet) zuerst, danach die übrigen Adapter.
 */
export function lanAddresses(interfaces: Interfaces, port: number, preferred: string | null = null): string[] {
  const found: string[] = [];
  for (const [name, list] of Object.entries(interfaces)) {
    if (VIRTUAL.test(name)) continue;
    for (const entry of list ?? []) {
      if (entry.family !== "IPv4" || entry.internal || !isPrivateIpv4(entry.address)) continue;
      if (!found.includes(entry.address)) found.push(entry.address);
    }
  }
  if (preferred && found.includes(preferred)) found.sort((x, y) => Number(y === preferred) - Number(x === preferred));
  return found.map((ip) => `http://${ip}:${port}`);
}

/**
 * Eigene Adresse auf dem Weg ins Internet. Ein UDP-«connect» fragt nur das Betriebssystem nach dem Weg,
 * es wird kein Paket verschickt. Ziel ist eine Dokumentationsadresse (RFC 5737). Ohne Netz: null.
 */
export function routeAddress(): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = createSocket("udp4");
    const done = (address: string | null) => {
      try {
        socket.close();
      } catch {
        // schon geschlossen
      }
      resolve(address);
    };
    socket.on("error", () => done(null));
    try {
      socket.connect(9, "192.0.2.1", () => {
        try {
          done(socket.address().address);
        } catch {
          done(null);
        }
      });
    } catch {
      done(null);
    }
  });
}

/** Ist die Gegenstelle der eigene PC (Loopback)? */
export function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  return address === "::1" || address.startsWith("127.") || address.startsWith("::ffff:127.");
}

const LOCAL_HOST_HEADER = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const PROXY_HEADERS = ["x-forwarded-for", "forwarded", "x-real-ip"];

/**
 * Kommt die Anfrage wirklich vom eigenen PC? Loopback allein reicht nicht: Hinter einem Proxy
 * (Render, Vite-Weiterleitung) verbindet der Proxy über 127.0.0.1. Darum zusätzlich: keine
 * Proxy-Kopfzeilen und als Adresse «localhost» (so, wie der Browser auf dem eigenen PC fragt).
 */
export function isLocalRequest(remoteAddress: string | undefined, headers: Record<string, string | string[] | undefined>): boolean {
  if (!isLoopback(remoteAddress)) return false;
  if (PROXY_HEADERS.some((name) => headers[name] !== undefined)) return false;
  const host = headers.host;
  return typeof host === "string" && LOCAL_HOST_HEADER.test(host);
}
