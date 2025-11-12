import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Server, 
  Network, 
  HardDrive, 
  Cpu, 
  Zap, 
  Clock, 
  Tag, 
  Shield, 
  Globe,
  Monitor,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Camera,
  FileText,
  ArrowLeft,
  RefreshCw,
  Settings,
  Info,
  Activity,
  Database,
  Unlink,
  Link,
  Plus,
  Terminal,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import { novaService, neutronService, cinderService, glanceService } from '../services/openstack';
import { cloudflareService } from '../services/cloudflare';
import toast from 'react-hot-toast';

interface InstanceDetail {
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
  volumes_attached: any[];
  fault?: any;
  config_drive: boolean;
  progress?: number;
  user_id: string;
  tenant_id: string;
}

interface VNCConsole {
  url: string;
  type: string;
}

const InstanceDetailPage: React.FC = () => {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const [instance, setInstance] = useState<InstanceDetail | null>(null);
  const [flavor, setFlavor] = useState<any>(null);
  const [image, setImage] = useState<any>(null);
  const [volumes, setVolumes] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'network' | 'storage' | 'security' | 'console' | 'logs' | 'connect'>('overview');
  const [connectSubTab, setConnectSubTab] = useState<'quick' | 'windows' | 'macos' | 'putty' | 'troubleshoot'>('quick');
  const [consoleUrl, setConsoleUrl] = useState<string | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<string>('');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const fetchInstanceDetail = async () => {
    if (!instanceId) return;
    
    try {
      setLoading(true);
      // 각 API 호출을 개별적으로 처리하여 일부 실패해도 전체가 실패하지 않도록 함
      const [instanceResult, volumesResult, networksResult] = await Promise.allSettled([
        novaService.getServer(instanceId),
        cinderService.getVolumes(),
        neutronService.getNetworks()
      ]);

      // 성공한 데이터만 추출
      const instanceData = instanceResult.status === 'fulfilled' ? instanceResult.value : null;
      const volumesData = volumesResult.status === 'fulfilled' ? volumesResult.value : { volumes: [] };
      const networksData = networksResult.status === 'fulfilled' ? networksResult.value : { networks: [] };

      // 실패한 API 로깅
      if (instanceResult.status === 'rejected') console.error('인스턴스 데이터 로딩 실패:', instanceResult.reason);
      if (volumesResult.status === 'rejected') console.error('볼륨 데이터 로딩 실패:', volumesResult.reason);
      if (networksResult.status === 'rejected') console.error('네트워크 데이터 로딩 실패:', networksResult.reason);

      // 인스턴스 데이터가 없으면 중단
      if (!instanceData) {
        throw new Error('인스턴스 정보를 불러올 수 없습니다.');
      }

      setInstance(instanceData.server);
      setVolumes(volumesData.volumes || []);
      setNetworks(networksData.networks || []);

      // 플레이버 정보 가져오기
      if (instanceData.server.flavor?.id) {
        try {
          const flavorData = await novaService.getFlavor(instanceData.server.flavor.id);
          setFlavor(flavorData.flavor);
        } catch (error) {
          console.error('플레이버 정보 가져오기 실패:', error);
        }
      }

      // 이미지 정보 가져오기
      if (instanceData.server.image?.id) {
        try {
          const imageData = await glanceService.getImage(instanceData.server.image.id);
          setImage(imageData);
        } catch (error) {
          console.error('이미지 정보 가져오기 실패:', error);
        }
      }
    } catch (error) {
      console.error('인스턴스 상세 정보 로딩 실패:', error);
      toast.error('인스턴스 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleVNCConsole = async () => {
    if (!instanceId) return;
    
    try {
      const response = await novaService.getVNCConsole(instanceId);
      let url = response.console.url;
      
      // WebSocket 경로가 올바르게 설정되도록 보장
      // noVNC가 현재 페이지의 호스트를 사용하므로, 상대 경로로 변환
      if (url && url.startsWith('/novnc/')) {
        // path 파라미터에 websockify 경로 포함 확인
        const urlObj = new URL(url.startsWith('/') ? `https://leee.cloud${url}` : url);
        const path = urlObj.searchParams.get('path');
        if (path && path.includes('token=')) {
          // path가 이미 token을 포함하고 있으면 그대로 사용
          // WebSocket 연결은 noVNC HTML 내부에서 자동 처리됨
        }
        // noVNC HTML은 자동으로 WebSocket URL을 생성하지만,
        // 올바른 경로를 사용하도록 보장하기 위해 상대 경로 사용
        url = url.replace(/^\/novnc\//, '/novnc/');
      }
      
      setConsoleUrl(url);
      setActiveTab('console');
    } catch (error) {
      console.error('VNC 콘솔 열기 실패:', error);
      toast.error('VNC 콘솔을 열 수 없습니다.');
    }
  };

  const handleGetConsoleLogs = async () => {
    if (!instanceId) return;
    
    try {
      const response = await novaService.getServerConsoleLog(instanceId, 100);
      setConsoleLogs(response.output || '로그가 없습니다.');
      setActiveTab('logs');
    } catch (error) {
      console.error('콘솔 로그 가져오기 실패:', error);
      toast.error('콘솔 로그를 가져오는데 실패했습니다.');
    }
  };

  const handleDetachVolume = async (volumeId: string, volumeName: string) => {
    if (!instanceId) return;
    
    // 부트 볼륨 분리 방지
    const isBootVolume = instance?.volumes_attached?.some((vol: any) => 
      vol.id === volumeId && (vol.device === '/dev/vda' || vol.device === '/dev/sda')
    ) || (!instance?.image?.id && instance?.volumes_attached?.[0]?.id === volumeId);
    
    if (isBootVolume) {
      toast.error('부트 볼륨은 분리할 수 없습니다.');
      return;
    }
    
    if (!confirm(`"${volumeName}" 볼륨을 분리하시겠습니까?`)) return;
    
    try {
      setActionLoading(true);
      await cinderService.detachVolume(instanceId, volumeId);
      toast.success('볼륨을 분리했습니다.');
      fetchInstanceDetail(); // 정보 새로고침
    } catch (error) {
      console.error('볼륨 분리 실패:', error);
      toast.error('볼륨 분리에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAttachVolume = async () => {
    if (!instanceId) return;
    
    // 사용 가능한 볼륨 목록 가져오기
    try {
      const volumesData = await cinderService.getVolumes();
      const availableVolumes = volumesData.volumes?.filter((vol: any) => 
        vol.status === 'available' && !vol.attachments?.length
      ) || [];
      
      if (availableVolumes.length === 0) {
        toast.error('연결할 수 있는 볼륨이 없습니다.');
        return;
      }
      
      // 간단한 프롬프트로 볼륨 선택 (추후 모달로 개선 가능)
      const volumeList = availableVolumes.map((vol: any, index: number) => 
        `${index + 1}. ${vol.name || vol.id} (${vol.size}GB)`
      ).join('\n');
      
      const choice = prompt(`연결할 볼륨을 선택하세요:\n\n${volumeList}\n\n번호를 입력하세요:`);
      
      if (!choice) return;
      
      const selectedIndex = parseInt(choice) - 1;
      if (selectedIndex < 0 || selectedIndex >= availableVolumes.length) {
        toast.error('올바른 번호를 입력해주세요.');
        return;
      }
      
      const selectedVolume = availableVolumes[selectedIndex];
      
      setActionLoading(true);
      await cinderService.attachVolume(selectedVolume.id, instanceId);
      toast.success('볼륨을 연결했습니다.');
      fetchInstanceDetail(); // 정보 새로고침
      
    } catch (error) {
      console.error('볼륨 연결 실패:', error);
      toast.error('볼륨 연결에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteWithVolumes = async () => {
    if (!instanceId || !instance) return;
    
    // 간단한 확인만
    if (!confirm(`인스턴스 "${instance.name}"을(를) 삭제하시겠습니까?\n\n연결된 볼륨과 Cloudflare 터널도 함께 삭제됩니다.`)) return;
    
    // 바로 목록 페이지로 이동
    toast.loading(`${instance.name} 삭제 중...`, { id: 'delete-instance', duration: Infinity });
    navigate('/compute');
    
    try {
      // 연결된 볼륨 확인
      const attachedVolumes = instance.volumes_attached || [];
      let volumesToCheck: any[] = attachedVolumes.map((vol: any) => {
        const volumeInfo = volumes.find((v: any) => v.id === vol.id);
        return {
          id: vol.id,
          name: volumeInfo?.name || vol.id,
          size: volumeInfo?.size || 0,
          device: vol.device
        };
      });

      // Cinder API에서 추가 볼륨 확인
      try {
        const cinderConnectedVolumes = volumes.filter((vol: any) => {
          return vol.attachments && vol.attachments.some((att: any) => att.server_id === instanceId);
        });
        
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
          }
        });
        
        volumesToCheck = volumesToCheck.map((vol: any) => {
          const cinderVolume = volumes.find((v: any) => v.id === vol.id);
          if (cinderVolume) {
            return {
              ...vol,
              name: cinderVolume.name || vol.id,
              size: cinderVolume.size || 0
            };
          }
          return vol;
        });
      } catch (cinderError) {
        console.log('Cinder API 볼륨 확인 실패, Nova API 정보만 사용');
      }

      // 모든 볼륨 자동 삭제로 설정
      const deleteVolumes = volumesToCheck.length > 0;
      
      // 볼륨 분리 (빠르게 시도만, 실패해도 계속 진행)
      if (volumesToCheck.length > 0) {
        await Promise.allSettled(
          volumesToCheck.map(vol => 
            cinderService.safeDetachVolume(instanceId, vol.id, vol.name)
              .catch(() => console.log(`볼륨 ${vol.name} 분리 실패, 강제 삭제 진행`))
          )
        );
        // 짧은 안정화 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 인스턴스 삭제
      await novaService.deleteServer(instanceId);
      
      // 짧은 삭제 대기 (백그라운드에서 완료됨)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 볼륨 삭제
      if (deleteVolumes && volumesToCheck.length > 0) {
        for (const vol of volumesToCheck) {
          try {
            await cinderService.safeDeleteVolume(vol.id, vol.name);
            console.log(`✅ ${vol.name} 삭제 완료`);
          } catch (deleteError) {
            console.error(`❌ ${vol.name} 삭제 실패:`, deleteError);
          }
        }
      }
      
      // Cloudflare 터널 정리
      const tunnelId = instance.metadata?.cloudflare_tunnel_id;
      const tunnelDomain = instance.metadata?.cloudflare_tunnel_domain;
      if (tunnelId) {
        try {
          console.log('Cloudflare 터널 정리 중...');
          // DNS 레코드 삭제
          if (tunnelDomain) {
            await cloudflareService.deleteDNSRecord(tunnelDomain);
          }
          // 터널 삭제
          await cloudflareService.deleteTunnel(tunnelId);
          console.log('✅ Cloudflare 터널 삭제 완료');
        } catch (tunnelError) {
          console.error('Cloudflare 터널 정리 실패:', tunnelError);
        }
      }
      
      toast.success('인스턴스 삭제 완료', { id: 'delete-instance' });
    } catch (error) {
      console.error('삭제 실패:', error);
      toast.error('인스턴스 삭제에 실패했습니다.');
    }
  };

  const handleAction = async (action: string) => {
    if (!instanceId || actionLoading) return;
    
    try {
      setActionLoading(true);
      
      switch (action) {
        case 'start':
          await novaService.startServer(instanceId);
          toast.success('인스턴스를 시작했습니다.');
          break;
        case 'stop':
          await novaService.stopServer(instanceId);
          toast.success('인스턴스를 정지했습니다.');
          break;
        case 'reboot':
          await novaService.rebootServer(instanceId);
          toast.success('인스턴스를 재시작했습니다.');
          break;
        case 'delete':
          await handleDeleteWithVolumes();
          return;
        case 'snapshot':
          const name = prompt('스냅샷 이름을 입력하세요:');
          if (name) {
            await novaService.createSnapshot(instanceId, name);
            toast.success('스냅샷을 생성했습니다.');
          }
          break;
      }
      
      // 액션 후 데이터 새로고침
      fetchInstanceDetail();
    } catch (error) {
      console.error(`${action} 실패:`, error);
      toast.error(`작업에 실패했습니다: ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string, taskState?: string) => {
    if (taskState && taskState !== 'null') {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
    }
    
    switch (status.toUpperCase()) {
      case 'ACTIVE': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
      case 'SHUTOFF': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200';
      case 'SUSPENDED': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200';
      case 'ERROR': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
      case 'BUILD': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string, taskState?: string) => {
    if (taskState && taskState !== 'null') {
      return `${status} (${taskState})`;
    }
    return status;
  };

  const getInstanceIPs = (addresses: any) => {
    const networks: { name: string; ips: { type: string; addr: string; version: number }[] }[] = [];
    if (addresses) {
      Object.entries(addresses).forEach(([networkName, networkAddresses]: [string, any]) => {
        if (Array.isArray(networkAddresses)) {
          networks.push({
            name: networkName,
            ips: networkAddresses.map((addr: any) => ({
              type: addr['OS-EXT-IPS:type'] || 'unknown',
              addr: addr.addr,
              version: addr.version
            }))
          });
        }
      });
    }
    return networks;
  };

  const getPowerStateText = (powerState: number) => {
    switch (powerState) {
      case 0: return 'NOSTATE';
      case 1: return 'RUNNING';
      case 3: return 'PAUSED';
      case 4: return 'SHUTDOWN';
      case 6: return 'CRASHED';
      case 7: return 'SUSPENDED';
      default: return `UNKNOWN (${powerState})`;
    }
  };

  useEffect(() => {
    fetchInstanceDetail();
  }, [instanceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="text-center py-12">
        <Server className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">인스턴스를 찾을 수 없습니다.</p>
        <button 
          onClick={() => navigate('/compute')}
          className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          인스턴스 목록으로 돌아가기
        </button>
      </div>
    );
  }

  const networkInfo = getInstanceIPs(instance.addresses);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/compute')}
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{instance.name}</h1>
            <p className="text-gray-600 dark:text-gray-400">{instance.id}</p>
          </div>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(instance.status, instance.task_state)}`}>
            {getStatusText(instance.status, instance.task_state)}
          </span>
        </div>
        
        <div className="flex items-center flex-wrap gap-3">
          <button
            onClick={fetchInstanceDetail}
            className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </button>
          
          {instance.status === 'ACTIVE' && (
            <>
              <button
                onClick={handleVNCConsole}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Monitor className="h-4 w-4 mr-2" />
                VNC 콘솔
              </button>
              <button
                onClick={() => handleAction('stop')}
                disabled={actionLoading}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <Square className="h-4 w-4 mr-2" />
                정지
              </button>
            </>
          )}
          
          {instance.status === 'SHUTOFF' && (
            <button
              onClick={() => handleAction('start')}
              disabled={actionLoading}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4 mr-2" />
              시작
            </button>
          )}
          
          <button
            onClick={() => handleAction('reboot')}
            disabled={actionLoading || instance.status === 'SHUTOFF'}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            재시작
          </button>
          
          <button
            onClick={() => handleAction('snapshot')}
            disabled={actionLoading || instance.status !== 'ACTIVE'}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <Camera className="h-4 w-4 mr-2" />
            스냅샷
          </button>
          
          <button
            onClick={handleGetConsoleLogs}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            콘솔 로그
          </button>
          
          <button
            onClick={() => handleAction('delete')}
            disabled={actionLoading}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            삭제
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200 dark:border-gray-600">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: '개요', icon: Info },
            { id: 'network', label: '네트워크', icon: Network },
            { id: 'storage', label: '스토리지', icon: HardDrive },
            { id: 'security', label: '보안', icon: Shield },
            { id: 'connect', label: '연결', icon: Terminal },
            { id: 'console', label: '콘솔', icon: Monitor },
            { id: 'logs', label: '로그', icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 기본 정보 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Server className="h-5 w-5 mr-2" />
              기본 정보
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">인스턴스 ID</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100 font-mono">{instance.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">이름</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">{instance.name}</dd>
              </div>
              {instance.metadata?.description && (
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">설명</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100">{instance.metadata.description}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">상태</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">{instance.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">전원 상태</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">{getPowerStateText(instance.power_state)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">키 페어</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">{instance.key_name || 'N/A'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">생성일</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  {new Date(instance.created).toLocaleString('ko-KR')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">최종 수정</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  {new Date(instance.updated).toLocaleString('ko-KR')}
                </dd>
              </div>
            </dl>
          </div>

          {/* 하드웨어 스펙 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Cpu className="h-5 w-5 mr-2" />
              하드웨어 스펙
            </h3>
            {flavor ? (
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">플레이버</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100">{flavor.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">vCPU</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100 flex items-center">
                    <Cpu className="h-4 w-4 mr-1" />
                    {flavor.vcpus} 코어
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">메모리</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100 flex items-center">
                    <Zap className="h-4 w-4 mr-1" />
                    {flavor.ram} MB ({(flavor.ram / 1024).toFixed(1)} GB)
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">디스크</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100 flex items-center">
                    <HardDrive className="h-4 w-4 mr-1" />
                    {flavor.disk} GB
                  </dd>
                </div>
                {flavor.swap && (
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">스왑</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{flavor.swap} MB</dd>
                  </div>
                )}
                {flavor.ephemeral && (
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">임시 디스크</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{flavor.ephemeral} GB</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">플레이버 정보를 불러올 수 없습니다.</p>
            )}
          </div>

          {/* 이미지 정보 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Database className="h-5 w-5 mr-2" />
              이미지 정보
            </h3>
            {instance.image?.id ? (
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">이미지 이름</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100">{image?.name || '로딩 중...'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">이미지 ID</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100 font-mono">{instance.image.id}</dd>
                </div>
                {image && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">상태</dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100">{image.status}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">가시성</dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100">{image.visibility}</dd>
                    </div>
                    {image.size && (
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">크기</dt>
                        <dd className="text-sm text-gray-900 dark:text-gray-100">{(image.size / (1024 * 1024 * 1024)).toFixed(2)} GB</dd>
                      </div>
                    )}
                  </>
                )}
              </dl>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">볼륨에서 부팅된 인스턴스입니다.</p>
            )}
          </div>

          {/* 메타데이터 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Tag className="h-5 w-5 mr-2" />
              메타데이터 & 태그
            </h3>
            {instance.metadata && Object.keys(instance.metadata).length > 0 ? (
              <dl className="space-y-3">
                {Object.entries(instance.metadata).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{key}</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{value as string}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">메타데이터가 없습니다.</p>
            )}
            
            {instance.tags && instance.tags.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">태그</h4>
                <div className="flex flex-wrap gap-2">
                  {instance.tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'network' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6 flex items-center">
            <Network className="h-5 w-5 mr-2" />
            네트워크 정보
          </h3>
          
          {networkInfo.length > 0 ? (
            <div className="space-y-6">
              {networkInfo.map((network, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">{network.name}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {network.ips.map((ip, ipIndex) => (
                      <div key={ipIndex} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center mb-2">
                          <Globe className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{ip.addr}</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          <p>타입: {ip.type}</p>
                          <p>버전: IPv{ip.version}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">네트워크 정보가 없습니다.</p>
          )}

          {/* 보안 그룹 */}
          <div className="mt-8">
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              보안 그룹
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {instance.security_groups.map((sg, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center">
                    <Shield className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{sg.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'storage' && (
        <div className="space-y-6">
          {/* 통합 스토리지 섹션 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
                <HardDrive className="h-5 w-5 mr-2" />
                스토리지 관리
              </h3>
              <button
                onClick={handleAttachVolume}
                disabled={actionLoading || instance?.status !== 'SHUTOFF'}
                className="flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                title={instance?.status !== 'SHUTOFF' ? '볼륨 연결은 인스턴스가 정지된 상태에서만 가능합니다' : '볼륨 연결'}
              >
                <Link className="h-4 w-4 mr-1" />
                볼륨 연결
              </button>
            </div>
            
            {(() => {
              // ComputePage와 동일한 로직으로 모든 볼륨 찾기
              const attachedVolumes = instance.volumes_attached || [];
              
              // Cinder API에서 해당 인스턴스에 연결된 모든 볼륨 찾기
              const connectedVolumes = volumes.filter((vol: any) => {
                return vol.attachments && vol.attachments.some((att: any) => att.server_id === instance.id);
              });
              
              // 두 방법으로 찾은 볼륨을 합치기 (중복 제거)
              const allFoundVolumes = new Map();
              
              // Nova API 결과 추가
              attachedVolumes.forEach((vol: any) => {
                const volumeInfo = volumes.find((v: any) => v.id === vol.id);
                allFoundVolumes.set(vol.id, {
                  id: vol.id,
                  name: volumeInfo?.name || vol.id,
                  size: volumeInfo?.size || 0,
                  device: vol.device,
                  source: 'nova_api',
                  volumeInfo: volumeInfo
                });
              });
              
              // Cinder API 결과 추가 (더 포괄적)
              connectedVolumes.forEach((vol: any) => {
                const attachment = vol.attachments.find((att: any) => att.server_id === instance.id);
                allFoundVolumes.set(vol.id, {
                  id: vol.id,
                  name: vol.name || vol.id,
                  size: vol.size || 0,
                  device: attachment?.device || 'unknown',
                  source: allFoundVolumes.has(vol.id) ? 'both_apis' : 'cinder_api',
                  volumeInfo: vol
                });
              });
              
              const volumesToShow = Array.from(allFoundVolumes.values());
              
              if (volumesToShow.length > 0) {
                return (
                  <div className="space-y-4">
                    {volumesToShow.map((volume: any, index: number) => {
                      const isBootVolume = volume.device === '/dev/vda' || volume.device === '/dev/sda' || 
                                         (!instance.image?.id && index === 0) ||
                                         (volume.device === 'unknown' && !instance.image?.id);
                      const volumeInfo = volume.volumeInfo;
                      
                      return (
                        <div key={volume.id} className={`border rounded-lg p-6 ${isBootVolume ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              {/* 볼륨 헤더 */}
                              <div className="flex items-center mb-4">
                                <HardDrive className={`h-6 w-6 mr-3 ${isBootVolume ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                                <div>
                                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                                    {volume.name}
                                    {isBootVolume && (
                                      <span className="ml-3 inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                                        🚀 부팅 볼륨
                                      </span>
                                    )}
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{volume.id}</p>
                                </div>
                              </div>
                              
                              {/* 볼륨 상세 정보 */}
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                                <div className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-600">
                                  <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">크기</dt>
                                  <dd className="text-lg font-semibold text-gray-900 dark:text-gray-100">{volume.size} GB</dd>
                                </div>
                                
                                <div className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-600">
                                  <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">디바이스</dt>
                                  <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{volume.device}</dd>
                                </div>
                                
                                <div className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-600">
                                  <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">상태</dt>
                                  <dd className="text-sm">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      volumeInfo?.status === 'available' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                                      volumeInfo?.status === 'in-use' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                                      volumeInfo?.status === 'creating' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' :
                                      'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                                    }`}>
                                      {volumeInfo?.status || 'unknown'}
                                    </span>
                                  </dd>
                                </div>
                                
                                <div className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-600">
                                  <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">볼륨 타입</dt>
                                  <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{volumeInfo?.volume_type || 'default'}</dd>
                                </div>
                              </div>
                              
                              {/* 추가 상세 정보 */}
                              {volumeInfo && (
                                <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-600">
                                  <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">상세 정보</h5>
                                  <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <dt className="text-gray-500 dark:text-gray-400">생성일</dt>
                                      <dd className="text-gray-900 dark:text-gray-100">{volumeInfo.created_at ? new Date(volumeInfo.created_at).toLocaleDateString('ko-KR') : '-'}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500 dark:text-gray-400">가용영역</dt>
                                      <dd className="text-gray-900 dark:text-gray-100">{volumeInfo.availability_zone || '-'}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500 dark:text-gray-400">암호화</dt>
                                      <dd className="text-gray-900 dark:text-gray-100">{volumeInfo.encrypted ? '예' : '아니오'}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500 dark:text-gray-400">부팅 가능</dt>
                                      <dd className="text-gray-900 dark:text-gray-100">{volumeInfo.bootable === 'true' ? '예' : '아니오'}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500 dark:text-gray-400">스냅샷 ID</dt>
                                      <dd className="text-gray-900 dark:text-gray-100">{volumeInfo.snapshot_id || '-'}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500 dark:text-gray-400">소스 이미지</dt>
                                      <dd className="text-gray-900 dark:text-gray-100">{volumeInfo.volume_image_metadata?.image_name || '-'}</dd>
                                    </div>
                                    {volumeInfo.description && (
                                      <div className="col-span-full">
                                        <dt className="text-gray-500 dark:text-gray-400">설명</dt>
                                        <dd className="text-gray-900 dark:text-gray-100">{volumeInfo.description}</dd>
                                      </div>
                                    )}
                                  </dl>
                                </div>
                              )}
                            </div>
                            
                            {/* 액션 버튼 */}
                            <div className="flex flex-col items-end space-y-2 ml-4">
                              <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                                연결됨
                              </span>
                              {!isBootVolume && (
                                <button
                                  onClick={() => handleDetachVolume(volume.id, volume.name)}
                                  disabled={actionLoading || instance?.status !== 'SHUTOFF'}
                                  className="flex items-center px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                                  title={instance?.status !== 'SHUTOFF' ? '볼륨 분리는 인스턴스가 정지된 상태에서만 가능합니다' : '볼륨 분리'}
                                >
                                  <Unlink className="h-4 w-4 mr-1" />
                                  분리
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              } else {
                return (
                  <div className="text-center py-12">
                    <HardDrive className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg">연결된 볼륨이 없습니다</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">이미지에서 부팅된 인스턴스이거나 볼륨 감지에 실패했습니다.</p>
                  </div>
                );
              }
            })()}
          </div>
          
          {/* 간단한 요약 정보 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              부팅 정보
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">부팅 방식</dt>
                <dd className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {instance.image?.id ? '🖼️ 이미지' : '💾 볼륨'}
                </dd>
              </div>
              
              {instance.image?.id && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">이미지</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{image?.name || '로딩 중...'}</dd>
                </div>
              )}
              
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">플레이버 디스크</dt>
                <dd className="text-lg font-semibold text-gray-900 dark:text-gray-100">{flavor?.disk || 0} GB</dd>
              </div>
              
              {flavor?.ephemeral && flavor.ephemeral > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">임시 디스크</dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-gray-100">{flavor.ephemeral} GB</dd>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6 flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            보안 설정
          </h3>
          
          <div className="space-y-6">
            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">보안 그룹</h4>
              <div className="space-y-2">
                {instance.security_groups.map((sg, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                    <div className="flex items-center">
                      <Shield className="h-4 w-4 text-green-600 dark:text-green-400 mr-3" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{sg.name}</span>
                    </div>
                    <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm">
                      규칙 보기
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">액세스 설정</h4>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">키 페어</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100">{instance.key_name || '설정되지 않음'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">잠금 상태</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100">
                    {instance.locked ? (
                      <span className="text-red-600 dark:text-red-400">잠김</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">잠금 해제</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Config Drive</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100">
                    {instance.config_drive ? (
                      <span className="text-green-600 dark:text-green-400">활성화</span>
                    ) : (
                      <span className="text-gray-600 dark:text-gray-400">비활성화</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'console' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
              <Monitor className="h-5 w-5 mr-2" />
              VNC 콘솔
            </h3>
            <button
              onClick={handleVNCConsole}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Monitor className="h-4 w-4 mr-2" />
              새 콘솔 연결
            </button>
          </div>
          
          {consoleUrl ? (
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <iframe
                id="vnc-console-iframe"
                src={consoleUrl}
                className="w-full h-96"
                title="VNC Console"
                sandbox="allow-same-origin allow-scripts allow-forms"
                onLoad={() => {
                  // noVNC iframe이 로드된 후 WebSocket 경로 수정
                  try {
                    const iframe = document.getElementById('vnc-console-iframe') as HTMLIFrameElement;
                    if (iframe && iframe.contentWindow) {
                      // noVNC가 WebSocket을 생성할 때 올바른 경로 사용하도록 보장
                      // noVNC는 자동으로 현재 페이지의 호스트를 사용하므로,
                      // 경로만 올바르게 설정하면 됨
                      const urlObj = new URL(consoleUrl.startsWith('/') ? `https://leee.cloud${consoleUrl}` : consoleUrl);
                      const path = urlObj.searchParams.get('path');
                      if (path) {
                        const tokenMatch = path.match(/token=([^&]+)/);
                        if (tokenMatch) {
                          console.log('VNC 토큰 확인:', tokenMatch[1]);
                        }
                      }
                    }
                  } catch (error) {
                    console.error('VNC 콘솔 iframe 처리 오류:', error);
                  }
                }}
              />
            </div>
          ) : (
            <div className="text-center py-12">
              <Monitor className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">VNC 콘솔에 연결하려면 위의 버튼을 클릭하세요.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'connect' && (
        <div className="space-y-6">
          {(() => {
            if (!instance) {
              return (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="text-center py-12">
                    <Terminal className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg">인스턴스 정보를 불러오는 중...</p>
                  </div>
                </div>
              );
            }

            const tunnelDomain = instance?.metadata?.cloudflare_tunnel_domain;
            
            // 이미지 이름 기반으로 사용자명 자동 감지
            const getDefaultUsername = (imageName?: string): string => {
              if (!imageName) return 'ubuntu'; // 기본값
              
              const name = imageName.toLowerCase();
              if (name.includes('ubuntu') || name.includes('debian')) {
                return 'ubuntu';
              } else if (name.includes('centos') || name.includes('rhel') || name.includes('rocky') || name.includes('almalinux')) {
                return 'centos';
              } else if (name.includes('fedora')) {
                return 'fedora';
              } else if (name.includes('opensuse') || name.includes('suse')) {
                return 'opensuse';
              } else if (name.includes('alpine')) {
                return 'alpine';
              }
              return 'ubuntu'; // 기본값
            };
            
            const username = getDefaultUsername(image?.name);
            
            if (!tunnelDomain) {
              return (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="text-center py-12">
                    <Terminal className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg">Cloudflare Tunnel이 설정되지 않았습니다.</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                      인스턴스 생성 시 "Cloudflare Tunnel 자동 설정" 옵션을 활성화하면 SSH 연결 정보가 표시됩니다.
                    </p>
                  </div>
                </div>
              );
            }

            const copyToClipboard = async (text: string, commandId: string) => {
              try {
                await navigator.clipboard.writeText(text);
                setCopiedCommand(commandId);
                toast.success('명령어가 복사되었습니다.');
                setTimeout(() => setCopiedCommand(null), 2000);
              } catch (error) {
                toast.error('복사에 실패했습니다.');
              }
            };

            return (
              <>
                {/* 서브 탭 네비게이션 */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="border-b border-gray-200 dark:border-gray-600">
                    <nav className="-mb-px flex space-x-8 px-6">
                      {[
                        { id: 'quick', label: '빠른 연결', icon: Zap },
                        { id: 'macos', label: 'macOS/Linux', icon: Terminal },
                        { id: 'windows', label: 'Windows', icon: Monitor },
                        { id: 'putty', label: 'PuTTY', icon: Settings },
                        { id: 'troubleshoot', label: '문제 해결', icon: Info },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setConnectSubTab(tab.id as any)}
                          className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center ${
                            connectSubTab === tab.id
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        >
                          <tab.icon className="h-4 w-4 mr-2" />
                          {tab.label}
                        </button>
                      ))}
                    </nav>
                  </div>
                </div>

                {/* 빠른 연결 탭 */}
                {connectSubTab === 'quick' && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
                    <div className="text-center pb-4">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">원클릭 연결</h3>
                      <p className="text-gray-500 dark:text-gray-400">가장 간단한 방법으로 연결하세요</p>
                    </div>

                    {/* Tunnel 문제 해결 버튼들 */}
                    {instance?.metadata?.cloudflare_tunnel_id && (
                      <div className="space-y-3">
                        {/* 자동 준비 버튼 */}
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border-2 border-green-200 dark:border-green-800">
                          <div className="mb-3">
                            <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center">
                              <Check className="h-4 w-4 mr-2" />
                              🚀 SSH 연결 준비 자동 완료 (추천!)
                            </h4>
                            <p className="text-xs text-green-700 dark:text-green-300 mb-3">
                              이 버튼 하나로 DNS, Ingress 규칙 등 모든 준비를 자동으로 완료합니다.
                              <br />
                              <strong>PuTTY와 일반 SSH 모두 동일한 문제가 발생할 수 있습니다.</strong>
                            </p>
                            <button
                              onClick={async () => {
                                try {
                                  const tunnelId = instance.metadata?.cloudflare_tunnel_id;
                                  const tunnelDomain = instance.metadata?.cloudflare_tunnel_domain;
                                  if (!tunnelId || !tunnelDomain) {
                                    toast.error('Tunnel 정보를 찾을 수 없습니다.');
                                    return;
                                  }
                                  toast.loading('SSH 연결 준비 중... (DNS + Ingress 설정)', { id: 'prepare-ssh' });
                                  const result = await cloudflareService.prepareSSHConnection(tunnelId, tunnelDomain);
                                  
                                  if (result.allReady) {
                                    const actionText = result.actions.length > 0 
                                      ? `다음 작업을 완료했습니다: ${result.actions.join(', ')}`
                                      : '모든 설정이 완료되어 있습니다.';
                                    toast.success(`${actionText} 3-5분 후 SSH 연결을 시도하세요.`, { 
                                      id: 'prepare-ssh',
                                      duration: 10000 
                                    });
                                  } else {
                                    toast.success('설정을 완료했습니다. 3-5분 후 SSH 연결을 시도하세요.', { 
                                      id: 'prepare-ssh',
                                      duration: 10000 
                                    });
                                  }
                                } catch (error: any) {
                                  toast.error(`SSH 연결 준비 실패: ${error.message}`, { 
                                    id: 'prepare-ssh',
                                    duration: 8000 
                                  });
                                }
                              }}
                              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                            >
                              ✅ SSH 연결 준비 완료하기
                            </button>
                            <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                              💡 이 버튼을 클릭하면 DNS 레코드와 Ingress 규칙이 자동으로 설정됩니다.
                              <br />
                              완료 후 3-5분 정도 기다린 다음 SSH 연결을 시도하세요.
                            </div>
                          </div>
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border-2 border-red-200 dark:border-red-800">
                          <div className="mb-3">
                            <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2 flex items-center">
                              <AlertCircle className="h-4 w-4 mr-2" />
                              SSH 연결이 안 되는 경우 수동 해결 방법
                            </h4>
                            <p className="text-xs text-red-700 dark:text-red-300 mb-3">
                              아래 단계를 <strong>순서대로</strong> 진행하세요:
                            </p>
                            
                            {/* 단계별 해결 방법 */}
                            <div className="space-y-3 text-xs">
                              <div className="bg-red-100 dark:bg-red-900 rounded p-3">
                                <div className="font-semibold text-red-800 dark:text-red-200 mb-2">1단계: DNS 레코드 재생성 (필수!)</div>
                                <div className="text-red-700 dark:text-red-300 mb-2">
                                  <strong>"DNS 강제 재생성"</strong> 버튼을 클릭한 후 <strong>3-5분</strong> 기다리세요.
                                  <br />
                                  <span className="text-xs">DNS 전파가 완료되기까지 시간이 걸릴 수 있습니다.</span>
                                </div>
                                <div className="flex gap-2 mb-2">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const tunnelId = instance.metadata?.cloudflare_tunnel_id;
                                        const tunnelDomain = instance.metadata?.cloudflare_tunnel_domain;
                                        if (!tunnelId || !tunnelDomain) {
                                          toast.error('Tunnel 정보를 찾을 수 없습니다.');
                                          return;
                                        }
                                        toast.loading('DNS 레코드 강제 재생성 중...', { id: 'fix-dns' });
                                        await cloudflareService.addDNSRecord(tunnelDomain, tunnelId, true);
                                        toast.success('DNS 레코드를 강제 재생성했습니다. 3-5분 후 다시 시도하세요.', { 
                                          id: 'fix-dns',
                                          duration: 8000 
                                        });
                                      } catch (error: any) {
                                        toast.error(`DNS 레코드 재생성 실패: ${error.message}`, { 
                                          id: 'fix-dns',
                                          duration: 8000 
                                        });
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium flex-1"
                                  >
                                    DNS 강제 재생성
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const tunnelDomain = instance.metadata?.cloudflare_tunnel_domain;
                                        if (!tunnelDomain) {
                                          toast.error('Tunnel 도메인을 찾을 수 없습니다.');
                                          return;
                                        }
                                        toast.loading('DNS 레코드 확인 중...', { id: 'check-dns' });
                                        const check = await cloudflareService.checkDNSRecord(tunnelDomain);
                                        if (check.exists) {
                                          toast.success(`DNS 레코드가 존재합니다: ${check.content}`, { 
                                            id: 'check-dns',
                                            duration: 5000 
                                          });
                                        } else {
                                          toast.error('DNS 레코드를 찾을 수 없습니다. 재생성이 필요합니다.', { 
                                            id: 'check-dns',
                                            duration: 5000 
                                          });
                                        }
                                      } catch (error: any) {
                                        toast.error(`DNS 확인 실패: ${error.message}`, { 
                                          id: 'check-dns',
                                          duration: 5000 
                                        });
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs font-medium"
                                  >
                                    DNS 확인
                                  </button>
                                </div>
                                <div className="text-xs text-red-600 dark:text-red-400 mt-2">
                                  💡 <strong>팁:</strong> DNS 재생성 후 로컬 DNS 캐시를 지우세요:
                                  <br />
                                  <code className="bg-red-50 dark:bg-red-950 px-1 rounded">sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder</code>
                                </div>
                              </div>

                              <div className="bg-red-100 dark:bg-red-900 rounded p-3">
                                <div className="font-semibold text-red-800 dark:text-red-200 mb-2">2단계: Ingress 규칙 추가</div>
                                <div className="text-red-700 dark:text-red-300 mb-2">
                                  "ingress 규칙 추가" 버튼을 클릭한 후 <strong>2-3분</strong> 기다리세요.
                                </div>
                                <button
                                  onClick={async () => {
                                    try {
                                      const tunnelId = instance.metadata?.cloudflare_tunnel_id;
                                      const tunnelDomain = instance.metadata?.cloudflare_tunnel_domain;
                                      if (!tunnelId || !tunnelDomain) {
                                        toast.error('Tunnel 정보를 찾을 수 없습니다.');
                                        return;
                                      }
                                      toast.loading('ingress 규칙 추가 중...', { id: 'fix-tunnel' });
                                      await cloudflareService.updateTunnelConfig(tunnelId, tunnelDomain, 'ssh://localhost:22');
                                      toast.success('ingress 규칙을 추가했습니다. 2-3분 후 SSH 연결을 시도하세요.', { 
                                        id: 'fix-tunnel',
                                        duration: 7000 
                                      });
                                    } catch (error: any) {
                                      toast.error(`ingress 규칙 추가 실패: ${error.message}`, { 
                                        id: 'fix-tunnel',
                                        duration: 7000 
                                      });
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs font-medium"
                                >
                                  ingress 규칙 추가
                                </button>
                              </div>

                              <div className="bg-red-100 dark:bg-red-900 rounded p-3">
                                <div className="font-semibold text-red-800 dark:text-red-200 mb-2">3단계: 인스턴스 콘솔에서 설정 확인 및 수정</div>
                                <div className="text-red-700 dark:text-red-300 mb-2">
                                  OpenStack 콘솔로 인스턴스에 접속한 후 아래 명령어를 실행하세요:
                                </div>

                                {/* 진단 명령어 */}
                                <div className="mb-3">
                                  <div className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">🔍 먼저 상태 확인 (복사해서 실행):</div>
                                  <div className="bg-red-50 dark:bg-red-950 rounded p-2 font-mono text-xs mb-2">
                                    <div className="mb-1"># 1. cloud-init 스크립트 파일 존재 확인</div>
                                    <div className="mb-1">ls -la /usr/local/bin/setup-cloudflare-tunnel.sh 2&gt;/dev/null && echo "✅ 스크립트 파일 있음" || echo "❌ 스크립트 파일 없음"</div>
                                    <div className="mb-1"># 2. cloud-init 로그 확인 (user_data 실행 여부)</div>
                                    <div className="mb-1">sudo cat /var/log/cloud-init.log | grep -i "cloudflare\|setup-cloudflare\|runcmd" | tail -20</div>
                                    <div className="mb-1"># 3. cloud-init 출력 로그 확인</div>
                                    <div className="mb-1">sudo cat /var/log/cloud-init-output.log | tail -50</div>
                                    <div className="mb-1"># 4. cloud-init 스크립트 실행 여부 확인</div>
                                    <div className="mb-1">ls -la /var/log/cloudflare-tunnel-script-executed 2&gt;/dev/null && echo "✅ 스크립트 실행됨" || echo "❌ 스크립트 실행 안됨"</div>
                                    <div className="mb-1"># 5. 스크립트 실행 로그 확인</div>
                                    <div className="mb-1">cat /var/log/cloudflare-tunnel-setup.log 2&gt;/dev/null || echo "로그 파일 없음"</div>
                                    <div className="mb-1"># 6. Cloudflare Tunnel 서비스 상태 확인</div>
                                    <div className="mb-1">systemctl status cloudflared-tunnel</div>
                                    <div className="mb-1"># 7. cloudflared 설치 확인</div>
                                    <div className="mb-1">which cloudflared && cloudflared version || echo "cloudflared 미설치"</div>
                                    <div className="mb-1"># 8. user_data 확인 (메타데이터 서버에서)</div>
                                    <div>curl -s http://169.254.169.254/latest/user-data | head -20</div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const command = `# Cloudflare Tunnel 진단 스크립트
echo "=== 1. 스크립트 파일 존재 확인 ==="
ls -la /usr/local/bin/setup-cloudflare-tunnel.sh 2>/dev/null && echo "✅ 스크립트 파일 있음" || echo "❌ 스크립트 파일 없음"

echo ""
echo "=== 2. cloud-init 로그 확인 (user_data 실행 여부) ==="
sudo cat /var/log/cloud-init.log | grep -i "cloudflare\|setup-cloudflare\|runcmd" | tail -20 || echo "cloud-init 로그에서 관련 내용 없음"

echo ""
echo "=== 3. cloud-init 출력 로그 확인 ==="
sudo cat /var/log/cloud-init-output.log | tail -50 || echo "cloud-init 출력 로그 없음"

echo ""
echo "=== 4. 스크립트 실행 여부 확인 ==="
ls -la /var/log/cloudflare-tunnel-script-executed 2>/dev/null && echo "✅ 스크립트 실행됨" || echo "❌ 스크립트 실행 안됨"

echo ""
echo "=== 5. 스크립트 실행 로그 ==="
cat /var/log/cloudflare-tunnel-setup.log 2>/dev/null || echo "로그 파일 없음"

echo ""
echo "=== 6. Cloudflare Tunnel 서비스 상태 ==="
systemctl status cloudflared-tunnel || echo "서비스 없음"

echo ""
echo "=== 7. cloudflared 설치 확인 ==="
which cloudflared && cloudflared version || echo "cloudflared 미설치"

echo ""
echo "=== 8. user_data 확인 (메타데이터 서버) ==="
curl -s http://169.254.169.254/latest/user-data | head -20 || echo "user_data 조회 실패"`;
                                      copyToClipboard(command, 'diagnose');
                                    }}
                                    className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs font-medium mb-2"
                                  >
                                    {copiedCommand === 'diagnose' ? (
                                      <span className="flex items-center">
                                        <Check className="h-3 w-3 mr-1" />
                                        복사됨
                                      </span>
                                    ) : (
                                      <span className="flex items-center">
                                        <Copy className="h-3 w-3 mr-1" />
                                        진단 명령어 복사
                                      </span>
                                    )}
                                  </button>
                                </div>

                                {/* Tunnel 완전 수동 설정 */}
                                <div className="mb-3">
                                  <div className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">🔧 Tunnel 완전 수동 설정 (토큰 포함):</div>
                                  <div className="bg-red-50 dark:bg-red-950 rounded p-2 font-mono text-xs mb-2">
                                    <div># 1. user_data에서 Tunnel 토큰 추출</div>
                                    <div>USER_DATA=$(curl -s http://169.254.169.254/latest/user-data)</div>
                                    <div>TUNNEL_LINE=$(echo "$USER_DATA" | grep "tunnel --token" | head -1)</div>
                                    <div>TUNNEL_TOKEN=$(echo "$TUNNEL_LINE" | sed 's/.*--token \\([^ ]*\\).*/\\1/')</div>
                                    <div>echo "토큰 확인: $TUNNEL_TOKEN"</div>
                                    <div className="mt-2"># 2. cloudflared 설치</div>
                                    <div>ARCH=$(uname -m); [ "$ARCH" = "x86_64" ] && ARCH="amd64" || ARCH="arm64"</div>
                                    <div>curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH -o /usr/local/bin/cloudflared</div>
                                    <div>chmod +x /usr/local/bin/cloudflared</div>
                                    <div className="mt-2"># 3. config.yml 생성</div>
                                    <div>sudo mkdir -p /etc/cloudflared</div>
                                    <div>sudo tee /etc/cloudflared/config.yml &lt;&lt;EOF</div>
                                    <div>ingress:</div>
                                    <div>&nbsp;&nbsp;- hostname: {tunnelDomain}</div>
                                    <div>&nbsp;&nbsp;&nbsp;&nbsp;service: ssh://localhost:22</div>
                                    <div>&nbsp;&nbsp;- service: http_status:404</div>
                                    <div>EOF</div>
                                    <div>sudo chmod 600 /etc/cloudflared/config.yml</div>
                                    <div className="mt-2"># 4. systemd 서비스 생성</div>
                                    <div>sudo tee /etc/systemd/system/cloudflared-tunnel.service &lt;&lt;EOFSERVICE</div>
                                    <div>[Unit]</div>
                                    <div>Description=Cloudflare Tunnel</div>
                                    <div>After=network-online.target</div>
                                    <div>Wants=network-online.target</div>
                                    <div>[Service]</div>
                                    <div>Type=simple</div>
                                    <div>User=root</div>
                                    <div>ExecStart=/usr/local/bin/cloudflared tunnel --token $TUNNEL_TOKEN run</div>
                                    <div>Restart=always</div>
                                    <div>RestartSec=5</div>
                                    <div>Environment=CLOUDFLARED_CONFIG=/etc/cloudflared/config.yml</div>
                                    <div>[Install]</div>
                                    <div>WantedBy=multi-user.target</div>
                                    <div>EOFSERVICE</div>
                                    <div className="mt-2"># 5. 서비스 시작</div>
                                    <div>sudo systemctl daemon-reload</div>
                                    <div>sudo systemctl enable cloudflared-tunnel</div>
                                    <div>sudo systemctl start cloudflared-tunnel</div>
                                    <div>sudo systemctl status cloudflared-tunnel</div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const command = `# Tunnel 완전 수동 설정 스크립트
# 1. user_data에서 Tunnel 토큰 추출
USER_DATA=$(curl -s http://169.254.169.254/latest/user-data)
TUNNEL_LINE=$(echo "$USER_DATA" | grep "tunnel --token" | head -1)
if [ -z "$TUNNEL_LINE" ]; then
  echo "❌ Tunnel 토큰을 찾을 수 없습니다. user_data를 확인하세요:"
  echo "$USER_DATA" | grep -A 5 "ExecStart" || echo "$USER_DATA" | tail -20
  exit 1
fi
TUNNEL_TOKEN=$(echo "$TUNNEL_LINE" | awk '{for(i=1;i<=NF;i++) if($i=="--token") print $(i+1)}')
if [ -z "$TUNNEL_TOKEN" ]; then
  echo "❌ 토큰 파싱 실패. 수동으로 확인하세요:"
  echo "$TUNNEL_LINE"
  exit 1
fi
echo "✅ Tunnel 토큰 발견"

# 2. cloudflared 설치
ARCH=$(uname -m)
[ "$ARCH" = "x86_64" ] && ARCH="amd64" || ARCH="arm64"
echo "cloudflared 다운로드 중... (아키텍처: $ARCH)"
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
cloudflared version || echo "⚠️ cloudflared 버전 확인 실패"

# 3. config.yml 생성
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml > /dev/null <<EOF
ingress:
  - hostname: ${tunnelDomain}
    service: ssh://localhost:22
  - service: http_status:404
EOF
sudo chmod 600 /etc/cloudflared/config.yml
echo "✅ config.yml 생성 완료"

# 4. systemd 서비스 생성
sudo tee /etc/systemd/system/cloudflared-tunnel.service > /dev/null <<EOFSERVICE
[Unit]
Description=Cloudflare Tunnel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel --token $TUNNEL_TOKEN run
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=CLOUDFLARED_CONFIG=/etc/cloudflared/config.yml

[Install]
WantedBy=multi-user.target
EOFSERVICE
echo "✅ systemd 서비스 생성 완료"

# 5. 서비스 시작
sudo systemctl daemon-reload
sudo systemctl enable cloudflared-tunnel
sudo systemctl start cloudflared-tunnel
sleep 3
sudo systemctl status cloudflared-tunnel

echo ""
echo "✅ Tunnel 설정 완료!"
echo "상태 확인: sudo systemctl status cloudflared-tunnel"
echo "로그 확인: sudo journalctl -u cloudflared-tunnel -f"`;
                                      copyToClipboard(command, 'manual-setup');
                                    }}
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium mb-2"
                                  >
                                    {copiedCommand === 'manual-setup' ? (
                                      <span className="flex items-center">
                                        <Check className="h-3 w-3 mr-1" />
                                        복사됨
                                      </span>
                                    ) : (
                                      <span className="flex items-center">
                                        <Copy className="h-3 w-3 mr-1" />
                                        완전 수동 설정 스크립트 복사
                                      </span>
                                    )}
                                  </button>
                                </div>

                                {/* Tunnel 활성화 스크립트 (가장 중요!) */}
                                <div className="mb-3">
                                  <div className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">🚨 Tunnel 활성화 (가장 중요! - Tunnel이 inactive인 경우):</div>
                                  <div className="bg-red-50 dark:bg-red-950 rounded p-2 font-mono text-xs mb-2">
                                    <div># 1. cloudflared 설치 확인 및 설치</div>
                                    <div>ARCH=$(uname -m)</div>
                                    <div>[ "$ARCH" = "x86_64" ] && ARCH="amd64" || ARCH="arm64"</div>
                                    <div>curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH -o /usr/local/bin/cloudflared</div>
                                    <div>chmod +x /usr/local/bin/cloudflared</div>
                                    <div className="mt-2"># 2. config.yml 생성</div>
                                    <div>sudo mkdir -p /etc/cloudflared</div>
                                    <div>sudo tee /etc/cloudflared/config.yml &lt;&lt;EOF</div>
                                    <div>ingress:</div>
                                    <div>&nbsp;&nbsp;- hostname: {tunnelDomain}</div>
                                    <div>&nbsp;&nbsp;&nbsp;&nbsp;service: ssh://localhost:22</div>
                                    <div>&nbsp;&nbsp;- service: http_status:404</div>
                                    <div>EOF</div>
                                    <div>sudo chmod 600 /etc/cloudflared/config.yml</div>
                                    <div className="mt-2"># 3. systemd 서비스 생성 (Tunnel 토큰 필요 - 대시보드에서 확인)</div>
                                    <div># ⚠️ Tunnel 토큰은 인스턴스 생성 시에만 제공되므로,</div>
                                    <div>#    기존 인스턴스는 Tunnel을 재생성해야 합니다.</div>
                                    <div className="mt-2"># 4. 서비스 시작</div>
                                    <div>sudo systemctl daemon-reload</div>
                                    <div>sudo systemctl enable cloudflared-tunnel</div>
                                    <div>sudo systemctl start cloudflared-tunnel</div>
                                    <div>sudo systemctl status cloudflared-tunnel</div>
                                  </div>
                                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-2 mb-2 border border-yellow-200 dark:border-yellow-800">
                                    <p className="text-xs text-yellow-800 dark:text-yellow-200 font-semibold mb-1">
                                      ⚠️ 중요: Tunnel 토큰이 필요합니다!
                                    </p>
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                      기존 인스턴스의 경우 Tunnel 토큰이 없을 수 있습니다.
                                      <br />
                                      <strong>해결 방법:</strong> 인스턴스를 삭제하고 Cloudflare Tunnel 옵션을 활성화한 상태로 다시 생성하세요.
                                      <br />
                                      또는 인스턴스 메타데이터에 Tunnel 토큰이 저장되어 있는지 확인하세요.
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const command = `# cloudflared 설치
ARCH=$(uname -m)
[ "$ARCH" = "x86_64" ] && ARCH="amd64" || ARCH="arm64"
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# config.yml 생성
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml > /dev/null <<EOF
ingress:
  - hostname: ${tunnelDomain}
    service: ssh://localhost:22
  - service: http_status:404
EOF
sudo chmod 600 /etc/cloudflared/config.yml

# systemd 서비스 생성 (Tunnel 토큰 필요)
# ⚠️ Tunnel 토큰은 대시보드에서 확인하거나 인스턴스 메타데이터에서 확인하세요
# sudo tee /etc/systemd/system/cloudflared-tunnel.service > /dev/null <<EOFSERVICE
# [Unit]
# Description=Cloudflare Tunnel
# After=network-online.target
# Wants=network-online.target
# [Service]
# Type=simple
# User=root
# ExecStart=/usr/local/bin/cloudflared tunnel --token YOUR_TUNNEL_TOKEN run
# Restart=always
# RestartSec=5
# Environment=CLOUDFLARED_CONFIG=/etc/cloudflared/config.yml
# [Install]
# WantedBy=multi-user.target
# EOFSERVICE

# 서비스 시작
sudo systemctl daemon-reload
sudo systemctl enable cloudflared-tunnel
sudo systemctl start cloudflared-tunnel
sudo systemctl status cloudflared-tunnel`;
                                      copyToClipboard(command, 'fix-tunnel-activate');
                                    }}
                                    className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
                                  >
                                    {copiedCommand === 'fix-tunnel-activate' ? (
                                      <span className="flex items-center">
                                        <Check className="h-3 w-3 mr-1" />
                                        복사됨
                                      </span>
                                    ) : (
                                      <span className="flex items-center">
                                        <Copy className="h-3 w-3 mr-1" />
                                        Tunnel 활성화 스크립트 복사
                                      </span>
                                    )}
                                  </button>
                                </div>

                                {/* config.yml 생성 명령어 */}
                                <div className="mb-3">
                                  <div className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">⚙️ config.yml 파일 생성/수정 (Tunnel이 이미 실행 중인 경우):</div>
                                  <div className="bg-red-50 dark:bg-red-950 rounded p-2 font-mono text-xs mb-2">
                                    <div>sudo mkdir -p /etc/cloudflared</div>
                                    <div>sudo tee /etc/cloudflared/config.yml &lt;&lt;EOF</div>
                                    <div>ingress:</div>
                                    <div>&nbsp;&nbsp;- hostname: {tunnelDomain}</div>
                                    <div>&nbsp;&nbsp;&nbsp;&nbsp;service: ssh://localhost:22</div>
                                    <div>&nbsp;&nbsp;- service: http_status:404</div>
                                    <div>EOF</div>
                                    <div>sudo chmod 600 /etc/cloudflared/config.yml</div>
                                    <div>sudo systemctl restart cloudflared-tunnel</div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const command = `sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml > /dev/null <<EOF
ingress:
  - hostname: ${tunnelDomain}
    service: ssh://localhost:22
  - service: http_status:404
EOF
sudo chmod 600 /etc/cloudflared/config.yml
sudo systemctl restart cloudflared-tunnel`;
                                      copyToClipboard(command, 'fix-config');
                                    }}
                                    className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium"
                                  >
                                    {copiedCommand === 'fix-config' ? (
                                      <span className="flex items-center">
                                        <Check className="h-3 w-3 mr-1" />
                                        복사됨
                                      </span>
                                    ) : (
                                      <span className="flex items-center">
                                        <Copy className="h-3 w-3 mr-1" />
                                        config.yml 생성 명령어 복사
                                      </span>
                                    )}
                                  </button>
                                </div>

                                {/* 재시작 및 로그 확인 명령어 */}
                                <div>
                                  <div className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">🔄 서비스 재시작 및 실시간 로그 확인:</div>
                                  <div className="bg-red-50 dark:bg-red-950 rounded p-2 font-mono text-xs mb-2">
                                    <div className="mb-1"># Tunnel 서비스 재시작</div>
                                    <div className="mb-1">sudo systemctl restart cloudflared-tunnel</div>
                                    <div className="mb-1"># 재시작 후 상태 확인</div>
                                    <div className="mb-1">sleep 5 && systemctl status cloudflared-tunnel</div>
                                    <div className="mb-1"># 실시간 로그 확인 (Ctrl+C로 종료)</div>
                                    <div>journalctl -u cloudflared-tunnel -f</div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const command = `sudo systemctl restart cloudflared-tunnel
sleep 5
systemctl status cloudflared-tunnel
echo "=== 최근 로그 ==="
journalctl -u cloudflared-tunnel -n 30 --no-pager`;
                                      copyToClipboard(command, 'restart-check');
                                    }}
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium"
                                  >
                                    {copiedCommand === 'restart-check' ? (
                                      <span className="flex items-center">
                                        <Check className="h-3 w-3 mr-1" />
                                        복사됨
                                      </span>
                                    ) : (
                                      <span className="flex items-center">
                                        <Copy className="h-3 w-3 mr-1" />
                                        재시작 및 확인 명령어 복사
                                      </span>
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="bg-red-100 dark:bg-red-900 rounded p-3">
                                <div className="font-semibold text-red-800 dark:text-red-200 mb-2">4단계: 클라이언트(macOS)에서 DNS 확인</div>
                                <div className="text-red-700 dark:text-red-300 mb-2">
                                  인스턴스는 정상입니다. 이제 클라이언트에서 DNS를 확인하세요:
                                </div>
                                <div className="bg-red-50 dark:bg-red-950 rounded p-2 font-mono text-xs mb-2">
                                  <div className="mb-1"># DNS 레코드 조회 (CNAME 확인)</div>
                                  <div className="mb-1">dig +short {tunnelDomain} CNAME</div>
                                  <div className="mb-1"># 또는 A 레코드 조회 (최종 IP 확인)</div>
                                  <div className="mb-1">dig +short {tunnelDomain} A</div>
                                  <div className="mb-1"># nslookup으로 확인</div>
                                  <div className="mb-1">nslookup {tunnelDomain}</div>
                                  <div className="mb-1"># macOS DNS 캐시 지우기 (중요!)</div>
                                  <div>sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder</div>
                                </div>
                                <button
                                  onClick={() => {
                                    const command = `dig +short ${tunnelDomain} CNAME
dig +short ${tunnelDomain} A
nslookup ${tunnelDomain}
echo "=== DNS 캐시 지우기 ==="
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`;
                                    copyToClipboard(command, 'dns-check');
                                  }}
                                  className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs font-medium mb-2"
                                >
                                  {copiedCommand === 'dns-check' ? (
                                    <span className="flex items-center">
                                      <Check className="h-3 w-3 mr-1" />
                                      복사됨
                                    </span>
                                  ) : (
                                    <span className="flex items-center">
                                      <Copy className="h-3 w-3 mr-1" />
                                      DNS 확인 명령어 복사
                                    </span>
                                  )}
                                </button>
                                <div className="text-xs text-red-600 dark:text-red-400 mb-3">
                                  💡 <strong>중요:</strong> DNS 캐시를 지운 후 다시 시도하세요.
                                </div>
                              </div>

                              <div className="bg-red-100 dark:bg-red-900 rounded p-3">
                                <div className="font-semibold text-red-800 dark:text-red-200 mb-2">5단계: SSH 연결 시도</div>
                                <div className="text-red-700 dark:text-red-300 mb-2">
                                  DNS 캐시를 지운 후 연결하세요:
                                </div>
                                <div className="bg-red-50 dark:bg-red-950 rounded p-2 font-mono text-xs mb-2">
                                  <div className="mb-1"># 방법 1: 기본 연결</div>
                                  <div className="mb-1">ssh {tunnelDomain}</div>
                                  <div className="mb-1"># 방법 2: IPv4 강제 + 키 파일 사용</div>
                                  <div>ssh -o AddressFamily=inet -i ~/Downloads/leekey.pem ubuntu@{tunnelDomain}</div>
                                </div>
                                <button
                                  onClick={() => {
                                    const command = instance?.key_name 
                                      ? `ssh -o AddressFamily=inet -i ~/Downloads/leekey.pem ubuntu@${tunnelDomain}`
                                      : `ssh -o AddressFamily=inet ubuntu@${tunnelDomain}`;
                                    copyToClipboard(command, 'ssh-connect');
                                  }}
                                  className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium"
                                >
                                  {copiedCommand === 'ssh-connect' ? (
                                    <span className="flex items-center">
                                      <Check className="h-3 w-3 mr-1" />
                                      복사됨
                                    </span>
                                  ) : (
                                    <span className="flex items-center">
                                      <Copy className="h-3 w-3 mr-1" />
                                      SSH 연결 명령어 복사
                                    </span>
                                  )}
                                </button>
                                <div className="text-xs text-red-600 dark:text-red-400 mt-2">
                                  💡 SSH config 파일을 사용하는 것을 강력히 권장합니다 (아래 참고)
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 경고: IPv6 문제 */}
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border-2 border-red-200 dark:border-red-800">
                      <div className="flex items-start">
                        <Info className="h-5 w-5 mr-2 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                            ⚠️ "dial tcp [IPv6]:443: connect: no route to host" 에러 발생 시
                          </h4>
                          
                          {/* SSH Config 파일 설정 방법 */}
                          <div className="mb-3">
                            <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-2">
                              1단계: SSH config 파일 설정 (필수)
                            </p>
                            <div className="bg-red-100 dark:bg-red-900 rounded p-3 font-mono text-xs mb-2">
                              <div className="flex items-start justify-between mb-2">
                                <div className="space-y-1 flex-1">
                                  <div className="text-red-600 dark:text-red-400 mb-1"># 다음 명령어로 파일 열기:</div>
                                  <div className="bg-red-50 dark:bg-red-950 px-2 py-1 rounded mb-2">
                                    <div>nano ~/.ssh/config</div>
                                  </div>
                                  <div className="text-red-600 dark:text-red-400 mb-1 mt-2"># 아래 내용 추가 (복사 후 붙여넣기):</div>
                                  <div className="bg-red-50 dark:bg-red-950 px-2 py-1 rounded">
                                    {instance?.key_name ? (
                                      <>
                                        <div>Host {tunnelDomain}</div>
                                        <div>&nbsp;&nbsp;AddressFamily inet</div>
                                        <div>&nbsp;&nbsp;User {username}</div>
                                        <div>&nbsp;&nbsp;IdentityFile ~/Downloads/leekey.pem</div>
                                        <div>&nbsp;&nbsp;PreferredAuthentications publickey</div>
                                        <div>&nbsp;&nbsp;StrictHostKeyChecking no</div>
                                        <div>&nbsp;&nbsp;ConnectTimeout 10</div>
                                      </>
                                    ) : (
                                      <>
                                        <div>Host {tunnelDomain}</div>
                                        <div>&nbsp;&nbsp;AddressFamily inet</div>
                                        <div>&nbsp;&nbsp;User {username}</div>
                                        <div>&nbsp;&nbsp;PreferredAuthentications publickey</div>
                                        <div>&nbsp;&nbsp;StrictHostKeyChecking no</div>
                                        <div>&nbsp;&nbsp;ConnectTimeout 10</div>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    const config = instance?.key_name 
                                      ? `Host ${tunnelDomain}\n    AddressFamily inet\n    User ${username}\n    IdentityFile ~/Downloads/leekey.pem\n    PreferredAuthentications publickey\n    StrictHostKeyChecking no\n    ConnectTimeout 10`
                                      : `Host ${tunnelDomain}\n    AddressFamily inet\n    User ${username}\n    PreferredAuthentications publickey\n    StrictHostKeyChecking no\n    ConnectTimeout 10`;
                                    copyToClipboard(config, 'ssh-config-fix');
                                  }}
                                  className="p-1 text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100 ml-2 flex-shrink-0"
                                >
                                  {copiedCommand === 'ssh-config-fix' ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                              <div className="text-red-600 dark:text-red-400 text-xs mt-2 pt-2 border-t border-red-200 dark:border-red-800 space-y-1">
                                <div># 저장: Ctrl+O, Enter, Ctrl+X</div>
                                <div># 파일 권한 설정: <code className="bg-red-200 dark:bg-red-800 px-1 rounded">chmod 600 ~/.ssh/config</code></div>
                                <div># 연결 테스트: <code className="bg-red-200 dark:bg-red-800 px-1 rounded">ssh {tunnelDomain}</code></div>
                              </div>
                            </div>
                          </div>

                          {/* 연결이 멈추는 경우 (타임아웃) */}
                          <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                            <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-2">
                              ⚠️ 연결이 멈추거나 타임아웃되는 경우:
                            </p>
                            <div className="space-y-2 text-xs text-red-700 dark:text-red-300 mb-3">
                              <div className="bg-red-50 dark:bg-red-950 rounded p-2 font-mono">
                                <div># 1. 디버그 모드로 연결 시도 (어디서 멈추는지 확인):</div>
                                <div className="mt-1">ssh -v -o ConnectTimeout=10 {tunnelDomain}</div>
                                <div className="mt-2 text-red-600 dark:text-red-400"># 또는 더 자세한 로그:</div>
                                <div>ssh -vvv -o ConnectTimeout=10 {tunnelDomain}</div>
                              </div>
                              <div className="mt-2">
                                <strong>2. 가장 중요한 해결책:</strong> 인스턴스 상세 페이지에서 <strong className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">"ingress 규칙 추가"</strong> 버튼을 클릭한 후 <strong>최소 2-3분</strong> 기다리세요.
                              </div>
                              <div>
                                <strong>3. 인스턴스 콘솔에서 확인:</strong> (OpenStack 콘솔 접속 후)
                                <div className="bg-red-50 dark:bg-red-950 rounded p-2 font-mono mt-1 text-xs">
                                  <div>systemctl status cloudflared-tunnel</div>
                                  <div>journalctl -u cloudflared-tunnel -n 50 --no-pager</div>
                                  <div>cat /etc/cloudflared/config.yml</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 추가 해결책 */}
                          <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                            <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-2">
                              기타 해결책:
                            </p>
                            <div className="space-y-2 text-xs text-red-700 dark:text-red-300">
                              <div>• <strong>"문제 해결"</strong> 탭에서 IPv4 주소를 직접 조회하여 사용</div>
                              <div>• macOS에서 IPv6 완전 비활성화: <code className="bg-red-200 dark:bg-red-800 px-1 rounded">sudo networksetup -setv6off Wi-Fi</code></div>
                              <div>• SSH config에 타임아웃 추가: <code className="bg-red-200 dark:bg-red-800 px-1 rounded">ConnectTimeout 10</code></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* macOS/Linux 간편 명령어 */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border-2 border-blue-200 dark:border-blue-800">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <Terminal className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                        macOS/Linux - 한 줄 명령어 (IPv6 문제 시 위 SSH config 사용 권장)
                      </h4>
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                        <div className="flex items-center justify-between">
                          <code className="text-lg text-gray-900 dark:text-gray-100 font-mono flex-1">
                            ssh -o AddressFamily=inet {username}@{tunnelDomain}
                          </code>
                          <button
                            onClick={() => copyToClipboard(`ssh -o AddressFamily=inet ${username}@${tunnelDomain}`, 'quick-ssh')}
                            className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                          >
                            {copiedCommand === 'quick-ssh' ? (
                              <>
                                <Check className="h-4 w-4 mr-2" />
                                복사됨
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-2" />
                                복사
                              </>
                            )}
                          </button>
                        </div>
                        {instance?.key_name && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">키 파일이 있는 경우:</p>
                            <div className="flex items-center justify-between">
                              <code className="text-sm text-gray-900 dark:text-gray-100 font-mono flex-1">
                                ssh -o AddressFamily=inet -i ~/Downloads/leekey.pem {username}@{tunnelDomain}
                              </code>
                              <button
                                onClick={() => copyToClipboard(`ssh -o AddressFamily=inet -i ~/Downloads/leekey.pem ${username}@${tunnelDomain}`, 'quick-ssh-key')}
                                className="ml-4 px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700"
                              >
                                {copiedCommand === 'quick-ssh-key' ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">* 실제 키 파일 경로로 변경하세요</p>
                          </div>
                        )}
                        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                            ⚠️ IPv6 연결 오류 발생 시:
                          </p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">
                            1. 아래의 "권장 방법: SSH Config 파일 설정"을 사용하거나
                          </p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">
                            2. hosts 파일에 IPv4 주소 추가 (가장 확실한 방법):
                          </p>
                          <div className="bg-white dark:bg-gray-800 rounded p-2 border border-yellow-200 dark:border-yellow-700 mb-2">
                            <div className="flex items-center justify-between">
                              <code className="text-xs text-gray-900 dark:text-gray-100 font-mono flex-1">
                                echo "172.67.164.152 {tunnelDomain}" | sudo tee -a /etc/hosts
                              </code>
                              <button
                                onClick={() => copyToClipboard(`echo "172.67.164.152 ${tunnelDomain}" | sudo tee -a /etc/hosts`, 'hosts-macos')}
                                className="ml-2 px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
                              >
                                {copiedCommand === 'hosts-macos' ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300">
                            3. 또는 "문제 해결" 탭에서 IPv4 주소를 직접 조회하여 사용하세요
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* SSH Config 파일 방법 (권장) */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border-2 border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                          <Zap className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                          권장 방법: SSH Config 파일 설정
                        </h4>
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium rounded">
                          추천
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        한 번 설정하면 이후로는 <code className="bg-white dark:bg-gray-800 px-1 rounded">ssh {tunnelDomain}</code> 만 입력하면 연결됩니다!
                      </p>
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-green-200 dark:border-green-700">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 font-mono text-sm text-gray-900 dark:text-gray-100 flex-1">
                            <div>Host {tunnelDomain}</div>
                            <div>&nbsp;&nbsp;AddressFamily inet</div>
                            <div>&nbsp;&nbsp;User {username}</div>
                            {instance?.key_name && (
                              <div>&nbsp;&nbsp;IdentityFile ~/Downloads/leekey.pem</div>
                            )}
                          </div>
                          <button
                            onClick={() => copyToClipboard(`Host ${tunnelDomain}\n    AddressFamily inet\n    User ${username}${instance?.key_name ? '\n    IdentityFile ~/Downloads/leekey.pem' : ''}`, 'ssh-config-quick')}
                            className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                          >
                            {copiedCommand === 'ssh-config-quick' ? (
                              <>
                                <Check className="h-4 w-4 mr-2" />
                                복사됨
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-2" />
                                복사
                              </>
                            )}
                          </button>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">설정 방법:</p>
                          <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                            <li><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">~/.ssh/config</code> 파일 열기 (없으면 생성)</li>
                            <li>위 내용을 파일 끝에 추가</li>
                            <li>키 파일 경로를 실제 경로로 수정 (필요시)</li>
                            <li>터미널에서 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">ssh {tunnelDomain}</code> 실행</li>
                          </ol>
                        </div>
                      </div>
                    </div>

                    {/* Windows 간편 명령어 */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6 border-2 border-purple-200 dark:border-purple-800">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <Monitor className="h-5 w-5 mr-2 text-purple-600 dark:text-purple-400" />
                        Windows - PowerShell/CMD
                      </h4>
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                        <div className="flex items-center justify-between">
                          <code className="text-lg text-gray-900 dark:text-gray-100 font-mono flex-1">
                            ssh -o AddressFamily=inet {username}@{tunnelDomain}
                          </code>
                          <button
                            onClick={() => copyToClipboard(`ssh -o AddressFamily=inet ${username}@${tunnelDomain}`, 'quick-win-ssh')}
                            className="ml-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center"
                          >
                            {copiedCommand === 'quick-win-ssh' ? (
                              <>
                                <Check className="h-4 w-4 mr-2" />
                                복사됨
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-2" />
                                복사
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Windows 10 1809 이상 또는 Windows 11에서는 OpenSSH가 기본 제공됩니다.
                        </p>
                      </div>
                    </div>

                    {/* 연결 정보 요약 */}
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">연결 정보</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">호스트:</span>
                          <code className="ml-2 text-gray-900 dark:text-gray-100 font-mono">{tunnelDomain}</code>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">포트:</span>
                          <span className="ml-2 text-gray-900 dark:text-gray-100">22</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">사용자:</span>
                          <span className="ml-2 text-gray-900 dark:text-gray-100">{username}</span>
                        </div>
                        {instance?.key_name && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">키 페어:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">{instance.key_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* macOS/Linux 상세 탭 */}
                {connectSubTab === 'macos' && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                      <Terminal className="h-5 w-5 mr-2" />
                      macOS/Linux SSH 클라이언트
                    </h3>
                  
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          1. 기본 SSH 연결 명령어
                        </label>
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 space-y-2">
                          <div className="flex items-center justify-between">
                            <code className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                              ssh -o AddressFamily=inet {username}@{tunnelDomain}
                            </code>
                            <button
                              onClick={() => copyToClipboard(`ssh -o AddressFamily=inet ${username}@${tunnelDomain}`, 'mac-ssh')}
                              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              {copiedCommand === 'mac-ssh' ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            * <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">-o AddressFamily=inet</code> 옵션은 IPv4 연결만 강제합니다 (IPv6 라우팅 문제 해결).
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          2. 키 파일이 있는 경우
                        </label>
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 space-y-2">
                          <div className="flex items-center justify-between">
                            <code className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                              ssh -o AddressFamily=inet -i ~/path/to/your/key.pem {username}@{tunnelDomain}
                            </code>
                            <button
                              onClick={() => copyToClipboard(`ssh -o AddressFamily=inet -i ~/path/to/your/key.pem ${username}@${tunnelDomain}`, 'mac-ssh-key')}
                              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              {copiedCommand === 'mac-ssh-key' ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            * 실제 키 파일 경로로 변경하세요 (예: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">~/Downloads/leekey.pem</code>).
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Windows 상세 탭 */}
                {connectSubTab === 'windows' && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                      <Monitor className="h-5 w-5 mr-2" />
                      Windows SSH 클라이언트 (PowerShell/CMD)
                    </h3>
                  
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          1. SSH 클라이언트 설치 (아직 설치하지 않은 경우)
                        </label>
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                          <div className="flex items-center justify-between mb-2">
                            <code className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                              winget install Microsoft.OpenSSH.Beta
                            </code>
                            <button
                              onClick={() => copyToClipboard('winget install Microsoft.OpenSSH.Beta', 'win-install')}
                              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              {copiedCommand === 'win-install' ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          2. SSH 연결 명령어
                        </label>
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 space-y-2">
                          <div className="flex items-center justify-between">
                            <code className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                              ssh -o AddressFamily=inet {username}@{tunnelDomain}
                            </code>
                            <button
                              onClick={() => copyToClipboard(`ssh -o AddressFamily=inet ${username}@${tunnelDomain}`, 'win-ssh')}
                              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              {copiedCommand === 'win-ssh' ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            * <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">-o AddressFamily=inet</code> 옵션은 IPv4 연결만 강제합니다 (IPv6 문제 해결).
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          3. 키 파일이 있는 경우
                        </label>
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                          <div className="flex items-center justify-between mb-2">
                            <code className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                              ssh -o AddressFamily=inet -i "C:\path\to\your\key.pem" {username}@{tunnelDomain}
                            </code>
                            <button
                              onClick={() => copyToClipboard(`ssh -o AddressFamily=inet -i "C:\\path\\to\\your\\key.pem" ${username}@${tunnelDomain}`, 'win-ssh-key')}
                              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              {copiedCommand === 'win-ssh-key' ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            * 실제 키 파일 경로로 변경하세요. Windows 경로 구분자는 백슬래시(\\) 또는 슬래시(/)를 사용할 수 있습니다.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <strong>참고:</strong> Windows 10 버전 1809 이상 또는 Windows 11에서는 OpenSSH 클라이언트가 기본 제공됩니다.
                        </p>
                      </div>

                      {/* IPv6 문제 해결: hosts 파일 방법 */}
                      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-2" />
                          IPv6 연결 오류 해결 방법 (hosts 파일 사용)
                        </h4>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                          Cloudflare Tunnel이 IPv6만 반환하는 경우, hosts 파일에 IPv4 주소를 직접 추가하세요:
                        </p>
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700 mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                              <div>1. 관리자 권한으로 PowerShell 실행</div>
                              <div className="mt-1">2. hosts 파일 열기:</div>
                              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">notepad C:\Windows\System32\drivers\etc\hosts</div>
                              <div className="mt-2">3. 파일 끝에 추가:</div>
                              <div className="mt-1 text-green-600 dark:text-green-400 font-semibold">172.67.164.152 {tunnelDomain}</div>
                              <div className="mt-2">4. 저장 후 DNS 캐시 초기화:</div>
                              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">ipconfig /flushdns</div>
                            </div>
                            <button
                              onClick={() => copyToClipboard(`172.67.164.152 ${tunnelDomain}`, 'hosts-entry')}
                              className="ml-4 px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                            >
                              {copiedCommand === 'hosts-entry' ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700">
                          <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-1">한 번에 실행 (PowerShell 관리자 권한):</p>
                          <div className="flex items-center justify-between">
                            <code className="text-xs text-gray-900 dark:text-gray-100 font-mono flex-1">
                              notepad C:\Windows\System32\drivers\etc\hosts; ipconfig /flushdns
                            </code>
                            <button
                              onClick={() => copyToClipboard(`notepad C:\\Windows\\System32\\drivers\\etc\\hosts\n\n# 파일 끝에 다음 줄 추가:\n172.67.164.152 ${tunnelDomain}\n\n# 저장 후 PowerShell에서:\nipconfig /flushdns`, 'hosts-full')}
                              className="ml-2 px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
                            >
                              {copiedCommand === 'hosts-full' ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-3">
                          💡 hosts 파일에 IPv4 주소를 추가하면 DNS 조회 없이 바로 IPv4로 연결됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* PuTTY 상세 탭 */}
                {connectSubTab === 'putty' && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                      <Settings className="h-5 w-5 mr-2" />
                      PuTTY
                    </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        1. PuTTY 다운로드 (아직 설치하지 않은 경우)
                      </label>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                          공식 웹사이트: <a href="https://www.putty.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">https://www.putty.org/</a>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          또는 Windows Package Manager를 사용: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">winget install PuTTY.PuTTY</code>
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        2. PuTTY 설정
                      </label>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 space-y-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">호스트 이름 (Host Name):</p>
                          <div className="flex items-center justify-between">
                            <code className="text-sm text-gray-900 dark:text-gray-100 font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">
                              {tunnelDomain}
                            </code>
                            <button
                              onClick={() => copyToClipboard(tunnelDomain, 'putty-host')}
                              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              {copiedCommand === 'putty-host' ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">포트 (Port):</p>
                          <code className="text-sm text-gray-900 dark:text-gray-100 font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">22</code>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">연결 타입 (Connection type):</p>
                          <code className="text-sm text-gray-900 dark:text-gray-100 font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">SSH</code>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        2-1. IPv4 강제 설정 (IPv6 문제 방지)
                      </label>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                          <strong>⚠️ 중요:</strong> "dial tcp [IPv6]:443: connect: no route to host" 오류가 발생하는 경우 아래 방법을 사용하세요.
                        </p>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">방법 1: IPv4 주소 직접 사용</p>
                            <ol className="list-decimal list-inside space-y-1 text-xs text-yellow-800 dark:text-yellow-200 ml-2">
                              <li>Windows 명령 프롬프트에서 실행: <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">nslookup {tunnelDomain}</code></li>
                              <li>나오는 IPv4 주소를 복사 (예: 198.41.192.57)</li>
                              <li>PuTTY의 Host Name 필드에 IPv4 주소를 직접 입력</li>
                              <li>단, 이 방법은 IP가 변경될 수 있어 권장하지 않음</li>
                            </ol>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">방법 2: PuTTY 네트워크 설정 (권장)</p>
                            <ol className="list-decimal list-inside space-y-1 text-xs text-yellow-800 dark:text-yellow-200 ml-2">
                              <li>PuTTY 창에서 <strong>Connection → Proxy</strong> 메뉴로 이동</li>
                              <li><strong>Proxy type</strong>을 <strong>"Local"</strong> 또는 <strong>"None"</strong>으로 설정</li>
                              <li><strong>Session</strong> 메뉴로 돌아가기</li>
                              <li><strong>Connection → Data</strong>에서 "Use DNS to find host" 체크 해제 (없는 경우 무시)</li>
                            </ol>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">방법 3: Windows 호스트 파일 편집</p>
                            <ol className="list-decimal list-inside space-y-1 text-xs text-yellow-800 dark:text-yellow-200 ml-2">
                              <li><code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">nslookup {tunnelDomain}</code> 실행하여 IPv4 주소 확인</li>
                              <li>관리자 권한으로 메모장 실행</li>
                              <li><code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">C:\Windows\System32\drivers\etc\hosts</code> 파일 열기</li>
                              <li>파일 끝에 추가: <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">[IPv4주소] {tunnelDomain}</code></li>
                              <li>저장 후 PuTTY 재연결</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        2-2. DNS 해석 확인 (연결 실패 시)
                      </label>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                          Windows 명령 프롬프트(CMD)에서 다음 명령어를 실행하여 DNS 확인:
                        </p>
                        <div className="bg-white dark:bg-gray-800 rounded p-2 font-mono text-xs space-y-1 mb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div>nslookup {tunnelDomain}</div>
                              <div className="text-gray-500 dark:text-gray-400">또는</div>
                              <div>ping {tunnelDomain}</div>
                            </div>
                            <button
                              onClick={() => copyToClipboard(`nslookup ${tunnelDomain}\nping ${tunnelDomain}`, 'dns-check-windows')}
                              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              {copiedCommand === 'dns-check-windows' ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          DNS가 해석되지 않으면 인스턴스 상세 페이지에서 "DNS 강제 재생성" 버튼을 클릭하세요.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        3. 키 파일 설정 (키 페어를 사용하는 경우)
                      </label>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 space-y-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                            방법 1: PuTTYgen 명령어로 변환 (Linux/WSL/Git Bash)
                          </p>
                          <div className="bg-white dark:bg-gray-800 rounded p-2 font-mono text-xs mb-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <div>puttygen ~/Downloads/leekey.pem -o ~/Downloads/leekey.ppk</div>
                                <div className="text-gray-500 dark:text-gray-400 text-xs mt-1"># 또는 절대 경로 사용</div>
                              </div>
                              <button
                                onClick={() => copyToClipboard('puttygen ~/Downloads/leekey.pem -o ~/Downloads/leekey.ppk', 'puttygen-cmd')}
                                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              >
                                {copiedCommand === 'puttygen-cmd' ? (
                                  <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            💡 PuTTYgen이 설치되어 있지 않은 경우: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">sudo apt install putty-tools</code> (Ubuntu/Debian)
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                            방법 2: PuTTYgen GUI로 변환 (Windows)
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-xs text-gray-900 dark:text-gray-100">
                            <li>PuTTYgen 실행 (PuTTY 설치 폴더에 포함되어 있음)</li>
                            <li><strong>"Conversions"</strong> → <strong>"Import key"</strong> 클릭</li>
                            <li>.pem 파일 선택 (파일 형식: "All Files (*.*)")</li>
                            <li><strong>"Save private key"</strong> 클릭</li>
                            <li>.ppk 파일로 저장 (예: leekey.ppk)</li>
                          </ol>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                            방법 3: PuTTY에서 직접 사용
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-xs text-gray-900 dark:text-gray-100">
                            <li>PuTTY 창에서 <strong>Connection → SSH → Auth</strong> 메뉴로 이동</li>
                            <li><strong>"Private key file for authentication"</strong> 섹션에서 <strong>"Browse"</strong> 클릭</li>
                            <li>.ppk 파일 선택 (변환된 파일 또는 직접 변환)</li>
                          </ol>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        4. 사용자 이름 설정
                      </label>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-900 dark:text-gray-100">
                          <li>PuTTY 창에서 <strong>Connection → Data</strong> 메뉴로 이동</li>
                          <li><strong>"Auto-login username"</strong> 필드에 입력:</li>
                        </ol>
                        <div className="flex items-center justify-between mt-2 bg-white dark:bg-gray-800 px-2 py-1 rounded">
                          <code className="text-sm text-gray-900 dark:text-gray-100 font-mono">{username}</code>
                          <button
                            onClick={() => copyToClipboard(username, 'putty-user')}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            {copiedCommand === 'putty-user' ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        5. 연결 저장 (선택사항)
                      </label>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-900 dark:text-gray-100">
                          <li>모든 설정 완료 후 <strong>"Session"</strong> 메뉴로 돌아가기</li>
                          <li><strong>"Saved Sessions"</strong>에 세션 이름 입력 (예: {instance.name})</li>
                          <li><strong>"Save"</strong> 클릭하여 설정 저장</li>
                          <li>다음번에는 저장된 세션 선택 후 <strong>"Load"</strong> → <strong>"Open"</strong>만 클릭하면 됩니다</li>
                        </ol>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        6. 연결 및 문제 해결
                      </label>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 space-y-3">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                            <strong>✅ 연결 방법:</strong>
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-xs text-blue-800 dark:text-blue-200">
                            <li>모든 설정 완료 후 <strong>"Open"</strong> 버튼 클릭</li>
                            <li>첫 연결 시 호스트 키 확인 창이 나타나면 <strong>"예"</strong> 또는 <strong>"Accept"</strong> 클릭</li>
                            <li>비밀번호를 입력하거나 (키 파일 사용 시 자동 로그인)</li>
                          </ol>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                          <p className="text-sm text-red-800 dark:text-red-200 mb-2">
                            <strong>❌ 연결 오류 해결:</strong>
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-xs text-red-800 dark:text-red-200">
                            <li><strong>"Could not resolve hostname"</strong>: DNS 레코드 재생성 필요 (인스턴스 상세 페이지 참고)</li>
                            <li><strong>"Network error: Connection timed out"</strong>: Cloudflare Tunnel이 실행 중인지 확인 (인스턴스 콘솔에서 확인)</li>
                            <li><strong>"Server unexpectedly closed network connection"</strong>: SSH 서비스가 실행 중인지 확인</li>
                            <li><strong>"No supported authentication methods available"</strong>: 키 파일(.ppk) 경로와 사용자 이름 확인</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                        <strong>💡 빠른 연결 팁:</strong>
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-green-800 dark:text-green-200">
                        <li>설정 완료 후 <strong>"Saved Sessions"</strong>에 저장하여 다음번에 빠르게 연결</li>
                        <li>연결 문제 발생 시 인스턴스 상세 페이지의 <strong>"SSH 연결 준비 완료하기"</strong> 버튼 클릭</li>
                        <li>IPv6 문제는 Windows 호스트 파일 편집이 가장 확실한 해결책</li>
                      </ul>
                    </div>
                  </div>
                </div>
                )}

                {/* 문제 해결 탭 */}
                {connectSubTab === 'troubleshoot' && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                      <Info className="h-5 w-5 mr-2" />
                      문제 해결
                    </h3>
                  
                    <div className="space-y-6">
                      {/* SSH 키 인증 문제 */}
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-3">
                          <strong>🔑 "Permission denied (publickey)" 에러 해결:</strong>
                        </p>
                        <div className="text-sm text-red-800 dark:text-red-200 space-y-4">
                          <div>
                            <p className="font-medium mb-2">1. SSH 키 파일 권한 확인</p>
                            <div className="bg-red-100 dark:bg-red-900 rounded p-3 font-mono text-xs">
                              <div className="flex items-center justify-between">
                                <code>chmod 600 leekey.pem</code>
                                <button
                                  onClick={() => copyToClipboard('chmod 600 leekey.pem', 'chmod-key')}
                                  className="p-1 text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
                                >
                                  {copiedCommand === 'chmod-key' ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                              <div className="text-red-600 dark:text-red-400 text-xs mt-2">
                                # 키 파일 권한이 600이 아니면 SSH가 거부됩니다
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <p className="font-medium mb-2">2. 올바른 사용자명 확인</p>
                            <div className="bg-red-100 dark:bg-red-900 rounded p-3 font-mono text-xs space-y-2">
                              <div className="text-red-600 dark:text-red-400 text-xs mb-2">
                                현재 이미지: <strong>{image?.name || '알 수 없음'}</strong>
                                <br />
                                추정 사용자명: <strong>{username}</strong>
                              </div>
                              <div className="space-y-1">
                                <div># Ubuntu/Debian: <code className="bg-red-200 dark:bg-red-800 px-1 rounded">ubuntu</code></div>
                                <div># CentOS/RHEL/Rocky: <code className="bg-red-200 dark:bg-red-800 px-1 rounded">centos</code></div>
                                <div># Fedora: <code className="bg-red-200 dark:bg-red-800 px-1 rounded">fedora</code></div>
                                <div># OpenSUSE: <code className="bg-red-200 dark:bg-red-800 px-1 rounded">opensuse</code></div>
                                <div># Alpine: <code className="bg-red-200 dark:bg-red-800 px-1 rounded">alpine</code></div>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <p className="font-medium mb-2">3. 올바른 키 파일 사용 확인</p>
                            <div className="bg-red-100 dark:bg-red-900 rounded p-3 font-mono text-xs">
                              <div className="text-red-600 dark:text-red-400 text-xs mb-2">
                                인스턴스에 등록된 키페어: <strong>{instance?.key_name || '없음'}</strong>
                              </div>
                              <div className="text-red-600 dark:text-red-400 text-xs">
                                # 인스턴스 생성 시 선택한 키페어와 일치하는 키 파일을 사용해야 합니다
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <p className="font-medium mb-2">4. 올바른 SSH 명령어</p>
                            <div className="bg-red-100 dark:bg-red-900 rounded p-3 font-mono text-xs space-y-2">
                              <div className="flex items-center justify-between">
                                <code>ssh -i leekey.pem {username}@{tunnelDomain}</code>
                                <button
                                  onClick={() => copyToClipboard(`ssh -i leekey.pem ${username}@${tunnelDomain}`, 'ssh-correct')}
                                  className="p-1 text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
                                >
                                  {copiedCommand === 'ssh-correct' ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                              <div className="text-red-600 dark:text-red-400 text-xs mt-2">
                                # 또는 IPv4 주소 사용: <code className="bg-red-200 dark:bg-red-800 px-1 rounded">ssh -i leekey.pem {username}@[IPv4주소]</code>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <p className="font-medium mb-2">5. 디버그 모드로 연결 시도</p>
                            <div className="bg-red-100 dark:bg-red-900 rounded p-3 font-mono text-xs">
                              <div className="flex items-center justify-between">
                                <code>ssh -v -i leekey.pem {username}@{tunnelDomain}</code>
                                <button
                                  onClick={() => copyToClipboard(`ssh -v -i leekey.pem ${username}@${tunnelDomain}`, 'ssh-debug')}
                                  className="p-1 text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
                                >
                                  {copiedCommand === 'ssh-debug' ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                              <div className="text-red-600 dark:text-red-400 text-xs mt-2">
                                # -v 옵션으로 상세한 디버그 정보를 확인할 수 있습니다
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-3">
                          <strong>⚠️ IPv6 연결 문제가 계속되는 경우:</strong>
                        </p>
                        <div className="text-sm text-yellow-800 dark:text-yellow-200 space-y-4">
                          <div>
                            <p className="font-medium mb-2">방법 1: IPv4 주소 직접 조회 및 사용</p>
                            <div className="bg-yellow-100 dark:bg-yellow-900 rounded p-3 font-mono text-xs space-y-2">
                              <div className="flex items-center justify-between">
                                <code>dig +short {tunnelDomain} A +follow</code>
                                <button
                                  onClick={() => copyToClipboard(`dig +short ${tunnelDomain} A +follow`, 'dig-command')}
                                  className="p-1 text-yellow-700 hover:text-yellow-900 dark:text-yellow-300 dark:hover:text-yellow-100"
                                >
                                  {copiedCommand === 'dig-command' ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                              <div className="text-yellow-600 dark:text-yellow-400 text-xs">
                                # CNAME이 반환되면 다음 명령어로 최종 IPv4 주소 조회:
                              </div>
                              <div className="flex items-center justify-between">
                                <code>dig +short $(dig +short {tunnelDomain} A) A</code>
                                <button
                                  onClick={() => copyToClipboard(`dig +short $(dig +short ${tunnelDomain} A) A`, 'dig-final')}
                                  className="p-1 text-yellow-700 hover:text-yellow-900 dark:text-yellow-300 dark:hover:text-yellow-100"
                                >
                                  {copiedCommand === 'dig-final' ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                              <div className="text-yellow-600 dark:text-yellow-400 text-xs mt-2">
                                # 반환된 IPv4 주소로 직접 연결:
                              </div>
                              <div className="flex items-center justify-between">
                                <code>ssh -i ~/Downloads/leekey.pem {username}@[IPv4주소]</code>
                                <button
                                  onClick={() => copyToClipboard(`ssh -i ~/Downloads/leekey.pem ${username}@[IPv4주소를_여기에_입력]`, 'ssh-ipv4')}
                                  className="p-1 text-yellow-700 hover:text-yellow-900 dark:text-yellow-300 dark:hover:text-yellow-100"
                                >
                                  {copiedCommand === 'ssh-ipv4' ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                              <div className="text-yellow-600 dark:text-yellow-400 text-xs mt-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
                                ⚠️ 참고: Cloudflare Tunnel은 동적 IP를 사용하므로 IP 주소가 자주 변경될 수 있습니다. 방법 2(SSH config)를 권장합니다.
                              </div>
                            </div>
                          </div>

                          <div>
                            <p className="font-medium mb-2">방법 2: SSH config 파일 사용 (권장)</p>
                            <div className="bg-yellow-100 dark:bg-yellow-900 rounded p-3 font-mono text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <div className="space-y-1">
                                  <div>Host {tunnelDomain}</div>
                                  <div>&nbsp;&nbsp;AddressFamily inet</div>
                                  <div>&nbsp;&nbsp;User {username}</div>
                                  <div>&nbsp;&nbsp;IdentityFile ~/Downloads/leekey.pem</div>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(`Host ${tunnelDomain}\n    AddressFamily inet\n    User ${username}\n    IdentityFile ~/Downloads/leekey.pem`, 'ssh-config')}
                                  className="p-1 text-yellow-700 hover:text-yellow-900 dark:text-yellow-300 dark:hover:text-yellow-100 ml-2"
                                >
                                  {copiedCommand === 'ssh-config' ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                              <div className="text-yellow-600 dark:text-yellow-400 text-xs mt-2">
                                # ~/.ssh/config 파일에 위 내용 추가 후: <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">ssh {tunnelDomain}</code>
                              </div>
                            </div>
                          </div>

                          <div>
                            <p className="font-medium mb-2">방법 3: macOS에서 IPv6 완전 비활성화 (임시)</p>
                            <div className="bg-yellow-100 dark:bg-yellow-900 rounded p-3 font-mono text-xs">
                              <div className="flex items-center justify-between">
                                <code>sudo networksetup -setv6off Wi-Fi</code>
                                <button
                                  onClick={() => copyToClipboard('sudo networksetup -setv6off Wi-Fi', 'disable-ipv6')}
                                  className="p-1 text-yellow-700 hover:text-yellow-900 dark:text-yellow-300 dark:hover:text-yellow-100"
                                >
                                  {copiedCommand === 'disable-ipv6' ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                              <div className="text-yellow-600 dark:text-yellow-400 text-xs mt-2">
                                # IPv6 재활성화: <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">sudo networksetup -setv6automatic Wi-Fi</code>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              콘솔 로그
            </h3>
            <button
              onClick={handleGetConsoleLogs}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              로그 새로고침
            </button>
          </div>
          
          <div className="bg-gray-900 dark:bg-black text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto max-h-96 border border-gray-300 dark:border-gray-600">
            <pre className="whitespace-pre-wrap">{consoleLogs || '로그를 불러오려면 위의 버튼을 클릭하세요.'}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstanceDetailPage; 