/**
 * Cloudflare API 서비스
 * Tunnel 생성 및 DNS 레코드 관리
 */

interface CloudflareConfig {
  apiToken: string;
  accountId: string;
  zoneId: string;
  domain: string; // 예: "example.com"
}

interface TunnelConfig {
  name: string;
  config: {
    ingress: Array<{
      hostname: string;
      service: string;
    }>;
  };
}

export class CloudflareService {
  private config: CloudflareConfig;

  constructor(config?: Partial<CloudflareConfig>) {
    // 환경 변수 또는 설정에서 가져오기
    this.config = {
      apiToken: config?.apiToken || import.meta.env.VITE_CLOUDFLARE_API_TOKEN || '',
      accountId: config?.accountId || import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID || '',
      zoneId: config?.zoneId || import.meta.env.VITE_CLOUDFLARE_ZONE_ID || '',
      domain: config?.domain || import.meta.env.VITE_CLOUDFLARE_DOMAIN || 'leee.cloud'
    };
    
    // 설정 확인 로깅 (디버그용)
    console.log('[Cloudflare] 설정 확인:', {
      hasApiToken: !!this.config.apiToken,
      hasAccountId: !!this.config.accountId,
      hasZoneId: !!this.config.zoneId,
      domain: this.config.domain,
      apiTokenLength: this.config.apiToken?.length || 0
    });
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET', data?: any) {
    // 브라우저에서 직접 Cloudflare API를 호출하면 CORS 에러가 발생하므로
    // 항상 프록시를 사용 (개발/프로덕션 모두)
    // 프로덕션 환경에서는 nginx 등에서 /cloudflare 프록시를 설정해야 함
    const useProxy = true; // 항상 프록시 사용
    
    const url = useProxy
      ? `/cloudflare${endpoint}`  // 프록시 경로 사용
      : `https://api.cloudflare.com/client/v4${endpoint}`;  // 직접 호출 (CORS 문제로 거의 사용 안됨)
    
    // API 토큰 확인
    if (!this.config.apiToken) {
      throw new Error('Cloudflare API 토큰이 설정되지 않았습니다. .env 파일에 VITE_CLOUDFLARE_API_TOKEN을 확인하세요.');
    }
    
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.config.apiToken}`,
      'Content-Type': 'application/json'
    };

    console.log(`[Cloudflare] ${method} ${url}`);
    if (data) {
      console.log('[Cloudflare] 요청 데이터:', JSON.stringify(data, null, 2));
    }

    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        ...(data && { body: JSON.stringify(data) })
      });
    } catch (networkError: any) {
      console.error('[Cloudflare] 네트워크 오류:', networkError);
      throw new Error(`네트워크 오류: ${networkError.message}`);
    }

    console.log(`[Cloudflare] 응답 상태: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('[Cloudflare] 에러 응답:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        errorData = { errors: [{ message: response.statusText }] };
      }
      
      // 403 에러의 경우 더 상세한 정보 제공
      if (response.status === 403) {
        const errorMessage = errorData.errors?.[0]?.message || '인증 실패';
        throw new Error(`Cloudflare 인증 실패 (403): ${errorMessage}. API 토큰과 권한을 확인하세요.`);
      }
      
