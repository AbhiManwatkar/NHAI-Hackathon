import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import { AttendanceEntry, AttendanceLog, Employee, VaultManager } from '../modules/BiometricVault';
import { FaceEngine } from '../modules/FaceEngine';
import { SyncManager } from '../modules/SyncManager';
import { BenchmarkStore, BenchmarkSummary } from '../utils/benchmark';
import { Logger } from '../utils/logger';
import type { SyncStatus } from '../types';

const initialSyncStatus: SyncStatus = {
  isConnected: false,
  isSyncing: false,
  pendingCount: 0,
  failedCount: 0,
  completedCount: 0,
  lastSuccessfulSync: null,
  progress: 0,
  currentError: null,
  uploadSpeedBps: 0,
};

export interface AppStoreState {
  employees: Employee[];
  todayAttendance: AttendanceLog[];
  syncStatus: SyncStatus;
  unsyncedCount: number;
  aiModelsReady: boolean;
  isOnline: boolean;
  spoofAttemptCount: number;
  benchmarkSummary: BenchmarkSummary | null;
  initApp: () => Promise<void>;
  refreshEmployees: () => Promise<void>;
  refreshAttendance: () => Promise<void>;
  addAttendanceEntry: (entry: AttendanceEntry) => Promise<void>;
  setSyncStatus: (status: Partial<SyncStatus>) => void;
  setOnline: (online: boolean) => void;
  setModelsReady: (ready: boolean) => void;
  incrementSpoofAttempts: () => void;
  setBenchmarkSummary: (summary: BenchmarkSummary | null) => void;
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  employees: [],
  todayAttendance: [],
  syncStatus: initialSyncStatus,
  unsyncedCount: 0,
  aiModelsReady: false,
  isOnline: false,
  spoofAttemptCount: 0,
  benchmarkSummary: null,

  initApp: async () => {
    const vault = VaultManager.getInstance();
    await vault.init();
    await FaceEngine.initialize();
    SyncManager.getInstance().init();

    const network = await NetInfo.fetch();
    const isOnline = Boolean(network.isConnected && network.isInternetReachable !== false);
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const [employees, todayAttendance, unsynced, spoofAttempts] = await Promise.all([
      vault.getAllEmployees(),
      vault.getTodayAttendance(),
      vault.getUnsyncedRecords(),
      vault.getSpoofAttempts(todayStart),
    ]);

    set((state) => ({
      employees,
      todayAttendance,
      unsyncedCount: unsynced.length,
      isOnline,
      aiModelsReady: true,
      spoofAttemptCount: spoofAttempts.length,
      benchmarkSummary: BenchmarkStore.getSummary(),
      syncStatus: {
        ...state.syncStatus,
        isConnected: isOnline,
        pendingCount: unsynced.length,
      },
    }));

    Logger.info('AppStore', 'Application state hydrated from SQLite', {
      employees: employees.length,
      attendance: todayAttendance.length,
      unsynced: unsynced.length,
    });
  },

  refreshEmployees: async () => {
    const employees = await VaultManager.getInstance().getAllEmployees();
    set({ employees });
  },

  refreshAttendance: async () => {
    const vault = VaultManager.getInstance();
    const [todayAttendance, unsynced] = await Promise.all([
      vault.getTodayAttendance(),
      vault.getUnsyncedRecords(),
    ]);
    set((state) => ({
      todayAttendance,
      unsyncedCount: unsynced.length,
      syncStatus: {
        ...state.syncStatus,
        pendingCount: unsynced.length,
      },
    }));
  },

  addAttendanceEntry: async (entry) => {
    const optimisticEntry: AttendanceLog = {
      ...entry,
      id: entry.id ?? `local_${Date.now()}`,
      sync_status: entry.sync_status ?? 'LOCAL',
    };

    set((state) => ({
      todayAttendance: [optimisticEntry, ...state.todayAttendance],
      unsyncedCount: state.unsyncedCount + 1,
      syncStatus: {
        ...state.syncStatus,
        pendingCount: state.syncStatus.pendingCount + 1,
      },
    }));

    try {
      await VaultManager.getInstance().logAttendance(optimisticEntry);
      get().refreshAttendance();
    } catch (error) {
      Logger.error('AppStore', 'Failed to persist attendance entry', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  setSyncStatus: (status) => {
    set((state) => ({
      syncStatus: {
        ...state.syncStatus,
        ...status,
      },
    }));
  },

  setOnline: (online) => {
    set((state) => ({
      isOnline: online,
      syncStatus: {
        ...state.syncStatus,
        isConnected: online,
      },
    }));
  },

  setModelsReady: (ready) => set({ aiModelsReady: ready }),

  incrementSpoofAttempts: () => {
    set((state) => ({ spoofAttemptCount: state.spoofAttemptCount + 1 }));
  },

  setBenchmarkSummary: (summary) => set({ benchmarkSummary: summary }),
}));

export default useAppStore;
