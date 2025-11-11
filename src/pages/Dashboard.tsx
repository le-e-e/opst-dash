import React, { useEffect, useState } from 'react';
import { 
  Server, 
  Network, 
  HardDrive, 
  Image, 
  Activity, 
  Cpu, 
  Database,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { novaService, neutronService, glanceService, cinderService } from '../services/openstack';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface Stats {
  servers: {
    total: number;
    running: number;
    stopped: number;
  };
  networks: {
    total: number;
    active: number;
  };
  volumes: {
    total: number;
    attached: number;
    available: number;
    totalSize: number;
    attachedSize: number;
    availableSize: number;
  };
  images: {
    total: number;
    active: number;
  };
  hypervisor: {
    totalNodes: number;
    runningVms: number;
    vcpusUsed: number;
    vcpusTotal: number;
    memoryUsed: number;
    memoryTotal: number;
    diskUsed: number;
    diskTotal: number;
  };
  usage: {
    cpu: number;
    memory: number;
    storage: number;
    volumeUsage: number;
  };
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // 각 API 호출을 개별적으로 처리하여 일부 실패해도 전체가 실패하지 않도록 함
      const [serversResult, networksResult, volumesResult, imagesResult, hypervisorResult] = await Promise.allSettled([
        novaService.getServers(),
        neutronService.getNetworks(),
        cinderService.getVolumes(),
        glanceService.getImages(),
        novaService.getHypervisorStatistics()
      ]);

      // 성공한 데이터만 추출
      const serversData = serversResult.status === 'fulfilled' ? serversResult.value : { servers: [] };
      const networksData = networksResult.status === 'fulfilled' ? networksResult.value : { networks: [] };
      const volumesData = volumesResult.status === 'fulfilled' ? volumesResult.value : { volumes: [] };
      const imagesData = imagesResult.status === 'fulfilled' ? imagesResult.value : { images: [] };
      const hypervisorData = hypervisorResult.status === 'fulfilled' ? hypervisorResult.value : null;

      // 실패한 API 로깅 및 처리
      if (serversResult.status === 'rejected') {
        console.error('서버 데이터 로딩 실패:', serversResult.reason);
      }
      if (networksResult.status === 'rejected') {
        console.error('네트워크 데이터 로딩 실패:', networksResult.reason);
      }
      if (volumesResult.status === 'rejected') {
        console.error('볼륨 데이터 로딩 실패:', volumesResult.reason);
      }
      if (imagesResult.status === 'rejected') {
        const error = imagesResult.reason;
        console.error('이미지 데이터 로딩 실패:', error);
        // HTTP 300 응답은 리다이렉트 문제일 수 있음
        if (error?.response?.status === 300) {
          console.warn('이미지 API가 300 리다이렉트 응답을 반환했습니다. API 엔드포인트나 파라미터를 확인하세요.');
        }
      }
      if (hypervisorResult.status === 'rejected') {
        console.error('하이퍼바이저 데이터 로딩 실패:', hypervisorResult.reason);
      }

      // 서버 상태 계산
      const servers = serversData.servers || [];
      const serverStats = {
        total: servers.length,
        running: servers.filter((s: any) => s.status === 'ACTIVE').length,
        stopped: servers.filter((s: any) => s.status === 'SHUTOFF').length
      };

      // 네트워크 상태 계산
      const networks = networksData.networks || [];
      const networkStats = {
        total: networks.length,
        active: networks.filter((n: any) => n.status === 'ACTIVE').length
      };

      // 볼륨 상태 계산
      const volumes = volumesData.volumes || [];
      const totalVolumeSize = volumes.reduce((sum: number, v: any) => sum + (v.size || 0), 0);
      const attachedVolumeSize = volumes
        .filter((v: any) => v.status === 'in-use')
        .reduce((sum: number, v: any) => sum + (v.size || 0), 0);
      const availableVolumeSize = volumes
        .filter((v: any) => v.status === 'available')
        .reduce((sum: number, v: any) => sum + (v.size || 0), 0);
        
      const volumeStats = {
        total: volumes.length,
        attached: volumes.filter((v: any) => v.status === 'in-use').length,
        available: volumes.filter((v: any) => v.status === 'available').length,
        totalSize: totalVolumeSize,
        attachedSize: attachedVolumeSize,
        availableSize: availableVolumeSize
      };

      // 이미지 상태 계산
      const images = imagesData.images || [];
      const imageStats = {
        total: images.length,
        active: images.filter((i: any) => i.status === 'active').length
      };

      // 하이퍼바이저 통계 (실제 하드웨어 리소스)
      const hypervisorStats = hypervisorData ? {
        totalNodes: hypervisorData.hypervisor_statistics?.count || 0,
        runningVms: hypervisorData.hypervisor_statistics?.running_vms || 0,
        vcpusUsed: hypervisorData.hypervisor_statistics?.vcpus_used || 0,
        vcpusTotal: hypervisorData.hypervisor_statistics?.vcpus || 0,
        memoryUsed: hypervisorData.hypervisor_statistics?.memory_mb_used || 0,
        memoryTotal: hypervisorData.hypervisor_statistics?.memory_mb || 0,
        diskUsed: hypervisorData.hypervisor_statistics?.local_gb_used || 0,
        diskTotal: hypervisorData.hypervisor_statistics?.local_gb || 0
      } : {
        totalNodes: 0,
        runningVms: 0,
        vcpusUsed: 0,
        vcpusTotal: 1,
        memoryUsed: 0,
        memoryTotal: 1,
        diskUsed: 0,
        diskTotal: 1
      };

      // 실제 사용률 계산 (하이퍼바이저와 볼륨 정보 결합)
      const usage = {
        cpu: hypervisorStats.vcpusTotal > 0 ? Math.round((hypervisorStats.vcpusUsed / hypervisorStats.vcpusTotal) * 100) : 0,
        memory: hypervisorStats.memoryTotal > 0 ? Math.round((hypervisorStats.memoryUsed / hypervisorStats.memoryTotal) * 100) : 0,
        storage: hypervisorStats.diskTotal > 0 ? Math.round((hypervisorStats.diskUsed / hypervisorStats.diskTotal) * 100) : 0,
        // 신더 볼륨 사용률 추가 (연결된 볼륨 기준)
        volumeUsage: totalVolumeSize > 0 ? Math.round((attachedVolumeSize / totalVolumeSize) * 100) : 0
      };

      setStats({
        servers: serverStats,
        networks: networkStats,
        volumes: volumeStats,
        images: imageStats,
        hypervisor: hypervisorStats,
        usage
      });
    } catch (err) {
      console.error('Stats 로딩 실패:', err);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
      </div>
    );
  }

  const serverStatusData = [
    { name: '실행 중', value: stats?.servers.running || 0, color: '#10B981' },
    { name: '중지됨', value: stats?.servers.stopped || 0, color: '#EF4444' },
  ];

  const resourceData = [
    { name: '서버', value: stats?.servers.total || 0 },
    { name: '네트워크', value: stats?.networks.total || 0 },
    { name: '볼륨', value: stats?.volumes.total || 0 },
    { name: '이미지', value: stats?.images.total || 0 },
  ];

  const usageData = [
    { name: 'CPU', value: stats?.usage.cpu || 0 },
    { name: '메모리', value: stats?.usage.memory || 0 },
    { name: '스토리지', value: stats?.usage.storage || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">대시보드</h1>
        <button
          onClick={fetchStats}
          className="btn-primary flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </button>
      </div>

      {/* 리소스 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">서버</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.servers.total}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                실행 중: {stats?.servers.running} / 중지: {stats?.servers.stopped}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
              <Server className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">네트워크</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.networks.total}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                활성: {stats?.networks.active}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
              <Network className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">볼륨</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.volumes.total}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                연결됨: {stats?.volumes.attached} / 사용가능: {stats?.volumes.available}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                총 용량: {stats?.volumes.totalSize}GB (연결됨: {stats?.volumes.attachedSize}GB)
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg">
              <HardDrive className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          {/* 볼륨 사용률 바 추가 */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>볼륨 사용률</span>
              <span>{stats?.usage.volumeUsage}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${(stats?.usage.volumeUsage || 0) > 80 ? 'bg-red-500' : (stats?.usage.volumeUsage || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${stats?.usage.volumeUsage || 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">이미지</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.images.total}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                활성: {stats?.images.active}
              </p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/30 p-3 rounded-lg">
              <Image className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 시스템 상태 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">컴퓨트 노드</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.hypervisor.totalNodes}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                실행 중인 VM: {stats?.hypervisor.runningVms}
              </p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-lg">
              <Server className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">CPU 사용률</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.usage.cpu}%</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {stats?.hypervisor.vcpusUsed} / {stats?.hypervisor.vcpusTotal} vCPUs
              </p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg">
              <Cpu className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                             <div 
                 className={`h-2 rounded-full ${(stats?.usage.cpu || 0) > 80 ? 'bg-red-500' : (stats?.usage.cpu || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                 style={{ width: `${stats?.usage.cpu || 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">메모리 사용률</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.usage.memory}%</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {Math.round((stats?.hypervisor.memoryUsed || 0) / 1024)}GB / {Math.round((stats?.hypervisor.memoryTotal || 0) / 1024)}GB
              </p>
            </div>
            <div className="bg-pink-50 dark:bg-pink-900/30 p-3 rounded-lg">
              <Database className="h-8 w-8 text-pink-600 dark:text-pink-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                             <div 
                 className={`h-2 rounded-full ${(stats?.usage.memory || 0) > 80 ? 'bg-red-500' : (stats?.usage.memory || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                 style={{ width: `${stats?.usage.memory || 0}%` }}
               ></div>
             </div>
           </div>
         </div>
 
         <div className="card p-6">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-sm font-medium text-gray-600 dark:text-gray-400">스토리지 사용률</p>
               <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.usage.storage}%</p>
               <p className="text-sm text-gray-500 dark:text-gray-400">
                 {stats?.hypervisor.diskUsed}GB / {stats?.hypervisor.diskTotal}GB
               </p>
             </div>
             <div className="bg-teal-50 dark:bg-teal-900/30 p-3 rounded-lg">
               <HardDrive className="h-8 w-8 text-teal-600 dark:text-teal-400" />
             </div>
           </div>
           <div className="mt-3">
             <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
               <div 
                 className={`h-2 rounded-full ${(stats?.usage.storage || 0) > 80 ? 'bg-red-500' : (stats?.usage.storage || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                 style={{ width: `${stats?.usage.storage || 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 서버 상태 파이 차트 */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">서버 상태</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={serverStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({name, value}) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {serverStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 리소스 사용량 바 차트 */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">리소스 사용량</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={usageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 최근 활동 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">최근 활동</h3>
        <div className="space-y-3">
          <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">새 인스턴스 생성됨</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">5분 전</p>
            </div>
          </div>
          <div className="flex items-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">네트워크 구성 업데이트</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">12분 전</p>
            </div>
          </div>
          <div className="flex items-center p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
            <Database className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">볼륨 백업 완료</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">1시간 전</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 