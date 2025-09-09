import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useKeystoneAuthStore } from '../store/keystoneAuth';
import { useNotificationStore } from '../store/notification';
import { useThemeStore } from '../store/theme';
import NotificationPanel from './NotificationPanel';
import SettingsPanel from './SettingsPanel';
import {
  Cloud,
  Home,
  Server,
  Network,
  HardDrive,
  Image,
  User,
  Settings,
  Bell,
  Menu,
  X,
  Crown
} from 'lucide-react';
import { useState, useEffect } from 'react';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const { 
    user, 
    isAdmin
  } = useKeystoneAuthStore();
  const { unreadCount } = useNotificationStore();
  const { isDarkMode } = useThemeStore();
  const location = useLocation();

  // 다크모드 클래스 적용
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // 기본 네비게이션
  const baseNavigation = [
    { name: '대시보드', href: '/dashboard', icon: Home },
    { name: '가상머신', href: '/compute', icon: Server },
    { name: '네트워크', href: '/network', icon: Network },
    { name: '볼륨', href: '/volume', icon: HardDrive },
    { name: '이미지', href: '/images', icon: Image },
  ];

  // 관리자 전용 네비게이션
  const adminNavigation = [
    { name: '시스템 관리', href: '/admin', icon: Crown },
  ];

  // 역할에 따른 네비게이션 구성
  const navigation = isAdmin ? [...baseNavigation, ...adminNavigation] : baseNavigation;

  const getPageTitle = () => {
    const currentNav = navigation.find(nav => nav.href === location.pathname);
    return currentNav?.name || 'OpenStack Dashboard';
  };

  const renderUserBadge = () => {
    if (!user) return null;
    
    return (
      <div className="flex items-center space-x-2">
        <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-1">
          {isAdmin ? (
            <Crown className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          ) : (
            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          isAdmin 
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' 
            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
        }`}>
          {isAdmin ? '관리자' : '사용자'}
        </span>
      </div>
    );
  };

  const NavigationMenu = ({ isMobile = false }) => (
    <nav className="space-y-2">
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;
        const isAdminOnly = adminNavigation.some(nav => nav.href === item.href);
        
        return (
          <Link
            key={item.name}
            to={item.href}
            className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 border-r-2 border-blue-500'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            } ${isAdminOnly ? 'relative' : ''}`}
            onClick={isMobile ? () => setSidebarOpen(false) : undefined}
          >
            <Icon className="h-5 w-5 mr-3" />
            {item.name}
            {isAdminOnly && (
              <Crown className="h-3 w-3 ml-auto text-purple-500 dark:text-purple-400" />
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* 모바일 사이드바 */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} fixed inset-0 z-50 lg:hidden`}>
        <div className="absolute inset-0 bg-gray-600 opacity-75" onClick={() => setSidebarOpen(false)}></div>
        <nav className="relative flex flex-col w-64 h-full bg-white dark:bg-gray-800 shadow-lg">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Cloud className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <span className="ml-3 text-lg font-semibold text-gray-900 dark:text-gray-100">OpenStack</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {/* 사용자 정보 (모바일) */}
          {user && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-2">
                  <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.domain.name} 도메인</p>
                </div>
                {renderUserBadge()}
              </div>
            </div>
          )}
          
          <div className="flex-1 px-4 py-6">
            <NavigationMenu isMobile={true} />
          </div>
        </nav>
      </div>

      {/* 데스크톱 사이드바 */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64 bg-white dark:bg-gray-800 shadow-lg">
          <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <Cloud className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <span className="ml-3 text-lg font-semibold text-gray-900 dark:text-gray-100">OpenStack</span>
          </div>
          
          {/* 사용자 정보 (데스크톱) */}
          {user && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-2">
                  <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.domain.name} 도메인</p>
                </div>
              </div>
              <div className="mb-3">
                {renderUserBadge()}
              </div>
            </div>
          )}
          
          <div className="flex-1 px-4 py-6">
            <NavigationMenu />
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col">
        {/* 상단 헤더 */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="ml-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {getPageTitle()}
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* 알림 버튼 */}
              <div className="relative">
                <button 
                  onClick={() => {
                    setShowNotificationPanel(!showNotificationPanel);
                    setShowSettingsPanel(false);
                  }}
                  className="relative p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Bell className="h-6 w-6" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {showNotificationPanel && (
                  <div className="absolute right-0 top-full mt-2 z-50">
                    <NotificationPanel 
                      isOpen={showNotificationPanel} 
                      onClose={() => setShowNotificationPanel(false)} 
                    />
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isAdmin ? '시스템 관리자' : '사용자'}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {/* 설정 버튼 */}
                  <div className="relative">
                    <button 
                      onClick={() => {
                        setShowSettingsPanel(!showSettingsPanel);
                        setShowNotificationPanel(false);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                    {showSettingsPanel && (
                      <div className="absolute right-0 top-full mt-2 z-50">
                        <SettingsPanel 
                          isOpen={showSettingsPanel} 
                          onClose={() => setShowSettingsPanel(false)} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout; 