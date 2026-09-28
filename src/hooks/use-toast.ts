import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

let toastCount = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    ({ title, description, type = 'info', duration = 3000 }: Omit<Toast, 'id'>) => {
      const id = (++toastCount).toString();
      const newToast = { id, title, description, type, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }

      return id;
    },
    []
  );

  const dismiss = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  return {
    toasts,
    toast,
    dismiss,
  };
}

// 将toast暴露到全局window对象
if (typeof window !== 'undefined') {
  (window as any).toast = {
    success: (message: string) =>
      console.log('[Toast Success]', message),
    error: (message: string) =>
      console.log('[Toast Error]', message),
    info: (message: string) =>
      console.log('[Toast Info]', message),
    warning: (message: string) =>
      console.log('[Toast Warning]', message),
  };
}
