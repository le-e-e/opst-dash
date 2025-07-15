import React, { useEffect, useState } from 'react';
import { Image, Plus, Trash2, RefreshCw, Download, Upload } from 'lucide-react';
import { glanceService } from '../services/openstack';
import toast from 'react-hot-toast';

interface ImageResource {
  id: string;
  name: string;
  status: string;
  size: number;
  disk_format: string;
  container_format: string;
  visibility: string;
  created_at: string;
  updated_at: string;
  min_disk: number;
  min_ram: number;
  protected: boolean;
  description?: string;
}

const ImagesPage: React.FC = () => {
  const [images, setImages] = useState<ImageResource[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await glanceService.getImages();
      setImages(response.images || []);
    } catch (error) {
      console.error('이미지 로딩 실패:', error);
      toast.error('이미지 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('정말로 이 이미지를 삭제하시겠습니까?')) return;
    
    try {
      await glanceService.deleteImage(imageId);
      toast.success('이미지를 삭제했습니다.');
      fetchImages();
    } catch (error) {
      console.error('이미지 삭제 실패:', error);
      toast.error('이미지 삭제에 실패했습니다.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'queued': return 'bg-yellow-100 text-yellow-800';
      case 'saving': return 'bg-blue-100 text-blue-800';
      case 'killed': return 'bg-red-100 text-red-800';
      case 'deleted': return 'bg-gray-100 text-gray-800';
      case 'pending_delete': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return '활성';
      case 'queued': return '대기 중';
      case 'saving': return '저장 중';
      case 'killed': return '중단됨';
      case 'deleted': return '삭제됨';
      case 'pending_delete': return '삭제 대기';
      default: return status;
    }
  };

  const getVisibilityText = (visibility: string) => {
    switch (visibility.toLowerCase()) {
      case 'public': return '공개';
      case 'private': return '비공개';
      case 'shared': return '공유';
      case 'community': return '커뮤니티';
      default: return visibility;
    }
  };

  const formatSize = (size: number) => {
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  useEffect(() => {
    fetchImages();
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
        <h1 className="text-2xl font-bold text-gray-900">이미지</h1>
        <div className="flex space-x-3">
          <button
            onClick={fetchImages}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </button>
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Upload className="h-4 w-4 mr-2" />
            이미지 업로드
          </button>
        </div>
      </div>

      {/* 이미지 목록 */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">이미지 목록</h3>
        </div>
        
        {images.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">생성된 이미지가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">크기</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">포맷</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가시성</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">최소 디스크</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">최소 메모리</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">보호</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">생성일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {images.map((image) => (
                  <tr key={image.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Image className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{image.name}</div>
                          <div className="text-sm text-gray-500">{image.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(image.status)}`}>
                        {getStatusText(image.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {image.size ? formatSize(image.size) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {image.disk_format}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getVisibilityText(image.visibility)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {image.min_disk} GB
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {image.min_ram} MB
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        image.protected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {image.protected ? '보호됨' : '보호 안됨'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(image.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          className="text-blue-600 hover:text-blue-900"
                          title="다운로드"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {!image.protected && (
                          <button
                            onClick={() => handleDeleteImage(image.id)}
                            className="text-red-600 hover:text-red-900"
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
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

export default ImagesPage; 