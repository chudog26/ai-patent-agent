// 用户缓存管理
export interface CachedUser {
  id: string;
  username: string;
  currentUsername: string;
  /** @deprecated 服务端已不再下发密码（散列为单向、不可还原），仅为兼容历史本地缓存保留 */
  password?: string;
  /** 是否已设置密码；替代 password 用于界面展示 */
  hasPassword?: boolean;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  position?: string | null;
  role?: string;
  createdAt: string;
}

const USER_CACHE_KEY = 'patent_generator_user';

/**
 * 从缓存获取用户信息
 */
export function getUserFromCache(): CachedUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error reading user cache:', error);
    return null;
  }
}

/**
 * 保存用户信息到缓存
 */
export function saveUserToCache(user: CachedUser): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error saving user cache:', error);
  }
}

/**
 * 清除用户缓存
 */
export function clearUserCache(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(USER_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing user cache:', error);
  }
}
