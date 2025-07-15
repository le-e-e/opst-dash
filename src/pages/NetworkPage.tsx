import React, { useEffect, useState } from 'react';
import { Network, Plus, Trash2, RefreshCw, Globe, Shield, Router } from 'lucide-react';
import { neutronService } from '../services/openstack';
import toast from 'react-hot-toast';

interface NetworkResource {
  id: string;
  name: string;
  status: string;
  admin_state_up: boolean;
  subnets: string[];
  provider_network_type?: string;
  created_at?: string;
}

const NetworkPage: React.FC = () => {
  const [networks, setNetworks] = useState<NetworkResource[]>([]);
  const [subnets, setSubnets] = useState<any[]>([]);
  const [routers, setRouters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'networks' | 'subnets' | 'routers'>('networks');

  const fetchNetworkData = async () => {
    try {
      setLoading(true);
      const [networksData, subnetsData, routersData] = await Promise.all([
        neutronService.getNetworks(),
        neutronService.getSubnets(),
        neutronService.getRouters()
      ]);
      
      setNetworks(networksData.networks || []);
      setSubnets(subnetsData.subnets || []);
      setRouters(routersData.routers || []);
    } catch (error) {
      console.error('네트워크 데이터 로딩 실패:', error);
      toast.error('네트워크 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNetwork = async (networkId: string) => {
    if (!confirm('정말로 이 네트워크를 삭제하시겠습니까?')) return;
    
    try {
      await neutronService.deleteNetwork(networkId);
      toast.success('네트워크를 삭제했습니다.');
      fetchNetworkData();
    } catch (error) {
      console.error('네트워크 삭제 실패:', error);
      toast.error('네트워크 삭제에 실패했습니다.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'down': return 'bg-red-100 text-red-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return '활성';
      case 'down': return '비활성';
      case 'error': return '오류';
      default: return status;
    }
  };

  useEffect(() => {
    fetchNetworkData();
  }, []);

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
        <h1 className="text-2xl font-bold text-gray-900">네트워크</h1>
        <div className="flex space-x-3">
          <button
            onClick={fetchNetworkData}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </button>
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            네트워크 생성
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('networks')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'networks'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Network className="h-4 w-4 inline mr-2" />
            네트워크
          </button>
          <button
            onClick={() => setActiveTab('subnets')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'subnets'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Globe className="h-4 w-4 inline mr-2" />
            서브넷
          </button>
          <button
            onClick={() => setActiveTab('routers')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'routers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Router className="h-4 w-4 inline mr-2" />
            라우터
          </button>
        </nav>
      </div>

      {/* 네트워크 탭 */}
      {activeTab === 'networks' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">네트워크 목록</h3>
          </div>
          
          {networks.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Network className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">생성된 네트워크가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">관리 상태</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">서브넷</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {networks.map((network) => (
                    <tr key={network.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Network className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{network.name}</div>
                            <div className="text-sm text-gray-500">{network.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(network.status)}`}>
                          {getStatusText(network.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          network.admin_state_up ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {network.admin_state_up ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {network.subnets.length}개
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleDeleteNetwork(network.id)}
                          className="text-red-600 hover:text-red-900"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 서브넷 탭 */}
      {activeTab === 'subnets' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">서브넷 목록</h3>
          </div>
          
          {subnets.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">생성된 서브넷이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CIDR</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP 버전</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DHCP</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subnets.map((subnet) => (
                    <tr key={subnet.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Globe className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{subnet.name}</div>
                            <div className="text-sm text-gray-500">{subnet.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {subnet.cidr}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        IPv{subnet.ip_version}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          subnet.enable_dhcp ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {subnet.enable_dhcp ? '활성' : '비활성'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 라우터 탭 */}
      {activeTab === 'routers' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">라우터 목록</h3>
          </div>
          
          {routers.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Router className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">생성된 라우터가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">관리 상태</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">외부 게이트웨이</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {routers.map((router) => (
                    <tr key={router.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Router className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{router.name}</div>
                            <div className="text-sm text-gray-500">{router.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(router.status)}`}>
                          {getStatusText(router.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          router.admin_state_up ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {router.admin_state_up ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {router.external_gateway_info ? '연결됨' : '연결 안됨'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NetworkPage; 