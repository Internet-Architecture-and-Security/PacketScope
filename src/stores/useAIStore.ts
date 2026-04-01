import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { APIs } from '@/constants';

// Types
interface AIConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  temperature: number;
  api_key: string;
  openai_endpoint: string;
  anthropic_version?: string;
  debug: boolean;
  timeout: number;
}

interface AIStatus {
  provider: 'openai' | 'anthropic';
  is_configured: boolean;
  has_api_key: boolean;
  has_endpoint: boolean;
  has_model: boolean;
}

interface AIAnalysisResult {
  filters: any[];
  insights: string[];
}

interface AIGenerationResult {
  filters: any[];
}

interface PcapAnalysisResult {
  success: boolean;
  analysis: string;
  threats: Array<{
    severity: 'high' | 'medium' | 'low';
    type: string;
    description: string;
    source_ip: string;
    target_ip: string;
    target_port: number;
  }>;
  statistics: {
    total_packets: number;
    total_bytes: number;
    duration: string;
    protocols: Record<string, number>;
    top_source_ips: Array<{ ip: string; count: number }>;
    top_ports: Array<{ port: number; protocol: string; count: number }>;
    tcp_flags: Record<string, number>;
    connections: number;
  };
  suggestions: string[];
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
  pcapAnalysisResult: PcapAnalysisResult | null;

  // Actions
  getConfig: () => Promise<void>;
  updateConfig: (config: AIConfig) => Promise<void>;
  generateFilters: (params: any) => Promise<AIGenerationResult>;
  analyzeOnly: (params: any) => Promise<AIAnalysisResult>;
  setPcapAnalysisResult: (data: PcapAnalysisResult) => void;
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
      status: null,
      config: null,
      isLoading: false,
      error: null,
      lastAnalysisResult: null,
      lastGenerationResult: null,
      pcapAnalysisResult: null,

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
          throw error;
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

      setPcapAnalysisResult: (data: PcapAnalysisResult) => {
        set({ pcapAnalysisResult: data });
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set({
          isLoading: false,
          error: null,
          lastAnalysisResult: null,
          lastGenerationResult: null,
          pcapAnalysisResult: null,
        });
      },

      isAiConfigValid: () => {
        const { status } = get();
        return status?.is_configured && status.has_api_key;
      },
    }),
    {
      name: 'ai-store',
    },
  ),
);