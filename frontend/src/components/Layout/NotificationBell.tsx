import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellDot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../../services/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  BCC_MEETING_SCHEDULED:  '📅',
  BCC_MEETING_STARTED:    '▶️',
  BCC_SESSION_PRESENTING: '🎤',
  BCC_VOTE_CAST:          '✅',
  BCC_FLAG_RAISED:        '🚩',
  BCC_DECISION_MADE:      '⚖️',
  BCC_CONDITION_DUE:      '📋',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function entityPath(notification: Notification): string | null {
  if (!notification.entityId) return null;
  if (notification.entityType === 'BccMeeting') return `/bcc/meetings/${notification.entityId}`;
  if (notification.entityType === 'BccSession') return `/bcc/${notification.entityId}`;
  return null;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Poll unread count every 30s
  const { data: countData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: notificationApi.getUnreadCount,
    refetchInterval: 30_000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationApi.list,
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });

  const markReadMutation = useMutation({
    mutationFn: (ids: string[]) => notificationApi.markRead(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unread = countData?.count ?? 0;
  const items: Notification[] = notifications ?? [];

  function handleClick(n: Notification) {
    if (!n.isRead) markReadMutation.mutate([n.id]);
    const path = entityPath(n);
    if (path) { navigate(path); setOpen(false); }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
        aria-label="Notifications"
      >
        {unread > 0 ? (
          <>
            <BellDot className="h-5 w-5" />
            <span className="absolute top-0.5 right-0.5 min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
              {unread > 99 ? '99+' : unread}
            </span>
          </>
        ) : (
          <Bell className="h-5 w-5" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-xl border z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-gray-800 text-sm">Notifications</h3>
            {unread > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No notifications</p>
            ) : (
              items.slice(0, 15).map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition-colors ${
                    !n.isRead ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5">{TYPE_ICON[n.type] ?? '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {n.title}
                      </p>
                      {n.body && <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>}
                      <p className="text-xs text-gray-400 mt-1">{relativeTime(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
