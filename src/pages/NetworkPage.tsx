import React, { useEffect, useState } from 'react';
import { Network, RefreshCw, Globe, Shield, Router, Plus, Trash2, Edit, Eye, AlertTriangle, Settings, Key, Download } from 'lucide-react';
import { neutronService, novaService } from '../services/openstack';
import { 
  filterNetworksByProject, 
  filterSecurityGroupsByProject,
  isCurrentUserAdmin,
  canAccessAllProjects 
} from '../utils/projectScope';
import { workflowNotifications } from '../utils/notificationHelper';
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

interface SecurityGroup {
  id: string;
  name: string;
  description: string;
  rules: SecurityGroupRule[];
  tenant_id: string;
}

interface SecurityGroupRule {
  id: string;
  direction: 'ingress' | 'egress';
  ethertype: 'IPv4' | 'IPv6';
  protocol: string | null;
  port_range_min: number | null;
  port_range_max: number | null;
  remote_ip_prefix: string | null;
  remote_group_id: string | null;
  security_group_id: string;
}

interface KeyPair {
  name: string;
  public_key: string;
  fingerprint: string;
  type: string;
}

// 사전 정의된 서비스 포트
const PREDEFINED_SERVICES = [
  { name: 'HTTP', protocol: 'tcp', port: 80 },
  { name: 'HTTPS', protocol: 'tcp', port: 443 },
  { name: 'SSH', protocol: 'tcp', port: 22 },
  { name: 'FTP', protocol: 'tcp', port: 21 },
  { name: 'SMTP', protocol: 'tcp', port: 25 },
  { name: 'DNS', protocol: 'tcp', port: 53 },
  { name: 'DNS (UDP)', protocol: 'udp', port: 53 },
  { name: 'DHCP Server', protocol: 'udp', port: 67 },
  { name: 'DHCP Client', protocol: 'udp', port: 68 },
  { name: 'POP3', protocol: 'tcp', port: 110 },
  { name: 'IMAP', protocol: 'tcp', port: 143 },
  { name: 'SNMP', protocol: 'udp', port: 161 },
  { name: 'LDAP', protocol: 'tcp', port: 389 },
  { name: 'HTTPS Alt', protocol: 'tcp', port: 8443 },
  { name: 'MySQL', protocol: 'tcp', port: 3306 },
  { name: 'PostgreSQL', protocol: 'tcp', port: 5432 },
  { name: 'Redis', protocol: 'tcp', port: 6379 },
  { name: 'MongoDB', protocol: 'tcp', port: 27017 },
  { name: 'RDP', protocol: 'tcp', port: 3389 },
  { name: 'VNC', protocol: 'tcp', port: 5900 },
  { name: 'Custom', protocol: '', port: null }
];

interface RuleFormData {
  direction: 'ingress' | 'egress';
  ethertype: 'IPv4' | 'IPv6';
  protocol: string;
  serviceType: 'predefined' | 'custom';
  predefinedService: string;
  portRangeMin: number | null;
  portRangeMax: number | null;
  sourceType: 'cidr' | 'group' | 'anywhere';
  sourceValue: string;
}

