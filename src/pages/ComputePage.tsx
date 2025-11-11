import React, { useEffect, useState } from 'react';
import { 
  Server, 
  Play, 
  Square, 
  RotateCcw, 
  Trash2, 
  Plus, 
  RefreshCw,
  MoreVertical,
  Globe,
  Shield,
  FileText,
  Monitor,
  Pause,
  StopCircle,
  Power,
  Camera,
  Settings,
  Network,
  HardDrive,
  Eye,
  ArrowRight,
  X,
  User,
  Crown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { novaService, neutronService, glanceService, cinderService } from '../services/openstack';
import { cloudflareService } from '../services/cloudflare';
import { 
  filterInstancesByProject, 
  isCurrentUserAdmin,
  getResourceOwnerInfo,
  canAccessAllProjects 
} from '../utils/projectScope';
import { workflowNotifications } from '../utils/notificationHelper';
import toast from 'react-hot-toast';

interface Instance {
  id: string;
  name: string;
  status: string;
  task_state?: string;
  power_state: number;
  vm_state: string;
  image: any;
  flavor: any;
  created: string;
  updated: string;
  addresses: any;
  metadata: any;
  security_groups: any[];
  key_name?: string;
  availability_zone: string;
  host_id: string;
  hypervisor_hostname?: string;
  instance_name?: string;
  locked: boolean;
  tags: string[];
  description?: string;
}

interface Flavor {
  id: string;
  name: string;
  vcpus: number;
  ram: number;
  disk: number;
}

interface Image {
  id: string;
  name: string;
  status: string;
}

const ComputePage: React.FC = () => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchInstances = async () => {
    try {
      setLoading(true);
      
      // Promise.allSettled를 사용하여 일부 실패해도 계속 진행
      // 인스턴스와 플레이버는 필수, 이미지는 선택적
      const [instancesResult, flavorsResult, imagesResult] = await Promise.allSettled([
        novaService.getServers(),
        novaService.getFlavors(),
        glanceService.getImages()
      ]);
      
      // 인스턴스 데이터 (필수)
      if (instancesResult.status === 'fulfilled') {
        const allInstances = instancesResult.value.servers || [];
        const filteredInstances = filterInstancesByProject(allInstances);
        setInstances(filteredInstances);
        
        console.log('전체 인스턴스:', allInstances.length, '필터링된 인스턴스:', filteredInstances.length);
      } else {
        console.error('인스턴스 로딩 실패:', instancesResult.reason);
        const errorMessage = instancesResult.reason?.response?.data?.error?.message || 
                           instancesResult.reason?.message || 
                           '인스턴스 목록을 불러오는데 실패했습니다.';
        toast.error(errorMessage, { duration: 5000 });
        setInstances([]);
      }
      
      // 플레이버 데이터 (필수)
      if (flavorsResult.status === 'fulfilled') {
        setFlavors(flavorsResult.value.flavors || []);
      } else {
        console.error('플레이버 로딩 실패:', flavorsResult.reason);
        setFlavors([]);
        // 플레이버는 필수이지만 UI는 계속 표시 가능
      }
      
      // 이미지 데이터 (선택적 - 실패해도 계속 진행)
      if (imagesResult.status === 'fulfilled') {
        setImages(imagesResult.value.images || []);
      } else {
        console.error('이미지 로딩 실패:', imagesResult.reason);
        // 이미지 로딩 실패는 조용히 처리 (인스턴스 목록은 계속 표시)
        setImages([]);
        // 사용자에게는 경고만 표시
        toast.error('이미지 목록을 불러올 수 없습니다. 인스턴스 목록은 계속 표시됩니다.', {
          duration: 3000,
          icon: '⚠️'
        });
      }
    } catch (error: any) {
      console.error('예상치 못한 오류:', error);
      toast.error('데이터를 불러오는데 실패했습니다.');
      setInstances([]);
      setFlavors([]);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  // 액션 핸들러들
  const handleStart = async (instanceId: string) => {
    try {
      setActionLoading(instanceId);
      const instance = instances.find(i => i.id === instanceId);
      const instanceName = instance?.name || instanceId;
      
      await novaService.startServer(instanceId);
      workflowNotifications.instanceStarted(instanceName);
      fetchInstances();
    } catch (error: any) {
      console.error('시작 실패:', error);
      workflowNotifications.apiError('인스턴스 시작', error?.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (instanceId: string) => {
    try {
      setActionLoading(instanceId);
      const instance = instances.find(i => i.id === instanceId);
      const instanceName = instance?.name || instanceId;
      
      await novaService.stopServer(instanceId);
      workflowNotifications.instanceStopped(instanceName);
      fetchInstances();
    } catch (error: any) {
      console.error('정지 실패:', error);
      workflowNotifications.apiError('인스턴스 정지', error?.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReboot = async (instanceId: string, type: 'SOFT' | 'HARD' = 'SOFT') => {
    try {
      setActionLoading(instanceId);
      await novaService.rebootServer(instanceId, type);
      toast.success('인스턴스를 재시작했습니다.');
      fetchInstances();
    } catch (error) {
      console.error('재시작 실패:', error);
      toast.error('인스턴스 재시작에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async (instanceId: string) => {
    try {
      setActionLoading(instanceId);
      await novaService.pauseServer(instanceId);
      toast.success('인스턴스를 일시정지했습니다.');
      fetchInstances();
    } catch (error) {
      console.error('일시정지 실패:', error);
      toast.error('인스턴스 일시정지에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpause = async (instanceId: string) => {
    try {
      setActionLoading(instanceId);
      await novaService.unpauseServer(instanceId);
      toast.success('인스턴스 일시정지를 해제했습니다.');
      fetchInstances();
    } catch (error) {
      console.error('일시정지 해제 실패:', error);
      toast.error('인스턴스 일시정지 해제에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (instanceId: string) => {
    try {
      setActionLoading(instanceId);
      await novaService.suspendServer(instanceId);
      toast.success('인스턴스를 중단했습니다.');
      fetchInstances();
    } catch (error) {
      console.error('중단 실패:', error);
      toast.error('인스턴스 중단에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (instanceId: string) => {
    try {
      setActionLoading(instanceId);
      await novaService.resumeServer(instanceId);
      toast.success('인스턴스를 재개했습니다.');
      fetchInstances();
    } catch (error) {
      console.error('재개 실패:', error);
      toast.error('인스턴스 재개에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // 개별 인스턴스 선택/해제
  const handleInstanceSelect = (instanceId: string) => {
    setSelectedInstances(prev => 
      prev.includes(instanceId) 
        ? prev.filter(id => id !== instanceId)
        : [...prev, instanceId]
    );
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedInstances.length === instances.length) {
      setSelectedInstances([]);
    } else {
      setSelectedInstances(instances.map(i => i.id));
    }
  };

  // 일괄 작업 함수들
  const handleBulkAction = async (action: string) => {
    if (selectedInstances.length === 0) {
      toast.error('선택된 인스턴스가 없습니다.');
      return;
    }

    const selectedInstancesData = instances.filter(i => selectedInstances.includes(i.id));

    // 작업 가능 여부 확인
    const canPerformAction = (instance: Instance, action: string) => {
      switch (action) {
        case 'start':
          return instance.status === 'SHUTOFF';
        case 'stop':
          return instance.status === 'ACTIVE';
        case 'reboot':
          return instance.status === 'ACTIVE';
        case 'delete':
          return true; // 삭제는 모든 상태에서 가능
        default:
          return false;
      }
    };

    const validInstances = selectedInstancesData.filter(i => canPerformAction(i, action));
    const invalidInstances = selectedInstancesData.filter(i => !canPerformAction(i, action));

    if (invalidInstances.length > 0) {
      const actionNames = {
        start: '시작',
        stop: '중지',
        reboot: '재시작',
        delete: '삭제'
      };
      
      toast.error(`${invalidInstances.length}개 인스턴스는 ${actionNames[action as keyof typeof actionNames]}할 수 없는 상태입니다.`);
      
      if (validInstances.length === 0) return;
    }

    if (action === 'delete') {
      if (!confirm(`정말로 ${validInstances.length}개의 인스턴스를 삭제하시겠습니까?`)) {
        return;
      }
    }

    try {
      setBulkActionLoading(true);
      
      if (action === 'delete') {
        // 삭제는 강력한 볼륨 분리 로직을 사용
        for (const instance of validInstances) {
          await handleDelete(instance.id);
        }
      } else {
        const promises = validInstances.map(instance => {
          switch (action) {
            case 'start':
              return novaService.startServer(instance.id);
            case 'stop':
              return novaService.stopServer(instance.id);
            case 'reboot':
              return novaService.rebootServer(instance.id);
            default:
              return Promise.resolve();
          }
        });

        await Promise.all(promises);
      }
      
      const actionNames = {
        start: '시작',
        stop: '중지',
        reboot: '재시작',
        delete: '삭제'
      };
      
      toast.success(`${validInstances.length}개 인스턴스 ${actionNames[action as keyof typeof actionNames]} 완료`);
      setSelectedInstances([]);
      fetchInstances();
    } catch (error) {
      console.error('일괄 작업 실패:', error);
      toast.error('일괄 작업 중 오류가 발생했습니다.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleInstanceAction = async (instanceId: string, action: string) => {
    switch (action) {
      case 'start':
        await handleStart(instanceId);
        break;
      case 'stop':
        await handleStop(instanceId);
        break;
      case 'reboot':
        await handleReboot(instanceId);
        break;
      case 'delete':
        await handleDelete(instanceId);
        break;
      default:
        console.warn('Unknown action:', action);
    }
  };

  const handleDelete = async (instanceId: string) => {
    try {
      console.log(`\n🚀 인스턴스 ${instanceId} 삭제 프로세스 시작`);
      
      // 인스턴스 상세 정보 가져오기
      const instanceData = await novaService.getServer(instanceId);
      const instance = instanceData.server;
      
      console.log(`📋 인스턴스 정보: ${instance.name} (${instance.status})`);
      console.log(`📋 인스턴스 상세:`, {
        image: instance.image,
        volumes_attached: instance.volumes_attached,
        has_image: !!instance.image?.id,
        boot_type: instance.image?.id ? 'Image Boot' : 'Volume Boot'
      });
      
      // 볼륨 정보는 Nova API에서만 가져오기 (Cinder API 권한 문제 방지)
      const attachedVolumes = instance.volumes_attached || [];
      let volumesToCheck: any[] = [];
      
      console.log(`🔍 Nova API volumes_attached:`, attachedVolumes);
      
      // 방법 1: Nova API 결과 사용
      volumesToCheck = attachedVolumes.map((vol: any) => ({
        id: vol.id,
        name: vol.id, // 기본적으로 ID를 이름으로 사용
        size: 0, // 크기 정보는 일단 0으로 설정
        device: vol.device || 'unknown'
      }));
      
      // 방법 2: Cinder API에서 해당 인스턴스에 연결된 볼륨 찾기 (보완)
      try {
        console.log('🔍 Cinder API를 통한 추가 볼륨 연결 확인...');
        const allVolumesData = await cinderService.getVolumes();
        const allVolumes = allVolumesData.volumes || [];
        
        // 해당 인스턴스에 연결된 볼륨 찾기
        const cinderConnectedVolumes = allVolumes.filter((vol: any) => {
          return vol.attachments && vol.attachments.some((att: any) => att.server_id === instanceId);
        });
        
        console.log(`🔍 Cinder API에서 발견된 연결 볼륨: ${cinderConnectedVolumes.length}개`);
        
        // Nova에서 놓친 볼륨이 있는지 확인하고 추가
        cinderConnectedVolumes.forEach((cinderVol: any) => {
          const alreadyExists = volumesToCheck.some(vol => vol.id === cinderVol.id);
          if (!alreadyExists) {
            const attachment = cinderVol.attachments.find((att: any) => att.server_id === instanceId);
            volumesToCheck.push({
              id: cinderVol.id,
              name: cinderVol.name || cinderVol.id,
              size: cinderVol.size || 0,
              device: attachment?.device || 'unknown'
            });
            console.log(`✅ Nova에서 놓친 볼륨 발견: ${cinderVol.name || cinderVol.id}`);
          }
        });
        
        // Nova에서 가져온 볼륨 정보를 Cinder 정보로 보강
        volumesToCheck = volumesToCheck.map((vol: any) => {
          const cinderVolume = allVolumes.find((cv: any) => cv.id === vol.id);
          if (cinderVolume) {
            return {
              ...vol,
              name: cinderVolume.name || vol.id,
              size: cinderVolume.size || 0
            };
          }
          return vol;
        });
        
        console.log(`🔍 최종 확인된 연결 볼륨: ${volumesToCheck.length}개`);
        console.log(`🔍 볼륨 목록:`, volumesToCheck);
        
      } catch (cinderError) {
        console.log('🔍 Cinder API 접근 실패, Nova API 정보만 사용:', cinderError);
        
        // Cinder API 실패 시에도 Nova 정보로 볼륨 정보 보강 시도
        if (isCurrentUserAdmin()) {
          try {
            const allVolumesData = await cinderService.getVolumes();
            const allVolumes = allVolumesData.volumes || [];
            
            volumesToCheck = volumesToCheck.map((vol: any) => {
              const cinderVolume = allVolumes.find((cv: any) => cv.id === vol.id);
              return {
                ...vol,
                name: cinderVolume?.name || vol.id,
                size: cinderVolume?.size || 0
              };
            });
          } catch (adminCinderError) {
            console.log('🔍 관리자 권한으로도 Cinder API 접근 실패');
          }
        }
      }
      
      // 볼륨 삭제 정책 결정 (delete_on_termination 기반)
      let deleteVolumes = false;
      let autoDeleteVolumes: any[] = [];
      let keepVolumes: any[] = [];
      
      if (volumesToCheck.length > 0) {
        // 사용자에게 볼륨 삭제 여부 직접 확인
        let confirmMessage = `인스턴스 "${instance.name}" 삭제:\n\n`;
        confirmMessage += `📀 연결된 볼륨 (${volumesToCheck.length}개):\n`;
        confirmMessage += volumesToCheck.map((v: any) => {
          const sizeInfo = v.size > 0 ? ` (${v.size}GB)` : '';
          return `  - ${v.name}${sizeInfo} [${v.device}]`;
        }).join('\n') + '\n\n';
        confirmMessage += `⚠️ 볼륨도 함께 삭제하시겠습니까?\n\n`;
        confirmMessage += `- "확인": 인스턴스와 모든 볼륨 삭제\n`;
        confirmMessage += `- "취소": 인스턴스만 삭제, 볼륨은 보존`;
        
        const deleteVolumesToo = confirm(confirmMessage);
        
        if (deleteVolumesToo) {
          deleteVolumes = true;
          console.log(`✅ 사용자 선택: 인스턴스와 ${volumesToCheck.length}개 볼륨 모두 삭제`);
        } else {
          console.log(`✅ 사용자 선택: 인스턴스만 삭제, ${volumesToCheck.length}개 볼륨 보존`);
        }
      } else {
        if (!confirm(`정말로 인스턴스 "${instance.name}"을(를) 삭제하시겠습니까?`)) {
          console.log('❌ 사용자가 삭제를 취소했습니다.');
          return;
        }
        console.log('✅ 연결된 볼륨이 없으므로 바로 삭제 진행');
      }
      
      setActionLoading(instanceId);
      
      // 강력한 볼륨 분리 로직
      if (volumesToCheck.length > 0) {
        console.log('\n🔧 ===== 강화된 볼륨 분리 프로세스 시작 =====');
        
        // 모든 볼륨에 대해 안전한 분리 시도
        let successfulDetachments = 0;
        for (let i = 0; i < volumesToCheck.length; i++) {
          const vol = volumesToCheck[i];
          console.log(`\n📀 [${i + 1}/${volumesToCheck.length}] 볼륨 분리: ${vol.name}`);
          
          try {
            const success = await cinderService.safeDetachVolume(instanceId, vol.id, vol.name);
            if (success) {
              successfulDetachments++;
              console.log(`   ✅ [${i + 1}/${volumesToCheck.length}] ${vol.name} 분리 성공`);
            } else {
              console.log(`   ⚠️ [${i + 1}/${volumesToCheck.length}] ${vol.name} 분리 실패 (계속 진행)`);
            }
          } catch (detachError) {
            console.error(`   ❌ [${i + 1}/${volumesToCheck.length}] ${vol.name} 분리 오류:`, detachError);
          }
        }
        
        console.log(`\n📊 볼륨 분리 결과: ${successfulDetachments}/${volumesToCheck.length}개 성공`);
        
        // 추가 안정화 대기
        console.log('⏳ 인스턴스 삭제 전 안정화 대기...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Cloudflare Tunnel 삭제 (있는 경우)
      const tunnelId = instance.metadata?.cloudflare_tunnel_id;
      const tunnelDomain = instance.metadata?.cloudflare_tunnel_domain;
      
      if (tunnelId || tunnelDomain) {
        console.log('\n🌐 Cloudflare Tunnel 삭제 시작...');
        try {
          if (tunnelId) {
            console.log(`   Tunnel ID: ${tunnelId}`);
            await cloudflareService.deleteTunnel(tunnelId);
            console.log('   ✅ Tunnel 삭제 완료');
          }
          
          if (tunnelDomain) {
            console.log(`   DNS 레코드: ${tunnelDomain}`);
            await cloudflareService.deleteDNSRecord(tunnelDomain);
            console.log('   ✅ DNS 레코드 삭제 완료');
          }
        } catch (tunnelError: any) {
          console.warn('   ⚠️ Tunnel 삭제 실패 (계속 진행):', tunnelError.message);
          // Tunnel 삭제 실패해도 인스턴스 삭제는 계속 진행
        }
      }
      
      // 인스턴스 삭제
      console.log('\n🗑️ 인스턴스 삭제 시작...');
      await novaService.deleteServer(instanceId);
      console.log('✅ 인스턴스 삭제 요청 완료');
      
      // 인스턴스 완전 삭제 대기
      const instanceDeleted = await cinderService.waitForInstanceDeleted(instanceId, 60);
      if (!instanceDeleted) {
        console.log('⚠️ 인스턴스 삭제 확인 타임아웃, 볼륨 삭제 계속 진행');
      }
      
      // 볼륨 삭제 (사용자가 선택한 경우)
      if (deleteVolumes && volumesToCheck.length > 0) {
        console.log('\n🗑️ 볼륨 삭제 프로세스 시작...');
        toast.loading('볼륨을 삭제하는 중...', { id: 'delete-volumes' });
        
        let successfulDeletions = 0;
        let failedDeletions = 0;
        
        for (let i = 0; i < volumesToCheck.length; i++) {
          const vol = volumesToCheck[i];
          console.log(`\n📀 [${i + 1}/${volumesToCheck.length}] 볼륨 삭제: ${vol.name}`);
          
          try {
            await cinderService.safeDeleteVolume(vol.id, vol.name);
            successfulDeletions++;
            console.log(`   ✅ [${i + 1}/${volumesToCheck.length}] ${vol.name} 삭제 성공`);
          } catch (deleteError) {
            failedDeletions++;
            console.error(`   ❌ [${i + 1}/${volumesToCheck.length}] ${vol.name} 삭제 실패:`, deleteError);
            toast.error(`볼륨 ${vol.name} 삭제에 실패했습니다.`);
          }
        }
        
        toast.dismiss('delete-volumes');
        
        console.log(`\n📊 볼륨 삭제 결과: ${successfulDeletions}개 성공, ${failedDeletions}개 실패`);
        
        if (successfulDeletions > 0 && failedDeletions === 0) {
          toast.success('인스턴스와 모든 볼륨을 삭제했습니다.');
        } else if (successfulDeletions > 0) {
          toast.error(`인스턴스와 ${successfulDeletions}개 볼륨을 삭제했습니다. ${failedDeletions}개 볼륨 삭제 실패.`);
        } else {
          toast.error('인스턴스는 삭제되었지만 볼륨 삭제에 실패했습니다.');
        }
      } else {
        const instanceName = instance?.name || instanceId;
        workflowNotifications.instanceDeleted(instanceName);
        toast.success('인스턴스를 삭제했습니다.');
      }
      
      console.log('🎉 인스턴스 삭제 프로세스 완료');
      fetchInstances();
    } catch (error: any) {
      console.error('❌ 삭제 프로세스 실패:', error);
      
      let errorMessage = '인스턴스 삭제에 실패했습니다.';
      if (error?.response?.status === 409) {
        errorMessage = '인스턴스가 다른 리소스에 의해 사용 중입니다. 연결된 리소스를 먼저 해제해주세요.';
      } else if (error?.response?.status === 404) {
        errorMessage = '인스턴스를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.';
        // 404인 경우 목록을 새로고침하여 상태를 동기화
        fetchInstances();
      } else if (error?.response?.data?.message) {
        errorMessage = `삭제 실패: ${error.response.data.message}`;
      } else if (error?.message) {
        errorMessage = `삭제 실패: ${error.message}`;
      }
      
      workflowNotifications.apiError('인스턴스 삭제', errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateSnapshot = async (instanceId: string) => {
    const name = prompt('스냅샷 이름을 입력하세요:');
    if (!name) return;

    try {
      setActionLoading(instanceId);
      
      // 인스턴스 상세 정보 가져오기
      const instanceDetail = await novaService.getServer(instanceId);
      const instance = instanceDetail.server;
      
      console.log('인스턴스 부팅 정보:', {
        image: instance.image,
        volumes_attached: instance.volumes_attached,
        has_image: !!instance.image?.id
      });
      
      // 부팅 방식 확인
      const isImageBoot = !!instance.image?.id;
      const hasAttachedVolumes = instance.volumes_attached && instance.volumes_attached.length > 0;
      
      if (isImageBoot) {
        // 이미지 부팅: Nova 이미지 스냅샷 생성
        console.log('이미지 부팅 인스턴스 - Nova 스냅샷 생성');
        await novaService.createSnapshot(instanceId, name);
        toast.success('이미지 스냅샷을 생성했습니다. 볼륨 탭에서 확인할 수 있습니다.');
        console.log('✅ 이미지 스냅샷 생성 완료 (Nova):', {
          instanceName: instance.name,
          snapshotName: name,
          type: 'image'
        });
      } else if (hasAttachedVolumes) {
        // 볼륨 부팅: 부트 볼륨의 Cinder 스냅샷 생성
        console.log('볼륨 부팅 인스턴스 - Cinder 볼륨 스냅샷 생성');
        
        // 부트 볼륨 찾기 (첫 번째 볼륨이 일반적으로 부트 볼륨)
        const bootVolumeId = instance.volumes_attached[0].id;
        
        // 볼륨 스냅샷 생성
        await cinderService.createSnapshot({
          snapshot: {
            name: name,
            volume_id: bootVolumeId,
            description: `${instance.name} 인스턴스의 볼륨 스냅샷`,
            force: true // 사용 중인 볼륨도 스냅샷 생성 가능
          }
        });
        
        toast.success('볼륨 스냅샷을 생성했습니다. 볼륨 탭에서 확인할 수 있습니다.');
        console.log('✅ 볼륨 스냅샷 생성 완료 (Cinder):', {
          instanceName: instance.name,
          snapshotName: name,
          bootVolumeId: bootVolumeId,
          type: 'volume'
        });
      } else {
        // 부팅 방식을 확인할 수 없는 경우
        console.warn('부팅 방식을 확인할 수 없습니다. 기본 Nova 스냅샷 시도');
        await novaService.createSnapshot(instanceId, name);
        toast.success('이미지 스냅샷을 생성했습니다. 볼륨 탭에서 확인할 수 있습니다.');
        console.log('✅ 기본 이미지 스냅샷 생성 완료 (Nova):', {
          instanceName: instance.name,
          snapshotName: name,
          type: 'image'
        });
      }
      
    } catch (error: any) {
      console.error('스냅샷 생성 실패:', error);
      
      let errorMessage = '스냅샷 생성에 실패했습니다.';
      if (error.response?.data?.badRequest?.message) {
        errorMessage = `스냅샷 생성 실패: ${error.response.data.badRequest.message}`;
      } else if (error.message) {
        errorMessage = `스냅샷 생성 실패: ${error.message}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConsoleLog = async (instanceId: string) => {
    try {
      const response = await novaService.getServerConsoleLog(instanceId, 100);
      // 콘솔 로그를 별도 창에서 보여주거나 모달로 표시
      alert(`콘솔 로그:\n\n${response.output}`);
    } catch (error) {
      console.error('콘솔 로그 가져오기 실패:', error);
      toast.error('콘솔 로그를 가져오는데 실패했습니다.');
    }
  };

  const handleVNCConsole = async (instanceId: string) => {
    try {
      const response = await novaService.getVNCConsole(instanceId);
      window.open(response.console.url, '_blank');
    } catch (error) {
      console.error('VNC 콘솔 열기 실패:', error);
      toast.error('VNC 콘솔을 열 수 없습니다.');
    }
  };

  // 상태별 색상 및 텍스트
  const getStatusColor = (status: string, taskState?: string) => {
    if (taskState && taskState !== 'null') {
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
    }
    
    switch (status.toUpperCase()) {
      case 'ACTIVE': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'SHUTOFF': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
      case 'PAUSED': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'SUSPENDED': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
      case 'ERROR': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case 'BUILD': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      case 'REBUILD': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      case 'REBOOT': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      case 'RESIZE': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      case 'VERIFY_RESIZE': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200';
      case 'DELETED': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string, taskState?: string) => {
    if (taskState && taskState !== 'null') {
      return `${getStatusKorean(status)} (${taskState})`;
    }
    return getStatusKorean(status);
  };

  const getStatusKorean = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACTIVE': return '실행 중';
      case 'SHUTOFF': return '정지됨';
      case 'PAUSED': return '일시정지';
      case 'SUSPENDED': return '중단됨';
      case 'ERROR': return '오류';
      case 'BUILD': return '생성 중';
      case 'REBUILD': return '재구성 중';
      case 'REBOOT': return '재시작 중';
      case 'RESIZE': return '크기 변경 중';
      case 'VERIFY_RESIZE': return '크기 변경 확인';
      case 'DELETED': return '삭제됨';
      default: return status;
    }
  };

  // IP 주소 추출
  const getInstanceIPs = (addresses: any) => {
    const ips: string[] = [];
    if (addresses) {
      Object.values(addresses).forEach((networkAddresses: any) => {
        if (Array.isArray(networkAddresses)) {
          networkAddresses.forEach((addr: any) => {
            ips.push(addr.addr);
          });
        }
      });
    }
    return ips;
  };

  // 이미지 이름 가져오기
  const getImageName = (imageRef: string) => {
    const image = images.find(img => img.id === imageRef);
    return image ? image.name : imageRef;
  };

  // 플레이버 정보 가져오기
  const getFlavorInfo = (flavorRef: string) => {
    const flavor = flavors.find(f => f.id === flavorRef);
    return flavor ? flavor : null;
  };

  // 인스턴스 상세 페이지로 이동
  const handleInstanceClick = (instanceId: string) => {
    navigate(`/compute/${instanceId}`);
  };

  // 액션 메뉴 아이템들
  const getActionMenuItems = (instance: Instance) => {
    const items = [];
    const status = instance.status.toUpperCase();
    const isLoading = actionLoading === instance.id;

    if (status === 'SHUTOFF') {
      items.push({ icon: Play, label: '시작', action: () => handleStart(instance.id), color: 'text-green-600' });
    } else if (status === 'ACTIVE') {
      items.push({ icon: Square, label: '정지', action: () => handleStop(instance.id), color: 'text-red-600' });
      items.push({ icon: Pause, label: '일시정지', action: () => handlePause(instance.id), color: 'text-yellow-600' });
      items.push({ icon: StopCircle, label: '중단', action: () => handleSuspend(instance.id), color: 'text-orange-600' });
    } else if (status === 'PAUSED') {
      items.push({ icon: Play, label: '일시정지 해제', action: () => handleUnpause(instance.id), color: 'text-green-600' });
    } else if (status === 'SUSPENDED') {
      items.push({ icon: Play, label: '재개', action: () => handleResume(instance.id), color: 'text-green-600' });
    }

    if (['ACTIVE', 'SHUTOFF', 'PAUSED', 'SUSPENDED'].includes(status)) {
      items.push({ icon: RotateCcw, label: '재시작', action: () => handleReboot(instance.id), color: 'text-blue-600' });
    }

    if (status === 'ACTIVE') {
      items.push({ icon: Camera, label: '스냅샷 생성', action: () => handleCreateSnapshot(instance.id), color: 'text-purple-600' });
      items.push({ icon: Monitor, label: 'VNC 콘솔', action: () => handleVNCConsole(instance.id), color: 'text-indigo-600' });
    }

    items.push({ icon: FileText, label: '콘솔 로그', action: () => handleConsoleLog(instance.id), color: 'text-gray-600' });
    items.push({ icon: Globe, label: '유동 IP 관리', action: () => {}, color: 'text-cyan-600' });
    items.push({ icon: Shield, label: '보안 그룹', action: () => {}, color: 'text-teal-600' });
    items.push({ icon: Settings, label: '크기 변경', action: () => {}, color: 'text-gray-600' });
    items.push({ icon: Trash2, label: '삭제', action: () => handleDelete(instance.id), color: 'text-red-600' });

    return items.map(item => ({ ...item, disabled: isLoading }));
  };

  // 인스턴스 상태만 업데이트하는 함수
  const updateInstanceStatuses = async () => {
    try {
      const response = await novaService.getServers();
      const newInstances = response.servers || [];
      
      setInstances(prevInstances => 
        prevInstances.map(prevInstance => {
          const updatedInstance = newInstances.find((ni: Instance) => ni.id === prevInstance.id);
          return updatedInstance ? { ...prevInstance, ...updatedInstance } : prevInstance;
        }).filter(instance => 
          newInstances.some((ni: Instance) => ni.id === instance.id)
        ).concat(
          newInstances.filter((ni: Instance) => 
            !prevInstances.some(pi => pi.id === ni.id)
          )
        )
      );
    } catch (error) {
      console.error('상태 업데이트 실패:', error);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  // 5초마다 인스턴스 상태 업데이트
  useEffect(() => {
    const interval = setInterval(updateInstanceStatuses, 5000);
    return () => clearInterval(interval);
  }, []);

  // 외부 클릭 시 드롭다운 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showActionMenu) {
        setShowActionMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionMenu]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner h-12 w-12"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">가상머신</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">가상머신 인스턴스를 관리하고 모니터링합니다</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchInstances}
            className="btn-secondary flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </button>
          <button 
            onClick={() => navigate('/compute/create')}
            className="btn-primary flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            인스턴스 생성
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
              <Play className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">실행 중</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {instances.filter(i => i.status === 'ACTIVE').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="flex items-center">
            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg">
              <Square className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">정지됨</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {instances.filter(i => i.status === 'SHUTOFF').length}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
              <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">오류</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {instances.filter(i => i.status === 'ERROR').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
              <Server className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">전체</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{instances.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 일괄 작업 버튼들 */}
      {selectedInstances.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                {selectedInstances.length}개 인스턴스 선택됨
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handleBulkAction('start')}
                disabled={bulkActionLoading}
                className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
              >
                {bulkActionLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                ) : (
                  <Play className="h-4 w-4 mr-1" />
                )}
                시작
              </button>
              <button
                onClick={() => handleBulkAction('stop')}
                disabled={bulkActionLoading}
                className="inline-flex items-center px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 disabled:opacity-50"
              >
                {bulkActionLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                ) : (
                  <Square className="h-4 w-4 mr-1" />
                )}
                중지
              </button>
              <button
                onClick={() => handleBulkAction('reboot')}
                disabled={bulkActionLoading}
                className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {bulkActionLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                ) : (
                  <RotateCcw className="h-4 w-4 mr-1" />
                )}
                재시작
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                disabled={bulkActionLoading}
                className="inline-flex items-center px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                {bulkActionLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                삭제
              </button>
              <button
                onClick={() => setSelectedInstances([])}
                className="inline-flex items-center px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
              >
                <X className="h-4 w-4 mr-1" />
                선택 해제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 인스턴스 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">인스턴스 목록</h3>
        </div>
        
        {instances.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">생성된 인스턴스가 없습니다.</p>
            <button 
              onClick={() => navigate('/compute/create')}
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              첫 번째 인스턴스 생성
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedInstances.length === instances.length && instances.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">인스턴스 이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">IP 주소</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">플레이버</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">작업</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {instances.map((instance) => {
                  const ips = getInstanceIPs(instance.addresses);
                  const flavorInfo = getFlavorInfo(instance.flavor?.id || '');
                  
                  return (
                    <tr key={instance.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${selectedInstances.includes(instance.id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedInstances.includes(instance.id)}
                          onChange={() => handleInstanceSelect(instance.id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Server className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <button 
                              onClick={() => handleInstanceClick(instance.id)}
                              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-left"
                            >
                              {instance.name}
                            </button>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{instance.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {ips.length > 0 ? (
                            <div className="space-y-1">
                              {ips.map((ip, index) => (
                                <div key={index} className="flex items-center">
                                  <Network className="h-3 w-3 text-gray-400 dark:text-gray-500 mr-1" />
                                  <span className="text-xs">{ip}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400 text-xs">IP 없음</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {flavorInfo ? (
                            <div className="space-y-1">
                              <div className="font-medium">{flavorInfo.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                vCPU: {flavorInfo.vcpus} | RAM: {flavorInfo.ram}MB | Disk: {flavorInfo.disk}GB
                              </div>
                            </div>
                          ) : (
                            instance.flavor?.id || 'N/A'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(instance.status, instance.task_state)}`}>
                          {getStatusText(instance.status, instance.task_state)}
                        </span>
                      </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleInstanceClick(instance.id)}
                          className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-lg transition-colors"
                          title="상세 정보"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          상세 보기
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComputePage; 