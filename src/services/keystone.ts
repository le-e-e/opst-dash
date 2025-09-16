import axios from 'axios';
import { OPENSTACK_ENDPOINTS } from '../config/endpoints';
import authService from './auth';

// Keystone 엔티티 인터페이스들
export interface KeystoneUser {
  id: string;
  name: string;
  email?: string;
  enabled: boolean;
  domain_id: string;
  description?: string;
  password_expires_at?: string;
}

export interface KeystoneProject {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  domain_id: string;
  is_domain: boolean;
  parent_id?: string;
  tags: string[];
}

export interface KeystoneRole {
  id: string;
  name: string;
  description?: string;
  domain_id?: string;
}

export interface CreateUserRequest {
  name: string;
  password: string;
  email?: string;
  description?: string;
  enabled?: boolean;
  domain_id?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  enabled?: boolean;
  domain_id?: string;
}

class KeystoneService {
  private async makeRequest(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET', data?: any) {
    const headers = authService.getAuthHeaders();
    
    try {
      const response = await axios({
        method,
        url: `${OPENSTACK_ENDPOINTS.KEYSTONE}${path}`,
        headers,
        data
      });
      return response.data;
    } catch (error) {
      console.error(`Keystone API 요청 실패: ${method} ${path}`, error);
      throw error;
    }
  }

  // 프로젝트 관리
  async getProjects() {
    return this.makeRequest('/projects');
  }

  async getProject(projectId: string) {
    return this.makeRequest(`/projects/${projectId}`);
  }

  async createProject(projectData: CreateProjectRequest) {
    const payload = {
      project: {
        domain_id: projectData.domain_id || 'default',
        enabled: projectData.enabled !== false,
        name: projectData.name,
        description: projectData.description || `${projectData.name} 프로젝트`
      }
    };
    return this.makeRequest('/projects', 'POST', payload);
  }

  async updateProject(projectId: string, projectData: Partial<CreateProjectRequest>) {
    const payload = {
      project: projectData
    };
    return this.makeRequest(`/projects/${projectId}`, 'PATCH', payload);
  }

  async deleteProject(projectId: string) {
    return this.makeRequest(`/projects/${projectId}`, 'DELETE');
  }

  // 사용자 관리
  async getUsers() {
    return this.makeRequest('/users');
  }

  async getUser(userId: string) {
    return this.makeRequest(`/users/${userId}`);
  }

  async createUser(userData: CreateUserRequest) {
    const payload = {
      user: {
        domain_id: userData.domain_id || 'default',
        enabled: userData.enabled !== false,
        name: userData.name,
        password: userData.password,
        email: userData.email,
        description: userData.description || `${userData.name} 사용자 계정`
      }
    };
    return this.makeRequest('/users', 'POST', payload);
  }

  async updateUser(userId: string, userData: Partial<CreateUserRequest>) {
    const payload = {
      user: userData
    };
    return this.makeRequest(`/users/${userId}`, 'PATCH', payload);
  }

  async deleteUser(userId: string) {
    return this.makeRequest(`/users/${userId}`, 'DELETE');
  }

  async changeUserPassword(userId: string, newPassword: string, originalPassword?: string) {
    const payload = {
      user: {
        password: newPassword,
        ...(originalPassword && { original_password: originalPassword })
      }
    };
    return this.makeRequest(`/users/${userId}`, 'PATCH', payload);
  }

