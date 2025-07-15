import React, { useEffect, useState } from 'react';
import { 
  Server, 
  Network, 
  HardDrive, 
  Image, 
  Activity, 
  Cpu, 
  Memory, 
  Database,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { novaService, neutronService, glanceService, cinderService } from '../services/openstack';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface ResourceStats {
  servers: { total: number; running: number; stopped: number; };
  networks: { total: number; active: number; };
  volumes: { total: number; attached: number; available: number; };
  images: { total: number; active: number; };
  usage: {
    cpu: number;
    memory: number;
    storage: number;
  };
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<ResourceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // 병렬로 모든 데이터 가져오기
      const [serversData, networksData, volumesData, imagesData] = await Promise.all([
        novaService.getServers(),
        neutronService.getNetworks(),
        cinderService.getVolumes(),
        glanceService.getImages()
      ]);

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
      const volumeStats = {
        total: volumes.length,
        attached: volumes.filter((v: any) => v.status === 'in-use').length,
        available: volumes.filter((v: any) => v.status === 'available').length
      };

      // 이미지 상태 계산
      const images = imagesData.images || [];
      const imageStats = {
        total: images.length,
        active: images.filter((i: any) => i.status === 'active').length
      };

      // 사용량 통계 (임시 데이터)
      const usage = {
        cpu: Math.floor(Math.random() * 80) + 20,
        memory: Math.floor(Math.random() * 70) + 30,
        storage: Math.floor(Math.random() * 60) + 40
      };

      setStats({
        servers: serverStats,
        networks: networkStats,
        volumes: volumeStats,
        images: imageStats,
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
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <button
          onClick={fetchStats}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
              <p className="text-sm font-medium text-gray-600">서버</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.servers.total}</p>
              <p className="text-sm text-gray-500">
                실행 중: {stats?.servers.running} / 중지: {stats?.servers.stopped}
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <Server className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">네트워크</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.networks.total}</p>
              <p className="text-sm text-gray-500">
                활성: {stats?.networks.active}
              </p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <Network className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">볼륨</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.volumes.total}</p>
              <p className="text-sm text-gray-500">
                연결됨: {stats?.volumes.attached} / 사용가능: {stats?.volumes.available}
              </p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <HardDrive className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">이미지</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.images.total}</p>
              <p className="text-sm text-gray-500">
                활성: {stats?.images.active}
              </p>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <Image className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 서버 상태 파이 차트 */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">서버 상태</h3>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">리소스 사용량</h3>
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 활동</h3>
        <div className="space-y-3">
          <div className="flex items-center p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">새 인스턴스 생성됨</p>
              <p className="text-xs text-gray-500">5분 전</p>
            </div>
          </div>
          <div className="flex items-center p-3 bg-blue-50 rounded-lg">
            <Activity className="h-5 w-5 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">네트워크 구성 업데이트</p>
              <p className="text-xs text-gray-500">12분 전</p>
            </div>
          </div>
          <div className="flex items-center p-3 bg-purple-50 rounded-lg">
            <Database className="h-5 w-5 text-purple-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">볼륨 백업 완료</p>
              <p className="text-xs text-gray-500">1시간 전</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 