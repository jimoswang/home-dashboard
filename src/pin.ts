import type { PinRecord } from "./types";

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    material,
    256
  );
  return new Uint8Array(bits);
}

export async function createPinRecord(pin: string): Promise<PinRecord> {
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN must be six digits");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 150_000;
  const hash = await derive(pin, salt, iterations);
  return { salt: toBase64(salt), hash: toBase64(hash), iterations };
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  if (!/^\d{6}$/.test(pin)) return false;
  const actual = await derive(pin, fromBase64(record.salt), record.iterations);
  const expected = fromBase64(record.hash);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}
