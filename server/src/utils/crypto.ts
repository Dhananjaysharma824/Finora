import argon2 from 'argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
