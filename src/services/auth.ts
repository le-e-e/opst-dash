import axios from 'axios';
import { OPENSTACK_ENDPOINTS, AUTH_CONFIG } from '../config/endpoints';

export interface AuthToken {
  token: string;
  expires: string;
  project: {
    id: string;
    name: string;
    domain: {
      id: string;
      name: string;
    };
  };
  user: {
    id: string;
    name: string;
    domain: {
      id: string;
      name: string;
    };
  };
}

export interface LoginCredentials {
  username: string;
  password: string;
  projectName?: string;
  domainName?: string;
}

class AuthService {
  private token: string | null = null;
  private tokenExpires: Date | null = null;

  async login(credentials: LoginCredentials): Promise<AuthToken> {
    const authData = {
      auth: {
        identity: {
          methods: ['password'],
          password: {
            user: {
              name: credentials.username,
              domain: {
                name: credentials.domainName || AUTH_CONFIG.USER_DOMAIN_NAME
              },
              password: credentials.password
            }
          }
        },
        scope: {
          project: {
            name: credentials.projectName || AUTH_CONFIG.PROJECT_NAME,
            domain: {
              name: credentials.domainName || AUTH_CONFIG.PROJECT_DOMAIN_NAME
            }
          }
        }
      }
    };

    try {
      console.log('인증 요청 URL:', `${OPENSTACK_ENDPOINTS.KEYSTONE}/auth/tokens`);
      console.log('인증 요청 데이터:', JSON.stringify(authData, null, 2));
      
      const response = await axios.post(`${OPENSTACK_ENDPOINTS.KEYSTONE}/auth/tokens`, authData);
      
      console.log('인증 응답 상태:', response.status);
      console.log('인증 응답 헤더:', response.headers);
      
      const token = response.headers['x-subject-token'];
      const tokenData = response.data.token;
      
      this.token = token;
      this.tokenExpires = new Date(tokenData.expires_at);
      
      // 로컬 스토리지에 토큰 저장
      localStorage.setItem('openstack_token', token);
      localStorage.setItem('openstack_token_expires', tokenData.expires_at);
      
      return {
        token,
        expires: tokenData.expires_at,
        project: tokenData.project,
        user: tokenData.user
      };
    } catch (error) {
      console.error('로그인 실패:', error);
      throw new Error('로그인에 실패했습니다.');
    }
  }

  async logout(): Promise<void> {
    if (this.token) {
      try {
        await axios.delete(`${OPENSTACK_ENDPOINTS.KEYSTONE}/auth/tokens`, {
          headers: {
            'X-Auth-Token': this.token,
            'X-Subject-Token': this.token
          }
        });
      } catch (error) {
        console.error('로그아웃 실패:', error);
      }
    }
    
    this.token = null;
    this.tokenExpires = null;
    localStorage.removeItem('openstack_token');
    localStorage.removeItem('openstack_token_expires');
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    const expires = localStorage.getItem('openstack_token_expires');
    
    if (!token || !expires) return false;
    
    const expirationDate = new Date(expires);
    return expirationDate > new Date();
  }

  getToken(): string | null {
    if (this.token && this.tokenExpires && this.tokenExpires > new Date()) {
      return this.token;
    }
    
    const storedToken = localStorage.getItem('openstack_token');
    const storedExpires = localStorage.getItem('openstack_token_expires');
    
    if (storedToken && storedExpires) {
      const expirationDate = new Date(storedExpires);
      if (expirationDate > new Date()) {
        this.token = storedToken;
        this.tokenExpires = expirationDate;
        return storedToken;
      }
    }
    
    return null;
  }

  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { 'X-Auth-Token': token } : {};
  }
}

export default new AuthService(); 