import axios from 'axios';
import { OPENSTACK_ENDPOINTS } from '../config/endpoints';
import authService from './auth';

// 공통 API 클래스
class BaseOpenStackService {
  protected async makeRequest(endpoint: string, path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any) {
    const headers = authService.getAuthHeaders();
    
    try {
      const response = await axios({
        method,
        url: `${endpoint}${path}`,
        headers,
        data
      });
      return response.data;
    } catch (error) {
      console.error(`OpenStack API 요청 실패: ${method} ${endpoint}${path}`, error);
      throw error;
    }
  }
}

// Nova 서비스 (컴퓨트)
export class NovaService extends BaseOpenStackService {
  async getServers() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/servers/detail');
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
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/os-simple-tenant-usage');
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

  async getServerGroups() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/os-server-groups');
  }

  async getKeyPairs() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/os-keypairs');
  }

  async createKeyPair(keyPairData: { name: string; type?: string; public_key?: string }) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NOVA, '/os-keypairs', 'POST', {
      keypair: keyPairData
    });
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
}

// Neutron 서비스 (네트워크)
export class NeutronService extends BaseOpenStackService {
  async getNetworks() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/networks');
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
      const response = await this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/security-groups');
      
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
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/subnets');
  }

  async getRouters() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/routers');
  }

  async getFloatingIps() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/floatingips');
  }

  async getPorts() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/ports');
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
    return this.makeRequest(OPENSTACK_ENDPOINTS.GLANCE, '/v2/images');
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
  async getVolumes() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, '/volumes/detail');
  }

  async getVolume(volumeId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, `/volumes/${volumeId}`);
  }

  async createVolume(volumeData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, '/volumes', 'POST', volumeData);
  }

  async deleteVolume(volumeId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, `/volumes/${volumeId}`, 'DELETE');
  }

  async updateVolume(volumeId: string, volumeData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, `/volumes/${volumeId}`, 'PUT', volumeData);
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
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, `/volumes/${volumeId}/action`, 'POST', actionData);
  }

  // 볼륨 연결 정보 제거 (Cinder DB에서 강제로 attachment 정보 제거)
  async resetVolumeAttachment(volumeId: string) {
    const actionData = {
      'os-reset_status': {
        status: 'available',
        attach_status: 'detached'
      }
    };
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, `/volumes/${volumeId}/action`, 'POST', actionData);
  }

  // 단순 볼륨 상태 강제 변경 (관리자 권한)
  async forceResetVolumeState(volumeId: string, status = 'available') {
    const actionData = {
      'os-reset_status': {
        status: status
      }
    };
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, `/volumes/${volumeId}/action`, 'POST', actionData);
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
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, '/types');
  }

  async getSnapshots() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, '/snapshots/detail');
  }

  async createSnapshot(snapshotData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, '/snapshots', 'POST', snapshotData);
  }

  async deleteSnapshot(snapshotId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, `/snapshots/${snapshotId}`, 'DELETE');
  }
}

// 서비스 인스턴스 생성
export const novaService = new NovaService();
export const neutronService = new NeutronService();
export const glanceService = new GlanceService();
export const cinderService = new CinderService(); 