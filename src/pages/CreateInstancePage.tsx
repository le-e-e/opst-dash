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
  min_count: number;
  max_count: number;
  boot_source: 'image' | 'volume' | 'snapshot';
  volume_size?: number;
  volume_type?: string;
  delete_on_termination: boolean;
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

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateInstanceForm>({
    defaultValues: {
      name: '',
      description: '',
      networks: [],
      security_groups: ['default'],
      metadata: {},
      min_count: 1,
      max_count: 1,
      boot_source: 'image',
      delete_on_termination: true
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

      // 기본값 설정
      if (networksData.networks?.length > 0) {
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
          ...(data.availability_zone && { availability_zone: data.availability_zone }),
          ...(data.user_data && { user_data: btoa(data.user_data) }), // base64 encoding
          ...(Object.keys(data.metadata).length > 0 && { metadata: data.metadata }),
          min_count: data.min_count,
          max_count: data.max_count,
          ...bootConfig
        }
      };

      console.log('Creating instance with data:', serverData);
      
      const response = await novaService.createServer(serverData);
      
      toast.success('가상머신 생성이 시작되었습니다!');
      navigate('/compute');
    } catch (error) {
      console.error('인스턴스 생성 실패:', error);
      toast.error('가상머신 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const addNetwork = () => {
    const currentNetworks = watch('networks');
    setValue('networks', [...currentNetworks, { uuid: '' }]);
  };

  const removeNetwork = (index: number) => {
    const currentNetworks = watch('networks');
    setValue('networks', currentNetworks.filter((_, i) => i !== index));
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
    <div className="max-w-4xl mx-auto space-y-6">
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
                  인스턴스 개수
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Controller
                      name="min_count"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          min="1"
                          className="input w-full"
                          placeholder="최소"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <Controller
                      name="max_count"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          min="1"
                          className="input w-full"
                          placeholder="최대"
                        />
                      )}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  가용 영역
                </label>
                <Controller
                  name="availability_zone"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className="input w-full">
                      <option value="">자동 선택</option>
                      {availabilityZones.map(az => (
                        <option key={az} value={az}>{az}</option>
                      ))}
                    </select>
                  )}
                />
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
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">네트워크 설정</h3>
                <button
                  type="button"
                  onClick={addNetwork}
                  className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  네트워크 추가
                </button>
              </div>
              
              <Controller
                name="networks"
                control={control}
                render={({ field }) => (
                  <div className="space-y-4">
                    {field.value.map((network, index) => (
                      <div key={index} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                        <div className="flex-1">
                          <select
                            value={network.uuid}
                            onChange={(e) => {
                              const newNetworks = [...field.value];
                              newNetworks[index].uuid = e.target.value;
                              field.onChange(newNetworks);
                            }}
                            className="input w-full"
                          >
                            <option value="">네트워크 선택</option>
                            {networks.map(net => (
                              <option key={net.id} value={net.id}>{net.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="고정 IP (선택사항)"
                            value={network.fixed_ip || ''}
                            onChange={(e) => {
                              const newNetworks = [...field.value];
                              newNetworks[index].fixed_ip = e.target.value;
                              field.onChange(newNetworks);
                            }}
                            className="input w-full"
                          />
                        </div>
                        {field.value.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeNetwork(index)}
                            className="p-2 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* 보안 그룹 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">보안 그룹</h3>
              <Controller
                name="security_groups"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {securityGroups.map(sg => (
                      <label key={sg.id} className="flex items-center p-3 border border-gray-200 rounded-lg">
                        <input
                          type="checkbox"
                          checked={field.value.includes(sg.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              field.onChange([...field.value, sg.name]);
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
              <h3 className="text-lg font-medium text-gray-900 mb-6">키 페어</h3>
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
                    rows={8}
                    className="input w-full font-mono text-sm"
                    placeholder="#!/bin/bash&#10;echo 'Hello World' > /tmp/hello.txt"
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
                    <dt className="text-sm font-medium text-gray-500">개수</dt>
                    <dd className="text-sm text-gray-900">{watch('min_count')} - {watch('max_count')}</dd>
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
    </div>
  );
};

export default CreateInstancePage; 