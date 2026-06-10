import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns hex-encoded ciphertext (with auth tag appended) and hex IV,
 * formatted for Postgres BYTEA storage (\x prefix).
 */
export function encrypt(text: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // ciphertext + authTag concatenated
  const payload = Buffer.concat([encrypted, authTag]);
  return {
    encrypted: '\\x' + payload.toString('hex'),
    iv: '\\x' + iv.toString('hex'),
  };
}

/**
 * Decrypt ciphertext produced by encrypt().
 * Accepts the various shapes Supabase returns BYTEA in.
 */
export function decrypt(encryptedData: unknown, ivData: unknown): string {
  const payload = toBuffer(encryptedData);
  const iv = toBuffer(ivData);

  // Last 16 bytes are the auth tag
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(0, payload.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf-8');
}

/**
 * Convert any Supabase BYTEA representation to a Buffer.
 * Handles: hex string (\x...), JSON Buffer ({type:'Buffer',data:[...]}), Buffer, plain string.
 */
function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;

  if (data && typeof data === 'object' && (data as Record<string, unknown>).type === 'Buffer') {
    return Buffer.from((data as { data: number[] }).data);
  }

  if (typeof data === 'string') {
    if (data.startsWith('\\x')) {
      return Buffer.from(data.slice(2), 'hex');
    }
    try {
      const parsed = JSON.parse(data);
      if (parsed?.type === 'Buffer' && Array.isArray(parsed.data)) {
        return Buffer.from(parsed.data);
      }
    } catch {
      /* not JSON */
    }
    return Buffer.from(data, 'utf-8');
  }

  return Buffer.from(String(data), 'utf-8');
}

/**
 * Legacy decoder for plaintext-hex messages stored before encryption was added.
 * Tries decryption first; falls back to plain decode if it fails (old data).
 */
export function decodeMessage(encryptedData: unknown, ivData: unknown): string {
  try {
    return decrypt(encryptedData, ivData);
  } catch {
    // Old plaintext-hex message (pre-encryption) — decode as UTF-8
    return toBuffer(encryptedData).toString('utf-8');
  }
}
