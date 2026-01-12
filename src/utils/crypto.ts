/**
 * Token encryption utilities
 *
 * Encrypts OAuth tokens at rest using AES-256-GCM.
 * The encryption key is derived from machine-specific identifiers.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { hostname, userInfo } from 'node:os';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT = 'whoop-cli-v1'; // Static salt for key derivation
const CURRENT_VERSION = 1;

/**
 * Derive encryption key from machine-specific identifiers.
 * This binds the encrypted tokens to this machine.
 */
function deriveKey(): Buffer {
  // Combine machine-specific identifiers
  const machineId = [
    hostname(),
    userInfo().username,
    process.env['HOME'] ?? process.env['USERPROFILE'] ?? '',
  ].join(':');

  // Derive key using scrypt
  return scryptSync(machineId, SALT, KEY_LENGTH);
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  version: number;
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(data: string): EncryptedData {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    version: CURRENT_VERSION,
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(data: EncryptedData): string {
  if (data.version !== CURRENT_VERSION) {
    throw new Error(`Unsupported encryption version: ${data.version}`);
  }

  const key = deriveKey();
  const iv = Buffer.from(data.iv, 'base64');
  const tag = Buffer.from(data.tag, 'base64');

  if (tag.length !== TAG_LENGTH) {
    throw new Error('Invalid auth tag');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(data.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Test if data can be decrypted (validates machine binding)
 */
export function canDecrypt(data: EncryptedData): boolean {
  try {
    decrypt(data);
    return true;
  } catch {
    return false;
  }
}
