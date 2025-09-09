import React, { useEffect, useState } from 'react';
import { HardDrive, Plus, Trash2, RefreshCw, X, User, Crown } from 'lucide-react';
import { cinderService, novaService } from '../services/openstack';
import { 
  filterVolumesByProject, 
  isCurrentUserAdmin,
  getResourceOwnerInfo,
  canAccessAllProjects,
  getCurrentProjectId
} from '../utils/projectScope';
import { workflowNotifications } from '../utils/notificationHelper';
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
  const [loading, setLoading] = useState(true);
  const [showCreateVolumeModal, setShowCreateVolumeModal] = useState(false);
  const [volumeTypes, setVolumeTypes] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [instanceCache, setInstanceCache] = useState<{ [key: string]: string }>({});
  const [deletingVolumeId, setDeletingVolumeId] = useState<string | null>(null);
  const [detachingVolumeId, setDetachingVolumeId] = useState<string | null>(null);
  const [emergencyCleaningVolumeId, setEmergencyCleaningVolumeId] = useState<string | null>(null);
  
  // 볼륨 생성 폼 상태
  const [createVolumeForm, setCreateVolumeForm] = useState({
    name: '',
    description: '',
    size: 1,
    volume_type: ''
  });

  const fetchInstanceNames = async (volumes: Volume[]) => {
    try {
      const serverIds = new Set<string>();
      volumes.forEach(volume => {
        volume.attachments?.forEach(att => {
          serverIds.add(att.server_id);
        });
      });

      if (serverIds.size === 0) return;

      console.log(`🔍 ${serverIds.size}개 인스턴스 이름 조회 중...`);
      
      const instancePromises = Array.from(serverIds).map(async (serverId) => {
        try {
          const response = await novaService.getServer(serverId);
          return { id: serverId, name: response.server.name };
        } catch (error) {
          console.warn(`⚠️ 인스턴스 ${serverId} 정보 조회 실패:`, error);
          return { id: serverId, name: `instance_${serverId.slice(-8)}` };
        }
      });

      const instanceResults = await Promise.allSettled(instancePromises);
      const newCache: { [key: string]: string } = { ...instanceCache };
      
      instanceResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          newCache[result.value.id] = result.value.name;
        }
      });

      setInstanceCache(newCache);
      console.log(`✅ 인스턴스 이름 캐시 업데이트 완료: ${Object.keys(newCache).length}개`);
    } catch (error) {
      console.warn('⚠️ 인스턴스 이름 조회 실패:', error);
    }
  };

  const fetchVolumeData = async () => {
    try {
      setLoading(true);
      
      console.log('🔄 볼륨 데이터 로딩 시작...');
      console.log('현재 사용자가 관리자인가?', isCurrentUserAdmin());
      console.log('모든 프로젝트 접근 가능한가?', canAccessAllProjects());
      
      // 각 API 호출을 개별적으로 처리하여 일부 실패해도 전체가 실패하지 않도록 함
      const [volumesResult, volumeTypesResult] = await Promise.allSettled([
        cinderService.getVolumes(),
        cinderService.getVolumeTypes()
      ]);

      // 성공한 데이터만 추출
      const volumesData = volumesResult.status === 'fulfilled' ? volumesResult.value : { volumes: [] };
      const volumeTypesData = volumeTypesResult.status === 'fulfilled' ? volumeTypesResult.value : { volume_types: [] };

      // 실패한 API 로깅
      if (volumesResult.status === 'rejected') {
        console.error('볼륨 데이터 로딩 실패:', volumesResult.reason);
        toast.error('볼륨 목록을 불러오는데 실패했습니다.');
      }
      if (volumeTypesResult.status === 'rejected') console.error('볼륨 타입 데이터 로딩 실패:', volumeTypesResult.reason);
      
      // 볼륨 데이터 처리 - 클라이언트 사이드에서 프로젝트별 필터링 적용
      const allVolumes = volumesData.volumes || [];
      
      // 로그 제거
      
      // 프로젝트별 볼륨 필터링 적용
      // Nova API로 조회한 경우 이미 프로젝트 스코프가 적용되어 있으므로 필터링 건너뛸 수 있음
      const hasProjectInfo = allVolumes.some((v: any) => 
        v.project_id || v.tenant_id || v.os_vol_tenant_attr_tenant_id || v.owner
      );
      
      let filteredVolumes: any[];
      if (!hasProjectInfo && allVolumes.length > 0 && !isCurrentUserAdmin()) {
        console.log('🔍 Nova API 조회 볼륨: 필터링 건너뛰기');
        filteredVolumes = allVolumes;
      } else {
        filteredVolumes = filterVolumesByProject(allVolumes);
      }
      
      setVolumes(filteredVolumes);
      setVolumeTypes(volumeTypesData.volume_types || []);
      
      // 인스턴스 이름 캐시 업데이트
      if (filteredVolumes.length > 0) {
        fetchInstanceNames(filteredVolumes);
      }
      
    } catch (error) {
      console.error('볼륨 데이터 로딩 실패:', error);
      toast.error('볼륨 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVolume = async (volumeId: string) => {
    if (deletingVolumeId) return; // 중복 방지
    setDeletingVolumeId(volumeId);
    
    try {
      console.log(`🔍 볼륨 ${volumeId} 안전한 삭제 프로세스 시작`);
      
      // 볼륨 정보 가져오기
      const volumeDetail = await cinderService.getVolume(volumeId);
      const volume = volumeDetail.volume;
      const volumeName = volume.name || volumeId;
      
      console.log(`📋 볼륨 정보: ${volumeName} (${volume.status})`);
      console.log(`📋 연결 상태: ${volume.attachments?.length > 0 ? '연결됨' : '분리됨'}`);
      
      // 연결된 경우 사용자 확인
      if (volume.attachments && volume.attachments.length > 0) {
        const attachmentInfo = volume.attachments.map((att: any) => 
          `- 인스턴스 ID: ${att.server_id}, 디바이스: ${att.device}`
        ).join('\n');
        
        const forceDelete = confirm(
          `⚠️ 볼륨 "${volumeName}"이 현재 인스턴스에 연결되어 있습니다:\n\n${attachmentInfo}\n\n` +
          `강제로 분리하고 삭제하시겠습니까?\n\n` +
          `주의: 연결된 인스턴스에 영향을 줄 수 있습니다.`
        );
        
        if (!forceDelete) {
          setDeletingVolumeId(null);
          return;
        }
        
        // 강제 분리 시도
        console.log('🔧 볼륨 강제 분리 시도...');
        toast.loading('볼륨을 분리하는 중...', { id: 'detach-volume' });
        
        try {
          for (const attachment of volume.attachments) {
            if (attachment.server_id) {
              await cinderService.safeDetachVolume(attachment.server_id, volumeId, volumeName);
            }
          }
          console.log('✅ 볼륨 분리 완료');
        } catch (detachError) {
          console.warn('⚠️ 볼륨 분리 실패, 강제 삭제 시도:', detachError);
        }
        
        toast.dismiss('detach-volume');
      } else {
        // 단순 확인
        if (!confirm(`정말로 볼륨 "${volumeName}"을(를) 삭제하시겠습니까?`)) {
          setDeletingVolumeId(null);
          return;
        }
      }
      
      // 안전한 볼륨 삭제 시도
      console.log('🗑️ 안전한 볼륨 삭제 시도...');
      toast.loading('볼륨을 삭제하는 중...', { id: 'delete-volume' });
      
      await cinderService.safeDeleteVolume(volumeId, volumeName);
      
      toast.dismiss('delete-volume');
      toast.success(`볼륨 "${volumeName}"을(를) 삭제했습니다.`);
      
      // 목록 새로고침
      await fetchVolumeData();
      
    } catch (deleteError) {
      toast.dismiss('delete-volume');
      console.error('❌ 볼륨 삭제 프로세스 실패:', deleteError);
      
      // 에러 메시지 분석하여 구체적인 안내 제공
      let errorMessage = '볼륨 삭제에 실패했습니다.';
      const errorString = deleteError instanceof Error ? deleteError.message : String(deleteError);
      
      if (errorString.includes('사용자가') && errorString.includes('취소')) {
        // 사용자가 의도적으로 취소한 경우
        console.log('사용자가 삭제를 취소했습니다.');
        setDeletingVolumeId(null);
        return;
      } else if (errorString.toLowerCase().includes('in-use') || errorString.toLowerCase().includes('in use')) {
        errorMessage = '볼륨이 사용 중이어서 삭제할 수 없습니다. 연결된 인스턴스를 먼저 확인해주세요.';
      } else if (errorString.toLowerCase().includes('not found') || errorString.includes('404')) {
        errorMessage = '볼륨을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.';
      } else if (errorString.toLowerCase().includes('permission') || errorString.toLowerCase().includes('forbidden') || errorString.includes('403')) {
        errorMessage = '볼륨을 삭제할 권한이 없습니다.';
      } else if (errorString.toLowerCase().includes('snapshot')) {
        errorMessage = '이 볼륨의 스냅샷이 존재합니다. 관련 스냅샷을 먼저 확인해주세요.';
      } else if (errorString.toLowerCase().includes('invalid') || errorString.toLowerCase().includes('bad')) {
        errorMessage = '잘못된 요청입니다. 볼륨 상태를 확인해주세요.';
      } else {
        errorMessage = `볼륨 삭제 실패: ${errorString.slice(0, 100)}${errorString.length > 100 ? '...' : ''}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setDeletingVolumeId(null);
    }
  };

  const handleDetachVolume = async (volumeId: string) => {
    if (detachingVolumeId) return; // 중복 방지
    setDetachingVolumeId(volumeId);
    
    try {
      console.log(`🔧 볼륨 ${volumeId} 마운트 해제 프로세스 시작`);
      
      // 볼륨 정보 가져오기
      const volumeDetail = await cinderService.getVolume(volumeId);
      const volume = volumeDetail.volume;
      const volumeName = volume.name || volumeId;
      
      console.log(`📋 볼륨 정보: ${volumeName} (${volume.status})`);
      console.log(`📋 연결 상태: ${volume.attachments?.length > 0 ? '연결됨' : '분리됨'}`);
      
      if (!volume.attachments || volume.attachments.length === 0) {
        toast.error('이 볼륨은 이미 분리된 상태입니다.');
        setDetachingVolumeId(null);
        return;
      }
      
      const attachmentInfo = volume.attachments.map((att: any) => 
        `- 인스턴스 ID: ${att.server_id}, 디바이스: ${att.device}`
      ).join('\n');
      
      const shouldDetach = confirm(
        `볼륨 "${volumeName}"을 다음 인스턴스에서 분리하시겠습니까?\n\n${attachmentInfo}\n\n` +
        `주의: 연결된 인스턴스에 영향을 줄 수 있습니다.`
      );
      
      if (!shouldDetach) {
        setDetachingVolumeId(null);
        return;
      }
      
      // 각 연결에서 분리 시도
      console.log('🔧 볼륨 분리 시도...');
      toast.loading('볼륨을 분리하는 중...', { id: 'detach-volume' });
      
      let successfulDetachments = 0;
      for (const attachment of volume.attachments) {
        if (attachment.server_id) {
          try {
            const success = await cinderService.safeDetachVolume(attachment.server_id, volumeId, volumeName);
            if (success) {
              successfulDetachments++;
              console.log(`✅ 인스턴스 ${attachment.server_id}에서 분리 성공`);
            }
          } catch (detachError) {
            console.error(`❌ 인스턴스 ${attachment.server_id}에서 분리 실패:`, detachError);
          }
        }
      }
      
      toast.dismiss('detach-volume');
      
      if (successfulDetachments > 0) {
        toast.success(`볼륨 "${volumeName}"을 분리했습니다.`);
        await fetchVolumeData(); // 목록 새로고침
      } else {
        toast.error('볼륨 분리에 실패했습니다.');
      }
      
    } catch (error) {
      toast.dismiss('detach-volume');
      console.error('❌ 볼륨 분리 프로세스 실패:', error);
      toast.error('볼륨 분리에 실패했습니다.');
    } finally {
      setDetachingVolumeId(null);
    }
  };

  const handleEmergencyCleanup = async (volumeId: string) => {
    if (emergencyCleaningVolumeId) return; // 중복 방지
    setEmergencyCleaningVolumeId(volumeId);
    
    try {
      console.log(`🚨 볼륨 ${volumeId} 강제 정리 프로세스 시작`);
      
      // 볼륨 정보 가져오기
      const volumeDetail = await cinderService.getVolume(volumeId);
      const volume = volumeDetail.volume;
      const volumeName = volume.name || volumeId;
      
      console.log(`📋 볼륨 정보: ${volumeName} (${volume.status})`);
      console.log(`📋 연결 상태: ${volume.attachments?.length > 0 ? '연결됨' : '분리됨'}`);
      
      // 위험성 경고 및 사용자 확인
      const shouldProceed = confirm(
        `⚠️ 경고: 데이터베이스 레벨 강제 정리\n\n` +
        `볼륨 "${volumeName}"의 연결 정보를 데이터베이스에서 강제로 정리합니다.\n\n` +
        `이 작업은 다음과 같은 위험이 있습니다:\n` +
        `• 연결된 인스턴스에 예상치 못한 영향\n` +
        `• 파일시스템 오류 가능성\n` +
        `• 데이터 손실 위험\n\n` +
        `정말로 강제 정리를 진행하시겠습니까?\n\n` +
        `(이 작업은 일반적인 분리가 실패한 경우에만 사용하세요)`
      );
      
      if (!shouldProceed) {
        setEmergencyCleaningVolumeId(null);
        return;
      }
      
      // 추가 확인
      const doubleConfirm = confirm(
        `최종 확인: "${volumeName}" 강제 정리\n\n` +
        `다음 작업을 수행합니다:\n` +
        `1. volume_attachment 테이블에서 연결 정보 삭제\n` +
        `2. 볼륨 상태를 'available'로 강제 변경\n\n` +
        `계속 진행하시겠습니까?`
      );
      
      if (!doubleConfirm) {
        setEmergencyCleaningVolumeId(null);
        return;
      }
      
      // 강제 정리 실행
      console.log('🚨 강제 정리 시작...');
      toast.loading('볼륨을 강제로 정리하는 중...', { id: 'emergency-cleanup' });
      
      const success = await cinderService.emergencyVolumeCleanup(volumeId, volumeName);
      
      toast.dismiss('emergency-cleanup');
      
      if (success) {
        toast.success(`볼륨 "${volumeName}"을 강제로 정리했습니다.`);
        await fetchVolumeData(); // 목록 새로고침
      } else {
        toast.error('강제 정리에 실패했습니다.');
      }
      
    } catch (error) {
      toast.dismiss('emergency-cleanup');
      console.error('❌ 강제 정리 프로세스 실패:', error);
      
      let errorMessage = '강제 정리에 실패했습니다.';
      const errorString = error instanceof Error ? error.message : String(error);
      
      if (errorString.toLowerCase().includes('permission') || errorString.toLowerCase().includes('forbidden') || errorString.includes('403')) {
        errorMessage = '강제 정리 권한이 없습니다. 관리자 권한이 필요합니다.';
      } else if (errorString.toLowerCase().includes('not found') || errorString.includes('404')) {
        errorMessage = '볼륨을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.';
      } else {
        errorMessage = `강제 정리 실패: ${errorString.slice(0, 100)}${errorString.length > 100 ? '...' : ''}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setEmergencyCleaningVolumeId(null);
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
      
      console.log('🔧 볼륨 생성 요청 시작:', volumeData);
      
      const result = await cinderService.createVolume(volumeData);
      
      console.log('✅ 볼륨 생성 성공:', result);
      workflowNotifications.volumeCreated(createVolumeForm.name, createVolumeForm.size);
      toast.success(`볼륨 "${createVolumeForm.name}"이 생성되었습니다.`);
      
      // 폼 초기화
      setCreateVolumeForm({
        name: '',
        description: '',
        size: 1,
        volume_type: ''
      });
      
      setShowCreateVolumeModal(false);
      
      // 볼륨 목록 새로고침
      console.log('🔄 볼륨 생성 후 목록 새로고침...');
      await fetchVolumeData();
      
    } catch (error: any) {
      console.error('❌ 볼륨 생성 실패:', error);
      
      let errorMessage = '볼륨 생성에 실패했습니다.';
      
      // 커스텀 오류 처리 (일반 사용자 제한)
      if (error.name === 'VolumeLimitationError') {
        errorMessage = error.message;
      }
      // 서버 응답에서 구체적인 오류 메시지 추출
      else if (error.response?.data) {
        const responseData = error.response.data;
        
        // 다양한 오류 응답 형식 처리
        if (responseData.badRequest?.message) {
          errorMessage = `볼륨 생성 실패: ${responseData.badRequest.message}`;
        } else if (responseData.error?.message) {
          errorMessage = `볼륨 생성 실패: ${responseData.error.message}`;
        } else if (responseData.message) {
          errorMessage = `볼륨 생성 실패: ${responseData.message}`;
        } else if (responseData.detail) {
          errorMessage = `볼륨 생성 실패: ${responseData.detail}`;
        } else if (typeof responseData === 'string') {
          errorMessage = `볼륨 생성 실패: ${responseData}`;
        }
      } else if (error.message) {
        if (error.message.includes('Request failed with status code')) {
          errorMessage = `볼륨 생성 실패: 서버 오류 (${error.response?.status || 'Unknown'})`;
        } else {
          errorMessage = `볼륨 생성 실패: ${error.message}`;
        }
      }
      
      // 일반적인 오류에 대한 추가 안내
      if (error.response?.status === 400) {
        errorMessage += '\n요청 데이터를 확인해주세요.';
      } else if (error.response?.status === 401) {
        errorMessage += '\n인증이 만료되었습니다. 다시 로그인해주세요.';
      } else if (error.response?.status === 403) {
        errorMessage += '\n권한이 부족합니다.';
      } else if (error.response?.status === 413) {
        errorMessage += '\n볼륨 크기가 할당량을 초과했습니다.';
      }
      
      console.log('🔍 사용자에게 표시할 오류 메시지:', errorMessage);
      
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

  // 1. 테이블 헤더 복구 및 컬럼 정리
  const getUnifiedStatus = (volume: Volume) => {
    if (volume.attachments && volume.attachments.length > 0) return '사용 중';
    if (volume.status.toLowerCase() === 'error') return '오류';
    if (volume.status.toLowerCase() === 'deleting') return '삭제 중';
    if (volume.status.toLowerCase() === 'creating') return '생성 중';
    return '사용 가능';
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case '사용 중': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      case '사용 가능': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case '삭제 중': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case '생성 중': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case '오류': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  // 3. 볼륨 이름 표시 함수 개선(인스턴스에서 생성된 경우 인스턴스 이름 기반)
  const getVolumeDisplayName = (volume: Volume) => {
    if (volume.name && volume.name !== '이름 없음' && volume.name !== volume.id && !volume.name.startsWith('volume-')) {
      return volume.name;
    }
    if (volume.attachments && volume.attachments.length > 0) {
      const serverId = volume.attachments[0].server_id;
      const instanceName = instanceCache[serverId];
      if (instanceName) return `${instanceName}_volume`;
      return `instance_${serverId.slice(-8)}_volume`;
    }
    const volumeType = volume.volume_type === '__DEFAULT__' ? 'volume' : volume.volume_type;
    return `${volumeType}_${volume.size}GB`;
  };

  useEffect(() => {
    fetchVolumeData();
  }, []);

  // 삭제 중인 볼륨이 있으면 자동 새로고침
  useEffect(() => {
    const deletingVolumes = volumes.filter(v => v.status.toLowerCase() === 'deleting');
    
    if (deletingVolumes.length > 0) {
      console.log(`🔄 삭제 중인 볼륨 ${deletingVolumes.length}개 감지, 5초 후 자동 새로고침`);
      
      const refreshTimer = setTimeout(() => {
        fetchVolumeData();
      }, 5000);
      
      return () => clearTimeout(refreshTimer);
    }
  }, [volumes]);



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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">볼륨</h1>
        <div className="flex space-x-3">
          <button
            onClick={fetchVolumeData}
            className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
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

      {/* 볼륨 목록 */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">볼륨 목록</h3>
          </div>
          
          {volumes.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <HardDrive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-2">생성된 볼륨이 없습니다.</p>
              {!isCurrentUserAdmin() && (
                <div className="text-sm text-gray-400 dark:text-gray-500 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mx-auto max-w-md">
                  <p className="mb-2">💡 <strong>일반 사용자 안내</strong></p>
                  <p className="text-left">
                    • 직접 볼륨 생성이 제한될 수 있습니다.<br/>
                    • 인스턴스 생성 시 '볼륨에서 부팅' 옵션을 선택하여 볼륨과 함께 인스턴스를 생성해보세요.<br/>
                    • 생성된 볼륨은 관리자 계정에서 확인 가능합니다.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">이름</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">크기</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">타입</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">생성일</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">작업</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {volumes.map((volume) => (
                    <tr key={volume.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <HardDrive className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{getVolumeDisplayName(volume)}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{volume.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(getUnifiedStatus(volume))}`}>
                          {getUnifiedStatus(volume)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{volume.size} GB</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{volume.volume_type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{new Date(volume.created_at).toLocaleDateString('ko-KR')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {/* 연결 해제 버튼 (연결된 볼륨에만 표시) */}
                          {volume.attachments && volume.attachments.length > 0 && (
                            <>
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDetachVolume(volume.id); }}
                                className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 px-2 py-1 rounded mr-1"
                                title="연결 해제"
                                disabled={detachingVolumeId === volume.id || deletingVolumeId === volume.id || emergencyCleaningVolumeId === volume.id}
                              >
                                {detachingVolumeId === volume.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin inline" />
                                ) : (
                                  <svg className="h-4 w-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                  </svg>
                                )}
                              </button>
                              
                              {/* 강제 정리 버튼 (연결된 볼륨에만 표시) */}
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEmergencyCleanup(volume.id); }}
                                className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 px-2 py-1 rounded mr-1"
                                title="강제 정리 (데이터베이스 레벨)"
                                disabled={detachingVolumeId === volume.id || deletingVolumeId === volume.id || emergencyCleaningVolumeId === volume.id}
                              >
                                {emergencyCleaningVolumeId === volume.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin inline" />
                                ) : (
                                  <svg className="h-4 w-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                  </svg>
                                )}
                              </button>
                            </>
                          )}
                          
                          {/* 삭제 버튼 */}
                          <button
                            onClick={e => { e.preventDefault(); e.stopPropagation(); handleDeleteVolume(volume.id); }}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded"
                            title="삭제"
                            disabled={deletingVolumeId === volume.id || detachingVolumeId === volume.id || emergencyCleaningVolumeId === volume.id}
                          >
                            {deletingVolumeId === volume.id ? <RefreshCw className="h-4 w-4 animate-spin inline" /> : <Trash2 className="h-4 w-4 inline" />}
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

      {/* 볼륨 생성 모달 */}
      {showCreateVolumeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-full p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowCreateVolumeModal(false)} />
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">새 볼륨 생성</h3>
                <button
                  onClick={() => setShowCreateVolumeModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateVolume} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    볼륨 이름 *
                  </label>
                  <input
                    type="text"
                    value={createVolumeForm.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="볼륨 이름을 입력하세요"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    설명
                  </label>
                  <input
                    type="text"
                    value={createVolumeForm.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="볼륨 설명 (선택사항)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    크기 (GB) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={createVolumeForm.size}
                    onChange={(e) => handleFormChange('size', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    볼륨 타입
                  </label>
                  <select
                    value={createVolumeForm.volume_type}
                    onChange={(e) => handleFormChange('volume_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500"
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