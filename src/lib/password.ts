import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';

/**
 * 密码散列工具（单向、加盐、可验证）。
 *
 * 为什么不是 AES 之类的「加密」：
 * 密码只需要「验证」，永远不需要还原，因此用单向的 scrypt 派生函数。
 * 每个密码自带随机盐，相同明文也会得到不同散列，杜绝彩虹表。
 *
 * 存储格式：`scrypt$v1$<base64 salt>$<base64 hash>`（约 122 字符，
 * 与 users.password varchar(255) 兼容）。
 *
 * 兼容性：库里可能还留着历史明文密码（早期版本直接存明文）。
 * verifyPassword 对「非散列格式」的存量值退化为明文比对，并回报
 * needsRehash=true，调用方应顺势把该密码升级成散列——即惰性迁移，
 * 不需要停机刷数据。
 */

const HASH_PREFIX = 'scrypt$v1$';
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function deriveKey(plain: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(plain, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** 判断一个值是否已经是本工具产出的散列，而不是历史明文 */
export function isPasswordHash(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(HASH_PREFIX);
}

/** 把明文密码转成可入库的散列 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await deriveKey(plain, salt);
  return `${HASH_PREFIX}${salt.toString('base64')}$${derived.toString('base64')}`;
}

/** 若入参还不是散列就散列化，已经是散列则原样返回（幂等，避免二次散列） */
export async function ensureHashedPassword(plain: string): Promise<string> {
  return isPasswordHash(plain) ? plain : hashPassword(plain);
}

export interface VerifyPasswordResult {
  /** 明文是否匹配 */
  valid: boolean;
  /** 该记录仍是历史明文，验证通过后应写回散列 */
  needsRehash: boolean;
}

/**
 * 校验明文密码。
 * 对散列值走 scrypt + 定时安全比较；对历史明文走等值比较并提示需要迁移。
 */
export async function verifyPassword(
  plain: unknown,
  stored: unknown
): Promise<VerifyPasswordResult> {
  if (typeof plain !== 'string' || plain.length === 0) {
    return { valid: false, needsRehash: false };
  }
  if (typeof stored !== 'string' || stored.length === 0) {
    return { valid: false, needsRehash: false };
  }

  if (!isPasswordHash(stored)) {
    const valid = plain === stored;
    return { valid, needsRehash: valid };
  }

  const [, , saltPart, hashPart] = stored.split('$');
  if (!saltPart || !hashPart) {
    return { valid: false, needsRehash: false };
  }

  const salt = Buffer.from(saltPart, 'base64');
  const expected = Buffer.from(hashPart, 'base64');
  if (salt.length === 0 || expected.length === 0) {
    return { valid: false, needsRehash: false };
  }

  const derived = await deriveKey(plain, salt);
  if (derived.length !== expected.length) {
    return { valid: false, needsRehash: false };
  }

  return { valid: timingSafeEqual(derived, expected), needsRehash: false };
}
