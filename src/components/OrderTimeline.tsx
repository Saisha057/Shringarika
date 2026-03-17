import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { orderAPI } from '../services/api';

interface OrderTimelineProps {
  orderId: string;
}

interface TimelineEvent {
  id: string;
  event_type: string;
  description: string | null;
  created_at: string;
}

const formatEventType = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function OrderTimeline({ orderId }: OrderTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadTimeline = async () => {
      try {
        setLoading(true);
        const response = await orderAPI.getOrderTimeline(orderId);
        if (mounted) {
          setEvents(response?.data?.events || []);
        }
      } catch (error) {
        if (mounted) {
          setEvents([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadTimeline();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  if (loading) {
    return <div className="text-sm text-neutral-500">Loading timeline...</div>;
  }

  if (!events.length) {
    return <div className="text-sm text-neutral-500">No timeline events yet.</div>;
  }

  return (
    <div className="bg-neutral-50 rounded p-4">
      <p className="text-sm font-medium tracking-wider mb-3">ORDER TIMELINE</p>
      <div className="space-y-4">
        {events.map((event) => (
          <div key={event.id} className="flex gap-3">
            <CheckCircle className="w-4 h-4 text-green-600 mt-1 shrink-0" />
            <div>
              <p className="text-sm font-medium text-neutral-900">{formatEventType(event.event_type)}</p>
              <p className="text-sm text-neutral-600">{event.description || 'No details provided.'}</p>
              <p className="text-xs text-neutral-500 mt-1">
                {new Date(event.created_at).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
