import React, { useEffect, useState } from 'react';
import { HardDrive, Plus, Trash2, RefreshCw, Camera, X } from 'lucide-react';
import { cinderService, glanceService } from '../services/openstack';
import toast from 'react-hot-toast';

interface Volume {
  id: string;
  name: string;
  status: string;
  size: number;
  volume_type: string;
  created_at: string;
  attachments: any[];
  bootable: boolean;
  description?: string;
}

const VolumePage: React.FC = () => {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'volumes' | 'snapshots'>('volumes');
  const [showCreateVolumeModal, setShowCreateVolumeModal] = useState(false);
  const [volumeTypes, setVolumeTypes] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  
  // 볼륨 생성 폼 상태
  const [createVolumeForm, setCreateVolumeForm] = useState({
    name: '',
    description: '',
    size: 1,
    volume_type: ''
  });

  const fetchVolumeData = async () => {
    try {
      setLoading(true);
      const [volumesData, cinderSnapshotsData, volumeTypesData, imagesData] = await Promise.all([
        cinderService.getVolumes(),
        cinderService.getSnapshots(),
        cinderService.getVolumeTypes(),
        glanceService.getImages()
      ]);
      
      setVolumes(volumesData.volumes || []);
      
      // Cinder 볼륨 스냅샷 가져오기
      const cinderSnapshots = cinderSnapshotsData.snapshots || [];
      
      // Nova 이미지 스냅샷 추출 (CreateInstancePage와 동일한 로직)
      const allImages = imagesData.images || [];
      const imageSnapshots: any[] = [];
      
      allImages.forEach((img: any) => {
        if (img.status !== 'active') return;
        
        // Nova 스냅샷 판별 조건
        const isSnapshot = 
          img.image_type === 'snapshot' ||
          (img.metadata && img.metadata.image_type === 'snapshot') ||
          img.base_image_ref ||
          img.instance_uuid ||
          img.owner_specified ||
          (img.visibility === 'private' && 
           ((/snapshot|snap|backup|image-/i.test(img.name || '')) ||
            (/snapshot|snap|backup/i.test(img.description || '')))) ||
          (img.metadata && (
            img.metadata.user_id ||
            img.metadata.base_image_ref ||
            img.metadata.instance_type_id ||
            img.metadata.instance_type_memory_mb ||
            img.metadata.instance_type_vcpus ||
            img.metadata.instance_type_root_gb
          ));
        
        if (isSnapshot) {
          // Nova 스냅샷을 Cinder 스냅샷 형식으로 변환
          imageSnapshots.push({
            id: img.id,
            name: img.name,
            status: img.status,
            size: img.size ? Math.ceil(img.size / (1024 * 1024 * 1024)) : null, // bytes를 GB로 변환
            created_at: img.created_at,
            volume_id: null, // 이미지 스냅샷은 볼륨 ID가 없음
            description: img.description || '인스턴스 이미지 스냅샷',
            snapshot_type: 'image' // 구분용 필드 추가
          });
        }
      });
      
      // 두 종류 스냅샷 합치기
      const allSnapshots = [
        ...cinderSnapshots.map((s: any) => ({ ...s, snapshot_type: 'volume' })), 
        ...imageSnapshots
      ];
      
      console.log('🔍 Cinder 볼륨 스냅샷:', cinderSnapshots.length);
      console.log('🔍 Nova 이미지 스냅샷:', imageSnapshots.length);
      console.log('🔍 전체 스냅샷 데이터:', allSnapshots.length);
      
      allSnapshots.forEach((snapshot: any, index: number) => {
        console.log(`  ${index + 1}. 스냅샷 (${snapshot.snapshot_type}):`, {
          id: snapshot.id,
          name: snapshot.name,
          status: snapshot.status,
          volume_id: snapshot.volume_id,
          size: snapshot.size
        });
      });
      
      // 기본적인 존재 여부만 체크
      const validSnapshots = allSnapshots.filter((snapshot: any) => {
        return snapshot && snapshot.id;
      });
      
      console.log('📀 최종 표시될 스냅샷 (필터링 없음):', validSnapshots.length);
      console.log('📀 실제 설정할 스냅샷들:', validSnapshots.map((s: any) => ({ id: s.id, name: s.name, status: s.status, type: s.snapshot_type })));
      
      console.log('🔄 setSnapshots 호출 전 현재 snapshots 상태:', snapshots.length);
      setSnapshots(validSnapshots);
      console.log('🔄 setSnapshots 호출 완료 - 새 데이터 길이:', validSnapshots.length);
      setVolumeTypes(volumeTypesData.volume_types || []);
    } catch (error) {
      console.error('볼륨 데이터 로딩 실패:', error);
      toast.error('볼륨 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVolume = async (volumeId: string) => {
    if (!confirm('정말로 이 볼륨을 삭제하시겠습니까?')) return;
    
    try {
      await cinderService.deleteVolume(volumeId);
      toast.success('볼륨을 삭제했습니다.');
      fetchVolumeData();
    } catch (error) {
      console.error('볼륨 삭제 실패:', error);
      toast.error('볼륨 삭제에 실패했습니다.');
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string, snapshotName: string, snapshotType?: string) => {
    if (!confirm(`정말로 스냅샷 "${snapshotName || snapshotId}"을(를) 삭제하시겠습니까?`)) return;
    
    try {
      console.log(`🗑️ 스냅샷 삭제 시작: ${snapshotName} (타입: ${snapshotType})`);
      
      if (snapshotType === 'image') {
        // Nova 이미지 스냅샷 삭제
        console.log('이미지 스냅샷 삭제 (Glance API)');
        await glanceService.deleteImage(snapshotId);
        toast.success('이미지 스냅샷을 삭제했습니다.');
      } else {
        // Cinder 볼륨 스냅샷 삭제
        console.log('볼륨 스냅샷 삭제 (Cinder API)');
        await cinderService.deleteSnapshot(snapshotId);
        toast.success('볼륨 스냅샷을 삭제했습니다.');
      }
      
      fetchVolumeData();
    } catch (error: any) {
      console.error('스냅샷 삭제 실패:', error);
      
      let errorMessage = '스냅샷 삭제에 실패했습니다.';
      if (error.response?.data?.message) {
        errorMessage = `삭제 실패: ${error.response.data.message}`;
      } else if (error.response?.data?.badRequest?.message) {
        errorMessage = `삭제 실패: ${error.response.data.badRequest.message}`;
      } else if (error.message) {
        errorMessage = `삭제 실패: ${error.message}`;
      }
      
      toast.error(errorMessage);
    }
  };

  const handleCreateVolume = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createVolumeForm.name.trim()) {
      toast.error('볼륨 이름을 입력해주세요.');
      return;
    }
    
    if (createVolumeForm.size < 1) {
      toast.error('볼륨 크기는 최소 1GB여야 합니다.');
      return;
    }
    
    try {
      setCreating(true);
      
      const volumeData = {
        volume: {
          name: createVolumeForm.name.trim(),
          description: createVolumeForm.description.trim(),
          size: createVolumeForm.size,
          ...(createVolumeForm.volume_type && { volume_type: createVolumeForm.volume_type })
        }
      };
      
      console.log('볼륨 생성 요청:', volumeData);
      
      await cinderService.createVolume(volumeData);
      toast.success('볼륨을 생성했습니다.');
      
      // 폼 초기화
      setCreateVolumeForm({
        name: '',
        description: '',
        size: 1,
        volume_type: ''
      });
      
      setShowCreateVolumeModal(false);
      fetchVolumeData();
    } catch (error: any) {
      console.error('볼륨 생성 실패:', error);
      
      let errorMessage = '볼륨 생성에 실패했습니다.';
      if (error.response?.data?.badRequest?.message) {
        errorMessage = `볼륨 생성 실패: ${error.response.data.badRequest.message}`;
      } else if (error.message) {
        errorMessage = `볼륨 생성 실패: ${error.message}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setCreateVolumeForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'in-use': return 'bg-blue-100 text-blue-800';
      case 'creating': return 'bg-yellow-100 text-yellow-800';
      case 'deleting': return 'bg-red-100 text-red-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available': return '사용 가능';
      case 'in-use': return '사용 중';
      case 'creating': return '생성 중';
      case 'deleting': return '삭제 중';
      case 'error': return '오류';
      default: return status;
    }
  };

  useEffect(() => {
    fetchVolumeData();
  }, []);

  // 스냅샷 상태 변경 시 로그 출력 (디버깅용)
  useEffect(() => {
    console.log('🔄 볼륨 페이지 스냅샷 상태 업데이트:', {
      count: snapshots.length,
      snapshots: snapshots.map((s: any) => ({ id: s.id, name: s.name, status: s.status }))
    });
  }, [snapshots]);

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
        <h1 className="text-2xl font-bold text-gray-900">볼륨</h1>
        <div className="flex space-x-3">
          <button
            onClick={fetchVolumeData}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </button>

          <button 
            onClick={() => setShowCreateVolumeModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            볼륨 생성
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('volumes')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'volumes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <HardDrive className="h-4 w-4 inline mr-2" />
            볼륨
          </button>
          <button
            onClick={() => setActiveTab('snapshots')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'snapshots'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Camera className="h-4 w-4 inline mr-2" />
            스냅샷
          </button>
        </nav>
      </div>

      {/* 볼륨 탭 */}
      {activeTab === 'volumes' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">볼륨 목록</h3>
          </div>
          
          {volumes.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <HardDrive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">생성된 볼륨이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">크기</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">타입</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">연결 상태</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">부팅 가능</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">생성일</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {volumes.map((volume) => (
                    <tr key={volume.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <HardDrive className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{volume.name || '이름 없음'}</div>
                            <div className="text-sm text-gray-500">{volume.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(volume.status)}`}>
                          {getStatusText(volume.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {volume.size} GB
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {volume.volume_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {volume.attachments.length > 0 ? `${volume.attachments.length}개 연결` : '연결 안됨'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          volume.bootable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {volume.bootable ? '예' : '아니오'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(volume.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDeleteVolume(volume.id)}
                            className="text-red-600 hover:text-red-900"
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
      )}

      {/* 스냅샷 탭 */}
      {activeTab === 'snapshots' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">스냅샷 목록</h3>
          </div>
          
          {(() => {
            console.log('📱 UI 렌더링 시점 스냅샷 상태:', {
              length: snapshots.length,
              snapshots: snapshots.slice(0, 3).map((s: any) => ({ id: s.id?.slice(0, 8), name: s.name }))
            });
            
            if (snapshots.length === 0) {
              return (
                <div className="px-6 py-12 text-center">
                  <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">생성된 스냅샷이 없습니다.</p>
                  <p className="text-xs text-gray-400 mt-2">콘솔 로그를 확인해보세요</p>
                </div>
              );
            }
            
            return (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">타입</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">크기</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">원본</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">생성일</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {snapshots.map((snapshot) => (
                    <tr key={snapshot.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Camera className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{snapshot.name || '이름 없음'}</div>
                            <div className="text-sm text-gray-500">{snapshot.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          snapshot.snapshot_type === 'volume' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {snapshot.snapshot_type === 'volume' ? '볼륨' : '이미지'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(snapshot.status)}`}>
                          {getStatusText(snapshot.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {snapshot.size || '-'} GB
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {snapshot.snapshot_type === 'volume' ? (snapshot.volume_id || '-') : '인스턴스'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {snapshot.created_at ? new Date(snapshot.created_at).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDeleteSnapshot(snapshot.id, snapshot.name, snapshot.snapshot_type)}
                            className="text-red-600 hover:text-red-900"
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
            );
          })()}
        </div>
      )}

      {/* 볼륨 생성 모달 */}
      {showCreateVolumeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-full p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowCreateVolumeModal(false)} />
            
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">새 볼륨 생성</h3>
                <button
                  onClick={() => setShowCreateVolumeModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateVolume} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    볼륨 이름 *
                  </label>
                  <input
                    type="text"
                    value={createVolumeForm.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="볼륨 이름을 입력하세요"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    설명
                  </label>
                  <input
                    type="text"
                    value={createVolumeForm.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="볼륨 설명 (선택사항)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    크기 (GB) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={createVolumeForm.size}
                    onChange={(e) => handleFormChange('size', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    볼륨 타입
                  </label>
                  <select
                    value={createVolumeForm.volume_type}
                    onChange={(e) => handleFormChange('volume_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">기본값</option>
                    {volumeTypes.map(vt => (
                      <option key={vt.id} value={vt.name}>{vt.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateVolumeModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    disabled={creating}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                  >
                    {creating && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    )}
                    {creating ? '생성 중...' : '생성'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VolumePage; 