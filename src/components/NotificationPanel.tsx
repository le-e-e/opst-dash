import React from 'react';
import { useNotificationStore } from '../store/notification';
import { X, Trash2, CheckCheck, AlertCircle, CheckCircle, XCircle, Info, Bell } from 'lucide-react';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose }) => {
  const { 
    notifications, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications,
    clearOldNotifications 
  } = useNotificationStore();

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (minutes > 0) return `${minutes}분 전`;
    return '방금 전';
  };

  return (
    <div className="fixed inset-0 z-50 lg:relative lg:inset-auto">
      {/* 모바일 오버레이 */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-25 lg:hidden" 
        onClick={onClose}
      ></div>
      
      {/* 패널 */}
      <div className="absolute right-0 top-0 w-96 max-h-screen bg-white dark:bg-gray-800 shadow-xl lg:relative lg:h-auto lg:max-h-[500px] lg:rounded-lg lg:border lg:border-gray-200 dark:border-gray-700">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 lg:rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">알림</h3>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            {notifications.length > 0 && (
              <>
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="모두 읽음"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
                <button
                  onClick={clearOldNotifications}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="오래된 알림 정리"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 알림 목록 */}
        <div className="flex-1 overflow-y-auto max-h-96">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium">새로운 알림이 없습니다</p>
              <p className="text-xs mt-1">작업을 수행하면 알림이 여기에 표시됩니다</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                  className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    notification.read 
                      ? 'opacity-75' 
                      : 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-500'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <p className={`text-sm font-medium ${
                          notification.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="h-2 w-2 bg-indigo-500 rounded-full flex-shrink-0 mt-2"></span>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${
                        notification.read ? 'text-gray-500 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {getTimeAgo(notification.timestamp)}
                        </p>
                        {!notification.read && (
                          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                            새 알림
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        {notifications.length > 10 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-center bg-gray-50 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {notifications.length - 10}개의 추가 알림이 있습니다
            </p>
          </div>
        )}
        
        {notifications.length > 0 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 lg:rounded-b-lg">
            <button
              onClick={() => {
                if (confirm('모든 알림을 삭제하시겠습니까?')) {
                  clearNotifications();
                }
              }}
              className="w-full text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              모든 알림 삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel; 