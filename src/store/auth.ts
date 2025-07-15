import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import authService, { AuthToken, LoginCredentials } from '../services/auth';

interface AuthState {
  isAuthenticated: boolean;
  user: AuthToken['user'] | null;
  project: AuthToken['project'] | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      project: null,
      token: null,
      loading: false,
      error: null,

      login: async (credentials) => {
        set({ loading: true, error: null });
        try {
          const authData = await authService.login(credentials);
          set({
            isAuthenticated: true,
            user: authData.user,
            project: authData.project,
            token: authData.token,
            loading: false,
            error: null
          });
        } catch (error) {
          set({
            isAuthenticated: false,
            user: null,
            project: null,
            token: null,
            loading: false,
            error: error instanceof Error ? error.message : '로그인에 실패했습니다.'
          });
          throw error;
        }
      },

      logout: async () => {
        set({ loading: true });
        try {
          await authService.logout();
          set({
            isAuthenticated: false,
            user: null,
            project: null,
            token: null,
            loading: false,
            error: null
          });
        } catch (error) {
          console.error('로그아웃 실패:', error);
          // 로그아웃 실패해도 상태는 초기화
          set({
            isAuthenticated: false,
            user: null,
            project: null,
            token: null,
            loading: false,
            error: null
          });
        }
      },

      checkAuth: () => {
        const isAuth = authService.isAuthenticated();
        const token = authService.getToken();
        
        if (isAuth && token) {
          set({ 
            isAuthenticated: true,
            token: token
          });
        } else {
          set({
            isAuthenticated: false,
            user: null,
            project: null,
            token: null
          });
        }
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        project: state.project,
        token: state.token
      })
    }
  )
); 