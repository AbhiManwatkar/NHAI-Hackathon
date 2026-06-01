import React, { createContext, useContext, useEffect, useState } from 'react';
import { VaultManager } from './VaultManager';
import { DeviceCrypto } from './crypto';

interface VaultContextType {
  vault: VaultManager;
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const vault = VaultManager.getInstance();

  useEffect(() => {
    let active = true;

    const initializeVault = async () => {
      try {
        // Deriving keys and initializing sqlite tables
        await vault.init();
        if (active) {
          setIsReady(true);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[VaultProvider] Initialization failed:', err);
        if (active) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    };

    initializeVault();

    return () => {
      active = false;
    };
  }, [vault]);

  return (
    <VaultContext.Provider value={{ vault, isReady, isLoading, error }}>
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = (): VaultContextType => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
};
