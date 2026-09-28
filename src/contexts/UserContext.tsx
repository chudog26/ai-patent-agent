'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserFromCache, saveUserToCache, clearUserCache, type CachedUser } from '@/lib/userCache';

interface UserContextType {
  currentUser: CachedUser | null;
  setCurrentUser: (user: CachedUser | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  needsAuth: boolean;
  setNeedsAuth: (open: boolean) => void;
  /** 系统尚未初始化（库里还没有管理员），前端需引导用户完成首次部署 */
  needsSetup: boolean;
  refreshSetupStatus: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CachedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  // 加载用户信息
  const loadUserInfo = async () => {
    try {
      setIsLoading(true);

      // 先检查缓存
      const cachedUser = getUserFromCache();

      if (cachedUser) {
        console.log('UserContext: User found in cache', cachedUser.currentUsername);
        // 验证缓存的用户数据是否完整
        if (cachedUser.id && cachedUser.username) {
          setCurrentUser(cachedUser);
          // 可选：尝试从后端刷新用户信息以确保数据最新
          try {
            const response = await fetch('/api/user', {
              headers: { 'x-user-id': cachedUser.id },
            });
            if (response.ok) {
              const result = await response.json();
              if (result && result.id) {
                console.log('UserContext: User refreshed from API', result.currentUsername);
                setCurrentUser(result);
                saveUserToCache(result);
              }
            }
          } catch (error) {
            console.warn('UserContext: Failed to refresh user from API, using cached data');
          }
        } else {
          // 缓存数据不完整，清除缓存
          console.log('UserContext: Cached user data incomplete, clearing cache');
          clearUserCache();
          setCurrentUser(null);
        }
      } else {
        console.log('UserContext: No user in cache, user not logged in');
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('UserContext: Error loading user info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 刷新用户信息（强制从后端获取）
  const refreshUser = async () => {
    try {
      setIsLoading(true);

      // 从缓存获取用户ID
      const cachedUserId = getUserFromCache()?.id;

      console.log('UserContext: refreshUser called, cachedUserId:', cachedUserId);

      // 如果没有缓存用户ID，清除状态
      if (!cachedUserId) {
        console.log('UserContext: No cached user ID, clearing user state');
        setCurrentUser(null);
        return;
      }

      const response = await fetch('/api/user', {
        headers: { 'x-user-id': cachedUserId },
      });

      const result = await response.json();

      console.log('UserContext: refreshUser response status:', response.status);

      // 如果是401错误，说明用户未登录或token失效
      if (response.status === 401) {
        console.log('UserContext: User not authenticated (401), clearing user state');
        setCurrentUser(null);
        clearUserCache();
        return;
      }

      // API返回的用户数据直接就是用户对象
      if (result && result.id) {
        setCurrentUser(result);
        saveUserToCache(result);
        console.log('UserContext: user refreshed successfully', result.currentUsername);
      } else {
        // 如果获取失败，清除用户状态和缓存
        console.log('UserContext: refreshUser failed, clearing user state');
        setCurrentUser(null);
        clearUserCache();
      }
    } catch (error) {
      console.error('UserContext: Error refreshing user info:', error);
      // 发生错误时也清除状态
      setCurrentUser(null);
      clearUserCache();
    } finally {
      setIsLoading(false);
    }
  };

  // 登出
  const logout = () => {
    console.log('UserContext: logout called');
    setCurrentUser(null);
    // 清除缓存
    if (typeof window !== 'undefined') {
      localStorage.removeItem('patent_generator_user');
    }
    // 注意：不要设置 setNeedsAuth(false)，让页面自己决定是否需要登录
  };

  // 检查系统是否已完成初始化（是否存在管理员账号）
  const refreshSetupStatus = async () => {
    try {
      if (typeof window === 'undefined') return;

      const response = await fetch('/api/setup');
      const data = await response.json();

      setNeedsSetup(Boolean(data.needsSetup));
    } catch (error) {
      console.error('UserContext: 检查初始化状态失败', error);
    }
  };

  // 组件挂载时加载用户信息并检查初始化状态
  useEffect(() => {
    loadUserInfo();
    refreshSetupStatus();
  }, []);

  const value = {
    currentUser,
    setCurrentUser: (user: CachedUser | null) => {
      console.log('UserContext: setCurrentUser called', user?.username);
      setCurrentUser(user);
      if (user) {
        saveUserToCache(user);
      } else {
        // 清除缓存
        if (typeof window !== 'undefined') {
          localStorage.removeItem('patent_generator_user');
        }
      }
    },
    refreshUser,
    logout,
    isLoading,
    needsAuth,
    setNeedsAuth,
    needsSetup,
    refreshSetupStatus,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

// 自定义 Hook 方便使用
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
