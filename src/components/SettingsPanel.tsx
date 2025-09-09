import React from 'react';
import { useThemeStore } from '../store/theme';
import { useKeystoneAuthStore } from '../store/keystoneAuth';
import { useNavigate } from 'react-router-dom';
import { X, Moon, Sun, LogOut } from 'lucide-react';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const { logout } = useKeystoneAuthStore();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleLogout = async () => {
    try {
      logout();
      navigate('/login');
      onClose();
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 lg:relative lg:inset-auto">
      {/* 모바일 오버레이 */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-25 lg:hidden" 
        onClick={onClose}
      ></div>
      
      {/* 패널 */}
      <div className="absolute right-0 top-0 w-80 bg-white dark:bg-gray-800 shadow-xl lg:relative lg:h-auto lg:rounded-lg lg:border lg:border-gray-200 dark:border-gray-700">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">설정</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 설정 목록 */}
        <div className="p-6 space-y-6">
          {/* 테마 설정 */}
          <div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                {isDarkMode ? (
                  <Moon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Sun className="h-6 w-6 text-yellow-500" />
                )}
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {isDarkMode ? '다크 모드' : '라이트 모드'}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isDarkMode ? '어두운 테마가 적용되어 있습니다' : '밝은 테마가 적용되어 있습니다'}
                  </p>
                </div>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isDarkMode ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDarkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 로그아웃 */}
          <div>
            <button
              onClick={handleLogout}
              className="flex items-center w-full p-4 text-left bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            >
              <LogOut className="h-6 w-6 text-red-600 dark:text-red-400 mr-3" />
              <div>
                <span className="text-sm font-medium text-red-900 dark:text-red-100">로그아웃</span>
                <p className="text-xs text-red-600 dark:text-red-400">
                  현재 세션을 종료합니다
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel; 