const NetworkPage: React.FC = () => {
  const [networks, setNetworks] = useState<NetworkResource[]>([]);
  const [subnets, setSubnets] = useState<any[]>([]);
  const [routers, setRouters] = useState<any[]>([]);
  const [securityGroups, setSecurityGroups] = useState<SecurityGroup[]>([]);
  const [keyPairs, setKeyPairs] = useState<KeyPair[]>([]);
  const [selectedSecurityGroup, setSelectedSecurityGroup] = useState<SecurityGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'networks' | 'subnets' | 'routers' | 'security-groups' | 'keypairs'>('networks');
  const [showCreateSGModal, setShowCreateSGModal] = useState(false);
  const [showCreateRuleModal, setShowCreateRuleModal] = useState(false);
  const [showEditRuleModal, setShowEditRuleModal] = useState(false);
  const [showCreateKeyPairModal, setShowCreateKeyPairModal] = useState(false);
  const [editingRule, setEditingRule] = useState<SecurityGroupRule | null>(null);
  const [ruleFormData, setRuleFormData] = useState<RuleFormData>({
    direction: 'ingress',
    ethertype: 'IPv4',
    protocol: '',
    serviceType: 'predefined',
    predefinedService: 'HTTP',
    portRangeMin: null,
    portRangeMax: null,
    sourceType: 'cidr',
    sourceValue: '0.0.0.0/0'
  });

  const fetchNetworkData = async () => {
    try {
      setLoading(true);
      
      // 각 API 호출을 개별적으로 처리하여 일부 실패해도 전체가 실패하지 않도록 함
      const [networksResult, subnetsResult, routersResult, securityGroupsResult, keyPairsResult] = await Promise.allSettled([
        neutronService.getNetworks(),
        neutronService.getSubnets(),
        neutronService.getRouters(),
        neutronService.getSecurityGroups(),
        novaService.getKeyPairs()
      ]);

      // 성공한 데이터만 추출
      const networksData = networksResult.status === 'fulfilled' ? networksResult.value : { networks: [] };
      const subnetsData = subnetsResult.status === 'fulfilled' ? subnetsResult.value : { subnets: [] };
      const routersData = routersResult.status === 'fulfilled' ? routersResult.value : { routers: [] };
      const securityGroupsData = securityGroupsResult.status === 'fulfilled' ? securityGroupsResult.value : { security_groups: [] };
      const keyPairsData = keyPairsResult.status === 'fulfilled' ? keyPairsResult.value : { keypairs: [] };
      
      // 실패한 API 로깅
      if (networksResult.status === 'rejected') console.error('네트워크 데이터 로딩 실패:', networksResult.reason);
      if (subnetsResult.status === 'rejected') console.error('서브넷 데이터 로딩 실패:', subnetsResult.reason);
      if (routersResult.status === 'rejected') console.error('라우터 데이터 로딩 실패:', routersResult.reason);
      if (securityGroupsResult.status === 'rejected') console.error('보안그룹 데이터 로딩 실패:', securityGroupsResult.reason);
      if (keyPairsResult.status === 'rejected') console.error('키페어 데이터 로딩 실패:', keyPairsResult.reason);
      
      // 프로젝트별 필터링 적용
      const allNetworks = networksData.networks || [];
      const allSecurityGroups = securityGroupsData.security_groups || [];
      const allKeyPairs = (keyPairsData.keypairs || []).map((kp: any) => kp.keypair || kp);
      
      const filteredNetworks = filterNetworksByProject(allNetworks);
      const filteredSecurityGroups = filterSecurityGroupsByProject(allSecurityGroups);
      
      console.log('전체 네트워크:', allNetworks.length, '필터링된 네트워크:', filteredNetworks.length);
      console.log('전체 보안그룹:', allSecurityGroups.length, '필터링된 보안그룹:', filteredSecurityGroups.length);
      console.log('전체 키페어:', allKeyPairs.length);
      console.log('현재 사용자가 관리자인가?', isCurrentUserAdmin());
      console.log('모든 프로젝트 접근 가능한가?', canAccessAllProjects());
      
      setNetworks(filteredNetworks);
      setSubnets(subnetsData.subnets || []); // 서브넷은 네트워크에 종속되므로 별도 필터링 불필요
      setRouters(routersData.routers || []); // 라우터도 마찬가지
      setSecurityGroups(filteredSecurityGroups);
      setKeyPairs(allKeyPairs); // 키페어는 사용자별 리소스이므로 별도 필터링 불필요
    } catch (error) {
      console.error('네트워크 데이터 로딩 실패:', error);
      toast.error('네트워크 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworkData();
  }, []);

  const handleCreateSecurityGroup = async (name: string, description: string) => {
    try {
      const securityGroupData = {
        security_group: {
          name: name,
          description: description
        }
      };
      
      await neutronService.createSecurityGroup(securityGroupData);
      toast.success('보안그룹을 생성했습니다.');
      setShowCreateSGModal(false);
      fetchNetworkData();
    } catch (error) {
      console.error('보안그룹 생성 실패:', error);
      toast.error('보안그룹 생성에 실패했습니다.');
    }
  };

  const handleDeleteSecurityGroup = async (sgId: string, sgName: string) => {
    if (!confirm(`정말로 보안그룹 "${sgName}"을(를) 삭제하시겠습니까?`)) return;
    
    try {
      await neutronService.deleteSecurityGroup(sgId);
      toast.success('보안그룹을 삭제했습니다.');
      setSelectedSecurityGroup(null);
      fetchNetworkData();
    } catch (error) {
      console.error('보안그룹 삭제 실패:', error);
      toast.error('보안그룹 삭제에 실패했습니다.');
    }
  };

  const resetRuleForm = () => {
    setRuleFormData({
      direction: 'ingress',
      ethertype: 'IPv4',
      protocol: '',
      serviceType: 'predefined',
      predefinedService: 'HTTP',
      portRangeMin: null,
      portRangeMax: null,
      sourceType: 'cidr',
      sourceValue: '0.0.0.0/0'
    });
  };

  const handleCreateRule = async () => {
    if (!selectedSecurityGroup) return;

    try {
      let protocol = ruleFormData.protocol;
      let portMin = ruleFormData.portRangeMin;
      let portMax = ruleFormData.portRangeMax;

      // 사전 정의된 서비스 사용 시
      if (ruleFormData.serviceType === 'predefined' && ruleFormData.predefinedService !== 'Custom') {
        const service = PREDEFINED_SERVICES.find(s => s.name === ruleFormData.predefinedService);
        if (service) {
          protocol = service.protocol;
          portMin = service.port;
          portMax = service.port;
        }
      }

      // 소스 설정
      let remoteIpPrefix = null;
      let remoteGroupId = null;

      switch (ruleFormData.sourceType) {
        case 'cidr':
          remoteIpPrefix = ruleFormData.sourceValue;
          break;
        case 'group':
          remoteGroupId = ruleFormData.sourceValue;
          break;
        case 'anywhere':
          remoteIpPrefix = ruleFormData.ethertype === 'IPv4' ? '0.0.0.0/0' : '::/0';
          break;
      }

      const ruleData = {
        security_group_rule: {
          direction: ruleFormData.direction,
          ethertype: ruleFormData.ethertype,
          protocol: protocol || null,
          port_range_min: portMin,
          port_range_max: portMax,
          remote_ip_prefix: remoteIpPrefix,
          remote_group_id: remoteGroupId,
          security_group_id: selectedSecurityGroup.id
        }
      };
      
      await neutronService.createSecurityGroupRule(ruleData);
      toast.success('보안규칙을 추가했습니다.');
      setShowCreateRuleModal(false);
      resetRuleForm();
      fetchNetworkData();
      
      // 선택된 보안그룹 정보 업데이트
      const updatedSGs = await neutronService.getSecurityGroups();
      const updatedSG = updatedSGs.security_groups?.find((sg: SecurityGroup) => sg.id === selectedSecurityGroup.id);
      if (updatedSG) setSelectedSecurityGroup(updatedSG);
    } catch (error) {
      console.error('보안규칙 생성 실패:', error);
      toast.error('보안규칙 생성에 실패했습니다.');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('정말로 이 보안규칙을 삭제하시겠습니까?')) return;
    
    try {
      await neutronService.deleteSecurityGroupRule(ruleId);
      toast.success('보안규칙을 삭제했습니다.');
      fetchNetworkData();
      
      // 선택된 보안그룹 정보 업데이트
      if (selectedSecurityGroup) {
        const updatedSGs = await neutronService.getSecurityGroups();
        const updatedSG = updatedSGs.security_groups?.find((sg: SecurityGroup) => sg.id === selectedSecurityGroup.id);
        if (updatedSG) setSelectedSecurityGroup(updatedSG);
      }
    } catch (error) {
      console.error('보안규칙 삭제 실패:', error);
      toast.error('보안규칙 삭제에 실패했습니다.');
    }
  };

  // 키페어 관련 함수들
  const handleCreateKeyPair = async (name: string) => {
    try {
      const trimmedName = name.trim();
      
      // OpenStack Nova 키페어 이름 규칙 검증 (더 엄격한 규칙)
      if (!trimmedName || trimmedName.length === 0) {
        toast.error('키페어 이름을 입력해주세요.');
        return;
      }
      
      // 길이 제한 (더 보수적으로)
      if (trimmedName.length < 1 || trimmedName.length > 64) {
        toast.error('키페어 이름은 1~64자 사이여야 합니다.');
        return;
      }
      
      // 더 엄격한 패턴: 영문자로 시작, 영문/숫자/하이픈/언더스코어만 허용
      const strictPattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
      if (!strictPattern.test(trimmedName)) {
        toast.error('키페어 이름은 영문자로 시작하고, 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.');
        return;
      }
      
      // 연속된 특수문자 금지
      if (/-{2,}|_{2,}/.test(trimmedName)) {
        toast.error('연속된 특수문자는 사용할 수 없습니다.');
        return;
      }
      
      // 시작/끝이 특수문자인 경우 금지
      if (trimmedName.startsWith('-') || trimmedName.startsWith('_') || 
          trimmedName.endsWith('-') || trimmedName.endsWith('_')) {
        toast.error('키페어 이름의 시작과 끝에는 특수문자를 사용할 수 없습니다.');
        return;
      }
      
      // 중복 키페어 이름 검사
      if (keyPairs.some(kp => kp.name === trimmedName)) {
        toast.error('이미 존재하는 키페어 이름입니다.');
        return;
      }
      
      // type 필드를 제거하고 name만 전송
      const newKeyPair = await novaService.createKeyPair({
        name: trimmedName
      });
      
      if (!newKeyPair || !newKeyPair.keypair) {
        throw new Error('키페어 생성 응답이 올바르지 않습니다.');
      }
      
      // 목록에 새 키페어 추가
      setKeyPairs(prev => [...prev, newKeyPair.keypair]);
      
      // 개인키 다운로드
      if (newKeyPair.keypair.private_key) {
        const blob = new Blob([newKeyPair.keypair.private_key], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${trimmedName}.pem`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        workflowNotifications.keyPairCreated(trimmedName);
      } else {
        workflowNotifications.keyPairCreated(trimmedName);
      }
      
      setShowCreateKeyPairModal(false);
    } catch (error: any) {
      console.error('키페어 생성 실패:', error);
      
      let errorMessage = '키페어 생성에 실패했습니다.';
      
      // API 응답에서 더 구체적인 오류 메시지 추출
      if (error?.response?.data?.badRequest?.message) {
        errorMessage = `서버 오류: ${error.response.data.badRequest.message}`;
      } else if (error?.response?.data?.message) {
        errorMessage = `서버 오류: ${error.response.data.message}`;
      } else if (error?.response?.status === 409) {
        errorMessage = '이미 존재하는 키페어 이름입니다.';
      } else if (error?.response?.status === 400) {
        errorMessage = '키페어 이름이 올바르지 않거나 요청 형식이 잘못되었습니다.';
      } else if (error?.message) {
        errorMessage = `키페어 생성 실패: ${error.message}`;
      }
      
      toast.error(errorMessage);
    }
  };

  const handleDeleteKeyPair = async (keyPairName: string) => {
    if (!confirm(`정말로 키페어 "${keyPairName}"을(를) 삭제하시겠습니까?`)) return;
    
    try {
      await novaService.deleteKeyPair(keyPairName);
      toast.success('키페어를 삭제했습니다.');
      setKeyPairs(prev => prev.filter(kp => kp.name !== keyPairName));
    } catch (error) {
      console.error('키페어 삭제 실패:', error);
      toast.error('키페어 삭제에 실패했습니다.');
    }
  };

  const openEditRuleModal = (rule: SecurityGroupRule) => {
    setEditingRule(rule);
    
    // 기존 규칙 데이터로 폼 초기화
    const service = PREDEFINED_SERVICES.find(s => 
      s.protocol === rule.protocol && 
      s.port === rule.port_range_min && 
      rule.port_range_min === rule.port_range_max
    );

    setRuleFormData({
      direction: rule.direction,
      ethertype: rule.ethertype,
      protocol: rule.protocol || '',
      serviceType: service ? 'predefined' : 'custom',
      predefinedService: service ? service.name : 'Custom',
      portRangeMin: rule.port_range_min,
      portRangeMax: rule.port_range_max,
      sourceType: rule.remote_group_id ? 'group' : 
                  (rule.remote_ip_prefix === '0.0.0.0/0' || rule.remote_ip_prefix === '::/0') ? 'anywhere' : 'cidr',
      sourceValue: rule.remote_group_id || rule.remote_ip_prefix || '0.0.0.0/0'
    });
    
    setShowEditRuleModal(true);
  };

  const handleUpdateRule = async () => {
    if (!editingRule || !selectedSecurityGroup) return;

    // 기존 규칙 삭제 후 새 규칙 생성 (OpenStack에서 규칙 직접 수정은 지원하지 않음)
    try {
      await neutronService.deleteSecurityGroupRule(editingRule.id);
      await handleCreateRule();
      
      setShowEditRuleModal(false);
      setEditingRule(null);
      toast.success('보안규칙을 수정했습니다.');
    } catch (error) {
      console.error('보안규칙 수정 실패:', error);
      toast.error('보안규칙 수정에 실패했습니다.');
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

  const getRuleTypeColor = (direction: string) => {
    return direction === 'ingress' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-green-100 text-green-800';
  };

  const getProtocolText = (protocol: string | null) => {
    if (!protocol) return 'Any';
    return protocol.toUpperCase();
  };

  const getPortText = (portMin: number | null, portMax: number | null) => {
    if (!portMin && !portMax) return 'Any';
    if (portMin === portMax) return portMin?.toString() || 'Any';
    return `${portMin || ''}-${portMax || ''}`;
  };

  const getSourceText = (rule: SecurityGroupRule) => {
    if (rule.remote_group_id) {
      const sourceGroup = securityGroups.find(sg => sg.id === rule.remote_group_id);
      return sourceGroup ? `그룹: ${sourceGroup.name}` : `그룹 ID: ${rule.remote_group_id}`;
    }
    if (rule.remote_ip_prefix) {
      if (rule.remote_ip_prefix === '0.0.0.0/0') return 'Anywhere (IPv4)';
      if (rule.remote_ip_prefix === '::/0') return 'Anywhere (IPv6)';
      return rule.remote_ip_prefix;
    }
    return 'Any';
  };

  const handleServiceChange = (serviceName: string) => {
    const service = PREDEFINED_SERVICES.find(s => s.name === serviceName);
    if (service && service.name !== 'Custom') {
      setRuleFormData(prev => ({
        ...prev,
        predefinedService: serviceName,
        protocol: service.protocol,
        portRangeMin: service.port,
        portRangeMax: service.port
      }));
    } else {
      setRuleFormData(prev => ({
        ...prev,
        predefinedService: serviceName,
        protocol: '',
        portRangeMin: null,
        portRangeMax: null
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">네트워크 정보를 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">네트워크 관리</h1>
        <button
          onClick={fetchNetworkData}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </button>
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
          <button
            onClick={() => setActiveTab('security-groups')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'security-groups'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Shield className="h-4 w-4 inline mr-2" />
            보안그룹
          </button>
          <button
            onClick={() => setActiveTab('keypairs')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'keypairs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Key className="h-4 w-4 inline mr-2" />
            키페어
          </button>
        </nav>
      </div>

      {/* 네트워크 탭 */}
      {activeTab === 'networks' && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">네트워크 목록</h3>
          </div>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">관리 상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">서브넷 수</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {networks.map((network) => (
                  <tr key={network.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Network className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{network.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{network.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(network.status)}`}>
                        {network.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {network.admin_state_up ? '활성' : '비활성'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {network.subnets.length}개
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 서브넷 탭 */}
      {activeTab === 'subnets' && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">서브넷 목록</h3>
          </div>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">CIDR</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">게이트웨이</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">IP 버전</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {subnets.map((subnet) => (
                  <tr key={subnet.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Globe className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{subnet.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{subnet.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{subnet.cidr}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{subnet.gateway_ip || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">IPv{subnet.ip_version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 라우터 탭 */}
      {activeTab === 'routers' && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">라우터 목록</h3>
          </div>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">관리 상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">외부 게이트웨이</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {routers.map((router) => (
                  <tr key={router.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Router className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{router.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{router.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(router.status)}`}>
                        {router.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {router.admin_state_up ? '활성' : '비활성'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {router.external_gateway_info ? '연결됨' : '연결 안됨'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 보안그룹 탭 */}
      {activeTab === 'security-groups' && (
        <div className="space-y-6">
          {/* 보안그룹 목록 */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">보안그룹 목록</h3>
              <button
                onClick={() => setShowCreateSGModal(true)}
                className="flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                생성
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">이름</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">설명</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">규칙 수</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">작업</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {securityGroups.map((sg) => (
                    <tr key={sg.id} className={`hover:bg-gray-50 ${selectedSecurityGroup?.id === sg.id ? 'bg-blue-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Shield className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{sg.name}</div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">{sg.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={sg.description}>
                          {sg.description || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {sg.rules?.length || 0}개
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedSecurityGroup(sg)}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded hover:bg-blue-200"
                            title="규칙 관리"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            규칙 보기
                          </button>
                          {sg.name !== 'default' && (
                            <button
                              onClick={() => handleDeleteSecurityGroup(sg.id, sg.name)}
                              className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-600 bg-red-100 rounded hover:bg-red-200"
                              title="삭제"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              삭제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {securityGroups.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>보안그룹이 없습니다.</p>
                </div>
              )}
            </div>
          </div>


        </div>
      )}

      {/* 보안그룹 규칙 상세 모달 */}
      {selectedSecurityGroup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="relative p-6 border w-full max-w-6xl mx-4 bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
            {/* 모달 헤더 */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center">
                <Shield className="h-6 w-6 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedSecurityGroup.name} 보안규칙 관리
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedSecurityGroup.description || '설명 없음'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    resetRuleForm();
                    setShowCreateRuleModal(true);
                  }}
                  className="flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  규칙 추가
                </button>
                <button
                  onClick={() => setSelectedSecurityGroup(null)}
                  className="flex items-center px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-400 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>

            {/* 규칙 통계 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">
                  {(selectedSecurityGroup.rules || []).filter(r => r.direction === 'ingress').length}
                </div>
                <div className="text-sm text-blue-600">인바운드 규칙</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-700">
                  {(selectedSecurityGroup.rules || []).filter(r => r.direction === 'egress').length}
                </div>
                <div className="text-sm text-green-600">아웃바운드 규칙</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-700">
                  {(selectedSecurityGroup.rules || []).filter(r => r.protocol === 'tcp').length}
                </div>
                <div className="text-sm text-purple-600">TCP 규칙</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-amber-700">
                  {(selectedSecurityGroup.rules || []).filter(r => r.protocol === 'udp').length}
                </div>
                <div className="text-sm text-amber-600">UDP 규칙</div>
              </div>
            </div>

            {/* 규칙 테이블 */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                <h4 className="text-lg font-medium text-gray-900">보안규칙 목록</h4>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">방향</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP 버전</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">프로토콜</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">포트 범위</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">소스/목적지</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(selectedSecurityGroup.rules || []).map((rule) => (
                      <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getRuleTypeColor(rule.direction)}`}>
                            {rule.direction === 'ingress' ? '인바운드' : '아웃바운드'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                            {rule.ethertype}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {getProtocolText(rule.protocol)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {getPortText(rule.port_range_min, rule.port_range_max)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-48 break-all" title={getSourceText(rule)}>
                            {getSourceText(rule)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => openEditRuleModal(rule)}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                              title="규칙 수정"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-600 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
                              title="규칙 삭제"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {(!selectedSecurityGroup.rules || selectedSecurityGroup.rules.length === 0) && (
                  <div className="text-center py-12 text-gray-500">
                    <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">보안규칙이 없습니다</h4>
                    <p className="text-sm">새로운 보안규칙을 추가하여 네트워크 액세스를 제어하세요.</p>
                    <button
                      onClick={() => {
                        resetRuleForm();
                        setShowCreateRuleModal(true);
                      }}
                      className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      첫 번째 규칙 추가
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 도움말 */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Settings className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                <div>
                  <h5 className="text-sm font-medium text-blue-800 mb-1">보안규칙 팁</h5>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• 인바운드 규칙은 외부에서 인스턴스로 들어오는 트래픽을 제어합니다</li>
                    <li>• 아웃바운드 규칙은 인스턴스에서 외부로 나가는 트래픽을 제어합니다</li>
                    <li>• 포트 범위를 지정하거나 사전 정의된 서비스를 선택할 수 있습니다</li>
                    <li>• CIDR 표기법(예: 192.168.1.0/24)으로 IP 범위를 지정하세요</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 보안그룹 생성 모달 */}
      {showCreateSGModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="relative p-8 border w-full max-w-md mx-auto bg-white rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">보안그룹 생성</h3>
            <div className="mb-4">
              <label htmlFor="sgName" className="block text-sm font-medium text-gray-700 mb-1">
                이름 *
              </label>
              <input
                type="text"
                id="sgName"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="보안그룹 이름"
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="sgDescription" className="block text-sm font-medium text-gray-700 mb-1">
                설명 (선택사항)
              </label>
              <textarea
                id="sgDescription"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="보안그룹에 대한 설명"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCreateSGModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
              >
                취소
              </button>
              <button
                onClick={() => {
                  const nameInput = document.getElementById('sgName') as HTMLInputElement;
                  const descriptionInput = document.getElementById('sgDescription') as HTMLTextAreaElement;
                  handleCreateSecurityGroup(nameInput.value, descriptionInput.value || '');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 보안그룹 규칙 추가/수정 모달 */}
      {(showCreateRuleModal || showEditRuleModal) && selectedSecurityGroup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="relative p-8 border w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {showEditRuleModal ? '보안규칙 수정' : '보안규칙 추가'} - {selectedSecurityGroup.name}
              </h3>
              <button
                onClick={() => {
                  setShowCreateRuleModal(false);
                  setShowEditRuleModal(false);
                  setEditingRule(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <AlertTriangle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 기본 설정 */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 border-b pb-2">기본 설정</h4>
                
                {/* 방향 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">방향 *</label>
                  <select
                    value={ruleFormData.direction}
                    onChange={(e) => setRuleFormData(prev => ({ ...prev, direction: e.target.value as 'ingress' | 'egress' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="ingress">인바운드 (Ingress)</option>
                    <option value="egress">아웃바운드 (Egress)</option>
                  </select>
                </div>

                {/* IP 버전 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IP 버전</label>
                  <select
                    value={ruleFormData.ethertype}
                    onChange={(e) => setRuleFormData(prev => ({ ...prev, ethertype: e.target.value as 'IPv4' | 'IPv6' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="IPv4">IPv4</option>
                    <option value="IPv6">IPv6</option>
                  </select>
                </div>

                {/* 서비스 타입 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">서비스 설정</label>
                  <div className="flex space-x-4 mb-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={ruleFormData.serviceType === 'predefined'}
                        onChange={() => setRuleFormData(prev => ({ ...prev, serviceType: 'predefined' }))}
                        className="mr-2"
                      />
                      사전 정의된 서비스
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={ruleFormData.serviceType === 'custom'}
                        onChange={() => setRuleFormData(prev => ({ ...prev, serviceType: 'custom' }))}
                        className="mr-2"
                      />
                      사용자 정의
                    </label>
                  </div>

                  {ruleFormData.serviceType === 'predefined' && (
                    <select
                      value={ruleFormData.predefinedService}
                      onChange={(e) => handleServiceChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {PREDEFINED_SERVICES.map(service => (
                        <option key={service.name} value={service.name}>
                          {service.name} {service.port && `(${service.protocol?.toUpperCase()}/${service.port})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* 프로토콜 및 포트 설정 */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 border-b pb-2">프로토콜 및 포트</h4>
                
                {(ruleFormData.serviceType === 'custom' || ruleFormData.predefinedService === 'Custom') && (
                  <>
                    {/* 프로토콜 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">프로토콜</label>
                      <select
                        value={ruleFormData.protocol}
                        onChange={(e) => setRuleFormData(prev => ({ ...prev, protocol: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Any</option>
                        <option value="tcp">TCP</option>
                        <option value="udp">UDP</option>
                        <option value="icmp">ICMP</option>
                      </select>
                    </div>

                    {/* 포트 범위 */}
                    {ruleFormData.protocol && ruleFormData.protocol !== 'icmp' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">시작 포트</label>
                          <input
                            type="number"
                            value={ruleFormData.portRangeMin || ''}
                            onChange={(e) => setRuleFormData(prev => ({ 
                              ...prev, 
                              portRangeMin: e.target.value ? parseInt(e.target.value) : null 
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="예: 80"
                            min="1"
                            max="65535"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">종료 포트</label>
                          <input
                            type="number"
                            value={ruleFormData.portRangeMax || ''}
                            onChange={(e) => setRuleFormData(prev => ({ 
                              ...prev, 
                              portRangeMax: e.target.value ? parseInt(e.target.value) : null 
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="예: 80"
                            min="1"
                            max="65535"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 현재 설정 요약 */}
                {ruleFormData.serviceType === 'predefined' && ruleFormData.predefinedService !== 'Custom' && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <h5 className="font-medium text-blue-900 mb-1">현재 설정:</h5>
                    <p className="text-sm text-blue-800">
                      프로토콜: {ruleFormData.protocol?.toUpperCase() || 'Any'}
                      {ruleFormData.portRangeMin && (
                        <>, 포트: {ruleFormData.portRangeMin}
                        {ruleFormData.portRangeMax !== ruleFormData.portRangeMin && `-${ruleFormData.portRangeMax}`}</>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 소스/목적지 설정 */}
            <div className="mt-6 space-y-4">
              <h4 className="font-medium text-gray-900 border-b pb-2">
                {ruleFormData.direction === 'ingress' ? '소스' : '목적지'} 설정
              </h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">타입</label>
                <div className="grid grid-cols-3 gap-3">
                  <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      checked={ruleFormData.sourceType === 'anywhere'}
                      onChange={() => setRuleFormData(prev => ({ 
                        ...prev, 
                        sourceType: 'anywhere',
                        sourceValue: prev.ethertype === 'IPv4' ? '0.0.0.0/0' : '::/0'
                      }))}
                      className="mr-2"
                    />
                    <div>
                      <div className="font-medium">Anywhere</div>
                      <div className="text-xs text-gray-500">모든 IP</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      checked={ruleFormData.sourceType === 'cidr'}
                      onChange={() => setRuleFormData(prev => ({ ...prev, sourceType: 'cidr' }))}
                      className="mr-2"
                    />
                    <div>
                      <div className="font-medium">CIDR</div>
                      <div className="text-xs text-gray-500">IP 주소/범위</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      checked={ruleFormData.sourceType === 'group'}
                      onChange={() => setRuleFormData(prev => ({ ...prev, sourceType: 'group' }))}
                      className="mr-2"
                    />
                    <div>
                      <div className="font-medium">보안그룹</div>
                      <div className="text-xs text-gray-500">다른 그룹</div>
                    </div>
                  </label>
                </div>
              </div>

              {ruleFormData.sourceType === 'cidr' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CIDR 표기법 (예: 192.168.1.0/24, 10.0.0.1/32)
                  </label>
                  <input
                    type="text"
                    value={ruleFormData.sourceValue}
                    onChange={(e) => setRuleFormData(prev => ({ ...prev, sourceValue: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="예: 192.168.1.0/24"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    단일 IP의 경우 /32 (IPv4) 또는 /128 (IPv6)를 사용하세요.
                  </p>
                </div>
              )}

              {ruleFormData.sourceType === 'group' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">보안그룹 선택</label>
                  <select
                    value={ruleFormData.sourceValue}
                    onChange={(e) => setRuleFormData(prev => ({ ...prev, sourceValue: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">보안그룹을 선택하세요</option>
                    {securityGroups.map(sg => (
                      <option key={sg.id} value={sg.id}>
                        {sg.name} ({sg.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex justify-end space-x-3 mt-8 pt-6 border-t">
              <button
                onClick={() => {
                  setShowCreateRuleModal(false);
                  setShowEditRuleModal(false);
                  setEditingRule(null);
                  resetRuleForm();
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
              >
                취소
              </button>
              <button
                onClick={showEditRuleModal ? handleUpdateRule : handleCreateRule}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {showEditRuleModal ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 키페어 탭 */}
      {activeTab === 'keypairs' && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">키페어 목록</h3>
            <button
              onClick={() => setShowCreateKeyPairModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              키페어 생성
            </button>
          </div>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">타입</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">지문</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">작업</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {keyPairs.map((keyPair) => (
                  <tr key={keyPair.name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Key className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{keyPair.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {keyPair.type || 'ssh'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100 font-mono">{keyPair.fingerprint}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDeleteKeyPair(keyPair.name)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ml-4"
                        title="키페어 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {keyPairs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      등록된 키페어가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 키페어 생성 모달 */}
      {showCreateKeyPairModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">키페어 생성</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const name = formData.get('kp_name') as string;
                
                if (!name || name.trim() === '') {
                  toast.error('키페어 이름을 입력해주세요.');
                  return;
                }
                
                await handleCreateKeyPair(name);
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">키페어 이름</label>
                  <input
                    type="text"
                    name="kp_name"
                    placeholder="예: my-keypair"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    영문자로 시작하고, 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다. (1~64자)
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateKeyPairModal(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkPage; 