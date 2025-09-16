import React, { useEffect, useState, useCallback } from 'react';
import { useKeystoneAuthStore } from '../store/keystoneAuth';
import { CreateUserRequest } from '../services/keystone';
import { 
  Users, 
  UserPlus, 
  Building, 
  Plus, 
  Trash2, 
  Settings,
  Crown, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Calendar,
  Mail,
  User as UserIcon,
  Link as LinkIcon,
  Eye,
  EyeOff,
  FolderPlus,
  Building2,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdminManagementPage: React.FC = () => {
  const {
    allUsers,
    allProjects,
    availableProjects,
    loading,
    error,
    isAdmin,
    loadUsers,
    loadProjects,
    createUser,
    deleteUser,
    createProject,
    deleteProject,
    assignUserToProject,
    approveUser,
    rejectUser,
    loadPendingUsers,
    clearError
  } = useKeystoneAuthStore();

  const [activeTab, setActiveTab] = useState<'users' | 'projects' | 'assignments'>('users');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'user' | 'project'; id: string; name: string } | null>(null);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);

  // 사용자 생성 폼
  const [createUserForm, setCreateUserForm] = useState<CreateUserRequest & { projectName?: string; createProject?: boolean }>({
    name: '',
    password: '',
    email: '',
    description: '',
    projectName: '',
    createProject: true
  });

  // 프로젝트 생성 폼
  const [createProjectForm, setCreateProjectForm] = useState({
    name: '',
    description: ''
  });

  // 할당 폼
  const [assignForm, setAssignForm] = useState({
    userId: '',
    projectId: ''
  });

  // 대기 중인 사용자 로드 함수를 외부로 분리
  const loadPendingData = () => {
    try {
      console.log('🔍 관리자 페이지에서 파일 기반 대기 사용자 로드 시작');
      const pending = loadPendingUsers();
      console.log('🔍 파일에서 로드된 대기 중인 사용자:', pending);
      setPendingUsers(pending);
      console.log('🔍 pendingUsers state 업데이트 완료');
    } catch (error) {
      console.error('파일 기반 대기 사용자 로드 실패:', error);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      loadProjects();
      loadPendingData();
    }
  }, [isAdmin]);

  // 주기적으로 대기 중인 사용자 목록 새로고침 (30초마다)
  useEffect(() => {
    if (!isAdmin) return;

    const interval = setInterval(() => {
      console.log('🔄 주기적 대기 중인 사용자 목록 새로고침');
      loadPendingData();
    }, 30000); // 30초마다

    return () => clearInterval(interval);
  }, [isAdmin]);

  // 페이지가 포커스될 때마다 새로고침
  useEffect(() => {
    if (!isAdmin) return;

    const handleFocus = () => {
      console.log('🔄 페이지 포커스로 인한 대기 중인 사용자 목록 새로고침');
      loadPendingData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isAdmin]);



  useEffect(() => {
    if (error) {
      // 재시도 관련 에러는 다른 스타일로 표시
      if (error.includes('최대 재시도 횟수 초과')) {
        toast.error(error, {
          duration: 5000,
          style: {
            background: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca'
          }
        });
      } else {
        toast.error(error);
      }
      clearError();
    }
  }, [error, clearError]);

  // pendingUsers 상태 변경 추적
  useEffect(() => {
    console.log('🔍 pendingUsers 상태 변경:', pendingUsers);
  }, [pendingUsers]);

  // 사용자 승인
  const handleApproveUser = async (userId: string, userName: string) => {
    try {
      await approveUser(userId);
      toast.success(`${userName} 사용자가 승인되었습니다.`);
      // 대기 중인 사용자 목록 새로고침
      loadPendingData();
    } catch (error) {
      toast.error('사용자 승인에 실패했습니다.');
    }
  };

  // 사용자 거부 (삭제)
  const handleRejectUser = async (userId: string, userName: string) => {
    try {
      await rejectUser(userId);
      toast.success(`${userName} 사용자 요청이 거부되었습니다.`);
      // 대기 중인 사용자 목록 새로고침
      loadPendingData();
    } catch (error) {
      toast.error('사용자 거부에 실패했습니다.');
    }
  };

  // JSON 파일 업로드 처리
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        
        // 단일 사용자 객체인지 확인
        if (jsonData.id && jsonData.username && jsonData.name) {
          // 기존 대기 사용자 목록 가져오기
          const existingUsers = JSON.parse(localStorage.getItem('pending-users') || '[]');
          
          // 중복 확인
          const isDuplicate = existingUsers.some((user: any) => user.id === jsonData.id || user.username === jsonData.username);
          
          if (isDuplicate) {
            toast.error(`사용자 "${jsonData.username}"이 이미 대기열에 있습니다.`);
            return;
          }
          
          // 대기열에 추가
          const updatedUsers = [...existingUsers, jsonData];
          localStorage.setItem('pending-users', JSON.stringify(updatedUsers));
          
          // 화면 새로고침
          loadPendingData();
          
          toast.success(`${jsonData.name} (${jsonData.username}) 사용자가 대기열에 추가되었습니다.`);
        } else {
          toast.error('올바른 회원가입 요청 파일이 아닙니다.');
        }
      } catch (error) {
        toast.error('JSON 파일을 읽는데 실패했습니다.');
      }
    };
    
    reader.readAsText(file);
    
    // 파일 input 초기화
    event.target.value = '';
  };

  // 관리자가 아닌 경우 접근 제한
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">관리자 권한이 필요합니다</h2>
          <p className="text-gray-600">이 페이지는 OpenStack 관리자만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createUserForm.name.trim()) {
      toast.error('사용자명을 입력해주세요.');
      return;
    }
    
    if (!createUserForm.password.trim()) {
      toast.error('비밀번호를 입력해주세요.');
      return;
    }
    
    try {
      const userData: CreateUserRequest = {
        name: createUserForm.name.trim(),
        password: createUserForm.password,
        email: createUserForm.email?.trim() || undefined,
        description: createUserForm.description?.trim() || undefined
      };

      const projectName = createUserForm.createProject && createUserForm.projectName?.trim() 
        ? createUserForm.projectName.trim() 
        : undefined;

      const result = await createUser(userData, projectName);
      
      toast.success(
        `사용자 "${result.user.name}"가 생성되었습니다.` +
        (result.project ? ` 프로젝트 "${result.project.name}"도 함께 생성되었습니다.` : '')
      );
      
      // 폼 초기화
      setCreateUserForm({
        name: '',
        password: '',
        email: '',
        description: '',
        projectName: '',
        createProject: true
      });
      
      setShowCreateUserModal(false);
    } catch (error) {
      toast.error('사용자 생성에 실패했습니다.');
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createProjectForm.name.trim()) {
      toast.error('프로젝트명을 입력해주세요.');
      return;
    }
    
    try {
      const result = await createProject({
        name: createProjectForm.name.trim(),
        description: createProjectForm.description?.trim()
      });
      
      toast.success(`프로젝트 "${result.name}"가 생성되었습니다.`);
      
      // 폼 초기화
      setCreateProjectForm({
        name: '',
        description: ''
      });
      
      setShowCreateProjectModal(false);
    } catch (error) {
      toast.error('프로젝트 생성에 실패했습니다.');
    }
  };

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!assignForm.userId || !assignForm.projectId) {
      toast.error('사용자와 프로젝트를 모두 선택해주세요.');
      return;
    }
    
    try {
      await assignUserToProject(assignForm.userId, assignForm.projectId);
      
      const user = allUsers.find(u => u.id === assignForm.userId);
      const project = allProjects.find(p => p.id === assignForm.projectId);
      
      toast.success(`사용자 "${user?.name}"가 프로젝트 "${project?.name}"에 할당되었습니다.`);
      
      // 폼 초기화
      setAssignForm({
        userId: '',
        projectId: ''
      });
      
      setShowAssignModal(false);
    } catch (error) {
      toast.error('사용자 할당에 실패했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    
    try {
      if (confirmDelete.type === 'user') {
        await deleteUser(confirmDelete.id);
        toast.success(`사용자 "${confirmDelete.name}"가 삭제되었습니다.`);
      } else {
        await deleteProject(confirmDelete.id);
        toast.success(`프로젝트 "${confirmDelete.name}"가 삭제되었습니다.`);
      }
      setConfirmDelete(null);
    } catch (error) {
      toast.error(`${confirmDelete.type === 'user' ? '사용자' : '프로젝트'} 삭제에 실패했습니다.`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Crown className="h-8 w-8 mr-3 text-purple-600" />
            시스템 관리
          </h1>
          <p className="mt-2 text-gray-600">
            OpenStack 사용자, 프로젝트 및 권한을 관리합니다.
          </p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">전체 사용자</p>
                <p className="text-2xl font-bold text-gray-900">{allUsers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Building2 className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">전체 프로젝트</p>
                <p className="text-2xl font-bold text-gray-900">{allProjects.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">활성 프로젝트</p>
                <p className="text-2xl font-bold text-gray-900">
                  {allProjects.filter(p => p.enabled).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-6 text-sm font-medium ${
                  activeTab === 'users'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="h-4 w-4 inline mr-2" />
                사용자 관리 ({allUsers.length})
              </button>
              <button
                onClick={() => setActiveTab('projects')}
                className={`py-4 px-6 text-sm font-medium ${
                  activeTab === 'projects'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Building2 className="h-4 w-4 inline mr-2" />
                프로젝트 관리 ({allProjects.length})
              </button>
              <button
                onClick={() => setActiveTab('assignments')}
                className={`py-4 px-6 text-sm font-medium ${
                  activeTab === 'assignments'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LinkIcon className="h-4 w-4 inline mr-2" />
                권한 할당
              </button>
            </nav>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* 사용자 관리 탭 */}
                {activeTab === 'users' && (
                  <div className="space-y-6">
                    {/* 승인 대기 중인 사용자 섹션 */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                          <h3 className="text-lg font-medium text-yellow-800">
                            승인 대기 중인 사용자 ({pendingUsers.length}명)
                          </h3>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={loadPendingData}
                            className="flex items-center px-3 py-1 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            새로고침
                          </button>
                          <label className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer">
                            <UserPlus className="h-4 w-4 mr-1" />
                            JSON 업로드
                            <input
                              type="file"
                              accept=".json"
                              className="hidden"
                              onChange={handleFileUpload}
                            />
                          </label>
                        </div>
                      </div>
                      {pendingUsers.length > 0 ? (
                        <div className="space-y-3">
                          {pendingUsers.map((user) => (
                            <div key={user.id} className="bg-white border border-yellow-200 rounded-md p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="bg-yellow-100 rounded-full p-2 mr-3">
                                    <UserIcon className="h-4 w-4 text-yellow-600" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                    <div className="text-sm text-gray-500">{user.username}</div>
                                    <div className="text-xs text-gray-400">
                                      등록일: {new Date(user.registeredAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleApproveUser(user.id, user.name)}
                                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    승인
                                  </button>
                                  <button
                                    onClick={() => handleRejectUser(user.id, user.name)}
                                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                  >
                                    <XCircle className="h-3 w-3 mr-1" />
                                    거부
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-yellow-700">대기 중인 사용자가 없습니다.</p>
                      )}
                    </div>

                    {/* 기존 사용자 목록 */}
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">
                        활성 사용자 목록 ({allUsers.filter(u => u.enabled).length}명)
                      </h3>
                      <button
                        onClick={() => setShowCreateUserModal(true)}
                        className="btn btn-primary flex items-center space-x-1"
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>사용자 생성</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              사용자 정보
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              상태
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              도메인
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              작업
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {allUsers.map((user) => (
                            <tr key={user.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="bg-gray-100 rounded-full p-2 mr-3">
                                    <UserIcon className="h-5 w-5 text-gray-600" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {user.name}
                                    </div>
                                    {user.email && (
                                      <div className="text-sm text-gray-500 flex items-center">
                                        <Mail className="h-3 w-3 mr-1" />
                                        {user.email}
                                      </div>
                                    )}
                                    {user.description && (
                                      <div className="text-sm text-gray-500">{user.description}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  user.enabled 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {user.enabled ? (
                                    <>
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      활성
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-3 w-3 mr-1" />
                                      비활성
                                    </>
                                  )}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {user.domain_id}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => setConfirmDelete({ 
                                    type: 'user', 
                                    id: user.id, 
                                    name: user.name 
                                  })}
                                  className="text-red-600 hover:text-red-900"
                                  disabled={loading}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 프로젝트 관리 탭 */}
                {activeTab === 'projects' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">프로젝트 목록</h3>
                      <button
                        onClick={() => setShowCreateProjectModal(true)}
                        className="btn btn-primary flex items-center space-x-1"
                      >
                        <FolderPlus className="h-4 w-4" />
                        <span>프로젝트 생성</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allProjects.map((project) => (
                        <div key={project.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Building2 className="h-5 w-5 text-blue-600" />
                                <h4 className="text-lg font-medium text-gray-900">
                                  {project.name}
                                </h4>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  project.enabled 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {project.enabled ? '활성' : '비활성'}
                                </span>
                              </div>
                              {project.description && (
                                <p className="text-sm text-gray-600 mb-2">
                                  {project.description}
                                </p>
                              )}
                              <div className="text-xs text-gray-500">
                                <div>ID: {project.id}</div>
                                <div>도메인: {project.domain_id}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => setConfirmDelete({ 
                                type: 'project', 
                                id: project.id, 
                                name: project.name 
                              })}
                              className="text-red-600 hover:text-red-900 ml-2"
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 권한 할당 탭 */}
                {activeTab === 'assignments' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">사용자-프로젝트 할당</h3>
                      <button
                        onClick={() => setShowAssignModal(true)}
                        className="btn btn-primary flex items-center space-x-1"
                      >
                        <LinkIcon className="h-4 w-4" />
                        <span>권한 할당</span>
                      </button>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <div className="flex">
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-blue-800">
                            권한 할당 안내
                          </h3>
                          <div className="mt-2 text-sm text-blue-700">
                            <p>• 사용자를 프로젝트에 할당하면 해당 프로젝트의 리소스에 접근할 수 있습니다.</p>
                            <p>• 각 사용자는 여러 프로젝트에 할당될 수 있습니다.</p>
                            <p>• 관리자는 모든 프로젝트에 접근할 수 있습니다.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 사용자 생성 모달 */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <UserPlus className="h-6 w-6 text-blue-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">새 사용자 생성</h3>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사용자명 *
                </label>
                <input
                  type="text"
                  value={createUserForm.name}
                  onChange={(e) => setCreateUserForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input w-full"
                  placeholder="사용자명을 입력하세요"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호 *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={createUserForm.password}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, password: e.target.value }))}
                    className="input w-full pr-10"
                    placeholder="비밀번호를 입력하세요"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일
                </label>
                <input
                  type="email"
                  value={createUserForm.email}
                  onChange={(e) => setCreateUserForm(prev => ({ ...prev, email: e.target.value }))}
                  className="input w-full"
                  placeholder="이메일을 입력하세요 (선택사항)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  value={createUserForm.description}
                  onChange={(e) => setCreateUserForm(prev => ({ ...prev, description: e.target.value }))}
                  className="input w-full"
                  rows={2}
                  placeholder="사용자 설명을 입력하세요 (선택사항)"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="createProject"
                  checked={createUserForm.createProject}
                  onChange={(e) => setCreateUserForm(prev => ({ ...prev, createProject: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor="createProject" className="text-sm text-gray-700">
                  개인 프로젝트 함께 생성
                </label>
              </div>

              {createUserForm.createProject && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    프로젝트명
                  </label>
                  <input
                    type="text"
                    value={createUserForm.projectName}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, projectName: e.target.value }))}
                    className="input w-full"
                    placeholder="프로젝트명을 입력하세요 (비어있으면 사용자명 사용)"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="btn bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 프로젝트 생성 모달 */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <FolderPlus className="h-6 w-6 text-green-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">새 프로젝트 생성</h3>
            </div>
            
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  프로젝트명 *
                </label>
                <input
                  type="text"
                  value={createProjectForm.name}
                  onChange={(e) => setCreateProjectForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input w-full"
                  placeholder="프로젝트명을 입력하세요"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  value={createProjectForm.description}
                  onChange={(e) => setCreateProjectForm(prev => ({ ...prev, description: e.target.value }))}
                  className="input w-full"
                  rows={3}
                  placeholder="프로젝트 설명을 입력하세요 (선택사항)"
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateProjectModal(false)}
                  className="btn bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 권한 할당 모달 */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <LinkIcon className="h-6 w-6 text-purple-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">사용자-프로젝트 할당</h3>
            </div>
            
            <form onSubmit={handleAssignUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사용자 선택 *
                </label>
                <select
                  value={assignForm.userId}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, userId: e.target.value }))}
                  className="input w-full"
                  required
                >
                  <option value="">사용자를 선택하세요</option>
                  {allUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email || user.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  프로젝트 선택 *
                </label>
                <select
                  value={assignForm.projectId}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, projectId: e.target.value }))}
                  className="input w-full"
                  required
                >
                  <option value="">프로젝트를 선택하세요</option>
                  {allProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  사용자에게 선택된 프로젝트의 member 역할이 할당됩니다.
                </p>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="btn bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  할당
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">
                {confirmDelete.type === 'user' ? '사용자' : '프로젝트'} 삭제
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              정말로 {confirmDelete.type === 'user' ? '사용자' : '프로젝트'} "{confirmDelete.name}"를 
              삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="btn bg-red-600 text-white hover:bg-red-700"
                disabled={loading}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagementPage; 