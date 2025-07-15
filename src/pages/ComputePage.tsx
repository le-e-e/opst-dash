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
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { novaService, neutronService, glanceService } from '../services/openstack';
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
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const [instancesData, flavorsData, imagesData] = await Promise.all([
        novaService.getServers(),
        novaService.getFlavors(),
        glanceService.getImages()
      ]);
      
      setInstances(instancesData.servers || []);
      setFlavors(flavorsData.flavors || []);
      setImages(imagesData.images || []);
    } catch (error) {
      console.error('인스턴스 로딩 실패:', error);
      toast.error('인스턴스 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 액션 핸들러들
  const handleStart = async (instanceId: string) => {
    try {
      setActionLoading(instanceId);
      await novaService.startServer(instanceId);
      toast.success('인스턴스를 시작했습니다.');
      fetchInstances();
    } catch (error) {
      console.error('시작 실패:', error);
      toast.error('인스턴스 시작에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (instanceId: string) => {
    try {
      setActionLoading(instanceId);
      await novaService.stopServer(instanceId);
      toast.success('인스턴스를 정지했습니다.');
      fetchInstances();
    } catch (error) {
      console.error('정지 실패:', error);
      toast.error('인스턴스 정지에 실패했습니다.');
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
    if (!confirm('정말로 이 인스턴스를 삭제하시겠습니까?')) return;
    
    try {
      setActionLoading(instanceId);
      await novaService.deleteServer(instanceId);
      toast.success('인스턴스를 삭제했습니다.');
      fetchInstances();
    } catch (error) {
      console.error('삭제 실패:', error);
      toast.error('인스턴스 삭제에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateSnapshot = async (instanceId: string) => {
    const name = prompt('스냅샷 이름을 입력하세요:');
    if (!name) return;

    try {
      setActionLoading(instanceId);
      await novaService.createSnapshot(instanceId, name);
      toast.success('스냅샷을 생성했습니다.');
    } catch (error) {
      console.error('스냅샷 생성 실패:', error);
      toast.error('스냅샷 생성에 실패했습니다.');
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
      return 'bg-blue-100 text-blue-800';
    }
    
    switch (status.toUpperCase()) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'SHUTOFF': return 'bg-gray-100 text-gray-800';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800';
      case 'SUSPENDED': return 'bg-orange-100 text-orange-800';
      case 'ERROR': return 'bg-red-100 text-red-800';
      case 'BUILD': return 'bg-blue-100 text-blue-800';
      case 'REBUILD': return 'bg-blue-100 text-blue-800';
      case 'REBOOT': return 'bg-blue-100 text-blue-800';
      case 'RESIZE': return 'bg-blue-100 text-blue-800';
      case 'VERIFY_RESIZE': return 'bg-purple-100 text-purple-800';
      case 'DELETED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  useEffect(() => {
    fetchInstances();
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">가상머신</h1>
          <p className="text-gray-600 mt-1">가상머신 인스턴스를 관리하고 모니터링합니다</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchInstances}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </button>
          <button 
            onClick={() => navigate('/compute/create')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            인스턴스 생성
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-green-100 p-2 rounded-lg">
              <Play className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">실행 중</p>
              <p className="text-2xl font-bold text-gray-900">
                {instances.filter(i => i.status === 'ACTIVE').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-gray-100 p-2 rounded-lg">
              <Square className="h-6 w-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">정지됨</p>
              <p className="text-2xl font-bold text-gray-900">
                {instances.filter(i => i.status === 'SHUTOFF').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-red-100 p-2 rounded-lg">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">오류</p>
              <p className="text-2xl font-bold text-gray-900">
                {instances.filter(i => i.status === 'ERROR').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Server className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">전체</p>
              <p className="text-2xl font-bold text-gray-900">{instances.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 인스턴스 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">인스턴스 목록</h3>
        </div>
        
        {instances.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">생성된 인스턴스가 없습니다.</p>
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
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">인스턴스 이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP 주소</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">플레이버</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {instances.map((instance) => {
                  const ips = getInstanceIPs(instance.addresses);
                  const flavorInfo = getFlavorInfo(instance.flavor?.id || '');
                  
                  return (
                    <tr key={instance.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Server className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <button 
                              onClick={() => handleInstanceClick(instance.id)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                            >
                              {instance.name}
                            </button>
                            <div className="text-xs text-gray-500 truncate">{instance.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {ips.length > 0 ? (
                            <div className="space-y-1">
                              {ips.map((ip, index) => (
                                <div key={index} className="flex items-center">
                                  <Network className="h-3 w-3 text-gray-400 mr-1" />
                                  <span className="text-xs">{ip}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-xs">IP 없음</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {flavorInfo ? (
                            <div className="space-y-1">
                              <div className="font-medium">{flavorInfo.name}</div>
                              <div className="text-xs text-gray-500">
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
                        <div className="relative">
                          <button
                            onClick={() => setShowActionMenu(showActionMenu === instance.id ? null : instance.id)}
                            disabled={actionLoading === instance.id}
                            className="inline-flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                            title="작업 메뉴"
                          >
                            {actionLoading === instance.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-1"></div>
                            ) : (
                              <Settings className="h-4 w-4 mr-1" />
                            )}
                            작업
                          </button>
                          
                          {showActionMenu === instance.id && (
                            <div className="absolute right-0 bottom-full mb-2 w-56 bg-white rounded-md shadow-xl border border-gray-200 py-1 z-20 max-h-64 overflow-y-auto">
                              <button
                                onClick={() => {
                                  handleInstanceClick(instance.id);
                                  setShowActionMenu(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Eye className="h-4 w-4 mr-3" />
                                상세 정보
                              </button>
                              <div className="border-t border-gray-100 my-1"></div>
                              {instance.status === 'ACTIVE' && (
                                <>
                                  <button
                                    onClick={() => {
                                      handleInstanceAction(instance.id, 'stop');
                                      setShowActionMenu(null);
                                    }}
                                    disabled={actionLoading === instance.id}
                                    className="flex items-center w-full px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                                  >
                                    {actionLoading === instance.id ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-3"></div>
                                    ) : (
                                      <Square className="h-4 w-4 mr-3" />
                                    )}
                                    인스턴스 중지
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleInstanceAction(instance.id, 'reboot');
                                      setShowActionMenu(null);
                                    }}
                                    disabled={actionLoading === instance.id}
                                    className="flex items-center w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                                  >
                                    {actionLoading === instance.id ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                                    ) : (
                                      <RotateCcw className="h-4 w-4 mr-3" />
                                    )}
                                    인스턴스 재시작
                                  </button>
                                </>
                              )}
                              {instance.status === 'SHUTOFF' && (
                                <button
                                  onClick={() => {
                                    handleInstanceAction(instance.id, 'start');
                                    setShowActionMenu(null);
                                  }}
                                  disabled={actionLoading === instance.id}
                                  className="flex items-center w-full px-4 py-2 text-sm text-green-600 hover:bg-green-50 disabled:opacity-50"
                                >
                                  {actionLoading === instance.id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-3"></div>
                                  ) : (
                                    <Play className="h-4 w-4 mr-3" />
                                  )}
                                  인스턴스 시작
                                </button>
                              )}
                              <div className="border-t border-gray-100 my-1"></div>
                              <button
                                onClick={() => {
                                                                     // TODO: 유동 IP 설정 기능
                                   toast('유동 IP 설정 기능은 준비중입니다.');
                                  setShowActionMenu(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-purple-600 hover:bg-purple-50"
                              >
                                <Globe className="h-4 w-4 mr-3" />
                                유동 IP 설정
                              </button>
                              <button
                                onClick={() => {
                                                                     // TODO: 보안 그룹 설정 기능
                                   toast('보안 그룹 설정 기능은 준비중입니다.');
                                  setShowActionMenu(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
                              >
                                <Shield className="h-4 w-4 mr-3" />
                                보안 그룹
                              </button>
                              <div className="border-t border-gray-100 my-1"></div>
                              <button
                                onClick={() => {
                                  handleInstanceAction(instance.id, 'delete');
                                  setShowActionMenu(null);
                                }}
                                disabled={actionLoading === instance.id}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {actionLoading === instance.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-3"></div>
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-3" />
                                )}
                                인스턴스 삭제
                              </button>
                            </div>
                          )}
                        </div>
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