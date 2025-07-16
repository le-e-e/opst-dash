import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  ArrowLeft,
  Server,
  Image as ImageIcon,
  Cpu,
  Network,
  HardDrive,
  Shield,
  Key,
  Settings,
  Plus,
  Trash2,
  Info,
  Check,
  X
} from 'lucide-react';
import { novaService, neutronService, glanceService, cinderService } from '../services/openstack';
import toast from 'react-hot-toast';

interface CreateInstanceForm {
  name: string;
  description?: string;
  image_ref: string;
  flavor_ref: string;
  networks: { uuid: string; fixed_ip?: string }[];
  security_groups: string[];
  key_name?: string;
  availability_zone?: string;
  user_data?: string;
  metadata: { [key: string]: string };
  boot_source: 'image' | 'volume' | 'snapshot';
  volume_size?: number;
  volume_type?: string;
  delete_on_termination: boolean;
  auto_assign_floating_ip: boolean;
}

interface Image {
  id: string;
  name: string;
  status: string;
  size?: number;
  disk_format: string;
  container_format: string;
  visibility: string;
  min_disk: number;
  min_ram: number;
}

interface Flavor {
  id: string;
  name: string;
  vcpus: number;
  ram: number;
  disk: number;
  swap?: number;
  ephemeral?: number;
}

interface NetworkInfo {
  id: string;
  name: string;
  status: string;
  subnets: any[];
}

interface SecurityGroup {
  id: string;
  name: string;
  description: string;
}

interface KeyPair {
  name: string;
  fingerprint: string;
  public_key: string;
}

const CreateInstancePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // 데이터 상태
  const [images, setImages] = useState<Image[]>([]);
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [securityGroups, setSecurityGroups] = useState<SecurityGroup[]>([]);
  const [keyPairs, setKeyPairs] = useState<KeyPair[]>([]);
  const [availabilityZones, setAvailabilityZones] = useState<string[]>([]);
  const [volumeTypes, setVolumeTypes] = useState<any[]>([]);

  const [showCreateSecurityGroup, setShowCreateSecurityGroup] = useState(false);
  const [showCreateKeyPair, setShowCreateKeyPair] = useState(false);

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateInstanceForm>({
    defaultValues: {
      name: '',
      description: '',
      networks: [],
      security_groups: ['default'],
      metadata: {},
      boot_source: 'image',
      delete_on_termination: true,
      availability_zone: 'nova',
      auto_assign_floating_ip: false
    }
  });

  const bootSource = watch('boot_source');
  const selectedImage = watch('image_ref');
  const selectedFlavor = watch('flavor_ref');

  // 데이터 로딩
  const loadData = async () => {
    try {
      setLoading(true);
      const [
        imagesData,
        flavorsData,
        networksData,
        securityGroupsData,
        keyPairsData,
        availabilityZonesData,
        volumeTypesData
      ] = await Promise.all([
        glanceService.getImages(),
        novaService.getFlavors(),
        neutronService.getNetworks(),
        neutronService.getSecurityGroups(),
        novaService.getKeyPairs(),
        novaService.getAvailabilityZones(),
        cinderService.getVolumeTypes()
      ]);

      setImages(imagesData.images?.filter((img: Image) => img.status === 'active') || []);
      setFlavors(flavorsData.flavors || []);
      setNetworks(networksData.networks || []);
      setSecurityGroups(securityGroupsData.security_groups || []);
      setKeyPairs(keyPairsData.keypairs?.map((kp: any) => kp.keypair) || []);
      setAvailabilityZones(availabilityZonesData.availabilityZoneInfo?.map((az: any) => az.zoneName) || ['nova']);
      setVolumeTypes(volumeTypesData.volume_types || []);

      // internal-net 찾아서 기본 네트워크로 설정
      const internalNet = networksData.networks?.find((net: any) => net.name === 'internal-net');
      if (internalNet) {
        setValue('networks', [{ uuid: internalNet.id }]);
      } else if (networksData.networks?.length > 0) {
        // internal-net이 없으면 첫 번째 네트워크 사용
        setValue('networks', [{ uuid: networksData.networks[0].id }]);
      }
      if (availabilityZonesData.availabilityZoneInfo?.length > 0) {
        setValue('availability_zone', availabilityZonesData.availabilityZoneInfo[0].zoneName);
      }
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
      toast.error('초기 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: CreateInstanceForm) => {
    try {
      setCreating(true);

      // 네트워크 설정
      const networks = data.networks.map(net => ({
        uuid: net.uuid,
        ...(net.fixed_ip && { fixed_ip: net.fixed_ip })
      }));

      // 보안 그룹 설정
      const security_groups = data.security_groups.map(sg => ({ name: sg }));

      // 부트 소스에 따른 설정
      let bootConfig: any = {};
      
      if (data.boot_source === 'image') {
        bootConfig = {
          imageRef: data.image_ref
        };
      } else if (data.boot_source === 'volume') {
        // 볼륨에서 부팅하는 경우
        bootConfig = {
          block_device_mapping_v2: [{
            source_type: 'image',
            destination_type: 'volume',
            uuid: data.image_ref,
            volume_size: data.volume_size,
            delete_on_termination: data.delete_on_termination,
            ...(data.volume_type && { volume_type: data.volume_type })
          }]
        };
      }

      const serverData = {
        server: {
          name: data.name,
          flavorRef: data.flavor_ref,
          networks,
          security_groups,
          ...(data.description && { description: data.description }),
          ...(data.key_name && { key_name: data.key_name }),
          availability_zone: 'nova',
          ...(data.user_data && { user_data: btoa(data.user_data) }), // base64 encoding
          ...(Object.keys(data.metadata).length > 0 && { metadata: data.metadata }),
          min_count: 1,
          max_count: 1,
          ...bootConfig
        }
      };

      console.log('Creating instance with data:', serverData);
      
      const response = await novaService.createServer(serverData);
      
      // 유동 IP 자동 할당
      if (data.auto_assign_floating_ip && response.server?.id) {
        // 백그라운드에서 유동 IP 할당 처리
        (async () => {
          try {
            // 인스턴스가 ACTIVE 상태가 될 때까지 대기
            let attempts = 0;
            const maxAttempts = 30; // 최대 5분 대기
            
            while (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 10000)); // 10초 대기
              
              try {
                const serverStatus = await novaService.getServer(response.server.id);
                if (serverStatus.server.status === 'ACTIVE') {
                  // 먼저 사용 가능한 유동 IP 찾기
                  const floatingIPs = await neutronService.getFloatingIps();
                  const availableIP = floatingIPs.floatingips?.find((fip: any) => !fip.port_id);
                  
                  let floatingIPAddress = '';
                  
                  if (availableIP) {
                    floatingIPAddress = availableIP.floating_ip_address;
                  } else {
                    // 새로운 유동 IP 생성
                    const networks = await neutronService.getNetworks();
                    const externalNetwork = networks.networks?.find((net: any) => 
                      net['router:external'] === true || net.name.includes('external') || net.name.includes('public')
                    );
                    
                    if (externalNetwork) {
                      const newFloatingIP = await neutronService.createFloatingIP({
                        floating_network_id: externalNetwork.id
                      });
                      if (newFloatingIP.floatingip) {
                        floatingIPAddress = newFloatingIP.floatingip.floating_ip_address;
                      }
                    }
                  }
                  
                  if (floatingIPAddress) {
                    await novaService.attachFloatingIP(response.server.id, floatingIPAddress);
                    toast.success(`유동 IP ${floatingIPAddress}가 자동으로 할당되었습니다.`);
                  } else {
                    toast.error('유동 IP 할당에 실패했습니다: 외부 네트워크를 찾을 수 없습니다.');
                  }
                  break;
                }
              } catch (checkError) {
                console.error('인스턴스 상태 확인 실패:', checkError);
              }
              
              attempts++;
            }
            
            if (attempts >= maxAttempts) {
              toast.error('유동 IP 할당 시간이 초과되었습니다.');
            }
          } catch (ipError) {
            console.error('유동 IP 할당 실패:', ipError);
            toast.error('유동 IP 할당에 실패했습니다.');
          }
        })();
      }
      
      toast.success('가상머신 생성이 시작되었습니다!');
      navigate('/compute');
    } catch (error) {
      console.error('인스턴스 생성 실패:', error);
      toast.error('가상머신 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };



  const addMetadata = () => {
    const currentMetadata = watch('metadata');
    const key = prompt('메타데이터 키를 입력하세요:');
    if (key && !currentMetadata[key]) {
      const value = prompt('메타데이터 값을 입력하세요:');
      if (value) {
        setValue('metadata', { ...currentMetadata, [key]: value });
      }
    }
  };

  const removeMetadata = (key: string) => {
    const currentMetadata = watch('metadata');
    const newMetadata = { ...currentMetadata };
    delete newMetadata[key];
    setValue('metadata', newMetadata);
  };

  const getSelectedImageInfo = () => {
    return images.find(img => img.id === selectedImage);
  };

  const getSelectedFlavorInfo = () => {
    return flavors.find(flavor => flavor.id === selectedFlavor);
  };

  const steps = [
    { id: 1, title: '기본 정보', icon: Server },
    { id: 2, title: '이미지 & 플레이버', icon: ImageIcon },
    { id: 3, title: '네트워크 & 보안', icon: Network },
    { id: 4, title: '고급 설정', icon: Settings },
    { id: 5, title: '검토 & 생성', icon: Check }
  ];

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 min-h-screen pb-20">
      {/* 헤더 */}
      <div className="flex items-center space-x-4">
        <button 
          onClick={() => navigate('/compute')}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">가상머신 생성</h1>
          <p className="text-gray-600">새로운 가상머신 인스턴스를 생성합니다</p>
        </div>
      </div>

      {/* 스텝 표시 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep >= step.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                <step.icon className="h-4 w-4" />
              </div>
              <div className="ml-3 hidden sm:block">
                <p className={`text-sm font-medium ${
                  currentStep >= step.id ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.title}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`ml-3 w-8 h-px ${
                  currentStep > step.id ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 스텝 1: 기본 정보 */}
        {currentStep === 1 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">기본 정보</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  인스턴스 이름 *
                </label>
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: '인스턴스 이름은 필수입니다' }}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      className="input w-full"
                      placeholder="my-instance"
                    />
                  )}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명
                </label>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      className="input w-full"
                      placeholder="인스턴스 설명"
                    />
                  )}
                />
              </div>



              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  가용 영역
                </label>
                <input
                  type="text"
                  value="nova"
                  disabled
                  className="input w-full bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">가용 영역이 nova로 고정되어 있습니다.</p>
              </div>
            </div>
          </div>
        )}

        {/* 스텝 2: 이미지 & 플레이버 */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* 부트 소스 선택 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">부트 소스</h3>
              <Controller
                name="boot_source"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { value: 'image', label: '이미지', desc: '이미지에서 직접 부팅' },
                      { value: 'volume', label: '볼륨', desc: '이미지를 볼륨으로 생성하여 부팅' },
                      { value: 'snapshot', label: '스냅샷', desc: '볼륨 스냅샷에서 부팅' }
                    ].map(option => (
                      <label key={option.value} className="relative">
                        <input
                          type="radio"
                          value={option.value}
                          checked={field.value === option.value}
                          onChange={field.onChange}
                          className="sr-only"
                        />
                        <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          field.value === option.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                          <p className="font-medium">{option.label}</p>
                          <p className="text-sm text-gray-500">{option.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* 이미지 선택 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">이미지 선택</h3>
              <Controller
                name="image_ref"
                control={control}
                rules={{ required: '이미지를 선택해주세요' }}
                render={({ field }) => (
                  <div className="max-h-96 overflow-y-auto border rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {images.map(image => (
                      <label key={image.id} className="relative">
                        <input
                          type="radio"
                          value={image.id}
                          checked={field.value === image.id}
                          onChange={field.onChange}
                          className="sr-only"
                        />
                        <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          field.value === image.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                          <div className="flex items-center mb-2">
                            <ImageIcon className="h-5 w-5 text-gray-400 mr-2" />
                            <p className="font-medium truncate">{image.name}</p>
                          </div>
                          <div className="text-sm text-gray-500 space-y-1">
                            <p>포맷: {image.disk_format}</p>
                            <p>최소 RAM: {image.min_ram}MB</p>
                            <p>최소 디스크: {image.min_disk}GB</p>
                            {image.size && (
                              <p>크기: {(image.size / (1024 * 1024 * 1024)).toFixed(1)}GB</p>
                            )}
                          </div>
                        </div>
                      </label>
                      ))}
                    </div>
                  </div>
                )}
              />
              {errors.image_ref && (
                <p className="mt-2 text-sm text-red-600">{errors.image_ref.message}</p>
              )}
            </div>

            {/* 볼륨 설정 (볼륨 부팅 시) */}
            {bootSource === 'volume' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-6">볼륨 설정</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      볼륨 크기 (GB)
                    </label>
                    <Controller
                      name="volume_size"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          min="1"
                          className="input w-full"
                          placeholder="20"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      볼륨 타입
                    </label>
                    <Controller
                      name="volume_type"
                      control={control}
                      render={({ field }) => (
                        <select {...field} className="input w-full">
                          <option value="">기본값</option>
                          {volumeTypes.map(vt => (
                            <option key={vt.id} value={vt.name}>{vt.name}</option>
                          ))}
                        </select>
                      )}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="flex items-center">
                    <Controller
                      name="delete_on_termination"
                      control={control}
                      render={({ field }) => (
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      )}
                    />
                    <span className="ml-2 text-sm text-gray-700">인스턴스 삭제 시 볼륨도 함께 삭제</span>
                  </label>
                </div>
              </div>
            )}

            {/* 플레이버 선택 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">플레이버 선택</h3>
              <Controller
                name="flavor_ref"
                control={control}
                rules={{ required: '플레이버를 선택해주세요' }}
                render={({ field }) => (
                  <div className="max-h-96 overflow-y-auto border rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {flavors.map(flavor => (
                      <label key={flavor.id} className="relative">
                        <input
                          type="radio"
                          value={flavor.id}
                          checked={field.value === flavor.id}
                          onChange={field.onChange}
                          className="sr-only"
                        />
                        <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          field.value === flavor.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                          <div className="flex items-center mb-2">
                            <Cpu className="h-5 w-5 text-gray-400 mr-2" />
                            <p className="font-medium">{flavor.name}</p>
                          </div>
                          <div className="text-sm text-gray-500 space-y-1">
                            <p>vCPU: {flavor.vcpus}</p>
                            <p>RAM: {flavor.ram}MB ({(flavor.ram / 1024).toFixed(1)}GB)</p>
                            <p>디스크: {flavor.disk}GB</p>
                            {flavor.swap && <p>스왑: {flavor.swap}MB</p>}
                            {flavor.ephemeral && <p>임시: {flavor.ephemeral}GB</p>}
                          </div>
                        </div>
                      </label>
                      ))}
                    </div>
                  </div>
                )}
              />
              {errors.flavor_ref && (
                <p className="mt-2 text-sm text-red-600">{errors.flavor_ref.message}</p>
              )}
            </div>
          </div>
        )}

        {/* 스텝 3: 네트워크 & 보안 */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {/* 네트워크 설정 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">네트워크 설정</h3>
              
              <Controller
                name="networks"
                control={control}
                render={({ field }) => (
                  <div className="space-y-4">
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center">
                        <Network className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">internal-net</p>
                          <p className="text-sm text-gray-500">기본 내부 네트워크 (자동 IP 할당)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              />
              
              {/* 유동 IP 자동 할당 */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Controller
                  name="auto_assign_floating_ip"
                  control={control}
                  render={({ field }) => (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="ml-3">
                        <span className="text-sm font-medium text-gray-700">유동 IP 자동 할당</span>
                        <p className="text-xs text-gray-500">인스턴스 생성 후 자동으로 유동 IP를 할당하고 연결합니다.</p>
                      </div>
                    </label>
                  )}
                />
              </div>
            </div>

            {/* 보안 그룹 */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">보안 그룹</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateSecurityGroup(true)}
                  className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  새로 만들기
                </button>
              </div>
              <Controller
                name="security_groups"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {securityGroups.map(sg => (
                      <label key={sg.id} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={field.value.includes(sg.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // 중복 선택 방지
                              if (!field.value.includes(sg.name)) {
                                field.onChange([...field.value, sg.name]);
                              }
                            } else {
                              field.onChange(field.value.filter(name => name !== sg.name));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-3">
                          <p className="font-medium">{sg.name}</p>
                          <p className="text-sm text-gray-500 truncate">{sg.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* 키 페어 */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">키 페어</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateKeyPair(true)}
                  className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  새로 만들기
                </button>
              </div>
              <Controller
                name="key_name"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <label className="relative">
                      <input
                        type="radio"
                        value=""
                        checked={!field.value}
                        onChange={() => field.onChange('')}
                        className="sr-only"
                      />
                      <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        !field.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <div className="flex items-center">
                          <Key className="h-5 w-5 text-gray-400 mr-2" />
                          <p className="font-medium">키 페어 없음</p>
                        </div>
                      </div>
                    </label>
                    {keyPairs.map(kp => (
                      <label key={kp.name} className="relative">
                        <input
                          type="radio"
                          value={kp.name}
                          checked={field.value === kp.name}
                          onChange={field.onChange}
                          className="sr-only"
                        />
                        <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          field.value === kp.name
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                          <div className="flex items-center mb-2">
                            <Key className="h-5 w-5 text-gray-400 mr-2" />
                            <p className="font-medium truncate">{kp.name}</p>
                          </div>
                          <p className="text-sm text-gray-500 font-mono truncate">
                            {kp.fingerprint}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {/* 스텝 4: 고급 설정 */}
        {currentStep === 4 && (
          <div className="space-y-6">
            {/* 사용자 데이터 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">사용자 데이터</h3>
              <Controller
                name="user_data"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={15}
                    className="input w-full font-mono text-sm"
                    placeholder={`#!/bin/bash
# 패키지 업데이트
apt-get update

# 웹서버 설치
apt-get install -y apache2

# 웹서버 시작
systemctl start apache2
systemctl enable apache2

# 테스트 페이지 생성
echo '<h1>Hello from OpenStack!</h1>' > /var/www/html/index.html`}
                  />
                )}
              />
              <p className="mt-2 text-sm text-gray-500">
                인스턴스 시작 시 실행될 스크립트를 입력하세요 (cloud-init 형식)
              </p>
            </div>

            {/* 메타데이터 */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">메타데이터</h3>
                <button
                  type="button"
                  onClick={addMetadata}
                  className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  메타데이터 추가
                </button>
              </div>
              
              <Controller
                name="metadata"
                control={control}
                render={({ field }) => (
                  <div className="space-y-3">
                    {Object.entries(field.value).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-700">{key}</span>
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-gray-900">{value}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMetadata(key)}
                          className="p-1 text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {Object.keys(field.value).length === 0 && (
                      <p className="text-gray-500 text-center py-4">메타데이터가 없습니다</p>
                    )}
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {/* 스텝 5: 검토 & 생성 */}
        {currentStep === 5 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">설정 검토</h3>
            
            <div className="space-y-6">
              {/* 기본 정보 요약 */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">기본 정보</h4>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">이름</dt>
                    <dd className="text-sm text-gray-900">{watch('name')}</dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">가용 영역</dt>
                    <dd className="text-sm text-gray-900">{watch('availability_zone') || '자동 선택'}</dd>
                  </div>
                </dl>
              </div>

              {/* 이미지 & 플레이버 요약 */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">이미지 & 플레이버</h4>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">이미지</dt>
                    <dd className="text-sm text-gray-900">{getSelectedImageInfo()?.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">플레이버</dt>
                    <dd className="text-sm text-gray-900">{getSelectedFlavorInfo()?.name}</dd>
                  </div>
                </dl>
              </div>

              {/* 네트워크 & 보안 요약 */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">네트워크 & 보안</h4>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">네트워크</dt>
                    <dd className="text-sm text-gray-900">
                      {watch('networks').map((net, index) => (
                        <div key={index}>
                          {networks.find(n => n.id === net.uuid)?.name}
                          {net.fixed_ip && ` (${net.fixed_ip})`}
                        </div>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">보안 그룹</dt>
                    <dd className="text-sm text-gray-900">{watch('security_groups').join(', ')}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">키 페어</dt>
                    <dd className="text-sm text-gray-900">{watch('key_name') || '없음'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">유동 IP 자동 할당</dt>
                    <dd className="text-sm text-gray-900">{watch('auto_assign_floating_ip') ? '예' : '아니오'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* 네비게이션 버튼 */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            이전
          </button>
          
          <div className="flex space-x-3">
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                다음
              </button>
            ) : (
              <button
                type="submit"
                disabled={creating}
                className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    생성 중...
                  </>
                ) : (
                  <>
                    <Server className="h-4 w-4 mr-2" />
                    가상머신 생성
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* 보안그룹 생성 모달 */}
      {showCreateSecurityGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">보안그룹 생성</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const name = formData.get('sg_name') as string;
                const description = formData.get('sg_description') as string;
                
                try {
                  const newSecurityGroup = await neutronService.createSecurityGroup({
                    security_group: {
                      name,
                      description: description || ''
                    }
                  });
                  
                  // 목록에 새 보안그룹 추가
                  setSecurityGroups(prev => [...prev, newSecurityGroup.security_group]);
                  
                  // 폼에서 자동 선택
                  const currentSelected = watch('security_groups');
                  setValue('security_groups', [...currentSelected, newSecurityGroup.security_group.name]);
                  
                  toast.success('보안그룹이 생성되었습니다.');
                  setShowCreateSecurityGroup(false);
                } catch (error) {
                  console.error('보안그룹 생성 실패:', error);
                  toast.error('보안그룹 생성에 실패했습니다.');
                }
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이름
                  </label>
                  <input
                    name="sg_name"
                    type="text"
                    required
                    className="input w-full"
                    placeholder="my-security-group"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    설명
                  </label>
                  <textarea
                    name="sg_description"
                    rows={3}
                    className="input w-full"
                    placeholder="보안그룹 설명"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateSecurityGroup(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 키페어 생성 모달 */}
      {showCreateKeyPair && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">키페어 생성</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const name = formData.get('kp_name') as string;
                
                try {
                  // 키페어 이름 유효성 검사
                  if (!name || name.trim() === '') {
                    toast.error('키페어 이름을 입력해주세요.');
                    return;
                  }
                  
                  // 중복 키페어 이름 검사
                  if (keyPairs.some(kp => kp.name === name)) {
                    toast.error('이미 존재하는 키페어 이름입니다.');
                    return;
                  }
                  
                  const newKeyPair = await novaService.createKeyPair({
                    name: name.trim(),
                    type: 'ssh'
                  });
                  
                  if (!newKeyPair || !newKeyPair.keypair) {
                    throw new Error('키페어 생성 응답이 올바르지 않습니다.');
                  }
                  
                  // 목록에 새 키페어 추가
                  setKeyPairs(prev => [...prev, newKeyPair.keypair]);
                  
                  // 폼에서 자동 선택
                  setValue('key_name', newKeyPair.keypair.name);
                  
                  // 개인키 다운로드
                  if (newKeyPair.keypair.private_key) {
                    const blob = new Blob([newKeyPair.keypair.private_key], { type: 'text/plain' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${name}.pem`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    toast.success('키페어가 생성되고 다운로드되었습니다.');
                  } else {
                    toast.success('키페어가 생성되었습니다.');
                  }
                  
                  setShowCreateKeyPair(false);
                } catch (error: any) {
                  console.error('키페어 생성 실패:', error);
                  
                  let errorMessage = '키페어 생성에 실패했습니다.';
                  if (error?.response?.status === 409) {
                    errorMessage = '이미 존재하는 키페어 이름입니다.';
                  } else if (error?.response?.status === 400) {
                    errorMessage = '키페어 이름이 올바르지 않습니다.';
                  } else if (error?.message) {
                    errorMessage = `키페어 생성 실패: ${error.message}`;
                  }
                  
                  toast.error(errorMessage);
                }
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    키페어 이름
                  </label>
                  <input
                    name="kp_name"
                    type="text"
                    required
                    className="input w-full"
                    placeholder="my-keypair"
                  />
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-700">
                    키페어 생성 후 개인키(.pem 파일)가 자동으로 다운로드됩니다.
                    이 파일을 안전한 곳에 보관하세요.
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateKeyPair(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
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

export default CreateInstancePage; 