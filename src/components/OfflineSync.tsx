import { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Wifi, WifiOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
// Temporarily disabled problematic sonner import
// import { toast } from 'sonner@2.0.3';

interface OfflineSyncProps {
  pendingChanges: number;
  onSync: () => Promise<void>;
}

export function OfflineSync({ pendingChanges, onSync }: OfflineSyncProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('Connection restored');
      
      // Auto-sync when coming back online if there are pending changes
      if (pendingChanges > 0) {
        handleSync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('Connection lost - working offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingChanges]);

  const handleSync = async () => {
    if (!isOnline) {
      console.log('Cannot sync while offline');
      return;
    }

    setIsSyncing(true);
    try {
      await onSync();
      setLastSyncTime(new Date());
      console.log('Data synced successfully');
    } catch (error) {
      console.log('Sync failed - will retry automatically');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-shrink-0">
              {isOnline ? (
                <Wifi className="size-4 sm:size-5 text-green-600" />
              ) : (
                <WifiOff className="size-4 sm:size-5 text-red-600" />
              )}
              <span className="font-medium text-sm sm:text-base">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <div className="flex items-center gap-2 min-w-0">
              {pendingChanges > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <AlertCircle className="size-3 flex-shrink-0" />
                  <span className="hidden xs:inline">{pendingChanges} pending</span>
                  <span className="xs:hidden">{pendingChanges}</span>
                </Badge>
              )}
              
              {lastSyncTime && (
                <span className="text-xs sm:text-sm text-muted-foreground truncate">
                  <span className="hidden sm:inline">Last sync: </span>
                  {formatLastSync(lastSyncTime)}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {isOnline && pendingChanges > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
                className="text-xs sm:text-sm"
              >
                {isSyncing ? (
                  <RefreshCw className="size-3 sm:size-4 mr-1 sm:mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="size-3 sm:size-4 mr-1 sm:mr-2" />
                )}
                <span className="hidden sm:inline">Sync Now</span>
                <span className="sm:hidden">Sync</span>
              </Button>
            )}
            
            {isOnline && pendingChanges === 0 && (
              <div className="flex items-center text-green-600 text-xs sm:text-sm">
                <Check className="size-3 sm:size-4 mr-1" />
                <span className="hidden sm:inline">Up to date</span>
                <span className="sm:hidden">✓</span>
              </div>
            )}
          </div>
        </div>
        
        {!isOnline && (
          <div className="mt-2 text-xs sm:text-sm text-muted-foreground">
            Changes will be saved locally and synced when connection is restored.
          </div>
        )}
      </CardContent>
    </Card>
  );
}