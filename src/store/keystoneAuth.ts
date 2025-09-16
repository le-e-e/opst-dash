import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import authService, { AuthToken, LoginCredentials } from '../services/auth';
import keystoneService, { KeystoneUser, KeystoneProject, CreateUserRequest } from '../services/keystone';

interface ProjectScope {
  id: string;
  name: string;
  domain: {
    id: string;
    name: string;
  };
}

interface UserInfo {
  id: string;
  name: string;
  domain: {
    id: string;
    name: string;
  };
}

interface KeystoneAuthState {
  // 인증 상태
  isAuthenticated: boolean;
  user: UserInfo | null;
  currentProject: ProjectScope | null;
  token: string | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;

  // 관리자용 데이터
  allUsers: KeystoneUser[];
  allProjects: KeystoneProject[];
  availableProjects: KeystoneProject[];

  // 재시도 카운터
  loadUsersRetryCount: number;
  loadProjectsRetryCount: number;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  switchProject: (projectId: string) => Promise<void>;
  checkAuth: () => void;
  clearError: () => void;

  // 관리자 기능
  loadUsers: () => Promise<void>;
  loadProjects: () => Promise<void>;
  loadAvailableProjects: () => Promise<void>;
  createUser: (userData: CreateUserRequest, projectName?: string) => Promise<{ user: KeystoneUser; project?: KeystoneProject }>;
  deleteUser: (userId: string) => Promise<void>;
  createProject: (projectData: { name: string; description?: string }) => Promise<KeystoneProject>;
  deleteProject: (projectId: string) => Promise<void>;
  assignUserToProject: (userId: string, projectId: string) => Promise<void>;

  // 회원가입 및 승인 관련
  registerUser: (userData: { name: string; password: string; username: string }) => Promise<{ success: boolean; message: string }>;
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  loadPendingUsers: () => KeystoneUser[];

  // 유틸리티
  getCurrentProjectId: () => string | null;
  canAccessAllProjects: () => boolean;
  refreshAuth: () => Promise<void>;
}

