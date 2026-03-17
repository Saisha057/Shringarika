import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { adminAPI } from '../../services/api';

interface AdminNotification {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function NotificationPanel() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const isFetchingRef = useRef(false);

  const loadNotifications = async () => {
    if (isFetchingRef.current) {
      console.log('[NotificationPanel] Request already in progress, skipping');
      return;
    }

    isFetchingRef.current = true;
    try {
      console.log('[NotificationPanel] Fetching notifications...');
      const res = await adminAPI.getAdminNotifications();
      console.log('[NotificationPanel] Raw response:', res);
      const parsedItems = Array.isArray(res)
        ? res
        : (res?.notifications || res?.data?.notifications || []);
      console.log('[NotificationPanel] Items parsed:', parsedItems?.length);
      setItems(parsedItems);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = useMemo(() => items.filter((n) => n.is_read === false).length, [items]);

  useEffect(() => {
    console.log('[NotificationPanel] Unread count:', unreadCount);
    console.log('All notifications:', items.length, 'Unread:', unreadCount);
  }, [items, unreadCount]);

  const grouped = useMemo(() => {
    const bucket: Record<string, AdminNotification[]> = {};
    items.forEach((item) => {
      if (!bucket[item.type]) {
        bucket[item.type] = [];
      }
      bucket[item.type].push(item);
    });
    return bucket;
  }, [items]);

  const markAsRead = async (id: string) => {
    try {
      await adminAPI.markNotificationRead(id);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  };

  return (
    <div className="bg-white border border-neutral-300 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          <h3 className="text-sm tracking-wider font-medium">ADMIN NOTIFICATIONS</h3>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-black text-white">Unread: {unreadCount}</span>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading notifications...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-500">No notifications available.</p>
      ) : (
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {Object.entries(grouped).map(([type, groupItems]) => (
            <div key={type}>
              <p className="text-xs font-medium tracking-wider text-neutral-500 mb-2">{type}</p>
              <div className="space-y-2">
                {groupItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => markAsRead(item.id)}
                    className={`w-full text-left border rounded p-3 transition-colors ${item.is_read ? 'bg-neutral-50 border-neutral-200' : 'bg-orange-50 border-orange-200'}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-neutral-900 text-white">{item.type}</span>
                      <span className={`text-xs ${item.is_read ? 'text-neutral-500' : 'text-orange-700'}`}>
                        {item.is_read ? 'Read' : 'Unread'}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-800">{item.message}</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {new Date(item.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
