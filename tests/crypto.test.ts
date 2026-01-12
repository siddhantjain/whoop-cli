import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, canDecrypt } from '../src/utils/crypto.js';

describe('encrypt', () => {
  it('encrypts data and returns encrypted object', () => {
    const data = 'secret data';
    const result = encrypt(data);

    expect(result).toHaveProperty('encrypted');
    expect(result).toHaveProperty('iv');
    expect(result).toHaveProperty('tag');
    expect(result).toHaveProperty('version');
    expect(result.version).toBe(1);
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const data = 'secret data';
    const result1 = encrypt(data);
    const result2 = encrypt(data);

    expect(result1.encrypted).not.toBe(result2.encrypted);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it('handles empty string', () => {
    const result = encrypt('');
    expect(result.encrypted).toBeDefined();
  });

  it('handles unicode characters', () => {
    const data = '🔥 Recovery: 72% | HRV: 45ms 日本語';
    const result = encrypt(data);
    const decrypted = decrypt(result);
    expect(decrypted).toBe(data);
  });

  it('handles JSON data', () => {
    const data = JSON.stringify({ access_token: 'abc123', refresh_token: 'xyz789' });
    const result = encrypt(data);
    const decrypted = decrypt(result);
    expect(decrypted).toBe(data);
  });
});

describe('decrypt', () => {
  it('decrypts encrypted data correctly', () => {
    const original = 'my secret token data';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(original);
  });

  it('throws on invalid version', () => {
    const encrypted = encrypt('test');
    encrypted.version = 99;

    expect(() => decrypt(encrypted)).toThrow('Unsupported encryption version');
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('test');
    encrypted.encrypted = 'tampered' + encrypted.encrypted;

    expect(() => decrypt(encrypted)).toThrow();
  });

  it('throws on invalid auth tag', () => {
    const encrypted = encrypt('test');
    encrypted.tag = 'invalidtag';

    expect(() => decrypt(encrypted)).toThrow();
  });

  it('throws on invalid IV', () => {
    const encrypted = encrypt('test');
    encrypted.iv = 'short';

    expect(() => decrypt(encrypted)).toThrow();
  });
});

describe('canDecrypt', () => {
  it('returns true for valid encrypted data', () => {
    const encrypted = encrypt('test');
    expect(canDecrypt(encrypted)).toBe(true);
  });

  it('returns false for tampered data', () => {
    const encrypted = encrypt('test');
    encrypted.encrypted = 'tampered';
    expect(canDecrypt(encrypted)).toBe(false);
  });

  it('returns false for wrong version', () => {
    const encrypted = encrypt('test');
    encrypted.version = 99;
    expect(canDecrypt(encrypted)).toBe(false);
  });
});

describe('round-trip encryption', () => {
  it('handles large data', () => {
    const largeData = 'x'.repeat(100000);
    const encrypted = encrypt(largeData);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(largeData);
  });

  it('handles special characters', () => {
    const data = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
    const encrypted = encrypt(data);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(data);
  });

  it('handles newlines and tabs', () => {
    const data = 'line1\nline2\tTabbed';
    const encrypted = encrypt(data);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(data);
  });
});
