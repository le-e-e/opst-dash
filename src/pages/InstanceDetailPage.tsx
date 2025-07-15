import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Server, 
  Network, 
  HardDrive, 
  Cpu, 
  Memory, 
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
  Zap,
  Database
} from 'lucide-react';
import { novaService, neutronService, cinderService } from '../services/openstack';
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
      const [instanceData, volumesData, networksData] = await Promise.all([
        novaService.getServer(instanceId),
        cinderService.getVolumes(),
        neutronService.getNetworks()
      ]);

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
          if (confirm('정말로 이 인스턴스를 삭제하시겠습니까?')) {
            await novaService.deleteServer(instanceId);
            toast.success('인스턴스를 삭제했습니다.');
            navigate('/compute');
            return;
          }
          break;
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
      return 'bg-blue-100 text-blue-800';
    }
    
    switch (status.toUpperCase()) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'SHUTOFF': return 'bg-gray-100 text-gray-800';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800';
      case 'SUSPENDED': return 'bg-orange-100 text-orange-800';
      case 'ERROR': return 'bg-red-100 text-red-800';
      case 'BUILD': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
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
        <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">인스턴스를 찾을 수 없습니다.</p>
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
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{instance.name}</h1>
            <p className="text-gray-600">{instance.id}</p>
          </div>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(instance.status, instance.task_state)}`}>
            {getStatusText(instance.status, instance.task_state)}
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchInstanceDetail}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
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
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
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
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Server className="h-5 w-5 mr-2" />
              기본 정보
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">인스턴스 ID</dt>
                <dd className="text-sm text-gray-900 font-mono">{instance.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">이름</dt>
                <dd className="text-sm text-gray-900">{instance.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">상태</dt>
                <dd className="text-sm text-gray-900">{instance.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">VM 상태</dt>
                <dd className="text-sm text-gray-900">{instance.vm_state}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">전원 상태</dt>
                <dd className="text-sm text-gray-900">{getPowerStateText(instance.power_state)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">가용 영역</dt>
                <dd className="text-sm text-gray-900">{instance.availability_zone}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">키 페어</dt>
                <dd className="text-sm text-gray-900">{instance.key_name || 'N/A'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">생성일</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(instance.created).toLocaleString('ko-KR')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">최종 수정</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(instance.updated).toLocaleString('ko-KR')}
                </dd>
              </div>
            </dl>
          </div>

          {/* 하드웨어 스펙 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Cpu className="h-5 w-5 mr-2" />
              하드웨어 스펙
            </h3>
            {flavor ? (
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">플레이버</dt>
                  <dd className="text-sm text-gray-900">{flavor.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">vCPU</dt>
                  <dd className="text-sm text-gray-900 flex items-center">
                    <Cpu className="h-4 w-4 mr-1" />
                    {flavor.vcpus} 코어
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">메모리</dt>
                  <dd className="text-sm text-gray-900 flex items-center">
                    <Memory className="h-4 w-4 mr-1" />
                    {flavor.ram} MB ({(flavor.ram / 1024).toFixed(1)} GB)
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">디스크</dt>
                  <dd className="text-sm text-gray-900 flex items-center">
                    <HardDrive className="h-4 w-4 mr-1" />
                    {flavor.disk} GB
                  </dd>
                </div>
                {flavor.swap && (
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500">스왑</dt>
                    <dd className="text-sm text-gray-900">{flavor.swap} MB</dd>
                  </div>
                )}
                {flavor.ephemeral && (
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500">임시 디스크</dt>
                    <dd className="text-sm text-gray-900">{flavor.ephemeral} GB</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-gray-500">플레이버 정보를 불러올 수 없습니다.</p>
            )}
          </div>

          {/* 이미지 정보 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Database className="h-5 w-5 mr-2" />
              이미지 정보
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">이미지 ID</dt>
                <dd className="text-sm text-gray-900 font-mono">{instance.image?.id || 'N/A'}</dd>
              </div>
            </dl>
          </div>

          {/* 메타데이터 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Tag className="h-5 w-5 mr-2" />
              메타데이터 & 태그
            </h3>
            {instance.metadata && Object.keys(instance.metadata).length > 0 ? (
              <dl className="space-y-3">
                {Object.entries(instance.metadata).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500">{key}</dt>
                    <dd className="text-sm text-gray-900">{value as string}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-gray-500">메타데이터가 없습니다.</p>
            )}
            
            {instance.tags && instance.tags.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">태그</h4>
                <div className="flex flex-wrap gap-2">
                  {instance.tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
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
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
            <Network className="h-5 w-5 mr-2" />
            네트워크 정보
          </h3>
          
          {networkInfo.length > 0 ? (
            <div className="space-y-6">
              {networkInfo.map((network, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">{network.name}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {network.ips.map((ip, ipIndex) => (
                      <div key={ipIndex} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center mb-2">
                          <Globe className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm font-medium text-gray-900">{ip.addr}</span>
                        </div>
                        <div className="text-xs text-gray-500">
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
            <p className="text-gray-500">네트워크 정보가 없습니다.</p>
          )}

          {/* 보안 그룹 */}
          <div className="mt-8">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              보안 그룹
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {instance.security_groups.map((sg, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center">
                    <Shield className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-gray-900">{sg.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'storage' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
            <HardDrive className="h-5 w-5 mr-2" />
            스토리지 정보
          </h3>
          
          {instance.volumes_attached && instance.volumes_attached.length > 0 ? (
            <div className="space-y-4">
              {instance.volumes_attached.map((volume, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <HardDrive className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{volume.id}</p>
                        <p className="text-xs text-gray-500">디바이스: {volume.device}</p>
                      </div>
                    </div>
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      연결됨
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">연결된 볼륨이 없습니다.</p>
          )}
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            보안 설정
          </h3>
          
          <div className="space-y-6">
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">보안 그룹</h4>
              <div className="space-y-2">
                {instance.security_groups.map((sg, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <Shield className="h-4 w-4 text-green-600 mr-3" />
                      <span className="text-sm font-medium text-gray-900">{sg.name}</span>
                    </div>
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                      규칙 보기
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">액세스 설정</h4>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">키 페어</dt>
                  <dd className="text-sm text-gray-900">{instance.key_name || '설정되지 않음'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">잠금 상태</dt>
                  <dd className="text-sm text-gray-900">
                    {instance.locked ? (
                      <span className="text-red-600">잠김</span>
                    ) : (
                      <span className="text-green-600">잠금 해제</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Config Drive</dt>
                  <dd className="text-sm text-gray-900">
                    {instance.config_drive ? (
                      <span className="text-green-600">활성화</span>
                    ) : (
                      <span className="text-gray-600">비활성화</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'console' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
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
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <iframe
                src={consoleUrl}
                className="w-full h-96"
                title="VNC Console"
                sandbox="allow-same-origin allow-scripts allow-forms"
              />
            </div>
          ) : (
            <div className="text-center py-12">
              <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">VNC 콘솔에 연결하려면 위의 버튼을 클릭하세요.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
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
          
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto max-h-96">
            <pre className="whitespace-pre-wrap">{consoleLogs || '로그를 불러오려면 위의 버튼을 클릭하세요.'}</pre>
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">인스턴스 작업</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleAction('snapshot')}
            disabled={actionLoading || instance.status !== 'ACTIVE'}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <Camera className="h-4 w-4 mr-2" />
            스냅샷 생성
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
            인스턴스 삭제
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstanceDetailPage; 