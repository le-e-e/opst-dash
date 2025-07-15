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

  async getSubnets() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/subnets');
  }

  async getRouters() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/routers');
  }

  async getFloatingIps() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/floatingips');
  }

  async getSecurityGroups() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/security-groups');
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

  async getSecurityGroupRules() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/security-group-rules');
  }

  async createSecurityGroupRule(ruleData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, '/v2.0/security-group-rules', 'POST', ruleData);
  }

  async deleteSecurityGroupRule(ruleId: string) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.NEUTRON, `/v2.0/security-group-rules/${ruleId}`, 'DELETE');
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

  async getVolumeTypes() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, '/types');
  }

  async getSnapshots() {
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, '/snapshots/detail');
  }

  async createSnapshot(snapshotData: any) {
    return this.makeRequest(OPENSTACK_ENDPOINTS.CINDER, '/snapshots', 'POST', snapshotData);
  }
}

// 서비스 인스턴스 생성
export const novaService = new NovaService();
export const neutronService = new NeutronService();
export const glanceService = new GlanceService();
export const cinderService = new CinderService(); 