  // 연결 테스트
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${OPENSTACK_ENDPOINTS.KEYSTONE}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('OpenStack 연결 테스트:', response.status, response.statusText);
      return response.status < 500; // 4xx도 괜찮음 (인증 에러는 정상)
    } catch (error) {
      console.error('OpenStack 연결 실패:', error);
      return false;
    }
  }

  // 관리자 토큰으로 임시 인증 (회원가입용)
  async getAdminToken(): Promise<string> {
    const authData = {
      auth: {
        identity: {
          methods: ['password'],
          password: {
            user: {
              name: 'admin',
              password: 'qR9oiHHohOK1UMq6EmKCDXJwttooNp0uB4T4yeMe',
              domain: { name: 'Default' }
            }
          }
        },
        scope: {
          project: {
            name: 'admin',
            domain: { name: 'Default' }
          }
        }
      }
    };

    const response = await fetch(`${OPENSTACK_ENDPOINTS.KEYSTONE}/auth/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(authData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('관리자 인증 실패:', response.status, errorText);
      throw new Error(`관리자 인증에 실패했습니다: ${response.status} ${errorText}`);
    }

    const token = response.headers.get('X-Subject-Token');
    if (!token) {
      throw new Error('토큰을 받지 못했습니다.');
    }

    return token;
  }

  // 임시 파일 기반 회원가입 (크로스 네트워크 대응)
  async registerUser(userData: {
    name: string;
    password: string;
    username: string;
  }) {
    try {
      console.log('🔍 임시 파일 기반 회원가입 시작:', userData);
      
      // 브라우저에서 파일 다운로드로 회원가입 정보 저장
      const newUser = {
        id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: userData.name.trim(),
        username: userData.username.trim(),
        password: userData.password, // 실제로는 해시화 필요
        email: userData.username.trim(),
        description: `${userData.name.trim()} - Pending approval`,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        enabled: false,
        domain: { id: 'default', name: 'Default' },
        browser: navigator.userAgent,
        timestamp: Date.now()
      };

      // 기존 대기 사용자 목록 가져오기
      const existingUsers = this.getLocalPendingUsers();
      
      // 중복 확인
      const isDuplicate = existingUsers.some(user => 
        user && user.username === userData.username.trim()
      );
      
      if (isDuplicate) {
        throw new Error(`사용자명 "${userData.username}"이 이미 존재합니다.`);
      }

      // 새 사용자 추가
      const updatedUsers = [...existingUsers, newUser];
      
      // 로컬 스토리지에 저장
      localStorage.setItem('pending-users', JSON.stringify(updatedUsers));
      
      // JSON 파일로 다운로드 (관리자가 다른 네트워크에서 확인 가능)
      const dataStr = JSON.stringify(newUser, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `회원가입요청_${userData.username}_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ 임시 파일 기반 회원가입 완료:', newUser);
      
      return {
        user: newUser,
        success: true,
        message: `회원가입 요청이 완료되었습니다. 다운로드된 JSON 파일을 관리자에게 전달해주세요.`
      };
    } catch (error: any) {
      console.error('❌ 임시 파일 회원가입 실패:', error);
      
      if (error.message) {
        throw error;
      } else {
        throw new Error('회원가입 처리 중 오류가 발생했습니다.');
      }
    }
  }

  // 서버에서 승인 대기 중인 사용자 목록 가져오기
  async getServerPendingUsers(): Promise<any[]> {
    try {
      console.log('🔍 서버에서 대기 사용자 목록 조회 시작');
      
      const response = await fetch('/api/queue/pending-users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`서버 응답 오류: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || '대기 사용자 목록 조회에 실패했습니다.');
      }

      console.log('✅ 서버 대기 사용자 목록 로드:', result.users.length, '명');
      return result.users || [];
    } catch (error: any) {
      console.error('❌ 서버 대기 사용자 조회 실패:', error);
      
      if (error.message.includes('Failed to fetch')) {
        console.warn('서버에 연결할 수 없음, 빈 배열 반환');
        return [];
      }
      
      throw error;
    }
  }

  // 레거시 호환용 (로컬 스토리지)
  getLocalPendingUsers(): any[] {
    try {
      const stored = localStorage.getItem('pending-users');
      if (!stored) {
        return [];
      }
      
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('로컬 대기 사용자 목록 파싱 실패:', error);
      localStorage.removeItem('pending-users');
      return [];
    }
  }

  // 특정 사용자 승인 (서버에서 제거 + OpenStack 생성)
  async approveUserRegistration(pendingUserId: string) {
    try {
      console.log('🔍 사용자 승인 시작:', pendingUserId);
      
      // 1. 서버에서 승인 처리 (대기 목록에서 제거)
      const approveResponse = await fetch(`/api/queue/approve-user/${pendingUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!approveResponse.ok) {
        const errorResult = await approveResponse.json();
        throw new Error(errorResult.message || '서버에서 사용자 승인에 실패했습니다.');
      }

      const approveResult = await approveResponse.json();
      const userToApprove = approveResult.user;
      
      console.log('✅ 서버에서 사용자 승인 완료:', userToApprove.username);
      
      // 2. OpenStack에 실제 사용자 생성
      const adminToken = await this.getAdminToken();
      
      const payload = {
        user: {
          domain_id: 'default',
          enabled: true, // 승인된 사용자는 활성화 상태
          name: userToApprove.username,
          password: userToApprove.password || 'temp_password_' + Date.now(), // 임시 비밀번호
          email: userToApprove.email,
          description: `${userToApprove.name} - Approved user`
        }
      };

      const keystoneResponse = await fetch(`${OPENSTACK_ENDPOINTS.KEYSTONE}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': adminToken,
        },
        body: JSON.stringify(payload),
      });

      if (!keystoneResponse.ok) {
        const errorText = await keystoneResponse.text();
        throw new Error(`OpenStack 사용자 생성 실패: ${errorText}`);
      }

      const keystoneUser = await keystoneResponse.json();
      
      console.log('✅ OpenStack 사용자 생성 완료:', {
        pendingId: pendingUserId,
        keystoneId: keystoneUser.user.id,
        username: keystoneUser.user.name
      });
      
      return keystoneUser;
    } catch (error: any) {
      console.error('❌ 사용자 승인 실패:', error);
      throw error;
    }
  }

  // 사용자 거부 (서버에서 제거)
  async rejectUserRegistration(pendingUserId: string) {
    try {
      console.log('🔍 사용자 거부 시작:', pendingUserId);
      
      const response = await fetch(`/api/queue/reject-user/${pendingUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.message || '서버에서 사용자 거부에 실패했습니다.');
      }

      const result = await response.json();
      console.log('✅ 서버에서 사용자 거부 완료:', result.message);
      
      return true;
    } catch (error: any) {
      console.error('❌ 사용자 거부 실패:', error);
      throw error;
    }
  }

  // 로컬 스토리지 초기화 (개발/디버깅용)
  clearPendingUsers(): void {
    try {
      localStorage.removeItem('pending-users');
      console.log('✅ 대기 사용자 목록 초기화 완료');
    } catch (error) {
      console.error('❌ 대기 사용자 목록 초기화 실패:', error);
    }
  }

  // 로컬 스토리지 상태 확인
  debugPendingUsers(): void {
    try {
      const stored = localStorage.getItem('pending-users');
      console.log('🔍 현재 로컬 스토리지 상태:');
      console.log('  - Raw data:', stored);
      console.log('  - Parsed data:', stored ? JSON.parse(stored) : null);
      console.log('  - Is Array:', stored ? Array.isArray(JSON.parse(stored)) : false);
    } catch (error) {
      console.error('❌ 로컬 스토리지 디버그 실패:', error);
    }
  }

  // 사용자 활성화/비활성화
  async updateUserStatus(userId: string, enabled: boolean) {
    const payload = {
      user: {
        enabled
      }
    };
    return this.makeRequest(`/users/${userId}`, 'PATCH', payload);
  }

  // OpenStack에서 비활성화된 사용자 목록 조회
  async getKeystonePendingUsers(): Promise<KeystoneUser[]> {
    const response = await this.getUsers();
    return response.users.filter((user: KeystoneUser) => !user.enabled);
  }

  // 역할 관리
  async getRoles() {
    return this.makeRequest('/roles');
  }

  async getRole(roleId: string) {
    return this.makeRequest(`/roles/${roleId}`);
  }

  async getRoleByName(roleName: string) {
    const rolesData = await this.getRoles();
    return rolesData.roles.find((role: KeystoneRole) => role.name === roleName);
  }

  // 역할 할당
  async assignRoleToUserOnProject(userId: string, projectId: string, roleId: string) {
    return this.makeRequest(`/projects/${projectId}/users/${userId}/roles/${roleId}`, 'PUT');
  }

  async removeRoleFromUserOnProject(userId: string, projectId: string, roleId: string) {
    return this.makeRequest(`/projects/${projectId}/users/${userId}/roles/${roleId}`, 'DELETE');
  }

  async getUserRolesOnProject(userId: string, projectId: string) {
    return this.makeRequest(`/projects/${projectId}/users/${userId}/roles`);
  }

  async getProjectUsers(projectId: string) {
    return this.makeRequest(`/role_assignments?scope.project.id=${projectId}`);
  }

  // 도메인 관리
  async getDomains() {
    return this.makeRequest('/domains');
  }

  async getDomain(domainId: string) {
    return this.makeRequest(`/domains/${domainId}`);
  }

  // 현재 토큰 정보
  async getCurrentToken() {
    return this.makeRequest('/auth/tokens', 'GET');
  }

  // 프로젝트별 토큰 발급 (관리자용)
  async getTokenForProject(projectId: string) {
    // 현재 사용자 정보를 기반으로 지정된 프로젝트의 토큰 발급
    const currentAuth = authService.getToken();
    if (!currentAuth) throw new Error('인증이 필요합니다.');

    // 관리자만 다른 프로젝트의 토큰을 발급받을 수 있음
    const authData = {
      auth: {
        identity: {
          methods: ['token'],
          token: {
            id: currentAuth
          }
        },
        scope: {
          project: {
            id: projectId
          }
        }
      }
    };

    try {
      const response = await axios.post(`${OPENSTACK_ENDPOINTS.KEYSTONE}/auth/tokens`, authData);
      return {
        token: response.headers['x-subject-token'],
        data: response.data
      };
    } catch (error) {
      console.error('프로젝트 토큰 발급 실패:', error);
      throw error;
    }
  }

  // 편의 함수들
  async createUserWithProject(userData: CreateUserRequest, projectName?: string) {
    try {
      // 1. 사용자 생성
      const userResponse = await this.createUser(userData);
      const user = userResponse.user;

      // 2. 프로젝트 생성 (제공된 경우)
      let project = null;
      if (projectName) {
        const projectResponse = await this.createProject({
          name: projectName,
          description: `${userData.name}의 개인 프로젝트`
        });
        project = projectResponse.project;

        // 3. 사용자에게 프로젝트 member 역할 할당
        const memberRole = await this.getRoleByName('member');
        if (memberRole) {
          await this.assignRoleToUserOnProject(user.id, project.id, memberRole.id);
        }
      }

      return { user, project };
    } catch (error) {
      console.error('사용자 및 프로젝트 생성 실패:', error);
      throw error;
    }
  }

  async isUserAdmin(userId?: string) {
    try {
      // 현재 사용자의 역할 확인
      const rolesData = await this.makeRequest('/role_assignments?user.id=' + (userId || 'current'));
      
      // admin 역할이 있는지 확인
      return rolesData.role_assignments.some((assignment: any) => 
        assignment.role && assignment.role.name === 'admin'
      );
    } catch (error) {
      console.error('관리자 권한 확인 실패:', error);
      return false;
    }
  }

  async getCurrentUserProjects() {
    try {
      // 현재 사용자가 접근 가능한 프로젝트 목록
      return this.makeRequest('/auth/projects');
    } catch (error) {
      console.error('사용자 프로젝트 목록 조회 실패:', error);
      throw error;
    }
  }
}

export default new KeystoneService(); 