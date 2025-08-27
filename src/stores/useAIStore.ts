import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { APIs } from '@/constants';

// Types
interface AIConfig {
  // 根据你的实际配置类型定义
  model: string;
  temperature: number;
  maxTokens: number;
  api_key: string;
  openai_endpoint: string;
  // 添加其他配置字段
}
// Types
interface AIStatus {
  // 根据你的实际配置类型定义
  is_configured: boolean;
  has_api_key: boolean;
  has_endpoint: boolean;
  has_model: boolean;
  // 添加其他配置字段
}

interface AIAnalysisResult {
  // 根据你的实际分析结果类型定义
  filters: any[];
  insights: string[];
  // 添加其他结果字段
}

interface AIGenerationResult {
  // 根据你的实际生成结果类型定义
  filters: any[];
  // 添加其他结果字段
}

// Store State Interface
interface AIStore {
  // State
  status: AIStatus | null;
  config: AIConfig | null;
  isLoading: boolean;
  error: string | null;
  lastAnalysisResult: AIAnalysisResult | null;
  lastGenerationResult: AIGenerationResult | null;

  // Actions
  getConfig: () => Promise<void>;
  updateConfig: (config: AIConfig) => Promise<void>;
  generateFilters: (params: any) => Promise<AIGenerationResult>;
  analyzeOnly: (params: any) => Promise<AIAnalysisResult>;
  clearError: () => void;
  reset: () => void;
  isAiConfigValid: () => boolean;
}

// API functions
const aiAPI = {
  getStatus: async (): Promise<AIStatus> => {
    const response = await fetch(APIs['Guarder.status']);
    if (!response.ok) {
      throw new Error('Failed to fetch AI status');
    }
    return response.json();
  },
  getConfig: async (): Promise<AIConfig> => {
    const response = await fetch(APIs['Guarder.config']);
    if (!response.ok) {
      throw new Error('Failed to fetch AI config');
    }
    return response.json();
  },

  updateConfig: async (config: AIConfig): Promise<void> => {
    const response = await fetch(APIs['Guarder.config'], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      throw new Error('Failed to update AI config');
    }
  },

  generateFilters: async (params: any): Promise<AIGenerationResult> => {
    const response = await fetch(APIs['Guarder.generate'], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      throw new Error('Failed to generate AI filters');
    }
    return response.json();
  },

  analyzeOnly: async (params: any): Promise<AIAnalysisResult> => {
    const response = await fetch(APIs['Guarder.analyze'], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      throw new Error('Failed to analyze network data');
    }
    return response.json();
  },
};

// Zustand Store
export const useAIStore = create<AIStore>()(
  devtools(
    (set, get) => ({
      // Initial State
      config: null,
      isLoading: false,
      error: null,
      lastAnalysisResult: null,
      lastGenerationResult: null,

      // Actions
      getConfig: async () => {
        set({ isLoading: true, error: null });
        try {
          const config = await aiAPI.getConfig();
          const status = await aiAPI.getStatus();
          console.log(config);
          set({ config, status, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false,
          });
        }
      },

      updateConfig: async (config: AIConfig) => {
        set({ isLoading: true, error: null });
        try {
          await aiAPI.updateConfig(config);
          const status = await aiAPI.getStatus();
          set({ config, status, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false,
          });
          throw error; // Re-throw for component error handling
        }
      },

      generateFilters: async (params: any) => {
        set({ isLoading: true, error: null });
        try {
          const result = await aiAPI.generateFilters(params);
          set({
            lastGenerationResult: result,
            isLoading: false,
          });
          return result;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false,
          });
          throw error;
        }
      },

      analyzeOnly: async (params: any) => {
        set({ isLoading: true, error: null });
        try {
          const result = await aiAPI.analyzeOnly(params);
          set({
            lastAnalysisResult: result,
            isLoading: false,
          });
          return result;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false,
          });
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set({
          // config: null,
          isLoading: false,
          error: null,
          lastAnalysisResult: null,
          lastGenerationResult: null,
        });
      },

      isAiConfigValid: () => {
        const { status } = get();
        return status?.is_configured && status.has_api_key;
      },
    }),
    {
      name: 'ai-store', // Store name for devtools
    },
  ),
);
