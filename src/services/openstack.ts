import axios from 'axios';
import { OPENSTACK_ENDPOINTS } from '../config/endpoints';
import authService from './auth';
import { getCurrentProjectId } from '../utils/projectScope';

// 관리자 권한 확인 함수
const isAdminUser = (): boolean => {
  try {
    const token = authService.getToken();
    if (!token) return false;
    
    // JWT 토큰을 디코드하거나 저장된 사용자 정보에서 확인
    // 간단하게 localStorage에서 확인
    const authData = JSON.parse(localStorage.getItem('keystone-auth-storage') || '{}');
    return authData?.state?.isAdmin === true;
  } catch {
    return false;
  }
};

// 서비스별 프로젝트 스코프 쿼리 파라미터 추가
const addProjectScopeParams = (service: 'nova' | 'neutron' | 'glance' | 'cinder', params: any = {}): any => {
  if (isAdminUser()) {
    // 관리자는 모든 프로젝트 리소스 조회
    switch (service) {
      case 'nova':
        return { ...params, all_tenants: 'True' };
      case 'neutron':
        // Neutron API는 관리자 권한으로 요청하면 기본적으로 모든 프로젝트 리소스 반환
        // all_tenants 파라미터가 일부 배포에서 400 오류를 발생시킬 수 있음
        return params;
      case 'glance':
        // Glance는 기본적으로 모든 이미지를 표시하지만, 더 확실하게 하기 위해
        return { ...params, visibility: 'all' };
      case 'cinder':
        return { ...params, all_tenants: 'True' };
      default:
        return params;
    }
  } else {
    // 일반 사용자는 현재 프로젝트만 조회
    const authData = JSON.parse(localStorage.getItem('keystone-auth-storage') || '{}');
    const currentProjectId = authData?.state?.currentProject?.id;
    
    console.log('🏷️ 일반 사용자 프로젝트 스코프 추가:', currentProjectId);
    
    if (currentProjectId) {
      switch (service) {
        case 'nova':
          // Nova API는 일반 사용자의 경우 project_id 파라미터를 지원하지 않음
          // 토큰 기반으로 자동 스코프 처리됨
          console.log('⚠️ Nova API: 일반 사용자는 project_id 파라미터 없이 토큰 기반으로 요청');
          return params;
        case 'neutron':
          // Neutron API는 일반 사용자의 경우 tenant_id 파라미터를 지원하지 않음
          // 토큰 기반으로 자동 스코프 처리됨
          console.log('⚠️ Neutron API: 일반 사용자는 tenant_id 파라미터 없이 토큰 기반으로 요청');
          return params;
        case 'glance':
          // Glance API는 일반 사용자의 경우 owner 파라미터를 지원하지 않음
          // 토큰 기반으로 자동 스코프 처리됨
          console.log('⚠️ Glance API: 일반 사용자는 owner 파라미터 없이 토큰 기반으로 요청');
          return params;
        case 'cinder':
          // Cinder API는 일반 사용자의 경우 project_id 파라미터를 지원하지 않음
          // 토큰 기반으로 자동 스코프 처리됨
          console.log('⚠️ Cinder API: 일반 사용자는 project_id 파라미터 없이 토큰 기반으로 요청');
          return params;
        default:
          return { ...params, project_id: currentProjectId };
      }
    }
    
    return params;
  }
};

// 공통 API 클래스
class BaseOpenStackService {
  protected async makeRequest(endpoint: string, path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any, params?: any, additionalHeaders?: any) {
    let headers = authService.getAuthHeaders();
    
    // Neutron API에서 관리자가 모든 프로젝트의 리소스에 접근하려면 특별한 헤더가 필요할 수 있음
    if (isAdminUser() && endpoint.includes('neutron')) {
      headers = {
        ...headers,
        'X-Auth-All-Projects': 'true'
      };
    }
    
    // Cinder API 호출 시 버전 헤더와 프로젝트 스코프 추가
    if (endpoint.includes('cinder')) {
      // 기본 Cinder API 헤더
      headers = {
        ...headers,
        'OpenStack-API-Version': 'volume 3.59', // 호라이즌이 주로 사용하는 버전
        'X-OpenStack-API-Version': '3.59'
      };
      
      // 모든 사용자에게 OpenStack 표준 헤더 추가 (호라이즌 방식)
      const currentProjectId = getCurrentProjectId();
      
      if (currentProjectId) {
        headers = {
          ...headers,
          'X-Project-Id': currentProjectId,
          'X-Project-Domain-Id': 'default',
          'X-User-Domain-Id': 'default'
        };
        
        // 일반 사용자 추가 헤더
        if (!isAdminUser()) {
          headers = {
            ...headers,
            'X-Subject-Token': headers['X-Auth-Token'], // 토큰을 명시적으로 재전달
            'OpenStack-API-Version': 'volume 3.59', // 호라이즌이 사용하는 버전
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          };
        }
        
                 // 헤더 로그 제거
      }
    }
    
    // 추가 헤더가 있으면 병합
    if (additionalHeaders) {
      headers = { ...headers, ...additionalHeaders };
    }
    
    try {
      const response = await axios({
        method,
        url: `${endpoint}${path}`,
        headers,
        data,
        params
      });
      return response.data;
    } catch (error: any) {
      // 로그 제거 - 오류는 상위에서 처리
      
      throw error;
    }
  }
}

