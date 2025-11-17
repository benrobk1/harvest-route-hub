import { supabase } from '@/integrations/supabase/client';

/**
 * Request notification permission and save subscription
 */
export const requestNotificationPermission = async (userId: string): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    // Register service worker
    await navigator.serviceWorker.ready;

    // Note: For full push notification support, you need:
    // 1. A valid VAPID public key
    // 2. Service worker with push event listener
    // 3. Backend to send notifications
    
    // For now, we'll just save that notifications are enabled
    await supabase
      .from('profiles')
      .update({ 
        push_subscription: { 
          enabled: true,
          timestamp: new Date().toISOString()
        } 
      })
      .eq('id', userId);

    console.log('Notification permission granted');
    return true;
  } catch (error: unknown) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
};

/**
 * Check if notifications are enabled for user
 */
export const areNotificationsEnabled = async (userId: string): Promise<boolean> => {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('push_subscription')
      .eq('id', userId)
      .single();

    if (!data?.push_subscription || typeof data.push_subscription !== 'object') {
      return false;
    }

    return (data.push_subscription as { enabled?: boolean }).enabled === true;
  } catch (error: unknown) {
    console.error('Failed to check notification status:', error);
    return false;
  }
};

/**
 * Show local notification (for demo purposes)
 */
export const showLocalNotification = (title: string, body: string): void => {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    });
  }
};
