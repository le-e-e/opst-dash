import React, { useEffect, useState } from 'react';
import { Server, Play, Square, RotateCcw, Trash2, Plus, Settings, RefreshCw } from 'lucide-react';
import { novaService } from '../services/openstack';
import toast from 'react-hot-toast';

interface Instance {
  id: string;
  name: string;
  status: string;
  image: any;
  flavor: any;
  created: string;
  addresses: any;
}

const ComputePage: React.FC = () => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const response = await novaService.getServers();
      setInstances(response.servers || []);
    } catch (error) {
      console.error('인스턴스 로딩 실패:', error);
      toast.error('인스턴스 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'SHUTOFF': return 'bg-gray-100 text-gray-800';
      case 'ERROR': return 'bg-red-100 text-red-800';
      case 'BUILD': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '실행 중';
      case 'SHUTOFF': return '중지됨';
      case 'ERROR': return '오류';
      case 'BUILD': return '생성 중';
      default: return status;
    }
  };

  useEffect(() => {
    fetchInstances();
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
        <h1 className="text-2xl font-bold text-gray-900">컴퓨트 인스턴스</h1>
        <div className="flex space-x-3">
          <button
            onClick={fetchInstances}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </button>
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            인스턴스 생성
          </button>
        </div>
      </div>

      {/* 인스턴스 목록 */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">인스턴스 목록</h3>
        </div>
        
        {instances.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">생성된 인스턴스가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이미지</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">플레이버</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">생성일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {instances.map((instance) => (
                  <tr key={instance.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Server className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{instance.name}</div>
                          <div className="text-sm text-gray-500">{instance.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(instance.status)}`}>
                        {getStatusText(instance.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {instance.image?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {instance.flavor?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(instance.created).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleReboot(instance.id, 'SOFT')}
                          disabled={actionLoading === instance.id}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                          title="재시작"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(instance.id)}
                          disabled={actionLoading === instance.id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComputePage; 