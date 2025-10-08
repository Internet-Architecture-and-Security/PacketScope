/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LOCAL_STORE, APIs } from '@/constants';
import { devtools } from 'zustand/middleware';

type ThemeType = 'light' | 'dark' | 'system';

// 监听系统主题
export const getSystemTheme = (): Exclude<ThemeType, 'system'> =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

interface ThemeState {
  systemTheme: Exclude<ThemeType, 'system'>;
  currentTheme: ThemeType;
  setCurrentTheme: (newTheme: ThemeType) => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      currentTheme: 'light', // 默认值，不用 getStoredTheme()，persist 会自动读取存储值
      systemTheme: getSystemTheme(),
      setCurrentTheme: (newTheme) => {
        set({ currentTheme: newTheme });
      },
    }),
    {
      name: LOCAL_STORE.theme, // persist 处理 localStorage 存储
    },
  ),
);

interface ReadyState {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  maxAttemptsReached: boolean;
  checkReady: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  resetPolling: () => void;
}
export const useMonitorReadyStore = create<ReadyState>((set, get) => {
  let pollingInterval: NodeJS.Timeout | null = null;
  let attemptCount = 0;
  const MAX_ATTEMPTS = 60; // 60次 * 500ms = 30秒

  return {
    isReady: false,
    isLoading: false,
    error: null,
    maxAttemptsReached: false,

    checkReady: async () => {
      console.log('[MonitorReadyStore] checkReady called, attemptCount:', attemptCount);
      
      try {
        const res = await fetch(APIs['Tracer.isAttachFinished']);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        const ready = Array.isArray(data) && data[0] === true;

        console.log('[MonitorReadyStore] API response:', { data, ready });

        set({
          isReady: ready,
          isLoading: false  // 关键：每次检查后都设置为 false
        });

        // 如果已准备好，停止轮询并重置计数
        if (ready && pollingInterval) {
          console.log('[MonitorReadyStore] Ready! Stopping polling');
          clearInterval(pollingInterval);
          pollingInterval = null;
          attemptCount = 0;
        }
      } catch (error) {
        console.error('[MonitorReadyStore] checkReady error:', error);
        set({
          isReady: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },

    startPolling: () => {
      console.log('[MonitorReadyStore] startPolling called');
      
      // 清除已存在的轮询
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }

      // 重置状态
      attemptCount = 0;
      set({ 
        maxAttemptsReached: false, 
        error: null,
        isLoading: true  // 开始轮询时设置为 true
      });

      // 立即执行一次
      get().checkReady();
      attemptCount++;

      // 每1000ms执行一次
      pollingInterval = setInterval(() => {
        const { isReady } = get();
        
        console.log('[MonitorReadyStore] Polling check:', { attemptCount, isReady });
        
        // 检查是否达到最大尝试次数
        if (attemptCount >= MAX_ATTEMPTS) {
          console.log('[MonitorReadyStore] Max attempts reached');
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
          set({
            maxAttemptsReached: true,
            isLoading: false,
            error: '服务没有开启或网络故障，请检查后再重新尝试'
          });
          return;
        }

        if (!isReady) {
          get().checkReady();
          attemptCount++;
        } else {
          // 已准备好，停止轮询
          console.log('[MonitorReadyStore] Already ready, stopping interval');
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
          attemptCount = 0;
          set({ isLoading: false });
        }
      }, 1000);
    },

    stopPolling: () => {
      console.log('[MonitorReadyStore] stopPolling called');
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
      attemptCount = 0;
      set({ isLoading: false });
    },

    resetPolling: () => {
      console.log('[MonitorReadyStore] resetPolling called');
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
      attemptCount = 0;
      set({
        isReady: false,
        isLoading: false,
        error: null,
        maxAttemptsReached: false
      });
      get().startPolling();
    }
  };
});
// 监听系统主题变化
export const listenSystemThemeChange = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleThemeChange = (event: MediaQueryListEvent) => {
    if (useTheme.getState().currentTheme === 'system') {
      useTheme.setState({ systemTheme: event.matches ? 'dark' : 'light' });
    }
  };

  mediaQuery.addEventListener('change', handleThemeChange);

  return () => {
    mediaQuery.removeEventListener('change', handleThemeChange);
  };
};

type LangType = 'en-US' | 'zh-CN';

interface SelectLangState {
  defaultValue: LangType;
  currentLang: LangType;
  setCurrentLang: (newLang: LangType) => void;
}

// 获取浏览器默认语言
const getDefaultLang = (): LangType => (navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US');

export const useSelectLang = create<SelectLangState>()(
  persist(
    (set) => ({
      defaultValue: getDefaultLang(),
      currentLang: getDefaultLang(), // 语言默认值
      setCurrentLang: (newLang) => {
        set({ currentLang: newLang });
      },
    }),
    {
      name: LOCAL_STORE.local, // localStorage key
    },
  ),
);

interface AutoScrollState {
  isAutoScroll: boolean;
  setIsAutoScroll: (value: boolean) => void;
  toggleAutoScroll: () => void;
}

export const useIsAutoScroll = create<AutoScrollState>((set, get) => ({
  isAutoScroll: true,

  // 显式设置
  setIsAutoScroll: (value: boolean) => {
    set({ isAutoScroll: value });
  },

  // 切换 true/false
  toggleAutoScroll: () => {
    set({ isAutoScroll: !get().isAutoScroll });
  },
}));

interface AIModalVisibleState {
  aiGenerateModalVisible: boolean;
  setAiGenerateModalVisible: (value: boolean) => void;
  toggleAiGenerateModalVisible: () => void;
}
export const useAIModalVisible = create<AIModalVisibleState>((set, get) => ({
  aiGenerateModalVisible: false,

  // 显式设置
  setAiGenerateModalVisible: (value: boolean) => {
    set({ aiGenerateModalVisible: value });
  },

  // 切换 true/false
  toggleAiGenerateModalVisible: () => {
    set({ aiGenerateModalVisible: !get().aiGenerateModalVisible });
  },
}));

// 模态框可见性状态
interface ModalState {
  aiConfigModalVisible: boolean;
  setAiConfigModalVisible: (visible: boolean) => void;
  aiGenerateModalVisible: boolean;
  setAiGenerateModalVisible: (visible: boolean) => void;
  aiAnalyzeModalVisible: boolean;
  setAiAnalyzeModalVisible: (visible: boolean) => void;
  filterModalVisible: boolean;
  setFilterModalVisible: (visible: boolean) => void;
}

export const useModals = create<ModalState>()(
  // devtools(
  (set) => ({
    aiConfigModalVisible: false,
    setAiConfigModalVisible: (visible) => {
      set({ aiConfigModalVisible: visible });
    },
    aiGenerateModalVisible: false,
    setAiGenerateModalVisible: (visible) => {
      set({ aiGenerateModalVisible: visible });
    },
    aiAnalyzeModalVisible: false,
    setAiAnalyzeModalVisible: (visible) => {
      set({ aiAnalyzeModalVisible: visible });
    },
    filterModalVisible: false,
    setFilterModalVisible: (visible) => {
      set({ filterModalVisible: visible });
    },
  }),
  //   {
  //     name: 'modals-storage',
  //   },
  // ),
);

// 编辑状态
interface EditState {
  editingFilter: Filter | null;
  setEditingFilter: (filter: Filter | null) => void;
}

export const useEdit = create<EditState>()(
  devtools(
    (set) => ({
      editingFilter: null,
      setEditingFilter: (filter) => {
        set({ editingFilter: filter });
      },
    }),
    {
      name: 'edit-storage',
    },
  ),
);
