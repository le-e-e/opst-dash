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
  Maximize2
} from 'lucide-react';
import { novaService, neutronService, cinderService, glanceService } from '../services/openstack';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'network' | 'storage' | 'security' | 'console' | 'logs'>('overview');
  const [consoleUrl, setConsoleUrl] = useState<string | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<string>('');

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
      setConsoleUrl(response.console.url);
      setActiveTab('console');
    } catch (error) {
      console.error('VNC 콘솔 열기 실패:', error);
      toast.error('VNC 콘솔을 열 수 없습니다.');
    }
  };

  const handleVNCConsoleFullscreen = async () => {
    if (!instanceId) return;
    
    try {
      const response = await novaService.getVNCConsole(instanceId);
      const vncUrl = response.console.url;
      
      // 새 탭에서 전체화면으로 열기
      const newWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
      
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>VNC Console - ${instance?.name || 'Instance'}</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                background: #000;
                overflow: hidden;
              }
              .vnc-container {
                width: 100vw;
                height: 100vh;
                display: flex;
                flex-direction: column;
              }
              .vnc-header {
                background: #1f2937;
                color: white;
                padding: 8px 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #374151;
              }
              .vnc-title {
                font-weight: 600;
              }
              .vnc-controls {
                display: flex;
                gap: 8px;
              }
              .vnc-btn {
                background: #374151;
                border: none;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
              }
              .vnc-btn:hover {
                background: #4b5563;
              }
              .vnc-frame {
                flex: 1;
                border: none;
                background: #000;
              }
              .loading {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100%;
                color: #9ca3af;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              }
            </style>
          </head>
          <body>
            <div class="vnc-container">
              <div class="vnc-header">
                <div class="vnc-title">VNC Console - ${instance?.name || 'Instance'}</div>
                <div class="vnc-controls">
                  <button class="vnc-btn" onclick="window.close()">닫기</button>
                  <button class="vnc-btn" onclick="toggleFullscreen()">전체화면</button>
                  <button class="vnc-btn" onclick="refreshConsole()">새로고침</button>
                </div>
              </div>
              <iframe 
                id="vnc-frame"
                class="vnc-frame" 
                src="${vncUrl}"
                title="VNC Console"
                sandbox="allow-same-origin allow-scripts allow-forms"
                onload="hideLoading()"
              ></iframe>
              <div id="loading" class="loading">
                VNC 콘솔을 로딩 중입니다...
              </div>
            </div>
            
            <script>
              function hideLoading() {
                const loading = document.getElementById('loading');
                if (loading) {
                  loading.style.display = 'none';
                }
              }
              
              function toggleFullscreen() {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(err => {
                    console.log('전체화면 모드 진입 실패:', err);
                  });
                } else {
                  document.exitFullscreen();
                }
              }
              
              function refreshConsole() {
                const frame = document.getElementById('vnc-frame');
                if (frame) {
                  frame.src = frame.src;
                }
              }
              
              // ESC 키로 전체화면 해제
              document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && document.fullscreenElement) {
                  document.exitFullscreen();
                }
              });
              
              // 창 크기 변경 시 iframe 크기 조정
              window.addEventListener('resize', function() {
                const frame = document.getElementById('vnc-frame');
                if (frame) {
                  frame.style.width = '100vw';
                  frame.style.height = 'calc(100vh - 40px)';
                }
              });
            </script>
          </body>
          </html>
        `);
        newWindow.document.close();
        
        toast.success('VNC 콘솔을 새 탭에서 열었습니다.');
      } else {
        toast.error('팝업이 차단되었습니다. 팝업 차단을 해제하고 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('전체화면 VNC 콘솔 열기 실패:', error);
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

      console.log(`🔍 Nova API volumes_attached: ${attachedVolumes.length}개`);
      
      // 추가로 Cinder API에서 해당 인스턴스에 연결된 볼륨 찾기
      try {
        const cinderConnectedVolumes = volumes.filter((vol: any) => {
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
        
        // 기존 볼륨 정보 보강
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
        
        console.log(`🔍 최종 확인된 연결 볼륨: ${volumesToCheck.length}개`);
        
      } catch (cinderError) {
        console.log('🔍 Cinder API 볼륨 확인 실패, Nova API 정보만 사용');
      }

      // 볼륨 삭제 정책 결정 (delete_on_termination 기반)
      let deleteVolumes = false;
      let autoDeleteVolumes: any[] = [];
      let keepVolumes: any[] = [];
      
      if (volumesToCheck.length > 0) {
        // 볼륨별로 delete_on_termination 설정 확인
        for (const vol of volumesToCheck) {
          try {
            // 인스턴스의 볼륨 연결 정보에서 delete_on_termination 확인
            const attachmentInfo = (instance as any)['os-extended-volumes:volumes_attached']?.find((av: any) => av.id === vol.id);
            const metadataDeleteFlag = instance.metadata?.volume_delete_on_termination === 'true' ||
                                     instance.metadata?.[`volume_${vol.id}_delete_on_termination`] === 'true';
            const shouldDelete = attachmentInfo?.delete_on_termination || 
                               attachmentInfo?.['delete_on_termination'] ||
                               metadataDeleteFlag;
            
            if (shouldDelete) {
              autoDeleteVolumes.push(vol);
            } else {
              keepVolumes.push(vol);
            }
          } catch (error) {
            // 정보를 알 수 없는 경우 보존하는 것이 안전
            keepVolumes.push(vol);
          }
        }
        
        // 사용자에게 볼륨 삭제 여부 직접 확인
        let confirmMessage = `인스턴스 "${instance.name}" 삭제:\n\n`;
        confirmMessage += `📀 연결된 볼륨 (${volumesToCheck.length}개):\n`;
        confirmMessage += volumesToCheck.map((v: any) => {
          return `  - ${v.name} (${v.size}GB, ${v.device})`;
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
        if (!confirm(`정말로 인스턴스 "${instance.name}"을(를) 삭제하시겠습니까?`)) return;
      }
      
      // 강력한 볼륨 분리 로직
      if (volumesToCheck.length > 0) {
        console.log('===== 강화된 볼륨 분리 시작 =====');
        
        let successfulDetachments = 0;
        for (const vol of volumesToCheck) {
          console.log(`\n볼륨 ${vol.name} (${vol.id}) 분리 시작...`);
          
          try {
            const success = await cinderService.safeDetachVolume(instanceId, vol.id, vol.name);
            if (success) {
              successfulDetachments++;
              console.log(`✅ ${vol.name} 분리 성공`);
            } else {
              console.log(`⚠️ ${vol.name} 분리 실패 (계속 진행)`);
            }
          } catch (detachError) {
            console.error(`❌ ${vol.name} 분리 오류:`, detachError);
          }
        }
        
        console.log(`\n📊 볼륨 분리 결과: ${successfulDetachments}/${volumesToCheck.length}개 성공`);
        console.log('===== 모든 볼륨 분리 시도 완료 =====\n');
        
        // 추가 안정화 대기
        console.log('인스턴스 삭제 전 안정화 대기...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // 인스턴스 삭제
      console.log('인스턴스 삭제 시작...');
      await novaService.deleteServer(instanceId);
      console.log('인스턴스 삭제 요청 완료');
      
      // 인스턴스 완전 삭제 대기
      const instanceDeleted = await cinderService.waitForInstanceDeleted(instanceId, 60);
      if (!instanceDeleted) {
        console.log('⚠️ 인스턴스 삭제 확인 타임아웃, 볼륨 삭제 계속 진행');
      }
      
      // 볼륨 삭제 (사용자가 선택한 경우)
      if (deleteVolumes && volumesToCheck.length > 0) {
        console.log('볼륨 삭제 시작...');
        toast.loading('볼륨을 삭제하는 중...', { id: 'delete-volumes' });
        
        let successfulDeletions = 0;
        let failedDeletions = 0;
        
        for (const vol of volumesToCheck) {
          try {
            console.log(`볼륨 ${vol.name} 삭제 시도...`);
            await cinderService.safeDeleteVolume(vol.id, vol.name);
            successfulDeletions++;
            console.log(`✅ ${vol.name} 삭제 완료`);
          } catch (deleteError) {
            failedDeletions++;
            console.error(`❌ ${vol.name} 삭제 실패:`, deleteError);
            toast.error(`볼륨 ${vol.name} 삭제에 실패했습니다.`);
          }
        }
        
        toast.dismiss('delete-volumes');
        
        if (successfulDeletions > 0 && failedDeletions === 0) {
          toast.success('인스턴스와 모든 볼륨을 삭제했습니다.');
        } else if (successfulDeletions > 0) {
          toast.error(`인스턴스와 ${successfulDeletions}개 볼륨을 삭제했습니다. ${failedDeletions}개 볼륨 삭제 실패.`);
        } else {
          toast.error('인스턴스는 삭제되었지만 볼륨 삭제에 실패했습니다.');
        }
      } else {
        toast.success('인스턴스를 삭제했습니다.');
      }
      
      navigate('/compute');
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
                onClick={handleVNCConsoleFullscreen}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                title="새 탭에서 전체화면으로 VNC 콘솔 열기"
              >
                <Maximize2 className="h-4 w-4 mr-2" />
                전체화면 VNC
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
            <div className="flex items-center gap-3">
              <button
                onClick={handleVNCConsole}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Monitor className="h-4 w-4 mr-2" />
                새 콘솔 연결
              </button>
              <button
                onClick={handleVNCConsoleFullscreen}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                title="새 탭에서 전체화면으로 VNC 콘솔 열기"
              >
                <Maximize2 className="h-4 w-4 mr-2" />
                전체화면 VNC
              </button>
            </div>
          </div>
          
          {consoleUrl ? (
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <iframe
                src={consoleUrl}
                className="w-full h-96"
                title="VNC Console"
                sandbox="allow-same-origin allow-scripts allow-forms"
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