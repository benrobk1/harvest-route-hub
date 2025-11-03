import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DemoModeContextType {
  isDemoMode: boolean;
  dataSeeded: boolean;
  currentDemoAccount: string | null;
  enableDemoMode: () => Promise<any>;
  disableDemoMode: () => Promise<void>;
  setCurrentDemoAccount: (email: string) => void;
}

const DemoModeContext = createContext<DemoModeContextType>({
  isDemoMode: false,
  dataSeeded: false,
  currentDemoAccount: null,
  enableDemoMode: async () => ({}),
  disableDemoMode: async () => {},
  setCurrentDemoAccount: () => {},
});

export const useDemoMode = () => {
  const context = useContext(DemoModeContext);
  return context;
};

interface DemoModeProviderProps {
  children: ReactNode;
}

// Load initial state from localStorage
const getInitialDemoMode = () => {
  try {
    const storedDemoMode = localStorage.getItem('demoMode');
    if (storedDemoMode) {
      const parsed = JSON.parse(storedDemoMode);
      return {
        enabled: parsed.enabled || false,
        dataSeeded: parsed.dataSeeded || false,
        lastAccount: parsed.lastAccount || null,
      };
    }
  } catch (e) {
    console.error('Failed to parse demo mode state:', e);
  }
  return { enabled: false, dataSeeded: false, lastAccount: null };
};

export const DemoModeProvider = ({ children }: DemoModeProviderProps) => {
  const initialState = getInitialDemoMode();
  const [isDemoMode, setIsDemoMode] = useState(initialState.enabled);
  const [dataSeeded, setDataSeeded] = useState(initialState.dataSeeded);
  const [currentDemoAccount, setCurrentDemoAccount] = useState<string | null>(initialState.lastAccount);

  // Save demo mode state to localStorage whenever it changes
  useEffect(() => {
    if (isDemoMode || dataSeeded) {
      localStorage.setItem('demoMode', JSON.stringify({
        enabled: isDemoMode,
        dataSeeded,
        enabledAt: new Date().toISOString(),
        lastAccount: currentDemoAccount,
      }));
    } else {
      localStorage.removeItem('demoMode');
    }
  }, [isDemoMode, dataSeeded, currentDemoAccount]);

  const enableDemoMode = async () => {
    try {
      toast.loading('Seeding demo data...', {
        description: 'This will take 30-60 seconds. All demo accounts and data will be ready...',
      });

      // Get the current session to ensure auth token is fresh
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session. Please log in again.');
      }

      const { data, error } = await supabase.functions.invoke('seed-full-demo', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      
      setIsDemoMode(true);
      setDataSeeded(true);
      
      toast.dismiss();
      toast.success('Demo Mode Enabled!', {
        description: 'All demo accounts and data are ready.',
      });
      
      return data; // Return the data so consumers can use it
    } catch (error: any) {
      toast.dismiss();
      toast.error('Failed to enable demo mode', {
        description: error.message,
      });
      throw error;
    }
  };

  const disableDemoMode = async () => {
    try {
      toast.loading('Cleaning up demo data...', {
        description: 'Removing all demo accounts and data from the platform.',
      });

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Call cleanup edge function
        const { error } = await supabase.functions.invoke('cleanup-demo-data', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        
        if (error) {
          console.error('Error cleaning up demo data:', error);
          toast.dismiss();
          toast.error('Failed to clean up demo data', {
            description: 'Demo mode disabled, but some data may remain.',
          });
        } else {
          toast.dismiss();
          toast.success('Demo Data Cleaned', {
            description: 'All demo accounts and data have been removed.',
          });
        }
      }
    } catch (error: any) {
      console.error('Error during demo cleanup:', error);
      toast.dismiss();
      toast.error('Cleanup error', {
        description: error.message,
      });
    } finally {
      setIsDemoMode(false);
      setCurrentDemoAccount(null);
      
      // Sign out current user
      await supabase.auth.signOut();
    }
  };

  return (
    <DemoModeContext.Provider
      value={{
        isDemoMode,
        dataSeeded,
        currentDemoAccount,
        enableDemoMode,
        disableDemoMode,
        setCurrentDemoAccount,
      }}
    >
      {children}
    </DemoModeContext.Provider>
  );
};