      throw new Error(errorData.errors?.[0]?.message || `Cloudflare API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Tunnel 목록 조회
   */
  async listTunnels(): Promise<Array<{ id: string; name: string; created_at: string }>> {
    try {
      const response = await this.makeRequest(`/accounts/${this.config.accountId}/cfd_tunnel`, 'GET');
      if (response.success && response.result) {
        return Array.isArray(response.result) ? response.result : [];
      }
      return [];
    } catch (error: any) {
      console.error('Tunnel 목록 조회 실패:', error);
      return [];
    }
  }

  /**
   * Cloudflare Tunnel 생성 (호스트명 포함)
   * @param name Tunnel 이름 (예: "ssh-instance-name")
   * @param hostname SSH 호스트명 (예: "ssh-instance-name.example.com")
   * @returns Tunnel 정보 (id, token 등)
   */
  async createTunnelWithHostname(name: string, hostname: string): Promise<{ id: string; token: string; name: string }> {
    try {
      // Tunnel 생성 시 ingress 규칙 포함 (호스트명 포함)
      // 이렇게 하면 Tunnel이 생성되자마자 SSH 연결 가능
      const response = await this.makeRequest(`/accounts/${this.config.accountId}/cfd_tunnel`, 'POST', {
        name,
        config: {
          ingress: [
            {
              hostname: hostname,
              service: 'ssh://localhost:22'
            },
            {
              service: 'http_status:404'
            }
          ]
        }
      });

      if (response.success && response.result) {
        return {
          id: response.result.id,
          token: response.result.token || '',
          name: response.result.name
        };
      }

      throw new Error('Tunnel 생성 실패');
    } catch (error: any) {
      // 409 Conflict - 같은 이름의 Tunnel이 이미 존재
      if (error.message?.includes('already have a tunnel with this name') || 
          error.message?.includes('409')) {
        console.log(`기존 Tunnel 발견: ${name}, 재사용 시도`);
        
        // 기존 Tunnel 목록 조회
        const tunnels = await this.listTunnels();
        const existingTunnel = tunnels.find(t => t.name === name);
        
        if (existingTunnel) {
          console.log(`기존 Tunnel 재사용: ${existingTunnel.id}`);
          
          // 기존 Tunnel 정보 조회
          const tunnelDetail = await this.makeRequest(
            `/accounts/${this.config.accountId}/cfd_tunnel/${existingTunnel.id}`
          );
          
          if (tunnelDetail.success && tunnelDetail.result) {
            // 기존 Tunnel이 있으면 재사용 (token은 새로 생성할 수 없으므로 기존 정보 사용)
            return {
              id: tunnelDetail.result.id,
              token: tunnelDetail.result.token || '', // token이 없을 수 있음
              name: tunnelDetail.result.name
            };
          }
        }
        
        // 기존 Tunnel을 찾을 수 없으면 고유한 이름 생성
        const uniqueName = `${name}-${Date.now()}`;
        const uniqueHostname = `${uniqueName}.${this.config.domain}`;
        console.log(`고유한 이름으로 재시도: ${uniqueName}`);
        return this.createTunnelWithHostname(uniqueName, uniqueHostname);
      }
      
      console.error('Cloudflare Tunnel 생성 오류:', error);
      throw new Error(`Tunnel 생성 실패: ${error.message}`);
    }
  }

  /**
   * Cloudflare Tunnel 생성 (레거시 호환용 - 호스트명 없이)
   * @param name Tunnel 이름 (예: "ssh-instance-name")
   * @returns Tunnel 정보 (id, token 등)
   */
  async createTunnel(name: string): Promise<{ id: string; token: string; name: string }> {
    // 내부적으로 createTunnelWithHostname 호출 (임시 호스트명 사용)
    const tempHostname = `${name}.${this.config.domain}`;
    return this.createTunnelWithHostname(name, tempHostname);
  }

  /**
   * DNS 레코드 확인
   * @param hostname 호스트명
   */
  async checkDNSRecord(hostname: string): Promise<{ exists: boolean; content?: string; id?: string }> {
    try {
      const response = await this.makeRequest(
        `/zones/${this.config.zoneId}/dns_records?name=${hostname}&type=CNAME`
      );

      if (response.success && response.result && response.result.length > 0) {
        const record = response.result[0];
        return {
          exists: true,
          content: record.content,
          id: record.id
        };
      }
      return { exists: false };
    } catch (error: any) {
      console.error('[Cloudflare] DNS 레코드 확인 오류:', error);
      return { exists: false };
    }
  }

  /**
   * Tunnel ingress 규칙 확인
   * @param tunnelId Tunnel ID
   * @param hostname 호스트명
   */
  async checkTunnelConfig(tunnelId: string, hostname: string): Promise<{ hasIngress: boolean; ingress?: any[] }> {
    try {
      const response = await this.makeRequest(
        `/accounts/${this.config.accountId}/cfd_tunnel/${tunnelId}`
      );

      if (response.success && response.result) {
        const config = response.result.config || {};
        const ingress = config.ingress || [];
        const hasHostname = ingress.some((rule: any) => rule.hostname === hostname);
        return {
          hasIngress: hasHostname,
          ingress
        };
      }
      return { hasIngress: false };
    } catch (error: any) {
      console.error('[Cloudflare] Tunnel 설정 확인 오류:', error);
      return { hasIngress: false };
    }
  }

  /**
   * SSH 연결 준비 상태 종합 확인 및 자동 수정
   * @param tunnelId Tunnel ID
   * @param hostname 호스트명
   */
  async prepareSSHConnection(tunnelId: string, hostname: string): Promise<{
    dnsReady: boolean;
    ingressReady: boolean;
    actions: string[];
    allReady: boolean;
  }> {
    const actions: string[] = [];
    let dnsReady = false;
    let ingressReady = false;

    try {
      // 1. DNS 레코드 확인
      console.log('🔍 DNS 레코드 확인 중...');
      const dnsCheck = await this.checkDNSRecord(hostname);
      
      if (dnsCheck.exists && dnsCheck.content === `${tunnelId}.cfargotunnel.com`) {
        console.log('✅ DNS 레코드가 올바르게 설정되어 있습니다.');
        dnsReady = true;
      } else {
        console.log('⚠️ DNS 레코드가 없거나 올바르지 않습니다. 재생성 중...');
        actions.push('DNS 레코드 재생성');
        await this.addDNSRecord(hostname, tunnelId, true);
        dnsReady = true; // 재생성 완료 후 true로 설정
      }

      // 2. Ingress 규칙 확인
      console.log('🔍 Ingress 규칙 확인 중...');
      const ingressCheck = await this.checkTunnelConfig(tunnelId, hostname);
      
      if (ingressCheck.hasIngress) {
        console.log('✅ Ingress 규칙이 올바르게 설정되어 있습니다.');
        ingressReady = true;
      } else {
        console.log('⚠️ Ingress 규칙이 없습니다. 추가 중...');
        actions.push('Ingress 규칙 추가');
        await this.updateTunnelConfig(tunnelId, hostname, 'ssh://localhost:22');
        ingressReady = true; // 추가 완료 후 true로 설정
      }

      return {
        dnsReady,
        ingressReady,
        actions,
        allReady: dnsReady && ingressReady
      };
    } catch (error: any) {
      console.error('[Cloudflare] SSH 연결 준비 중 오류:', error);
      throw new Error(`SSH 연결 준비 실패: ${error.message}`);
    }
  }

  /**
   * Tunnel에 DNS 레코드 추가 (강제 재생성 옵션 포함)
   * @param tunnelId Tunnel ID
   * @param hostname 호스트명 (예: "ssh-instance-name.example.com")
   * @param forceRecreate 기존 레코드를 강제로 삭제하고 재생성
   */
  async addDNSRecord(hostname: string, tunnelId: string, forceRecreate: boolean = false): Promise<void> {
    try {
      // 기존 DNS 레코드 확인 (같은 이름의 레코드가 있는지)
      const existingRecords = await this.makeRequest(
        `/zones/${this.config.zoneId}/dns_records?name=${hostname}&type=CNAME`
      );

      if (existingRecords.success && existingRecords.result && existingRecords.result.length > 0) {
        const existingRecord = existingRecords.result[0];
        
        // 강제 재생성 옵션이 있으면 무조건 삭제
        if (forceRecreate) {
          console.log(`🔨 강제 재생성: 기존 DNS 레코드 삭제 중... ${hostname}`);
          await this.makeRequest(
            `/zones/${this.config.zoneId}/dns_records/${existingRecord.id}`,
            'DELETE'
          );
        } else {
          // 기존 레코드가 올바른 tunnel을 가리키는지 확인
          if (existingRecord.content === `${tunnelId}.cfargotunnel.com`) {
            console.log(`✅ DNS 레코드가 이미 존재하고 올바르게 설정되어 있습니다: ${hostname}`);
            // 레코드가 올바르게 설정되어 있어도 확인을 위해 재생성 시도
            console.log(`⚠️ DNS 레코드는 존재하지만, DNS 전파가 완료되지 않았을 수 있습니다.`);
            console.log(`   DNS 전파는 최대 5분까지 걸릴 수 있습니다.`);
            return;
          } else {
            // 잘못된 레코드 삭제 후 새로 생성
            console.log(`기존 DNS 레코드를 업데이트합니다: ${hostname}`);
            await this.makeRequest(
              `/zones/${this.config.zoneId}/dns_records/${existingRecord.id}`,
              'DELETE'
            );
          }
        }
      }

      // DNS 레코드 생성 (CNAME, proxied=true로 IPv4/IPv6 dual stack 지원)
      const response = await this.makeRequest(`/zones/${this.config.zoneId}/dns_records`, 'POST', {
        type: 'CNAME',
        name: hostname,
        content: `${tunnelId}.cfargotunnel.com`,
        ttl: 1, // 자동 TTL (Cloudflare가 최적값으로 조정)
        proxied: true // Cloudflare 프록시를 통해 IPv4/IPv6 dual stack 지원
      });

      if (!response.success) {
        throw new Error(`DNS 레코드 생성 실패: ${JSON.stringify(response)}`);
      }
      
      console.log(`✅ DNS 레코드 생성 성공: ${hostname} → ${tunnelId}.cfargotunnel.com`);
      
      // 생성 후 즉시 확인
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
      const verify = await this.checkDNSRecord(hostname);
      if (verify.exists && verify.content === `${tunnelId}.cfargotunnel.com`) {
        console.log(`✅ DNS 레코드 확인 완료: ${hostname} → ${verify.content}`);
      } else {
        console.warn(`⚠️ DNS 레코드 확인 실패 (전파 대기 중일 수 있음): ${hostname}`);
      }
    } catch (error: any) {
      // 409 Conflict는 레코드가 이미 존재함을 의미 (정상)
      if (error.message?.includes('already exists') || error.message?.includes('409')) {
        console.log(`⚠️ DNS 레코드가 이미 존재합니다: ${hostname} (계속 진행)`);
        return;
      }
      
      console.error('[Cloudflare] DNS 레코드 추가 오류:', error);
      console.error('[Cloudflare] 오류 상세:', {
        message: error.message,
        hostname,
        tunnelId,
        zoneId: this.config.zoneId
      });
      throw new Error(`DNS 레코드 추가 실패: ${error.message}`);
    }
  }

  /**
   * Tunnel 구성 업데이트 (ingress 규칙 추가)
   * @param tunnelId Tunnel ID
   * @param hostname 호스트명
   * @param service 서비스 URL (예: "ssh://localhost:22")
   */
  async updateTunnelConfig(tunnelId: string, hostname: string, service: string): Promise<void> {
    try {
      // 기존 구성 가져오기
      const getResponse = await this.makeRequest(
        `/accounts/${this.config.accountId}/cfd_tunnel/${tunnelId}`
      );

      if (!getResponse.success) {
        throw new Error('Tunnel 정보 조회 실패');
      }

      // Tunnel이 존재하지 않으면 에러
      if (getResponse.result === null || !getResponse.result) {
        throw new Error(`Tunnel ${tunnelId}을(를) 찾을 수 없습니다.`);
      }

      const existingConfig = getResponse.result?.config || {};
      const existingIngress = existingConfig.ingress || [];

      // 새 ingress 규칙 추가
      const newIngress = [
        ...existingIngress.filter((rule: any) => rule.hostname !== hostname),
        {
          hostname,
          service
        }
      ];

      // catch-all 규칙이 없으면 추가
      if (!newIngress.some((rule: any) => rule.service === 'http_status:404')) {
        newIngress.push({
          service: 'http_status:404'
        });
      }

      // Tunnel 구성 업데이트
      // Cloudflare API 문서에 따르면 구성 업데이트는 /configurations 엔드포인트를 권장
      // 여러 방법을 순차적으로 시도
      let updateResponse;
      try {
        // 방법 1: /configurations 엔드포인트 사용 (권장)
        // 이 엔드포인트는 { config: { ingress: [...] } } 형식을 기대함
        updateResponse = await this.makeRequest(
          `/accounts/${this.config.accountId}/cfd_tunnel/${tunnelId}/configurations`,
          'PUT',
          {
            config: {
              ingress: newIngress
            }
          }
        );
      } catch (configError: any) {
        // 방법 2: PATCH 메서드로 전체 Tunnel 업데이트 시도
        try {
          updateResponse = await this.makeRequest(
            `/accounts/${this.config.accountId}/cfd_tunnel/${tunnelId}`,
            'PATCH',
            {
              config: {
                ingress: newIngress
              }
            }
          );
        } catch (patchError: any) {
          // 방법 3: PATCH로 이름 없이 config만 업데이트 시도
          console.log('PATCH config 실패, 간단한 형식 시도:', patchError.message);
          try {
            updateResponse = await this.makeRequest(
              `/accounts/${this.config.accountId}/cfd_tunnel/${tunnelId}`,
              'PATCH',
              {
                config: {
                  ingress: newIngress
                }
              }
            );
          } catch (finalError: any) {
            // 모든 방법 실패 - cloud-init의 config.yml이 처리할 것
            throw finalError;
          }
        }
      }

      if (!updateResponse.success) {
        throw new Error('Tunnel 구성 업데이트 실패');
      }
    } catch (error: any) {
      console.error('Tunnel 구성 업데이트 오류:', error);
      throw new Error(`Tunnel 구성 업데이트 실패: ${error.message}`);
    }
  }

  /**
   * SSH를 위한 Tunnel 전체 설정 (생성 + DNS + 구성)
   * @param instanceName 인스턴스 이름
   * @returns SSH 도메인과 연결 정보
   */
  async setupSSHTunnel(instanceName: string): Promise<{
    domain: string;
    tunnelId: string;
    tunnelToken: string;
    cloudInitScript: string;
  }> {
    try {
      // 1. 먼저 호스트명 결정 (Tunnel 생성 시 올바른 ingress 규칙으로 생성하기 위해)
      const baseName = `ssh-${instanceName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
      const timestamp = Date.now();
      const tunnelName = `${baseName}-${timestamp}`;
      const hostname = `${tunnelName}.${this.config.domain}`;
      
      // 2. Tunnel 생성 (기본 생성 후 구성 업데이트)
      const tunnel = await this.createTunnelWithHostname(tunnelName, hostname);
      
      // Tunnel이 재사용된 경우 token이 없을 수 있으므로 확인
      let finalHostname = hostname;
      if (!tunnel.token) {
        console.warn('⚠️ 기존 Tunnel을 재사용했지만 token이 없습니다. 고유한 이름으로 재시도합니다.');
        // 더 고유한 이름으로 재시도 (UUID 스타일)
        const uniqueId = `${baseName}-${timestamp}-${Math.random().toString(36).substring(2, 9)}`;
        const uniqueHostname = `${uniqueId}.${this.config.domain}`;
        const uniqueTunnel = await this.createTunnelWithHostname(uniqueId, uniqueHostname);
        
        if (!uniqueTunnel.token) {
          throw new Error('Tunnel token을 생성할 수 없습니다. API 토큰 권한을 확인하세요.');
        }
        
        // 새로운 Tunnel 정보로 업데이트
        tunnel.id = uniqueTunnel.id;
        tunnel.token = uniqueTunnel.token;
        tunnel.name = uniqueTunnel.name;
        finalHostname = uniqueHostname;
      }

      // 2-1. Tunnel 생성 시 이미 ingress 규칙이 포함되어 있는지 확인
      // Tunnel 생성 시 config에 ingress를 포함했으므로 추가 업데이트 불필요
      console.log('ℹ️ Tunnel 생성 시 이미 ingress 규칙이 포함되었습니다.');

      // 3. DNS 레코드 추가 (재시도 로직 포함)
      let dnsRecordAdded = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await this.addDNSRecord(finalHostname, tunnel.id);
          dnsRecordAdded = true;
          console.log(`✅ DNS 레코드 추가 성공: ${finalHostname}`);
          break;
        } catch (dnsError: any) {
          if (attempt === 3) {
            console.warn(`⚠️ DNS 레코드 추가 실패 (최대 시도 횟수 도달):`, dnsError);
            throw new Error(`DNS 레코드 추가 실패: ${dnsError.message}`);
          } else {
            console.log(`DNS 레코드 추가 재시도 중... (${attempt}/3)`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
          }
        }
      }

      // 4. cloud-init 스크립트 생성 (인스턴스 부팅 시 자동으로 cloudflared 설치 및 실행)
      const cloudInitScript = this.generateCloudInitScript(tunnel.token, finalHostname);

      console.log(`✅ Cloudflare Tunnel 설정 완료:`);
      console.log(`   - Tunnel ID: ${tunnel.id}`);
      console.log(`   - Tunnel 이름: ${tunnel.name}`);
      console.log(`   - SSH 도메인: ${finalHostname}`);
      console.log(`   - DNS 레코드: ${finalHostname} → ${tunnel.id}.cfargotunnel.com`);

      return {
        domain: finalHostname,
        tunnelId: tunnel.id,
        tunnelToken: tunnel.token,
        cloudInitScript
      };
    } catch (error: any) {
      console.error('SSH Tunnel 설정 오류:', error);
      throw error;
    }
  }

  /**
   * cloud-init 스크립트 생성
   * @param tunnelToken Cloudflare Tunnel 토큰
   * @param hostname 호스트명
   */
  private generateCloudInitScript(tunnelToken: string, hostname: string): string {
    return `#!/bin/bash
# Cloudflare Tunnel 자동 설정 스크립트

set -e

echo "=== Cloudflare Tunnel 자동 설정 시작 ==="

# 네트워크 대기 (cloud-init 완료 대기)
until ping -c 1 8.8.8.8 >/dev/null 2>&1; do
  echo "네트워크 연결 대기 중..."
  sleep 2
done

# SSH 서비스 확인 및 시작 (대부분의 이미지에서 기본 설치되어 있음)
if systemctl list-unit-files | grep -q ssh; then
  echo "SSH 서비스 확인 중..."
  # Ubuntu/Debian
  if systemctl list-unit-files | grep -q "ssh.service\|sshd.service"; then
    systemctl enable ssh 2>/dev/null || systemctl enable sshd 2>/dev/null || true
    systemctl start ssh 2>/dev/null || systemctl start sshd 2>/dev/null || true
  fi
  # CentOS/RHEL
  if systemctl list-unit-files | grep -q "sshd.service"; then
    systemctl enable sshd 2>/dev/null || true
    systemctl start sshd 2>/dev/null || true
  fi
fi

# 필수 패키지 확인 및 설치 (curl, systemd는 대부분 기본 설치되어 있음)
if ! command -v curl &> /dev/null; then
  echo "curl 설치 중..."
  if command -v apt-get &> /dev/null; then
    apt-get update -qq && apt-get install -y curl
  elif command -v yum &> /dev/null; then
    yum install -y curl
  elif command -v dnf &> /dev/null; then
    dnf install -y curl
  fi
fi

# cloudflared 설치
ARCH=\$(uname -m)
if [ "\$ARCH" = "x86_64" ]; then
    ARCH="amd64"
elif [ "\$ARCH" = "aarch64" ]; then
    ARCH="arm64"
fi

# cloudflared 최신 버전 사용 (2024.12.0 또는 최신)
CLOUDFLARED_VERSION="2024.12.0"
CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/download/\${CLOUDFLARED_VERSION}/cloudflared-linux-\${ARCH}"

echo "cloudflared 다운로드 중... (버전: \${CLOUDFLARED_VERSION}, 아키텍처: \${ARCH})"
if ! curl -L "\${CLOUDFLARED_URL}" -o /usr/local/bin/cloudflared; then
  echo "❌ cloudflared 다운로드 실패, 최신 버전 자동 감지 시도..."
  # 최신 버전 자동 감지 (fallback)
  LATEST_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-\${ARCH}"
  if ! curl -L "\${LATEST_URL}" -o /usr/local/bin/cloudflared; then
    echo "❌ cloudflared 다운로드 완전 실패"
    exit 1
  fi
fi

chmod +x /usr/local/bin/cloudflared
cloudflared version || echo "⚠️ cloudflared 버전 확인 실패 (계속 진행)"

# Tunnel 설정 파일 생성 (ingress 규칙 포함)
# 토큰 방식과 config 파일을 함께 사용하여 안정성 확보
mkdir -p /etc/cloudflared
cat > /etc/cloudflared/config.yml <<EOFCONFIG
ingress:
  - hostname: ${hostname}
    service: ssh://localhost:22
  - service: http_status:404
EOFCONFIG

# 설정 파일 권한 설정
chmod 600 /etc/cloudflared/config.yml

# Tunnel 자동 시작 설정
# 토큰 방식 + config 파일 조합 사용 (가장 안정적)
cat > /etc/systemd/system/cloudflared-tunnel.service <<EOFSERVICE
[Unit]
Description=Cloudflare Tunnel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
# 토큰으로 인증 + config 파일로 ingress 규칙 지정
ExecStart=/usr/local/bin/cloudflared tunnel --token ${tunnelToken} run
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
# config 파일 위치 지정 (선택적 - 토큰이 우선이지만 config의 ingress도 적용됨)
Environment=CLOUDFLARED_CONFIG=/etc/cloudflared/config.yml

[Install]
WantedBy=multi-user.target
EOFSERVICE

# systemd 서비스 활성화 및 시작
systemctl daemon-reload
systemctl enable cloudflared-tunnel

# 네트워크가 완전히 준비될 때까지 대기
echo "네트워크 준비 대기 중..."
until ping -c 1 8.8.8.8 >/dev/null 2>&1; do
  sleep 1
done

# SSH 서비스가 실행 중인지 확인
if ! systemctl is-active --quiet ssh && ! systemctl is-active --quiet sshd; then
  echo "SSH 서비스 시작 중..."
  systemctl start ssh 2>/dev/null || systemctl start sshd 2>/dev/null || true
  sleep 2
fi

# 잠시 대기 후 서비스 시작
echo "Cloudflare Tunnel 서비스 시작 중..."
sleep 5

# 서비스 시작
if systemctl start cloudflared-tunnel; then
  echo "서비스 시작 대기 중 (최대 30초)..."
  sleep 10
  
  # 서비스 상태 확인 (최대 3번 시도)
  for i in {1..3}; do
    if systemctl is-active --quiet cloudflared-tunnel; then
      echo "✅ Cloudflare Tunnel 서비스가 정상적으로 시작되었습니다."
      break
    else
      echo "서비스 시작 확인 중... (시도 $i/3)"
      sleep 5
    fi
  done
  
  # 최종 상태 확인 및 로그 출력
  if systemctl is-active --quiet cloudflared-tunnel; then
    echo "✅ Cloudflare Tunnel 서비스가 실행 중입니다."
    echo ""
    echo "최근 로그 확인:"
    journalctl -u cloudflared-tunnel -n 20 --no-pager || true
    
    # config 파일 확인
    echo ""
    echo "설정 파일 확인:"
    cat /etc/cloudflared/config.yml || echo "설정 파일을 읽을 수 없습니다"
    
    # Tunnel 연결 상태 확인 (cloudflared가 연결되었는지)
    echo ""
    echo "Tunnel 연결 확인 중..."
    sleep 3
    if systemctl is-active --quiet cloudflared-tunnel; then
      echo "✅ Tunnel 서비스가 계속 실행 중입니다."
      echo "⚠️ 참고: Tunnel이 완전히 연결되기까지 몇 분 걸릴 수 있습니다."
      echo "   연결 확인: journalctl -u cloudflared-tunnel -f"
    fi
  else
    echo "⚠️ Cloudflare Tunnel 서비스가 시작되지 않았습니다."
    echo "최근 로그:"
    journalctl -u cloudflared-tunnel -n 30 --no-pager || true
    
    # config 파일 검증
    echo ""
    echo "설정 파일 확인:"
    cat /etc/cloudflared/config.yml || echo "설정 파일을 읽을 수 없습니다"
  fi
else
  echo "❌ Cloudflare Tunnel 서비스 시작 실패"
  journalctl -u cloudflared-tunnel -n 30 --no-pager || true
fi

# DNS 설정 확인 (옵션)
echo ""
echo "DNS 해상 확인 중..."
if command -v dig &> /dev/null; then
  dig +short ${hostname} || echo "DNS 조회 실패 (정상일 수 있음 - DNS 전파 대기)"
elif command -v nslookup &> /dev/null; then
  nslookup ${hostname} || echo "DNS 조회 실패 (정상일 수 있음 - DNS 전파 대기)"
fi

echo ""
echo "=== Cloudflare Tunnel 설정 완료 ==="
echo "SSH 도메인: ${hostname}"
echo "터널 상태 확인: systemctl status cloudflared-tunnel"
echo "터널 로그 확인: journalctl -u cloudflared-tunnel -f"
echo ""
echo "⚠️ 참고:"
echo "   - Tunnel이 완전히 연결되기까지 1-2분 정도 걸릴 수 있습니다"
echo "   - DNS 전파는 최대 5분까지 걸릴 수 있습니다"
echo "   - SSH 연결 시 'AddressFamily inet' 옵션을 사용하는 것을 권장합니다"
`;
  }

  /**
   * Tunnel 삭제
   * @param tunnelId Tunnel ID
   */
  async deleteTunnel(tunnelId: string): Promise<void> {
    try {
      await this.makeRequest(
        `/accounts/${this.config.accountId}/cfd_tunnel/${tunnelId}`,
        'DELETE'
      );
    } catch (error: any) {
      console.error('Tunnel 삭제 오류:', error);
      throw new Error(`Tunnel 삭제 실패: ${error.message}`);
    }
  }

  /**
   * DNS 레코드 삭제
   * @param hostname 호스트명
   */
  async deleteDNSRecord(hostname: string): Promise<void> {
    try {
      // DNS 레코드 찾기
      const records = await this.makeRequest(
        `/zones/${this.config.zoneId}/dns_records?name=${hostname}&type=CNAME`
      );

      if (records.success && records.result && records.result.length > 0) {
        const recordId = records.result[0].id;
        await this.makeRequest(
          `/zones/${this.config.zoneId}/dns_records/${recordId}`,
          'DELETE'
        );
      }
    } catch (error: any) {
      console.error('DNS 레코드 삭제 오류:', error);
      throw new Error(`DNS 레코드 삭제 실패: ${error.message}`);
    }
  }
}

// 싱글톤 인스턴스
export const cloudflareService = new CloudflareService();


