/**
 * 密钥加解密工具
 *
 * 用户/管理员填写的模型 API Key 会以 AES-256-GCM 加密后落库，避免数据库泄露时
 * 直接暴露明文密钥。加密密钥来自环境变量 SETTINGS_ENCRYPTION_KEY。
 *
 * 存储格式： enc:v1:<iv_b64>:<authTag_b64>:<cipher_b64>
 *
 * 如果未配置 SETTINGS_ENCRYPTION_KEY，则降级为 base64 编码（plain: 前缀）并在
 * 启动日志中给出警告——这样本地开发不会因为缺变量而完全跑不起来，但生产环境
 * 必须配置该变量。
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const ENC_PREFIX = 'enc:v1:';
const PLAIN_PREFIX = 'plain:';

let warnedAboutMissingKey = false;

function deriveKey(): Buffer | null {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY;

  if (!secret) {
    if (!warnedAboutMissingKey) {
      warnedAboutMissingKey = true;
      console.warn(
        '[crypto] 未配置 SETTINGS_ENCRYPTION_KEY，模型 API Key 将以明文（base64）存储。' +
          '生产环境请务必配置，建议使用 `openssl rand -base64 32` 生成。'
      );
    }
    return null;
  }

  // 任意长度的口令统一派生成 32 字节密钥
  return createHash('sha256').update(secret, 'utf8').digest();
}

/** 加密明文密钥，返回可直接入库的字符串 */
export function encryptSecret(plain: string): string {
  const key = deriveKey();

  if (!key) {
    return PLAIN_PREFIX + Buffer.from(plain, 'utf8').toString('base64');
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return (
    ENC_PREFIX +
    [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(
      ':'
    )
  );
}

/** 解密入库的密钥；解析失败时返回空串，避免因历史脏数据导致整体不可用 */
export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return '';

  if (stored.startsWith(PLAIN_PREFIX)) {
    return Buffer.from(stored.slice(PLAIN_PREFIX.length), 'base64').toString('utf8');
  }

  if (!stored.startsWith(ENC_PREFIX)) {
    // 兼容历史明文数据
    return stored;
  }

  const key = deriveKey();
  if (!key) return '';

  const parts = stored.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 3) return '';

  try {
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    console.error('[crypto] 密钥解密失败，可能是 SETTINGS_ENCRYPTION_KEY 已变更：', error);
    return '';
  }
}

/**
 * 生成用于前端展示的脱敏密钥。
 * 由于加解密不可逆展示，这里只在能拿到明文时使用。
 */
export function maskSecret(plain: string | null | undefined): string {
  if (!plain) return '';
  const trimmed = plain.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
}

/** 从密文反推脱敏展示值 */
export function maskStoredSecret(stored: string | null | undefined): string {
  if (!stored) return '';
  return maskSecret(decryptSecret(stored));
}
