// WLAN-Adressen: welche Schnittstellen zählen, und nur der eigene PC bekommt sie über /api/lan-addresses.
import type { NetworkInterfaceInfo } from "node:os";
import { networkInterfaces } from "node:os";
import { describe, expect, it } from "vitest";
import { isLoopback, isPrivateIpv4, lanAddresses, routeAddress } from "../src/lan";
import { rawRequest, startServer } from "./helpers";

function v4(address: string, internal = false): NetworkInterfaceInfo {
  return { address, family: "IPv4", internal, netmask: "255.255.255.0", mac: "00:00:00:00:00:00", cidr: `${address}/24` };
}

function v6(address: string): NetworkInterfaceInfo {
  return { address, family: "IPv6", internal: false, netmask: "ffff:ffff:ffff:ffff::", mac: "00:00:00:00:00:00", cidr: `${address}/64`, scopeid: 0 };
}

describe("lanAddresses", () => {
  const interfaces = {
    "Ethernet 3": [v4("192.168.56.1")],
    "vEthernet (WSL)": [v4("172.24.112.1")],
    "VMware Network Adapter VMnet8": [v4("192.168.92.1")],
    "Loopback Pseudo-Interface 1": [v4("127.0.0.1", true)],
    WLAN: [v6("fe80::1"), v4("10.9.21.208")],
    Firma: [v4("172.16.0.5")],
    Ohne: [v4("169.254.10.10")],
    Öffentlich: [v4("85.1.2.3"), v4("172.32.0.1")],
    Doppelt: [v4("10.9.21.208")],
    Leer: undefined,
  };

  it("nimmt nur private IPv4-Adressen und lässt erkennbar virtuelle Adapter weg", () => {
    expect(lanAddresses(interfaces, 3001)).toEqual(["http://192.168.56.1:3001", "http://10.9.21.208:3001", "http://172.16.0.5:3001"]);
  });

  it("die Adresse des Wegs ins Internet kommt zuerst", () => {
    expect(lanAddresses(interfaces, 3001, "10.9.21.208")).toEqual(["http://10.9.21.208:3001", "http://192.168.56.1:3001", "http://172.16.0.5:3001"]);
    // Unbekannte oder öffentliche Adresse ändert nichts.
    expect(lanAddresses(interfaces, 3001, "85.1.2.3")[0]).toBe("http://192.168.56.1:3001");
  });

  it("ohne Netz: leer", () => {
    expect(lanAddresses({ Loopback: [v4("127.0.0.1", true)] }, 3001)).toEqual([]);
  });

  it("isPrivateIpv4", () => {
    for (const ip of ["192.168.0.1", "10.0.0.1", "172.16.0.1", "172.31.255.255"]) expect(isPrivateIpv4(ip), ip).toBe(true);
    for (const ip of ["172.15.0.1", "172.32.0.1", "8.8.8.8", "169.254.1.1", "127.0.0.1", "1.2.3", "abc"]) expect(isPrivateIpv4(ip), ip).toBe(false);
  });
});

describe("routeAddress", () => {
  it("liefert eine IPv4-Adresse dieses PCs oder null (ohne Netz)", async () => {
    const address = await routeAddress();
    if (address !== null) expect(address).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });
});

describe("isLoopback", () => {
  it("erkennt den eigenen PC", () => {
    for (const address of ["127.0.0.1", "127.1.2.3", "::1", "::ffff:127.0.0.1"]) expect(isLoopback(address), address).toBe(true);
    for (const address of [undefined, "", "192.168.1.23", "::ffff:192.168.1.23", "fe80::1", "10.0.0.1"]) expect(isLoopback(address), String(address)).toBe(false);
  });
});

describe("/api/lan-addresses", () => {
  it("antwortet dem eigenen PC mit den Adressen", async () => {
    const server = await startServer();
    const res = await rawRequest(server.port, "/api/lan-addresses");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/json; charset=utf-8");
    const data = JSON.parse(res.body) as { urls: string[] };
    expect(data.urls).toEqual(lanAddresses(networkInterfaces(), server.port, await routeAddress()));
  });

  // Über die eigene WLAN-Adresse kommt die Anfrage nicht vom Loopback: wie ein anderes Gerät.
  const lanIp = lanAddresses(networkInterfaces(), 1)[0]?.replace(/^http:\/\/|:1$/g, "");
  it.skipIf(!lanIp)("verrät anderen Geräten nichts", async () => {
    const server = await startServer();
    const res = await rawRequest(server.port, "/api/lan-addresses", "GET", {}, lanIp);
    // Ohne gebaute Oberfläche kommt der allgemeine Text, aber nie die Adressliste.
    expect(res.headers["content-type"]).not.toContain("application/json");
    expect(res.body).not.toContain("urls");
  });
});
