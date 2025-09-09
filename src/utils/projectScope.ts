import { useKeystoneAuthStore } from '../store/keystoneAuth';

// OpenStack 프로젝트 스코프 기반 리소스 관리

export const getCurrentProjectId = (): string | null => {
  const store = useKeystoneAuthStore.getState();
  const projectId = store.getCurrentProjectId();
  return projectId;
};

export const isCurrentUserAdmin = (): boolean => {
  const store = useKeystoneAuthStore.getState();
  return store.isAdmin;
};

export const canAccessAllProjects = (): boolean => {
  const store = useKeystoneAuthStore.getState();
  return store.canAccessAllProjects();
};

// 프로젝트별 리소스 필터링
export const filterResourcesByProject = (resources: any[], projectIdField: string = 'tenant_id'): any[] => {
  if (canAccessAllProjects()) {
    // 관리자는 모든 리소스 접근 가능
    return resources;
  }

  const currentProjectId = getCurrentProjectId();
  if (!currentProjectId) {
    return [];
  }

  return resources.filter(resource => {
    // OpenStack 리소스는 다양한 필드명으로 프로젝트 ID를 저장
    const resourceProjectId = 
      resource[projectIdField] || 
      resource.project_id || 
      resource.tenant_id ||
      resource.owner;
    
    return resourceProjectId === currentProjectId;
  });
};

// 인스턴스 필터링 (Nova)
export const filterInstancesByProject = (instances: any[]): any[] => {
  return filterResourcesByProject(instances, 'tenant_id');
};

// 볼륨 필터링 (Cinder)
export const filterVolumesByProject = (volumes: any[]): any[] => {

  if (canAccessAllProjects()) {
    return volumes;
  }

  const currentProjectId = getCurrentProjectId();
  if (!currentProjectId) {
    return [];
  }

  // Nova API로 조회한 볼륨인지 확인 (프로젝트 정보가 없는 경우)
  const hasProjectInfo = volumes.some(volume => 
    volume.project_id || 
    volume.tenant_id || 
    volume.os_vol_tenant_attr_tenant_id || 
    volume.owner
  );

  if (!hasProjectInfo && volumes.length > 0) {
    return volumes;
  }

  const filteredVolumes = volumes.filter(volume => {
    // Cinder 볼륨은 project_id 필드를 주로 사용
    const volumeProjectId = 
      volume.project_id || 
      volume.tenant_id ||
      volume.os_vol_tenant_attr_tenant_id || // 일부 배포에서 사용하는 필드
      volume.owner;
    
    const isMatch = volumeProjectId === currentProjectId;
    return isMatch;
  });

  // 로그 제거

  return filteredVolumes;
};

// 네트워크 필터링 (Neutron)
export const filterNetworksByProject = (networks: any[]): any[] => {
  if (canAccessAllProjects()) {
    return networks;
  }

  const currentProjectId = getCurrentProjectId();
  if (!currentProjectId) {
    return [];
  }

  return networks.filter(network => {
    // 공유 네트워크와 외부 네트워크는 모든 프로젝트에서 사용 가능
    if (network.shared === true || network['router:external'] === true) {
      return true;
    }
    
    // 프라이빗 네트워크는 해당 프로젝트만 사용 가능
    return (network.project_id || network.tenant_id) === currentProjectId;
  });
};

// 이미지 필터링 (Glance)
export const filterImagesByProject = (images: any[]): any[] => {
  if (canAccessAllProjects()) {
    return images;
  }

  const currentProjectId = getCurrentProjectId();
  if (!currentProjectId) {
    return [];
  }

  return images.filter(image => {
    // 퍼블릭 이미지는 모든 프로젝트에서 사용 가능
    if (image.visibility === 'public') {
      return true;
    }
    
    // 프라이빗 이미지는 해당 프로젝트만 사용 가능
    return image.owner === currentProjectId;
  });
};

// 스냅샷 필터링
export const filterSnapshotsByProject = (snapshots: any[]): any[] => {
  return filterResourcesByProject(snapshots, 'project_id');
};

// 플로팅 IP 필터링
export const filterFloatingIPsByProject = (floatingIPs: any[]): any[] => {
  return filterResourcesByProject(floatingIPs, 'project_id');
};

// 보안 그룹 필터링
export const filterSecurityGroupsByProject = (securityGroups: any[]): any[] => {
  return filterResourcesByProject(securityGroups, 'project_id');
};

// 키페어 필터링 (Nova)
export const filterKeyPairsByProject = (keyPairs: any[]): any[] => {
  return filterResourcesByProject(keyPairs, 'user_id'); // 키페어는 user_id로 필터링
};

// 리소스 소유자 정보 가져오기
export const getResourceOwnerInfo = (resource: any): { projectId: string; projectName?: string } | null => {
  const projectId = 
    resource.project_id || 
    resource.tenant_id || 
    resource.owner;
    
  if (projectId) {
    return { 
      projectId,
      projectName: resource.project_name || undefined
    };
  }
  
  return null;
};

// 현재 프로젝트의 리소스인지 확인
export const isResourceOwnedByCurrentProject = (resource: any): boolean => {
  if (canAccessAllProjects()) {
    return true; // 관리자는 모든 리소스 접근 가능
  }
  
  const currentProjectId = getCurrentProjectId();
  if (!currentProjectId) {
    return false;
  }
  
  const ownerInfo = getResourceOwnerInfo(resource);
  return ownerInfo?.projectId === currentProjectId;
};

// API 요청에 프로젝트 스코프 추가
export const addProjectScopeToQuery = (params: Record<string, any> = {}): Record<string, any> => {
  if (canAccessAllProjects()) {
    // 관리자는 all_tenants=1 플래그 추가하여 모든 프로젝트 리소스 조회
    return {
      ...params,
      all_tenants: 1
    };
  }
  
  // 일반 사용자는 현재 프로젝트 스코프로만 조회 (기본 동작)
  return params;
};

// 프로젝트 전환 후 리소스 새로고침이 필요한지 확인
export const shouldRefreshResourcesAfterProjectSwitch = (): boolean => {
  return !canAccessAllProjects();
};

// 리소스 생성 시 현재 프로젝트 ID 자동 설정
export const addCurrentProjectToResource = (resourceData: any, projectField: string = 'project_id'): any => {
  const currentProjectId = getCurrentProjectId();
  
  if (!currentProjectId) {
    throw new Error('현재 프로젝트가 설정되지 않았습니다.');
  }
  
  return {
    ...resourceData,
    [projectField]: currentProjectId
  };
};

// 관리자가 특정 프로젝트로 리소스 생성
export const createResourceForProject = (
  resourceData: any, 
  targetProjectId: string, 
  projectField: string = 'project_id'
): any => {
  if (!canAccessAllProjects()) {
    throw new Error('프로젝트 지정 생성은 관리자만 가능합니다.');
  }
  
  return {
    ...resourceData,
    [projectField]: targetProjectId
  };
}; 