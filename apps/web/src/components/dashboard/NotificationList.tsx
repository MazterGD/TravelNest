"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Check, Trash2, Info, CalendarCheck, Star, CreditCard, AlertTriangle } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { notificationService, Notification, ApiError } from "@/lib/api";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "booking_confirmed":
    case "booking_status":
      return <CalendarCheck className="w-5 h-5 text-blue-500" />;
    case "payment_received":
    case "payment_status":
      return <CreditCard className="w-5 h-5 text-green-500" />;
    case "review_received":
      return <Star className="w-5 h-5 text-yellow-500" />;
    case "system_alert":
    case "warning":
      return <AlertTriangle className="w-5 h-5 text-red-500" />;
    default:
      return <Info className="w-5 h-5 text-gray-500" />;
  }
};

export function NotificationList() {
  const t = useTranslations();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination if needed later
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Depending on API response structure, it could be the array directly or paginated
      const response = await notificationService.getAll({ page, limit });
      // @ts-ignore - Handle both array and paginated response possibilities
      const data = Array.isArray(response) ? response : (response.notifications || response.data || []);
      setNotifications(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        // Fallback text
        setError("Failed to load notifications.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [page]);

  const markAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadCount = notifications.filter(n => !n.isRead).length;
      if (unreadCount === 0) return;
      
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  if (isLoading && notifications.length === 0) {
    return (
      <div className="flex justify-center items-center py-12 text-primary">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center">
        {error}
        <button 
          onClick={fetchNotifications}
          className="ml-4 underline font-medium hover:text-red-800"
        >
          {t("dashboard.notifications.retry", { defaultValue: "Retry" })}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
          <Bell className="text-primary w-5 h-5" />
          {t("dashboard.notifications.title", { defaultValue: "Notifications" })}
        </h2>
        {notifications.some(n => !n.isRead) && (
          <button 
            onClick={markAllAsRead}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors bg-primary/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {t("dashboard.notifications.markAllRead", { defaultValue: "Mark all as read" })}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="p-12 text-center text-gray-500">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-lg font-medium text-gray-900 mb-1">
            {t("dashboard.notifications.empty", { defaultValue: "No notifications yet" })}
          </p>
          <p className="text-sm">
            {t("dashboard.notifications.emptyDesc", { defaultValue: "When you get updates, they'll show up here." })}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`p-4 sm:p-6 hover:bg-gray-50 transition-colors flex gap-4 cursor-pointer group ${!notification.isRead ? 'bg-primary/5' : ''}`}
              onClick={() => !notification.isRead && markAsRead(notification.id)}
            >
              <div className="flex-shrink-0 mt-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!notification.isRead ? 'bg-white shadow-sm' : 'bg-gray-50'}`}>
                   {getNotificationIcon(notification.type)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <h3 className={`text-base font-semibold truncate ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                    {notification.title}
                  </h3>
                  <span className="text-xs text-gray-500 whitespace-nowrap pt-1">
                    {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }).format(new Date(notification.createdAt))}
                  </span>
                </div>
                <p className={`text-sm ${!notification.isRead ? 'text-gray-800' : 'text-gray-500'} break-words`}>
                  {notification.message}
                </p>
              </div>
              <div className="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => deleteNotification(notification.id, e)}
                  title={t("dashboard.notifications.delete", { defaultValue: "Delete notification" })}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
