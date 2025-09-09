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
              password: 'z4gERtPDjxYg2se2OONUkyqsbuCKOyiiwg8vkpLt',
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

  // 회원가입용 비활성화 사용자 생성
  async registerUser(userData: {
    name: string;
    password: string;
    username: string;
  }) {
    try {
      // 관리자 토큰 획득
      const adminToken = await this.getAdminToken();
      
      const payload = {
        user: {
          domain_id: 'default',
          enabled: false, // 비활성화 상태로 생성
          name: userData.username, // 아이디를 name 필드에
          password: userData.password,
          email: userData.username, // username을 email로 사용
          description: `${userData.name} - Pending approval`  // 한글 이름을 description에
        }
      };

      // 관리자 토큰으로 직접 요청
      const response = await fetch(`${OPENSTACK_ENDPOINTS.KEYSTONE}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': adminToken,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`사용자 생성 실패: ${error}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('회원가입 실패:', error);
      throw new Error('회원가입에 실패했습니다. 나중에 다시 시도해주세요.');
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

  // 비활성화된 사용자 목록 조회
  async getPendingUsers(): Promise<KeystoneUser[]> {
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