export const useKeystoneAuthStore = create<KeystoneAuthState>()(
  persist(
    (set, get) => ({
      // 초기 상태
      isAuthenticated: false,
      user: null,
      currentProject: null,
      token: null,
      isAdmin: false,
      loading: false,
      error: null,
      allUsers: [],
      allProjects: [],
      availableProjects: [],
      loadUsersRetryCount: 0,
      loadProjectsRetryCount: 0,

      login: async (credentials) => {
        set({ loading: true, error: null });
        
        try {
          const authData = await authService.login(credentials);
          
          // 관리자 권한 확인 - admin 사용자만 관리자
          const isAdminUser = authData.user.name === 'admin';
          
          set({
            isAuthenticated: true,
            user: authData.user,
            currentProject: authData.project,
            token: authData.token,
            isAdmin: isAdminUser,
            loading: false,
            error: null
          });

          // 관리자인 경우 전체 데이터 로드
          if (isAdminUser) {
            get().loadUsers();
            get().loadProjects();
          }
          
          // 사용 가능한 프로젝트 목록 로드
          get().loadAvailableProjects();

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '로그인에 실패했습니다.';
          set({
            isAuthenticated: false,
            user: null,
            currentProject: null,
            token: null,
            isAdmin: false,
            loading: false,
            error: errorMessage
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
            currentProject: null,
            token: null,
            isAdmin: false,
            loading: false,
            error: null,
            allUsers: [],
            allProjects: [],
            availableProjects: [],
            loadUsersRetryCount: 0,
            loadProjectsRetryCount: 0
          });
        } catch (error) {
          console.error('로그아웃 실패:', error);
          // 로그아웃 실패해도 상태는 초기화
          set({
            isAuthenticated: false,
            user: null,
            currentProject: null,
            token: null,
            isAdmin: false,
            loading: false,
            error: null,
            allUsers: [],
            allProjects: [],
            availableProjects: [],
            loadUsersRetryCount: 0,
            loadProjectsRetryCount: 0
          });
        }
      },

      switchProject: async (projectId) => {
        set({ loading: true });
        
        try {
          const state = get();
          if (!state.user) {
            throw new Error('로그인이 필요합니다.');
          }

          // 새 프로젝트로 토큰 재발급
          const tokenData = await keystoneService.getTokenForProject(projectId);
          
          set({
            currentProject: tokenData.data.token.project,
            token: tokenData.token,
            loading: false,
            error: null
          });

          // 로컬 스토리지 업데이트
          localStorage.setItem('openstack_token', tokenData.token);
          localStorage.setItem('openstack_token_expires', tokenData.data.token.expires_at);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '프로젝트 전환에 실패했습니다.';
          set({ loading: false, error: errorMessage });
          throw error;
        }
      },

      checkAuth: () => {
        const isAuth = authService.isAuthenticated();
        const token = authService.getToken();
        
        if (isAuth && token) {
          // 저장된 인증 정보 복원
          const state = get();
          if (state.user && state.currentProject) {
            set({ 
              isAuthenticated: true,
              token: token
            });
            
            // 관리자인 경우 데이터 로드
            if (state.isAdmin) {
              get().loadUsers();
              get().loadProjects();
            }
            get().loadAvailableProjects();
          }
        } else {
          set({
            isAuthenticated: false,
            user: null,
            currentProject: null,
            token: null,
            isAdmin: false,
            allUsers: [],
            allProjects: [],
            availableProjects: [],
            loadUsersRetryCount: 0,
            loadProjectsRetryCount: 0
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      // 관리자 기능들
      loadUsers: async () => {
        const state = get();
        const maxRetries = 3;
        
        if (state.loadUsersRetryCount >= maxRetries) {
          console.error('사용자 목록 로드 최대 재시도 횟수 초과');
          set({ 
            error: '사용자 목록을 불러오는데 실패했습니다. (최대 재시도 횟수 초과)',
            loadUsersRetryCount: 0 // 카운터 리셋
          });
          return;
        }

        try {
          const usersData = await keystoneService.getUsers();
          set({ 
            allUsers: usersData.users || [],
            loadUsersRetryCount: 0 // 성공 시 카운터 리셋
          });
        } catch (error) {
          console.error(`사용자 목록 로드 실패 (${state.loadUsersRetryCount + 1}/${maxRetries}):`, error);
          set({ 
            error: `사용자 목록을 불러오는데 실패했습니다. (${state.loadUsersRetryCount + 1}/${maxRetries})`,
            loadUsersRetryCount: state.loadUsersRetryCount + 1
          });
        }
      },

      loadProjects: async () => {
        const state = get();
        const maxRetries = 3;
        
        if (state.loadProjectsRetryCount >= maxRetries) {
          console.error('프로젝트 목록 로드 최대 재시도 횟수 초과');
          set({ 
            error: '프로젝트 목록을 불러오는데 실패했습니다. (최대 재시도 횟수 초과)',
            loadProjectsRetryCount: 0 // 카운터 리셋
          });
          return;
        }

        try {
          const projectsData = await keystoneService.getProjects();
          set({ 
            allProjects: projectsData.projects || [],
            loadProjectsRetryCount: 0 // 성공 시 카운터 리셋
          });
        } catch (error) {
          console.error(`프로젝트 목록 로드 실패 (${state.loadProjectsRetryCount + 1}/${maxRetries}):`, error);
          set({ 
            error: `프로젝트 목록을 불러오는데 실패했습니다. (${state.loadProjectsRetryCount + 1}/${maxRetries})`,
            loadProjectsRetryCount: state.loadProjectsRetryCount + 1
          });
        }
      },

      loadAvailableProjects: async () => {
        try {
          const projectsData = await keystoneService.getCurrentUserProjects();
          set({ availableProjects: projectsData.projects || [] });
        } catch (error) {
          console.error('사용 가능한 프로젝트 목록 로드 실패:', error);
        }
      },

      createUser: async (userData, projectName) => {
        set({ loading: true });
        
        try {
          const result = await keystoneService.createUserWithProject(userData, projectName);
          
          // 사용자 목록 새로고침
          await get().loadUsers();
          if (result.project) {
            await get().loadProjects();
          }
          
          set({ loading: false, error: null });
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '사용자 생성에 실패했습니다.';
          set({ loading: false, error: errorMessage });
          throw error;
        }
      },

      deleteUser: async (userId) => {
        set({ loading: true });
        
        try {
          await keystoneService.deleteUser(userId);
          await get().loadUsers();
          set({ loading: false, error: null });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '사용자 삭제에 실패했습니다.';
          set({ loading: false, error: errorMessage });
          throw error;
        }
      },

      createProject: async (projectData) => {
        set({ loading: true });
        
        try {
          const result = await keystoneService.createProject(projectData);
          await get().loadProjects();
          set({ loading: false, error: null });
          return result.project;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '프로젝트 생성에 실패했습니다.';
          set({ loading: false, error: errorMessage });
          throw error;
        }
      },

      deleteProject: async (projectId) => {
        set({ loading: true });
        
        try {
          await keystoneService.deleteProject(projectId);
          await get().loadProjects();
          set({ loading: false, error: null });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '프로젝트 삭제에 실패했습니다.';
          set({ loading: false, error: errorMessage });
          throw error;
        }
      },

      assignUserToProject: async (userId, projectId) => {
        set({ loading: true });
        
        try {
          // member 역할 찾기
          const memberRole = await keystoneService.getRoleByName('member');
          if (!memberRole) {
            throw new Error('member 역할을 찾을 수 없습니다.');
          }
          
          // 역할 할당
          await keystoneService.assignRoleToUserOnProject(userId, projectId, memberRole.id);
          set({ loading: false, error: null });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '사용자 할당에 실패했습니다.';
          set({ loading: false, error: errorMessage });
          throw error;
        }
      },

      // 회원가입 (서버 저장 - 비활성화 상태)
      registerUser: async (userData: {
        name: string;
        password: string;
        username: string;
      }) => {
        set({ loading: true });
        
        try {
          console.log('🔍 서버 기반 회원가입 시작:', userData);
          
          // 입력 데이터 유효성 검사
          if (!userData.name?.trim()) {
            throw new Error('이름을 입력해주세요.');
          }
          if (!userData.username?.trim()) {
            throw new Error('아이디를 입력해주세요.');
          }
          if (!userData.password?.trim()) {
            throw new Error('비밀번호를 입력해주세요.');
          }
          if (userData.password.length < 6) {
            throw new Error('비밀번호는 최소 6자 이상이어야 합니다.');
          }
          
          // Keystone 서버에 비활성화 상태로 사용자 생성
          const result = await keystoneService.registerUser({
            name: userData.name.trim(),
            password: userData.password,
            username: userData.username.trim()
          });
          
          console.log('✅ 서버에 회원가입 완료:', result);
          
          set({ loading: false, error: null });
          return { 
            success: true, 
            message: `회원가입이 완료되었습니다. 사용자명 "${userData.username}"로 관리자 승인을 기다려주세요.`,
            user: result.user
          };
        } catch (error: any) {
          console.error('❌ 회원가입 실패:', error);
          
          let errorMessage = '회원가입에 실패했습니다.';
          
          // 더 구체적인 오류 메시지 처리
          if (error?.message) {
            if (error.message.includes('Conflict') || error.message.includes('409')) {
              errorMessage = `사용자명 "${userData.username}"이 이미 존재합니다. 다른 아이디를 시도해주세요.`;
            } else if (error.message.includes('Bad Request') || error.message.includes('400')) {
              errorMessage = '입력 정보가 올바르지 않습니다. 아이디는 영문, 숫자, 언더스코어만 사용 가능합니다.';
            } else if (error.message.includes('Unauthorized') || error.message.includes('401')) {
              errorMessage = '관리자 인증에 실패했습니다. 시스템 관리자에게 문의하세요.';
            } else if (error.message.includes('Network Error') || error.message.includes('Failed to fetch')) {
              errorMessage = 'OpenStack 서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
            } else {
              errorMessage = error.message;
            }
          }
          
          set({ loading: false, error: errorMessage });
          throw new Error(errorMessage);
        }
      },

      // 사용자 승인 (로컬 대기 → OpenStack 생성)
      approveUser: async (pendingUserId: string) => {
        set({ loading: true });
        
        try {
          console.log('🔍 사용자 승인 시작:', pendingUserId);
          
          // 로컬 대기 사용자를 OpenStack에 실제 생성
          const keystoneUser = await keystoneService.approveUserRegistration(pendingUserId);
          console.log('✅ OpenStack 사용자 생성 완료:', keystoneUser.user.name);
          
          // 개인 프로젝트 생성 및 역할 할당
          try {
            console.log('개인 프로젝트 생성 및 역할 할당 시작...');
            
            // 사용자명으로 개인 프로젝트 생성
            const personalProject = await keystoneService.createProject({
              name: keystoneUser.user.name,
              description: `${keystoneUser.user.description || keystoneUser.user.name}님의 개인 프로젝트`
            });
            console.log('개인 프로젝트 생성 완료:', personalProject.project.name);

            // member 역할 찾기
            const memberRole = await keystoneService.getRoleByName('member');
            console.log('member 역할:', memberRole);
            
            if (!memberRole) {
              throw new Error('member 역할을 찾을 수 없습니다.');
            }

            // 사용자를 개인 프로젝트에 member 역할로 할당
            console.log(`역할 할당 시도: 사용자 ${keystoneUser.user.id} → 프로젝트 ${personalProject.project.id} → 역할 ${memberRole.id}`);
            
            await keystoneService.assignRoleToUserOnProject(
              keystoneUser.user.id, 
              personalProject.project.id, 
              memberRole.id
            );

            console.log(`✅ 성공! 사용자 ${keystoneUser.user.name}에게 개인 프로젝트 ${keystoneUser.user.name} 생성 및 할당 완료`);
          } catch (roleError) {
            console.error('❌ 개인 프로젝트 생성/할당 실패:', roleError);
            throw new Error('사용자 개인 프로젝트 생성에 실패했습니다.');
          }
          
          await get().loadUsers();
          set({ loading: false, error: null });
          return keystoneUser;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '사용자 승인에 실패했습니다.';
          set({ loading: false, error: errorMessage });
          throw error;
        }
      },

      rejectUser: async (pendingUserId: string) => {
        set({ loading: true });
        
        try {
          console.log('🔍 사용자 거부 시작:', pendingUserId);
          
          // 로컬 스토리지에서 제거
          await keystoneService.rejectUserRegistration(pendingUserId);
          console.log('✅ 사용자 거부 완료');
          
          set({ loading: false, error: null });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '사용자 거부에 실패했습니다.';
          set({ loading: false, error: errorMessage });
          throw error;
        }
      },

      // 대기 중인 사용자 목록 조회 (로컬 스토리지 + 파일 기반)
      loadPendingUsers: () => {
        try {
          console.log('🔍 로컬 스토리지에서 대기 중인 사용자 로드 시작');
          const pendingUsers = keystoneService.getLocalPendingUsers();
          console.log('🔍 로컬에서 로드된 대기 중인 사용자:', pendingUsers);
          return pendingUsers;
        } catch (error) {
          console.error('대기 중인 사용자 목록 로드 실패:', error);
          set({ error: '대기 중인 사용자 목록을 불러오는데 실패했습니다.' });
          return [];
        }
      },

      // 유틸리티 함수들
      getCurrentProjectId: () => {
        const state = get();
        return state.currentProject?.id || null;
      },

      canAccessAllProjects: () => {
        const state = get();
        return state.isAdmin;
      },

      refreshAuth: async () => {
        const state = get();
        if (state.isAuthenticated && state.user) {
          try {
            // 관리자 권한 재확인
            const isAdminUser = await keystoneService.isUserAdmin(state.user.id);
            set({ isAdmin: isAdminUser });
            
            if (isAdminUser) {
              get().loadUsers();
              get().loadProjects();
            }
            get().loadAvailableProjects();
          } catch (error) {
            console.error('인증 정보 새로고침 실패:', error);
          }
        }
      }
    }),
    {
      name: 'keystone-auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        currentProject: state.currentProject,
        token: state.token,
        isAdmin: state.isAdmin
      })
    }
  )
); 