// Nova 서비스 (컴퓨트)
export class NovaService extends BaseOpenStackService {
  async getServers() {
    const params = addProjectScopeParams('nova');
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/servers/detail', 'GET', undefined, params);
  }

  async getServer(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}`);
  }

  async createServer(serverData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/servers', 'POST', serverData);
  }

  async deleteServer(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}`, 'DELETE');
  }

  async rebootServer(serverId: string, type: 'SOFT' | 'HARD' = 'SOFT') {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      reboot: { type }
    });
  }

  async startServer(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      'os-start': null
    });
  }

  async stopServer(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      'os-stop': null
    });
  }

  async pauseServer(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      pause: null
    });
  }

  async unpauseServer(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      unpause: null
    });
  }

  async suspendServer(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      suspend: null
    });
  }

  async resumeServer(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      resume: null
    });
  }

  async getServerConsoleLog(serverId: string, length?: number) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      'os-getConsoleOutput': { length: length || 50 }
    });
  }

  async getVNCConsole(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      'os-getVNCConsole': { type: 'novnc' }
    });
  }

  async attachFloatingIP(serverId: string, address: string, fixedAddress?: string) {
    const body: any = { address };
    if (fixedAddress) body.fixed_address = fixedAddress;
    
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      addFloatingIp: body
    });
  }

  async detachFloatingIP(serverId: string, address: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      removeFloatingIp: { address }
    });
  }

  async getFlavors() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/flavors/detail');
  }

  async getFlavor(flavorId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/flavors/${flavorId}`);
  }

  async getUsage() {
    const params = addProjectScopeParams('nova');
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/os-simple-tenant-usage', 'GET', undefined, params);
  }

  async getServerDiagnostics(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/diagnostics`);
  }

  async getServerTopology(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/topology`);
  }

  async getInstanceActions(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/os-instance-actions`);
  }

  async getAvailabilityZones() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/os-availability-zone/detail');
  }

  // 하이퍼바이저 정보 (실제 하드웨어 리소스 상태)
  async getHypervisors() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/os-hypervisors/detail');
  }

  async getHypervisorStatistics() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/os-hypervisors/statistics');
  }

  // 할당량 정보
  async getQuotas() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/os-quota-sets');
  }

  async getServerGroups() {
    const params = addProjectScopeParams('nova');
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/os-server-groups', 'GET', undefined, params);
  }

  async getKeyPairs() {
    const params = addProjectScopeParams('nova');
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/os-keypairs', 'GET', undefined, params);
  }

  async createKeyPair(keyPairData: { name: string; type?: string; public_key?: string }) {
    console.log('키페어 생성 요청:', keyPairData);
    
    const requestData = {
      keypair: {
        name: keyPairData.name,
        ...(keyPairData.type && { type: keyPairData.type }),
        ...(keyPairData.public_key && { public_key: keyPairData.public_key })
      }
    };
    
    console.log('Nova API 요청 데이터:', requestData);
    
    try {
      const response = await this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/os-keypairs', 'POST', requestData);
      console.log('키페어 생성 성공:', response);
      return response;
    } catch (error: any) {
      console.error('키페어 생성 상세 오류:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        message: error?.message
      });
      throw error;
    }
  }

  async deleteKeyPair(keyPairName: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/os-keypairs/${keyPairName}`, 'DELETE');
  }

  async createSnapshot(serverId: string, name: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      createImage: { name }
    });
  }

  async resizeServer(serverId: string, flavorRef: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      resize: { flavorRef }
    });
  }

  async confirmResize(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      confirmResize: null
    });
  }

  async revertResize(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/action`, 'POST', {
      revertResize: null
    });
  }

  // 인스턴스 메타데이터 업데이트
  async updateServerMetadata(serverId: string, metadata: { [key: string]: string }) {
    const metadataData = {
      metadata: metadata
    };
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/metadata`, 'PUT', metadataData);
  }

  // 개별 메타데이터 항목 설정
  async setServerMetadata(serverId: string, key: string, value: string) {
    const metaData = {
      meta: {
        [key]: value
      }
    };
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/metadata/${key}`, 'PUT', metaData);
  }

  // 인스턴스 메타데이터 가져오기
  async getServerMetadata(serverId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${serverId}/metadata`, 'GET');
  }
}

// Neutron 서비스 (네트워크)
export class NeutronService extends BaseOpenStackService {
  async getNetworks() {
    const params = addProjectScopeParams('neutron');
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/networks', 'GET', undefined, params);
  }

  async getNetwork(networkId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, `/v2.0/networks/${networkId}`);
  }

  async createNetwork(networkData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/networks', 'POST', networkData);
  }

  async deleteNetwork(networkId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, `/v2.0/networks/${networkId}`, 'DELETE');
  }

  // 보안그룹 관련 메서드들
  async getSecurityGroups() {
    try {
      const params = addProjectScopeParams('neutron');
      const response = await this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/security-groups', 'GET', undefined, params);
      
      // 각 보안그룹에 대해 규칙 정보가 없으면 빈 배열로 초기화
      if (response.security_groups) {
        response.security_groups = response.security_groups.map((sg: any) => ({
          ...sg,
          rules: sg.security_group_rules || sg.rules || []
        }));
      }
      
      return response;
    } catch (error) {
      console.error('보안그룹 조회 실패:', error);
      throw error;
    }
  }

  async getSecurityGroup(securityGroupId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, `/v2.0/security-groups/${securityGroupId}`);
  }

  async createSecurityGroup(securityGroupData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/security-groups', 'POST', securityGroupData);
  }

  async deleteSecurityGroup(securityGroupId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, `/v2.0/security-groups/${securityGroupId}`, 'DELETE');
  }

  async updateSecurityGroup(securityGroupId: string, securityGroupData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, `/v2.0/security-groups/${securityGroupId}`, 'PUT', securityGroupData);
  }

  // 보안그룹 규칙 관련 메서드들
  async getSecurityGroupRules(securityGroupId?: string) {
    const url = securityGroupId 
      ? `/v2.0/security-group-rules?security_group_id=${securityGroupId}`
      : '/v2.0/security-group-rules';
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, url);
  }

  async createSecurityGroupRule(ruleData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/security-group-rules', 'POST', ruleData);
  }

  async deleteSecurityGroupRule(ruleId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, `/v2.0/security-group-rules/${ruleId}`, 'DELETE');
  }

  async getSubnets() {
    const params = addProjectScopeParams('neutron');
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/subnets', 'GET', undefined, params);
  }

  async getRouters() {
    const params = addProjectScopeParams('neutron');
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/routers', 'GET', undefined, params);
  }

  async getFloatingIps() {
    const params = addProjectScopeParams('neutron');
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/floatingips', 'GET', undefined, params);
  }

  async getPorts() {
    const params = addProjectScopeParams('neutron');
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/ports', 'GET', undefined, params);
  }

  async getPort(portId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, `/v2.0/ports/${portId}`);
  }

  async updatePort(portId: string, portData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, `/v2.0/ports/${portId}`, 'PUT', portData);
  }

  async createFloatingIP(floatingIPData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/floatingips', 'POST', floatingIPData);
  }

  async updateFloatingIP(floatingIPId: string, floatingIPData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, `/v2.0/floatingips/${floatingIPId}`, 'PUT', floatingIPData);
  }

  async deleteFloatingIP(floatingIPId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, `/v2.0/floatingips/${floatingIPId}`, 'DELETE');
  }

  async getQuotas() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/quotas');
  }
}

// Glance 서비스 (이미지)
export class GlanceService extends BaseOpenStackService {
  async getImages() {
    const params = addProjectScopeParams('glance');
    return this.makeRequest(OPENSTACK_ENDPOINTS.GLANCE, '/v2/images', 'GET', undefined, params);
  }

  async getImage(imageId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.GLANCE, `/v2/images/${imageId}`);
  }

  async createImage(imageData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.GLANCE, '/v2/images', 'POST', imageData);
  }

  async deleteImage(imageId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.GLANCE, `/v2/images/${imageId}`, 'DELETE');
  }

  async updateImage(imageId: string, updateData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.GLANCE, `/v2/images/${imageId}`, 'PUT', updateData);
  }
}

// Cinder 서비스 (블록 스토리지)
export class CinderService extends BaseOpenStackService {
  // Cinder API 버전을 동적으로 감지하고 호출하는 헬퍼 메서드
  private async tryMultipleCinderVersions(
    paths: string[],
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', 
    data?: any, 
    params?: any
  ): Promise<any> {
    // v3, 루트, v2, v1 순서로 시도
    const endpoints = [
      `${OPENSTACK_ENDPOINTS.CINDER}/v3`,
      OPENSTACK_ENDPOINTS.CINDER,
      `${OPENSTACK_ENDPOINTS.CINDER}/v2`,
      `${OPENSTACK_ENDPOINTS.CINDER}/v1`
    ];
    let lastError: any = null;
    for (const path of paths) {
      for (const endpoint of endpoints) {
        try {
          return await this.makeRequest(endpoint, path, method, data, params);
        } catch (error: any) {
          lastError = error;
          if (error?.response?.status !== 404 && error?.response?.status !== 400) {
            break;
          }
        }
      }
    }
    throw lastError;
  }

  async getVolumes() {
    const currentProjectId = this.getCurrentProjectId();
    try {
      if (isAdminUser()) {
        // 관리자는 모든 프로젝트 볼륨 조회
        const params = { all_tenants: 'True' };
        const paths = ['/volumes/detail'];
        const result = await this.tryMultipleCinderVersions(paths, 'GET', undefined, params);
        return result;
      } else {
        // 일반 사용자는 Cinder v3/v2/v1/루트 여러 경로 → 실패 시 Nova API fallback
        const paths = ['/volumes/detail'];
        try {
          const result = await this.tryMultipleCinderVersions(paths, 'GET');
          if (result && Array.isArray(result.volumes)) {
            return result;
          }
        } catch (cinderError) {
          // Cinder 실패 시 Nova API 여러 경로 fallback
          const novaPaths = ['/os-volumes', '/os-volumes_boot', '/volumes'];
          for (const novaPath of novaPaths) {
            try {
              const novaResult = await this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, novaPath, 'GET');
              const volumes = novaResult.volumes || [];
              if (volumes.length > 0) return { volumes };
            } catch (novaError) {
              // 다음 경로 시도
            }
          }
          // Nova API도 실패하면 빈 배열 반환
          return { volumes: [] };
        }
        // 모든 시도 실패 시 빈 결과 반환
        return { volumes: [] };
      }
    } catch (error: any) {
      // 모든 시도 실패 시 빈 결과 반환
      return { volumes: [] };
    }
  }

  async getVolume(volumeId: string) {
    const currentProjectId = this.getCurrentProjectId();
    const paths = currentProjectId
      ? [`/${currentProjectId}/volumes/${volumeId}`, `/volumes/${volumeId}`]
      : [`/volumes/${volumeId}`];
    return this.tryMultipleCinderVersions(paths);
  }

  async createVolume(volumeData: any) {
    const currentProjectId = this.getCurrentProjectId();
    
    console.log('🔧 볼륨 생성 시작:', {
      hasProjectId: !!currentProjectId,
      projectId: currentProjectId,
      isAdmin: isAdminUser(),
      originalVolumeData: volumeData
    });
    
    // 표준 Cinder API 형식으로 요청 데이터 구성
    const volumeSize = parseInt(volumeData.volume?.size) || 1;
    const volumeName = String(volumeData.volume?.name || '').trim();
    const volumeDescription = String(volumeData.volume?.description || '').trim();
    
    if (volumeSize < 1) {
      throw new Error('볼륨 크기는 최소 1GB여야 합니다.');
    }
    
    if (!volumeName) {
      throw new Error('볼륨 이름이 필요합니다.');
    }
    
    const standardVolumeData = {
      volume: {
        size: volumeSize,
        name: volumeName,
        description: volumeDescription,
        ...(volumeData.volume?.volume_type && volumeData.volume.volume_type.trim() && { volume_type: String(volumeData.volume.volume_type).trim() }),
        ...(volumeData.volume?.availability_zone && volumeData.volume.availability_zone.trim() && { availability_zone: String(volumeData.volume.availability_zone).trim() }),
        ...(volumeData.volume?.source_volid && { source_volid: String(volumeData.volume.source_volid) }),
        ...(volumeData.volume?.source_replica && { source_replica: String(volumeData.volume.source_replica) }),
        ...(volumeData.volume?.consistencygroup_id && { consistencygroup_id: String(volumeData.volume.consistencygroup_id) }),
        ...(volumeData.volume?.snapshot_id && { snapshot_id: String(volumeData.volume.snapshot_id) }),
        ...(volumeData.volume?.imageRef && { imageRef: String(volumeData.volume.imageRef) }),
        ...(volumeData.volume?.metadata && { metadata: volumeData.volume.metadata })
      }
    };
    
    // project_id는 서버에서 토큰을 기반으로 자동 설정되므로 제거
    // 명시적으로 설정하면 오히려 오류가 발생할 수 있음
    
    console.log('📤 표준화된 볼륨 생성 요청 데이터:', standardVolumeData);
    
    try {
      // 프로젝트 ID를 URL에 포함
      const currentProjectId = this.getCurrentProjectId();
      let createPath = '/volumes';
      
      if (currentProjectId) {
        createPath = `/${currentProjectId}/volumes`;
        console.log('🔗 프로젝트 스코프 생성 경로:', createPath);
      }
      
      const result = await this.tryMultipleCinderVersions([createPath], 'POST', standardVolumeData);
      console.log('✅ 볼륨 생성 성공:', result);
      return result;
    } catch (error: any) {
      console.error('❌ Cinder API 볼륨 생성 오류:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        message: error?.message
      });
      
      // 일반 사용자가 Cinder API에 접근할 수 없는 경우 (404) 오류 메시지 개선
      if (error?.response?.status === 404) {
        console.warn('⚠️ 일반 사용자는 직접 볼륨 생성이 제한됩니다.');
        const customError = new Error(
          '일반 사용자는 직접 볼륨을 생성할 수 없습니다. 인스턴스 생성 시 볼륨 옵션을 선택하여 볼륨과 함께 인스턴스를 생성해주세요.'
        );
        customError.name = 'VolumeLimitationError';
        throw customError;
      }
      
      throw error;
    }
  }

  async deleteVolume(volumeId: string) {
    const currentProjectId = this.getCurrentProjectId();
    const paths = currentProjectId
      ? [`/${currentProjectId}/volumes/${volumeId}`, `/volumes/${volumeId}`]
      : [`/volumes/${volumeId}`];
    return this.tryMultipleCinderVersions(paths, 'DELETE');
  }

  async updateVolume(volumeId: string, volumeData: any) {
    const currentProjectId = this.getCurrentProjectId();
    const path = currentProjectId ? `/${currentProjectId}/volumes/${volumeId}` : `/volumes/${volumeId}`;
    return this.tryMultipleCinderVersions([path], 'PUT', volumeData);
  }

  async attachVolume(volumeId: string, instanceId: string, device?: string) {
    const attachData: any = {
      volumeAttachment: {
        volumeId: volumeId,
        ...(device && { device })
      }
    };
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${instanceId}/os-volume_attachments`, 'POST', attachData);
  }

  async detachVolume(instanceId: string, volumeId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${instanceId}/os-volume_attachments/${volumeId}`, 'DELETE');
  }

  // 강제 볼륨 분리 (Cinder API 직접 사용)
  async forceDetachVolume(volumeId: string) {
    const actionData = {
      'os-force_detach': {}
    };
    return this.tryMultipleCinderVersions(['/volumes/${volumeId}/action'], 'POST', actionData);
  }

  // 볼륨 연결 정보 제거 (Cinder DB에서 강제로 attachment 정보 제거)
  async resetVolumeAttachment(volumeId: string) {
    const actionData = {
      'os-reset_status': {
        status: 'available',
        attach_status: 'detached'
      }
    };
    return this.tryMultipleCinderVersions(['/volumes/${volumeId}/action'], 'POST', actionData);
  }

  // 단순 볼륨 상태 강제 변경 (관리자 권한)
  async forceResetVolumeState(volumeId: string, status = 'available') {
    const actionData = {
      'os-reset_status': {
        status: status
      }
    };
    return this.tryMultipleCinderVersions(['/volumes/${volumeId}/action'], 'POST', actionData);
  }

  // 모든 attachment 강제 해제
  async clearAllAttachments(volumeId: string) {
    try {
      // 볼륨 정보 먼저 가져오기
      const volumeInfo = await this.getVolume(volumeId);
      const attachments = volumeInfo.volume?.attachments || [];
      
      console.log(`볼륨 ${volumeId}의 연결 정보:`, attachments);
      
      // 각 attachment에 대해 강제 분리 시도
      for (const attachment of attachments) {
        try {
          console.log(`Attachment ${attachment.id} 강제 해제 시도...`);
          
          // Nova API를 통한 attachment 삭제 시도
          if (attachment.server_id) {
            await this.makeRequest(
              OPENSTACK_ENDPOINTS.NOVA, 
              `/servers/${attachment.server_id}/os-volume_attachments/${volumeId}`, 
              'DELETE'
            );
          }
        } catch (error) {
          console.warn(`Attachment ${attachment.id} 삭제 실패:`, error);
          // 실패해도 계속 진행
        }
      }
      
      return true;
    } catch (error) {
      console.error(`볼륨 ${volumeId} attachment 정리 실패:`, error);
      return false;
    }
  }

  // 볼륨 상태 확인
  async checkVolumeStatus(volumeId: string) {
    try {
      const response = await this.getVolume(volumeId);
      return {
        status: response.volume?.status,
        attach_status: response.volume?.attach_status,
        attachments: response.volume?.attachments || []
      };
    } catch (error) {
      console.error(`볼륨 ${volumeId} 상태 확인 실패:`, error);
      return null;
    }
  }

  // 볼륨이 완전히 분리될 때까지 대기
  async waitForVolumeDetached(volumeId: string, maxWaitSeconds = 30) {
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    
    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkVolumeStatus(volumeId);
      
      if (!status) {
        throw new Error(`볼륨 ${volumeId} 상태를 확인할 수 없습니다.`);
      }
      
      console.log(`볼륨 ${volumeId} 상태: ${status.status}, 연결 상태: ${status.attach_status}, 연결 수: ${status.attachments.length}`);
      
      // 볼륨이 완전히 분리되었는지 확인
      if (status.status === 'available' && 
          (status.attach_status === 'detached' || !status.attach_status) && 
          status.attachments.length === 0) {
        console.log(`볼륨 ${volumeId} 분리 완료`);
        return true;
      }
      
      // 2초 대기 후 다시 확인
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`볼륨 ${volumeId} 분리 타임아웃 (${maxWaitSeconds}초)`);
  }

  async getVolumeAttachments(instanceId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${instanceId}/os-volume_attachments`);
  }

  async getVolumeTypes() {
    try {
      // 일반 사용자인 경우 프로젝트 ID를 URL에 포함
      const currentProjectId = getCurrentProjectId();
      let typesPath = '/types';
      
      if (!isAdminUser() && currentProjectId) {
        typesPath = `/${currentProjectId}/types`;
      }
      
      const result = await this.tryMultipleCinderVersions([typesPath]);
      return result;
    } catch (error: any) {
      // 모든 오류의 경우 기본 타입 제공
      return {
        volume_types: [
          {
            id: 'default',
            name: '__DEFAULT__',
            description: 'Default volume type',
            is_public: true,
            extra_specs: {}
          }
        ]
      };
    }
  }

  async getSnapshots() {
    try {
      if (isAdminUser()) {
        // 관리자는 모든 프로젝트의 스냅샷 조회
        const params = addProjectScopeParams('cinder');
        return this.tryMultipleCinderVersions(['/snapshots/detail'], 'GET', undefined, params);
      } else {
        // 일반 사용자는 현재 프로젝트 스냅샷만 조회 (기본 동작)
        return this.tryMultipleCinderVersions(['/snapshots/detail']);
      }
    } catch (error) {
      console.error('스냅샷 조회 실패:', error);
      throw error;
    }
  }

  async createSnapshot(snapshotData: any) {
    return this.tryMultipleCinderVersions(['/snapshots'], 'POST', snapshotData);
  }

  async deleteSnapshot(snapshotId: string) {
    return this.tryMultipleCinderVersions([`/snapshots/${snapshotId}`], 'DELETE');
  }

  // 할당량 정보
  async getQuotas() {
    const currentProjectId = this.getCurrentProjectId();
    if (!currentProjectId) {
      throw new Error('프로젝트 정보가 없습니다.');
    }
    
    // 기본 quota API 사용
    return this.tryMultipleCinderVersions([`/os-quota-sets/${currentProjectId}`]);
  }

  // 볼륨 통계 (관리자용)
  async getVolumeStatistics() {
    if (!isAdminUser()) {
      throw new Error('관리자 권한이 필요합니다.');
    }
    return this.tryMultipleCinderVersions(['/scheduler-stats/get_pools']);
  }

  // 현재 프로젝트 ID 가져오기 헬퍼 메서드
  private getCurrentProjectId(): string | null {
    try {
      console.log('🔍 프로젝트 ID 검색 시작...');
      
      // 1. Zustand 스토어에서 가져오기 시도
      const keystoneAuthData = JSON.parse(localStorage.getItem('keystone-auth-storage') || '{}');
      const keystoneProjectId = keystoneAuthData?.state?.currentProject?.id;
      
      // 2. 기존 auth 스토리지에서 가져오기 시도
      const authData = JSON.parse(localStorage.getItem('auth-storage') || '{}');
      const authProjectId = authData?.state?.project?.id;
      
      // 3. authService에서 직접 가져오기 시도
      const token = authService.getToken();
      let tokenProjectId = null;
      if (token) {
        try {
          // JWT 토큰 디코딩 시도 (Base64)
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            tokenProjectId = payload.project?.id;
          }
        } catch (e) {
          // JWT가 아닌 경우 무시
        }
      }
      
      const projectId = keystoneProjectId || authProjectId || tokenProjectId;
      
      console.log('🔍 프로젝트 ID 검색 결과:', {
        keystoneProjectId,
        authProjectId,
        tokenProjectId,
        finalProjectId: projectId,
        isAdmin: isAdminUser(),
        hasToken: !!token,
        tokenLength: token?.length,
        keystoneAuthFull: keystoneAuthData?.state,
        authDataFull: authData?.state
      });
      
      if (!projectId && !isAdminUser()) {
        console.error('❌ 일반 사용자인데 프로젝트 ID를 찾을 수 없습니다!');
        console.error('전체 keystoneAuth 상태:', keystoneAuthData);
        console.error('전체 auth 상태:', authData);
        console.error('토큰 존재 여부:', !!token);
      }
      
      return projectId;
    } catch (error) {
      console.error('❌ 프로젝트 ID 가져오기 실패:', error);
      return null;
    }
  }

  // ========== 강화된 볼륨 관리 메서드들 ==========
  
  // 볼륨 스냅샷 존재 여부 확인
  async checkVolumeSnapshots(volumeId: string) {
    try {
      const snapshots = await this.getSnapshots();
      const volumeSnapshots = snapshots.snapshots?.filter((snap: any) => snap.volume_id === volumeId) || [];
      return {
        hasSnapshots: volumeSnapshots.length > 0,
        snapshots: volumeSnapshots,
        count: volumeSnapshots.length
      };
    } catch (error) {
      console.warn(`볼륨 ${volumeId} 스냅샷 확인 실패:`, error);
      return { hasSnapshots: false, snapshots: [], count: 0 };
    }
  }
  
  // 볼륨 백업 존재 여부 확인 (간단한 구현)
  async checkVolumeBackups(volumeId: string) {
    try {
      // 실제 환경에서는 백업 API 호출 필요
      // 현재는 기본값 반환
      return { hasBackups: false, backups: [], count: 0 };
    } catch (error) {
      console.warn(`볼륨 ${volumeId} 백업 확인 실패:`, error);
      return { hasBackups: false, backups: [], count: 0 };
    }
  }
  
  // 단계별 안전한 볼륨 분리
  async safeDetachVolume(instanceId: string, volumeId: string, volumeName?: string) {
    const volName = volumeName || volumeId;
    console.log(`🔧 ${volName} 안전한 분리 프로세스 시작`);
    
    // 현재 상태 확인
    const initialStatus = await this.checkVolumeStatus(volumeId);
    if (!initialStatus) {
      throw new Error(`볼륨 ${volName} 상태를 확인할 수 없습니다.`);
    }
    
    console.log(`   현재 상태: ${initialStatus.status}, 연결 수: ${initialStatus.attachments.length}`);
    
    // 이미 분리된 경우
    if (initialStatus.status === 'available' && initialStatus.attachments.length === 0) {
      console.log(`   ✅ ${volName} 이미 분리된 상태`);
      return true;
    }
    
    // 1단계: Nova API 일반 분리
    try {
      console.log(`   🔄 1단계: Nova API 일반 분리 시도...`);
      await this.detachVolume(instanceId, volumeId);
      
      // 분리 완료 대기 (최대 20초)
      try {
        await this.waitForVolumeDetached(volumeId, 20);
        console.log(`   ✅ 1단계 성공: ${volName} Nova API 분리 완료`);
        return true;
      } catch (waitError) {
        console.log(`   ⚠️ 1단계 실패: 분리 대기 타임아웃`);
      }
    } catch (detachError) {
      console.log(`   ⚠️ 1단계 실패: Nova API 분리 오류`);
    }
    
    // 2단계: Cinder API 강제 분리
    try {
      console.log(`   🔄 2단계: Cinder API 강제 분리 시도...`);
      await this.forceDetachVolume(volumeId);
      
      try {
        await this.waitForVolumeDetached(volumeId, 15);
        console.log(`   ✅ 2단계 성공: ${volName} Cinder API 강제 분리 완료`);
        return true;
      } catch (waitError) {
        console.log(`   ⚠️ 2단계 실패: 강제 분리 대기 타임아웃`);
      }
    } catch (forceDetachError) {
      console.log(`   ⚠️ 2단계 실패: Cinder API 강제 분리 오류`);
    }
    
    // 3단계: 모든 attachment 개별 정리
    try {
      console.log(`   🔄 3단계: attachment 개별 정리 시도...`);
      await this.clearAllAttachments(volumeId);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusAfterClear = await this.checkVolumeStatus(volumeId);
      if (statusAfterClear?.attachments?.length === 0) {
        console.log(`   ✅ 3단계 성공: ${volName} attachment 정리 완료`);
        return true;
      }
    } catch (clearError) {
      console.log(`   ⚠️ 3단계 실패: attachment 정리 오류`);
    }
    
    // 4단계: 볼륨 상태 강제 리셋 (최후 수단)
    try {
      console.log(`   🔄 4단계: 볼륨 상태 강제 리셋 시도...`);
      await this.forceResetVolumeState(volumeId, 'available');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const finalStatus = await this.checkVolumeStatus(volumeId);
      if (finalStatus?.status === 'available') {
        console.log(`   ✅ 4단계 성공: ${volName} 상태 리셋 완료`);
        return true;
      }
    } catch (resetError) {
      console.log(`   ❌ 4단계 실패: 상태 리셋 오류`);
    }
    
    console.log(`   ❌ ${volName} 모든 분리 시도 실패`);
    return false;
  }
  
  // 인스턴스 완전 삭제 대기
  async waitForInstanceDeleted(instanceId: string, maxWaitSeconds = 60) {
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    
    console.log(`⏳ 인스턴스 ${instanceId} 완전 삭제 대기 (최대 ${maxWaitSeconds}초)`);
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        await this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, `/servers/${instanceId}`, 'GET');
        // 인스턴스가 여전히 존재함
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        if (error?.response?.status === 404) {
          console.log(`✅ 인스턴스 ${instanceId} 완전 삭제 확인`);
          return true;
        }
        // 다른 오류는 계속 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`⚠️ 인스턴스 ${instanceId} 삭제 대기 타임아웃`);
    return false;
  }
  
  // 의존성 체크 후 안전한 볼륨 삭제
  async safeDeleteVolume(volumeId: string, volumeName?: string) {
    const volName = volumeName || volumeId;
    console.log(`🗑️ ${volName} 안전한 삭제 프로세스 시작`);
    
    // 1. 현재 상태 확인
    const status = await this.checkVolumeStatus(volumeId);
    if (!status) {
      throw new Error(`볼륨 ${volName} 상태를 확인할 수 없습니다.`);
    }
    
    console.log(`   상태: ${status.status}, 연결 수: ${status.attachments.length}`);
    
    // 2. 연결 상태 확인
    if (status.attachments.length > 0) {
      console.log(`   ❌ ${volName}이 여전히 연결되어 있음. 먼저 분리 필요.`);
      throw new Error(`볼륨 ${volName}이 인스턴스에 연결되어 있어 삭제할 수 없습니다.`);
    }
    
    // 3. 스냅샷 존재 여부 확인
    const snapshotCheck = await this.checkVolumeSnapshots(volumeId);
    if (snapshotCheck.hasSnapshots) {
      console.log(`   ⚠️ ${volName}에 ${snapshotCheck.count}개 스냅샷 존재`);
      const shouldContinue = confirm(
        `볼륨 "${volName}"에 ${snapshotCheck.count}개의 스냅샷이 있습니다.\n\n` +
        `볼륨을 삭제하면 스냅샷도 함께 삭제될 수 있습니다.\n\n` +
        `계속 진행하시겠습니까?`
      );
      if (!shouldContinue) {
        throw new Error('사용자가 스냅샷 존재로 인해 삭제를 취소했습니다.');
      }
    }
    
    // 4. 백업 존재 여부 확인
    const backupCheck = await this.checkVolumeBackups(volumeId);
    if (backupCheck.hasBackups) {
      console.log(`   ⚠️ ${volName}에 백업 존재`);
    }
    
    // 5. 삭제 시도
    try {
      console.log(`   🗑️ ${volName} 삭제 요청 전송...`);
      await this.deleteVolume(volumeId);
      
      // 6. 삭제 완료 대기
      console.log(`   ⏳ ${volName} 삭제 완료 대기...`);
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const checkVolume = await this.getVolume(volumeId);
          
          if (checkVolume.volume.status === 'deleting') {
            console.log(`   ⏳ ${volName} 삭제 진행 중... (${attempts + 1}/${maxAttempts})`);
          } else {
            console.log(`   📋 ${volName} 현재 상태: ${checkVolume.volume.status}`);
          }
          attempts++;
        } catch (checkError: any) {
          if (checkError?.response?.status === 404) {
            console.log(`   ✅ ${volName} 삭제 완료 확인`);
            return true;
          }
          attempts++;
        }
      }
      
      console.log(`   ⚠️ ${volName} 삭제 완료 확인 타임아웃`);
      return true; // 타임아웃이어도 삭제 요청은 성공했으므로 true 반환
      
    } catch (deleteError) {
      console.error(`   ❌ ${volName} 삭제 실패:`, deleteError);
      throw deleteError;
    }
  }
  
  // 고아 볼륨 정리 (미사용 기능, 향후 확장용)
  async cleanupOrphanedVolumes() {
    console.log('🧹 고아 볼륨 정리 시작...');
    
    try {
      const volumes = await this.getVolumes();
      const orphanedVolumes = volumes.volumes?.filter((vol: any) => 
        vol.status === 'error' || 
        (vol.status === 'available' && vol.name?.includes('_orphaned_'))
      ) || [];
      
      console.log(`발견된 고아 볼륨: ${orphanedVolumes.length}개`);
      
      for (const vol of orphanedVolumes) {
        try {
          console.log(`🧹 고아 볼륨 정리: ${vol.name} (${vol.id})`);
          await this.safeDeleteVolume(vol.id, vol.name);
        } catch (error) {
          console.error(`고아 볼륨 ${vol.name} 정리 실패:`, error);
        }
      }
      
      return orphanedVolumes.length;
    } catch (error) {
      console.error('고아 볼륨 정리 실패:', error);
      return 0;
    }
  }

  // ========== 응급 볼륨 정리 메서드들 (데이터베이스 레벨) ==========
  
  // 볼륨 attachment 테이블에서 강제 삭제
  async forceCleanVolumeAttachment(volumeId: string) {
    console.log(`🔧 볼륨 ${volumeId} attachment 테이블 강제 정리 시도...`);
    
    try {
      // Cinder 관리자 API를 통한 attachment 강제 정리
      // 실제로는 os-reset_status 액션을 사용하여 상태를 리셋
      const resetData = {
        'os-reset_status': {
          status: 'available',
          attach_status: 'detached'
        }
      };
      
      const result = await this.tryMultipleCinderVersions([`/volumes/${volumeId}/action`], 'POST', resetData);
      console.log(`✅ 볼륨 ${volumeId} 상태 강제 리셋 성공`);
      return result;
    } catch (error) {
      console.error(`❌ 볼륨 ${volumeId} 상태 강제 리셋 실패:`, error);
      throw error;
    }
  }
  
  // 볼륨을 강제로 available 상태로 변경
  async forceSetVolumeAvailable(volumeId: string) {
    console.log(`🔧 볼륨 ${volumeId} 상태를 강제로 available로 변경...`);
    
    try {
      const resetData = {
        'os-reset_status': {
          status: 'available'
        }
      };
      
      const result = await this.tryMultipleCinderVersions([`/volumes/${volumeId}/action`], 'POST', resetData);
      console.log(`✅ 볼륨 ${volumeId} 상태 available로 강제 변경 성공`);
      return result;
    } catch (error) {
      console.error(`❌ 볼륨 ${volumeId} 상태 강제 변경 실패:`, error);
      throw error;
    }
  }
  
  // 응급 볼륨 정리 - 데이터베이스 레벨에서 강제 정리
  async emergencyVolumeCleanup(volumeId: string, volumeName?: string) {
    const volName = volumeName || volumeId;
    console.log(`🚨 볼륨 ${volName} 응급 정리 프로세스 시작`);
    
    try {
      // 1단계: 현재 상태 확인
      const initialStatus = await this.checkVolumeStatus(volumeId);
      console.log(`   현재 상태: ${initialStatus?.status}, 연결 수: ${initialStatus?.attachments?.length || 0}`);
      
      // 2단계: 모든 attachment를 강제로 정리 (Nova API 통해서)
      if (initialStatus?.attachments && initialStatus.attachments.length > 0) {
        console.log(`   🔧 ${initialStatus.attachments.length}개 attachment 강제 정리 시도...`);
        
        for (const attachment of initialStatus.attachments) {
          try {
            if (attachment.server_id) {
              // Nova API를 통한 강제 분리 시도
              await this.makeRequest(
                OPENSTACK_ENDPOINTS.NOVA, 
                `/servers/${attachment.server_id}/os-volume_attachments/${volumeId}`, 
                'DELETE'
              );
              console.log(`     ✅ 인스턴스 ${attachment.server_id}에서 강제 분리 시도 완료`);
            }
          } catch (detachError) {
            console.log(`     ⚠️ 인스턴스 ${attachment.server_id}에서 분리 실패 (계속 진행)`);
          }
        }
        
        // 3초 대기
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // 3단계: Cinder 데이터베이스에서 볼륨 상태 강제 리셋
      console.log(`   🔧 볼륨 상태 데이터베이스 레벨에서 강제 리셋...`);
      await this.forceCleanVolumeAttachment(volumeId);
      
      // 4단계: 상태가 available로 변경되었는지 확인
      await new Promise(resolve => setTimeout(resolve, 2000));
      const finalStatus = await this.checkVolumeStatus(volumeId);
      
      if (finalStatus?.status === 'available' && finalStatus?.attachments?.length === 0) {
        console.log(`✅ 볼륨 ${volName} 응급 정리 성공`);
        return true;
      } else {
        console.log(`⚠️ 볼륨 ${volName} 응급 정리 부분 성공 (상태: ${finalStatus?.status}, 연결: ${finalStatus?.attachments?.length || 0})`);
        return true; // 부분 성공도 true로 처리
      }
      
    } catch (error) {
      console.error(`❌ 볼륨 ${volName} 응급 정리 실패:`, error);
      throw error;
    }
  }
}

// 서비스 인스턴스 생성
export const novaService = new NovaService();
export const neutronService = new NeutronService();
export const glanceService = new GlanceService();
export const cinderService = new CinderService(); 