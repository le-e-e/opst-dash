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
  X,
  Globe
} from 'lucide-react';
import { novaService, neutronService, glanceService, cinderService } from '../services/openstack';
import { 
  filterImagesByProject
} from '../utils/projectScope';
import { workflowNotifications } from '../utils/notificationHelper';
import toast from 'react-hot-toast';

interface CreateInstanceForm {
  name: string;
  description?: string;
  image_ref: string;
  flavor_ref: string;
  networks: { uuid: string; fixed_ip?: string }[];
  security_groups: string;
  key_name?: string;
  availability_zone?: string;
  user_data?: string;
  metadata: { [key: string]: string };
  boot_source: 'image' | 'volume' | 'snapshot';
  // 볼륨 부팅 관련 필드
  volume_source?: 'image' | 'volume' | 'snapshot';
  source_volume_id?: string;
  source_snapshot_id?: string;
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
  const [networks, setNetworks] = useState<any[]>([]);
  const [securityGroups, setSecurityGroups] = useState<SecurityGroup[]>([]);
  const [keyPairs, setKeyPairs] = useState<KeyPair[]>([]);
  const [availabilityZones, setAvailabilityZones] = useState<string[]>([]);
  const [volumeTypes, setVolumeTypes] = useState<any[]>([]);
  const [availableVolumes, setAvailableVolumes] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);

  const [showCreateSecurityGroup, setShowCreateSecurityGroup] = useState(false);
  const [showCreateKeyPair, setShowCreateKeyPair] = useState(false);

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateInstanceForm>({
    defaultValues: {
      name: '',
      description: '',
      networks: [],
      security_groups: 'default',
      metadata: {},
      boot_source: 'image',
      volume_source: 'image',
      delete_on_termination: true,
      availability_zone: 'nova',
      auto_assign_floating_ip: false
    }
  });

  const bootSource = watch('boot_source');
  const volumeSource = watch('volume_source');
  const selectedImage = watch('image_ref');
  const selectedFlavor = watch('flavor_ref');
  const selectedVolume = watch('source_volume_id');
  const selectedSnapshot = watch('source_snapshot_id');

  // 데이터 로딩
  const loadData = async () => {
    try {
      setLoading(true);
      // 각 API 호출을 개별적으로 처리하여 일부 실패해도 전체가 실패하지 않도록 함
      const [
        imagesResult,
        flavorsResult,
        securityGroupsResult,
        keyPairsResult,
        availabilityZonesResult,
        volumeTypesResult,
        volumesResult,
        snapshotsResult
      ] = await Promise.allSettled([
        glanceService.getImages(),
        novaService.getFlavors(),
        neutronService.getSecurityGroups(),
        novaService.getKeyPairs(),
        novaService.getAvailabilityZones(),
        cinderService.getVolumeTypes(),
        cinderService.getVolumes(),
        cinderService.getSnapshots()
      ]);

      // 성공한 데이터만 추출
      const imagesData = imagesResult.status === 'fulfilled' ? imagesResult.value : { images: [] };
      const flavorsData = flavorsResult.status === 'fulfilled' ? flavorsResult.value : { flavors: [] };
      const securityGroupsData = securityGroupsResult.status === 'fulfilled' ? securityGroupsResult.value : { security_groups: [] };
      const keyPairsData = keyPairsResult.status === 'fulfilled' ? keyPairsResult.value : { keypairs: [] };
      const availabilityZonesData = availabilityZonesResult.status === 'fulfilled' ? availabilityZonesResult.value : { availabilityZoneInfo: [] };
      const volumeTypesData = volumeTypesResult.status === 'fulfilled' ? volumeTypesResult.value : { volume_types: [] };
      const volumesData = volumesResult.status === 'fulfilled' ? volumesResult.value : { volumes: [] };
      const snapshotsData = snapshotsResult.status === 'fulfilled' ? snapshotsResult.value : { snapshots: [] };

      // 실패한 API 로깅
      if (imagesResult.status === 'rejected') console.error('이미지 데이터 로딩 실패:', imagesResult.reason);
      if (flavorsResult.status === 'rejected') console.error('플레이버 데이터 로딩 실패:', flavorsResult.reason);
      if (securityGroupsResult.status === 'rejected') console.error('보안그룹 데이터 로딩 실패:', securityGroupsResult.reason);
      if (keyPairsResult.status === 'rejected') console.error('키페어 데이터 로딩 실패:', keyPairsResult.reason);
      if (availabilityZonesResult.status === 'rejected') console.error('가용성 영역 데이터 로딩 실패:', availabilityZonesResult.reason);
      if (volumeTypesResult.status === 'rejected') console.error('볼륨 타입 데이터 로딩 실패:', volumeTypesResult.reason);
      if (volumesResult.status === 'rejected') console.error('볼륨 데이터 로딩 실패:', volumesResult.reason);
      if (snapshotsResult.status === 'rejected') console.error('스냅샷 데이터 로딩 실패:', snapshotsResult.reason);

      // 이미지와 스냅샷을 구분하여 필터링 (더 엄격한 기준)
      const allImages = imagesData.images || [];
      const filteredImages: Image[] = [];
      const imageSnapshots: any[] = [];
      
      allImages.forEach((img: any) => {
        // 활성 상태가 아니면 제외
        if (img.status !== 'active') return;
        
        // 스냅샷 판별 조건들 (더 엄격함)
        const isSnapshot = 
          // 1. image_type이 snapshot (확실한 스냅샷)
          img.image_type === 'snapshot' ||
          // 2. metadata에서 image_type이 snapshot
          (img.metadata && img.metadata.image_type === 'snapshot') ||
          // 3. base_image_ref가 있음 (Nova 스냅샷의 확실한 특징)
          img.base_image_ref ||
          // 4. instance_uuid가 있음 (인스턴스에서 생성된 스냅샷)
          img.instance_uuid ||
          // 5. owner_specified가 있음 (Nova createImage 명령으로 생성)
          img.owner_specified ||
          // 6. 이름이나 설명에 스냅샷 관련 키워드가 포함되고 visibility가 private
          (img.visibility === 'private' && 
           ((/snapshot|snap|backup|image-/i.test(img.name || '')) ||
            (/snapshot|snap|backup/i.test(img.description || '')))) ||
          // 7. 메타데이터에 스냅샷 관련 정보가 있음
          (img.metadata && (
            img.metadata.user_id ||
            img.metadata.base_image_ref ||
            img.metadata.instance_type_id ||
            img.metadata.instance_type_memory_mb ||
            img.metadata.instance_type_vcpus ||
            img.metadata.instance_type_root_gb
          ));
        
        // OS 이미지 판별 (공식 이미지의 특징)
        const isOfficialImage = 
          // 1. visibility가 public (공식 이미지)
          img.visibility === 'public' ||
          // 2. 잘 알려진 OS 이름들
          /^(ubuntu|centos|rhel|fedora|debian|opensuse|windows|cirros|alpine|rocky|almalinux)/i.test(img.name || '') ||
          // 3. 메타데이터에 OS 정보가 있음
          (img.metadata && (img.metadata.os_type || img.metadata.os_distro || img.metadata.os_version));
        
        if (isSnapshot) {
          imageSnapshots.push(img);
        } else if (isOfficialImage || img.visibility === 'public') {
          // 공식 이미지나 public 이미지만 OS 이미지로 분류
          filteredImages.push(img);
        }
        // 애매한 이미지들은 제외 (neither snapshot nor clear OS image)
      });
      
      console.log('🖼️ 필터링된 이미지:', filteredImages.length, '개');
      console.log('📸 발견된 스냅샷:', imageSnapshots.length, '개');
      
      // 최종 검증: OS 이미지만 남기고 의심스러운 것들 추가 제거
      const finalImages = filteredImages.filter((img: any) => {
        // 이름에 스냅샷 관련 키워드가 있으면 제외
        const suspiciousName = /snapshot|snap|backup|image-\d+|server-\d+/i.test(img.name || '');
        
        // 메타데이터에 인스턴스 관련 정보가 있으면 제외 (Nova 스냅샷의 특징)
        const hasInstanceMetadata = img.metadata && (
          img.metadata.instance_uuid ||
          img.metadata.user_id ||
          img.metadata.base_image_ref ||
          img.metadata.instance_type_id
        );
        
        // OS 이미지의 확실한 특징이 있는지 확인
        const isDefinitelyOSImage = 
          // Public 이미지이거나
          img.visibility === 'public' ||
          // 잘 알려진 OS 이름으로 시작하거나
          /^(ubuntu|centos|rhel|fedora|debian|opensuse|windows|cirros|alpine|rocky|almalinux|oracle)/i.test(img.name || '') ||
          // 메타데이터에 OS 정보가 있음
          (img.metadata && (
            img.metadata.os_type || 
            img.metadata.os_distro || 
            img.metadata.os_version ||
            img.metadata.architecture
          ));
        
        // 의심스러운 이름이나 인스턴스 메타데이터가 있으면 제외
        if (suspiciousName || hasInstanceMetadata) {
          console.log(`❌ 스냅샷으로 판단하여 제외: ${img.name} (suspicious: ${suspiciousName}, metadata: ${hasInstanceMetadata})`);
          return false;
        }
        
        // 확실한 OS 이미지가 아니면 제외
        if (!isDefinitelyOSImage) {
          console.log(`❌ OS 이미지가 아닌 것으로 판단하여 제외: ${img.name}`);
          return false;
        }
        
        return true;
      });
      
      console.log('✅ 최종 OS 이미지:', finalImages.length, '개');
      finalImages.forEach((img: any) => {
        console.log(`  - ${img.name} (${img.visibility})`);
      });
      
      // 이미지 필터링 적용
      const userFilteredImages = filterImagesByProject(finalImages);
      
      console.log('전체 이미지:', finalImages.length, '프로젝트별 필터링된 이미지:', userFilteredImages.length);
      
      setImages(userFilteredImages);
      setFlavors(flavorsData.flavors || []);
      setNetworks([]); // 네트워크는 자동 선택되므로 빈 배열로 설정
      setSecurityGroups(securityGroupsData.security_groups || []);
      setKeyPairs(keyPairsData.keypairs?.map((kp: any) => kp.keypair) || []);
      setAvailabilityZones(availabilityZonesData.availabilityZoneInfo?.map((az: any) => az.zoneName) || ['nova']);
      setVolumeTypes(volumeTypesData.volume_types || []);
      setAvailableVolumes(volumesData.volumes?.filter((vol: any) => vol.status === 'available') || []);
      
      // Cinder 볼륨 스냅샷과 Nova 이미지 스냅샷 합치기
      const cinderSnapshots = snapshotsData.snapshots || [];
      
      // 이미 분류된 이미지 스냅샷을 사용 (위에서 이미 분류함)
      const imageSnapshotsForInstance = imageSnapshots.map((img: any) => ({
        id: img.id,
        name: img.name,
        status: img.status,
        size: img.size ? Math.ceil(img.size / (1024 * 1024 * 1024)) : null,
        created_at: img.created_at,
        volume_id: null,
        description: img.description || '인스턴스 이미지 스냅샷',
        snapshot_type: 'image'
      }));
      
      // 두 종류 스냅샷 합치기
      const allSnapshots = [
        ...cinderSnapshots.map((s: any) => ({ ...s, snapshot_type: 'volume' })), 
        ...imageSnapshotsForInstance
      ];
      
      console.log('🔍 인스턴스 생성용 Cinder 볼륨 스냅샷:', cinderSnapshots.length);
      console.log('🔍 인스턴스 생성용 Nova 이미지 스냅샷:', imageSnapshotsForInstance.length);
      console.log('🔍 인스턴스 생성용 전체 스냅샷:', allSnapshots.length);
      
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
      const validSnapshots = allSnapshots.filter((snap: any) => {
        return snap && snap.id;
      });
      
      console.log('✅ 인스턴스 생성용 최종 스냅샷 (필터링 없음):', validSnapshots.length);
      console.log('✅ 인스턴스 생성용 스냅샷들:', validSnapshots.map((s: any) => ({ id: s.id, name: s.name, status: s.status, type: s.snapshot_type })));
      
      console.log('🔄 setSnapshots 호출 전 현재 snapshots 상태:', snapshots.length);
      setSnapshots(validSnapshots);
      console.log('🔄 setSnapshots 호출 완료 - 새 데이터 길이:', validSnapshots.length);

      // 네트워크는 인스턴스 생성 시 자동으로 private 네트워크 선택
      console.log('네트워크는 인스턴스 생성 시 자동으로 private 네트워크를 선택합니다.');
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

      // 네트워크 설정 검증 및 구성
      let networks = [];
      
      if (data.networks && data.networks.length > 0 && data.networks[0].uuid) {
        networks = data.networks.map(net => ({
          uuid: net.uuid,
          ...(net.fixed_ip && { fixed_ip: net.fixed_ip })
        }));
      } else {
        // 네트워크가 설정되지 않은 경우 private 네트워크 찾기
        const allNetworks = await neutronService.getNetworks();
        
        // private 네트워크 우선 찾기 (외부 네트워크가 아닌 것)
        const privateNet = allNetworks.networks?.find((net: any) => 
          !net['router:external'] && 
          net.status === 'ACTIVE' &&
          (net.name.includes('private') || net.name.includes('internal') || net.name.includes('172.30'))
        );
        
        if (privateNet) {
          networks = [{ uuid: privateNet.id }];
          console.log('자동으로 private 네트워크 설정:', privateNet.name, privateNet.id);
        } else if (allNetworks.networks?.length > 0) {
          // private 네트워크가 없으면 첫 번째 ACTIVE 네트워크 사용
          const firstActiveNet = allNetworks.networks.find((net: any) => net.status === 'ACTIVE');
          if (firstActiveNet) {
            networks = [{ uuid: firstActiveNet.id }];
            console.log('자동으로 첫 번째 ACTIVE 네트워크 설정:', firstActiveNet.name, firstActiveNet.id);
          } else {
            throw new Error('사용 가능한 ACTIVE 상태의 네트워크가 없습니다.');
          }
        } else {
          throw new Error('사용 가능한 네트워크가 없습니다.');
        }
      }
      
      console.log('네트워크 설정:', networks);

      // 필수 항목 검증
      if (!data.name || data.name.trim() === '') {
        throw new Error('인스턴스 이름을 입력해주세요.');
      }
      
      if (!data.flavor_ref) {
        throw new Error('플레이버를 선택해주세요.');
      }
      
      // 데이터 로딩 확인
      if (images.length === 0 && data.boot_source === 'image') {
        throw new Error('사용 가능한 이미지가 없습니다. 잠시 후 다시 시도해주세요.');
      }
      
      if (flavors.length === 0) {
        throw new Error('사용 가능한 플레이버가 없습니다. 잠시 후 다시 시도해주세요.');
      }
      
      // 보안 그룹 설정
      const security_groups = [{ name: data.security_groups || 'default' }];
      
      console.log('기본 설정:', {
        name: data.name,
        flavor: data.flavor_ref,
        security_groups,
        boot_source: data.boot_source
      });

      // 부트 소스에 따른 설정
      let bootConfig: any = {};
      
      if (data.boot_source === 'image') {
        if (!data.image_ref) {
          throw new Error('이미지가 선택되지 않았습니다.');
        }
        
        console.log(`이미지 부팅: ${data.image_ref}`);
        
        bootConfig = {
          imageRef: data.image_ref
        };
      } else if (data.boot_source === 'volume') {
        // 볼륨에서 부팅하는 경우
        if (!data.volume_source) {
          throw new Error('볼륨 소스가 선택되지 않았습니다.');
        }
        
        let blockDeviceMapping: any = {};
        
        if (data.volume_source === 'image') {
          if (!data.image_ref) {
            throw new Error('이미지가 선택되지 않았습니다.');
          }
          // 이미지에서 새 볼륨 생성
          const selectedImageData = images.find(img => img.id === data.image_ref);
          const minDiskSize = selectedImageData?.min_disk || 1;
          const requestedSize = data.volume_size || 20;
          const volumeSize = Math.max(requestedSize, minDiskSize, 1); // 최소 1GB 보장
          
          console.log(`선택된 이미지: ${selectedImageData?.name}, 최소 디스크: ${minDiskSize}GB, 설정 크기: ${volumeSize}GB`);
          
          blockDeviceMapping = {
            source_type: 'image',
            destination_type: 'volume',
            uuid: data.image_ref,
            volume_size: volumeSize,
            boot_index: 0,
            delete_on_termination: data.delete_on_termination,
            ...(data.volume_type && { volume_type: data.volume_type })
          };
        } else if (data.volume_source === 'volume') {
          if (!data.source_volume_id) {
            throw new Error('사용할 볼륨이 선택되지 않았습니다.');
          }
          
          // 기존 볼륨 사용
          blockDeviceMapping = {
            source_type: 'volume',
            destination_type: 'volume',
            uuid: data.source_volume_id,
            boot_index: 0,
            delete_on_termination: false // 기존 볼륨은 삭제하지 않음
          };
        } else if (data.volume_source === 'snapshot') {
          if (!data.source_snapshot_id) {
            throw new Error('사용할 스냅샷이 선택되지 않았습니다.');
          }
          // 스냅샷에서 볼륨 생성
          const selectedSnapshot = snapshots.find(snap => snap.id === data.source_snapshot_id);
          const snapshotSize = selectedSnapshot?.size || 20;
          const requestedSize = data.volume_size || snapshotSize;
          const volumeSize = Math.max(requestedSize, snapshotSize, 1); // 최소 1GB 보장
          
          console.log(`선택된 스냅샷: ${selectedSnapshot?.name}, 스냅샷 크기: ${snapshotSize}GB, 설정 크기: ${volumeSize}GB`);
          
          blockDeviceMapping = {
            source_type: 'snapshot',
            destination_type: 'volume',
            uuid: data.source_snapshot_id,
            volume_size: volumeSize,
            boot_index: 0,
            delete_on_termination: data.delete_on_termination,
            ...(data.volume_type && { volume_type: data.volume_type })
          };
        }
        
        bootConfig = {
          block_device_mapping_v2: [blockDeviceMapping]
        };
      } else if (data.boot_source === 'snapshot') {
        if (!data.image_ref) {
          throw new Error('스냅샷이 선택되지 않았습니다.');
        }
        
        // 스냅샷에서 직접 부팅하는 경우 (볼륨 생성)
        const selectedSnapshot = snapshots.find(snap => snap.id === data.image_ref);
        if (!selectedSnapshot) {
          throw new Error('선택된 스냅샷을 찾을 수 없습니다.');
        }
        const snapshotSize = selectedSnapshot.size || 20;
        
        console.log(`직접 스냅샷 부팅: ${selectedSnapshot?.name}, 크기: ${snapshotSize}GB`);
        
        bootConfig = {
          block_device_mapping_v2: [{
            source_type: 'snapshot',
            destination_type: 'volume',
            uuid: data.image_ref, // 스냅샷 ID가 image_ref에 저장됨
            volume_size: snapshotSize,
            boot_index: 0,
            delete_on_termination: data.delete_on_termination
          }]
        };
      }

      const serverData = {
        server: {
          name: data.name,
          flavorRef: data.flavor_ref,
          networks,
          security_groups,

          ...(data.key_name && { key_name: data.key_name }),
          availability_zone: 'nova',
          ...(data.user_data && { user_data: btoa(data.user_data) }), // base64 encoding
          ...(Object.keys(data.metadata).length > 0 || data.description || data.boot_source === 'volume' ? { 
            metadata: {
              ...data.metadata,
              ...(data.description && { description: data.description }),
              // 볼륨 삭제 정책 저장 (delete_on_termination)
              ...(data.boot_source === 'volume' && { 
                volume_delete_on_termination: data.delete_on_termination ? 'true' : 'false'
              })
            }
          } : {}),
          min_count: 1,
          max_count: 1,
          ...bootConfig
        }
      };

      console.log('==== 인스턴스 생성 요청 ====');
      console.log('요청 데이터:', JSON.stringify(serverData, null, 2));
      
      const response = await novaService.createServer(serverData);
      
      console.log('==== 인스턴스 생성 응답 ====');
      console.log('응답 데이터:', response);
      
      // 볼륨 이름 설정 (새 볼륨 생성인 경우)
      if ((data.boot_source === 'volume' && data.volume_source === 'image') ||
          (data.boot_source === 'volume' && data.volume_source === 'snapshot') ||
          data.boot_source === 'snapshot') {
        
        console.log('볼륨 이름 설정을 위한 백그라운드 작업 시작...');
        
        // 백그라운드에서 볼륨 이름 설정 (더 안정적인 방법)
        setTimeout(async () => {
          try {
            console.log('🏷️ 볼륨 이름 설정 프로세스 시작...');
            
            // 인스턴스와 볼륨이 생성될 때까지 대기
            let attempts = 0;
            const maxAttempts = 30; // 최대 90초 대기
            let attachedVolumes: any[] = [];
            
            while (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 대기
              attempts++;
              
              try {
                const instanceDetail = await novaService.getServer(response.server.id);
                attachedVolumes = instanceDetail.server.volumes_attached || [];
                
                console.log(`🔍 시도 ${attempts}: 연결된 볼륨 개수 ${attachedVolumes.length}`);
                
                if (attachedVolumes.length > 0) {
                  // 볼륨이 연결되었으므로 이름 설정 시도
                  break;
                }
              } catch (error) {
                console.log(`🔍 시도 ${attempts}: 인스턴스 정보 가져오기 실패`);
              }
            }
            
            if (attachedVolumes.length > 0) {
              // 모든 연결된 볼륨에 대해 이름 설정
              for (let i = 0; i < attachedVolumes.length; i++) {
                const volume = attachedVolumes[i];
                const volumeSuffix = attachedVolumes.length === 1 ? 'volume' : `volume_${i + 1}`;
                const newVolumeName = `${data.name}_${volumeSuffix}`;
                
                try {
                  console.log(`🏷️ 볼륨 ID ${volume.id}의 이름을 "${newVolumeName}"으로 변경 시도`);
                  
                  // 현재 볼륨 정보 확인
                  const volumeDetail = await cinderService.getVolume(volume.id);
                  const currentName = volumeDetail.volume?.name;
                  
                  // 이미 이름이 있고 기본 생성 이름이 아니면 건너뛰기
                  if (currentName && 
                      currentName !== volume.id && 
                      !currentName.startsWith('volume-') && 
                      currentName !== '이름 없음') {
                    console.log(`🏷️ 볼륨 ${volume.id}에 이미 이름이 있음: "${currentName}". 건너뛰기.`);
                    continue;
                  }
                  
                  // 볼륨 이름 업데이트
                  await cinderService.updateVolume(volume.id, {
                    volume: {
                      name: newVolumeName,
                      description: `${data.name} 인스턴스의 ${i === 0 ? '부트' : '추가'} 볼륨`
                    }
                  });
                  
                  console.log(`✅ 볼륨 ${volume.id} 이름 설정 완료: "${newVolumeName}"`);
                  
                  // 볼륨 이름 설정 완료 알림
                  const { addNotification } = (await import('../store/notification')).useNotificationStore.getState();
                  addNotification({
                    title: '볼륨 설정 완료',
                    message: `인스턴스 "${data.name}"의 볼륨 "${newVolumeName}"이 생성되었습니다.`,
                    type: 'success'
                  });
                  
                } catch (volumeUpdateError) {
                  console.error(`❌ 볼륨 ${volume.id} 이름 설정 실패:`, volumeUpdateError);
                }
              }
              
              // 인스턴스 메타데이터에 각 볼륨의 삭제 정책 저장
              if (data.boot_source === 'volume' && attachedVolumes.length > 0) {
                console.log(`📝 볼륨 삭제 정책: delete_on_termination=${data.delete_on_termination}`);
                console.log(`📝 볼륨 ID들:`, attachedVolumes.map((v: any) => v.id));
                
                try {
                  const volumeMetadata: { [key: string]: string } = {};
                  
                  // 전체 정책 저장
                  volumeMetadata['volume_delete_on_termination'] = data.delete_on_termination ? 'true' : 'false';
                  
                  // 각 볼륨별 정책 저장
                  attachedVolumes.forEach((volume: any) => {
                    volumeMetadata[`volume_${volume.id}_delete_on_termination`] = data.delete_on_termination ? 'true' : 'false';
                  });
                  
                  await novaService.updateServerMetadata(response.server.id, volumeMetadata);
                  console.log(`✅ 인스턴스 메타데이터에 볼륨 삭제 정책 저장 완료`);
                } catch (metadataError) {
                  console.error(`❌ 메타데이터 업데이트 실패:`, metadataError);
                  // 메타데이터 저장 실패해도 인스턴스 생성은 성공으로 처리
                }
              }
            } else {
              console.log('⚠️ 연결된 볼륨을 찾을 수 없습니다. 볼륨 이름 설정을 건너뜁니다.');
            }
          } catch (volumeNameError) {
            console.error('❌ 볼륨 이름 설정 프로세스 실패:', volumeNameError);
            // 볼륨 이름 설정 실패는 인스턴스 생성 성공에 영향주지 않음
          }
        }, 5000); // 5초 후 시작 (더 안정적)
      }
      
      // 인스턴스 생성 성공 알림
      workflowNotifications.instanceCreated(data.name);
      
      // 유동 IP 자동 할당
      if (data.auto_assign_floating_ip && response.server?.id) {
        // 백그라운드에서 유동 IP 할당 처리
        (async () => {
          try {
            // 먼저 현재 네트워크와 유동 IP 상황 파악
            console.log('=== 유동 IP 할당 시작 ===');
            
            // 네트워크 정보 먼저 가져오기
            const networks = await neutronService.getNetworks();
            const floatingIPs = await neutronService.getFloatingIps();
            
            console.log('전체 네트워크 목록:');
            networks.networks?.forEach((net: any) => {
              console.log(`- ${net.name}: external=${net['router:external']}, provider=${net.provider_network_type}, id=${net.id}`);
            });
            
            console.log('현재 유동 IP 목록:');
            floatingIPs.floatingips?.forEach((fip: any) => {
              console.log(`- ${fip.floating_ip_address}: 사용중=${!!fip.port_id}, 네트워크ID=${fip.floating_network_id}`);
            });
            
            // 외부 네트워크 찾기 (여러 방법 시도)
            let externalNetwork = null;
            
            // 방법 1: router:external = true (가장 정확한 방법)
            externalNetwork = networks.networks?.find((net: any) => net['router:external'] === true);
            if (externalNetwork) {
              console.log('방법 1 성공: router:external=true 네트워크 발견:', externalNetwork.name);
            } else {
              console.log('방법 1 실패: router:external=true 네트워크 없음');
              
              // 방법 2: 이름 패턴으로 외부 네트워크 찾기
              externalNetwork = networks.networks?.find((net: any) => 
                net.name.toLowerCase().includes('external') || 
                net.name.toLowerCase().includes('public') ||
                net.name.toLowerCase().includes('floating') ||
                net.name.toLowerCase().includes('wan')
              );
              if (externalNetwork) {
                console.log('방법 2 성공: 이름 패턴으로 외부 네트워크 발견:', externalNetwork.name);
              } else {
                console.log('방법 2 실패: 이름 패턴 매칭 실패');
                
                // 방법 3: 기존 유동 IP로부터 네트워크 추정
                const existingFloatingIP = floatingIPs.floatingips?.find((fip: any) => 
                  fip.floating_ip_address && !fip.port_id
                );
                if (existingFloatingIP) {
                  externalNetwork = networks.networks?.find((net: any) => 
                    net.id === existingFloatingIP.floating_network_id
                  );
                  if (externalNetwork) {
                    console.log('방법 3 성공: 기존 유동 IP로부터 네트워크 추정:', externalNetwork.name);
                  }
                }
              }
            }
            
            if (!externalNetwork) {
              // 방법 4: provider_network_type이 flat 또는 vlan인 네트워크 찾기
              externalNetwork = networks.networks?.find((net: any) => 
                net.provider_network_type === 'flat' || net.provider_network_type === 'vlan'
              );
              if (externalNetwork) {
                console.log('방법 4 성공: provider_network_type으로 외부 네트워크 발견:', externalNetwork.name);
              } else {
                console.log('방법 4 실패: provider_network_type 매칭 실패');
                
                // 방법 5: 첫 번째 사용 가능한 네트워크 (마지막 수단)
                externalNetwork = networks.networks?.[0];
                console.log('방법 5: 첫 번째 네트워크 사용 (마지막 수단):', externalNetwork?.name);
              }
            }
            
            console.log('최종 선택된 외부 네트워크:', externalNetwork);
            
            if (!externalNetwork) {
              throw new Error('외부 네트워크를 찾을 수 없습니다.');
            }

            // 인스턴스가 ACTIVE 상태가 될 때까지 대기
            let attempts = 0;
            const maxAttempts = 60; // 최대 10분 대기
            
            while (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 10000)); // 10초 대기
              
              try {
                const serverStatus = await novaService.getServer(response.server.id);
                console.log(`인스턴스 상태: ${serverStatus.server.status} (시도: ${attempts + 1}/${maxAttempts})`);
                
                if (serverStatus.server.status === 'ACTIVE') {
                  console.log('인스턴스가 ACTIVE 상태가 되었습니다. 유동 IP 할당을 시작합니다...');
                  
                  // 사용 가능한 유동 IP 다시 확인
                  const currentFloatingIPs = await neutronService.getFloatingIps();
                  const availableIP = currentFloatingIPs.floatingips?.find((fip: any) => !fip.port_id);
                  
                  let floatingIPAddress = '';
                  
                  if (availableIP) {
                    console.log('기존 유동 IP 사용:', availableIP.floating_ip_address);
                    floatingIPAddress = availableIP.floating_ip_address;
                  } else {
                    console.log('새로운 유동 IP 생성 중...');
                    try {
                      const floatingIPRequest = {
                        floatingip: {
                          floating_network_id: externalNetwork.id
                        }
                      };
                      console.log('유동 IP 생성 요청:', floatingIPRequest);
                      
                      const newFloatingIP = await neutronService.createFloatingIP(floatingIPRequest);
                      console.log('새로 생성된 유동 IP 응답:', newFloatingIP);
                      
                      if (newFloatingIP.floatingip) {
                        floatingIPAddress = newFloatingIP.floatingip.floating_ip_address;
                        console.log('새로운 유동 IP 주소:', floatingIPAddress);
                      }
                    } catch (createError) {
                      console.error('유동 IP 생성 실패:', createError);
                      throw createError;
                    }
                  }
                  
                  if (floatingIPAddress) {
                    console.log('유동 IP 연결 시도:', floatingIPAddress);
                    try {
                      await novaService.attachFloatingIP(response.server.id, floatingIPAddress);
                      toast.success(`유동 IP ${floatingIPAddress}가 자동으로 할당되었습니다.`);
                      console.log('유동 IP 할당 성공!');
                                         } catch (attachError: any) {
                       console.error('유동 IP 연결 실패:', attachError);
                       toast.error(`유동 IP 연결에 실패했습니다: ${attachError.message || '연결 오류'}`);
                     }
                  } else {
                    console.error('유동 IP 주소를 얻을 수 없습니다.');
                    toast.error('유동 IP 할당에 실패했습니다: IP 주소를 얻을 수 없습니다.');
                  }
                  break;
                } else if (serverStatus.server.status === 'ERROR') {
                  console.error('인스턴스가 오류 상태입니다.');
                  toast.error('인스턴스가 오류 상태로 인해 유동 IP를 할당할 수 없습니다.');
                  break;
                }
              } catch (checkError) {
                console.error('인스턴스 상태 확인 실패:', checkError);
              }
              
              attempts++;
            }
            
            if (attempts >= maxAttempts) {
              console.error('유동 IP 할당 시간 초과');
              toast.error('유동 IP 할당 시간이 초과되었습니다. 인스턴스 생성 후 수동으로 할당해주세요.');
            }
          } catch (ipError: any) {
            console.error('유동 IP 할당 프로세스 실패:', ipError);
            toast.error(`유동 IP 할당에 실패했습니다: ${ipError.message || '알 수 없는 오류'}`);
          } finally {
            console.log('=== 유동 IP 할당 종료 ===');
          }
        })();
      }
      
      navigate('/compute');
    } catch (error: any) {
      console.error('인스턴스 생성 실패:', error);
      
      // 상세한 오류 메시지 추출
      let errorMessage = '가상머신 생성에 실패했습니다.';
      
      if (error.response?.data) {
        const errorData = error.response.data;
        console.error('오류 상세 정보:', JSON.stringify(errorData, null, 2));
        
        if (errorData.badRequest?.message) {
          errorMessage = `생성 실패: ${errorData.badRequest.message}`;
        } else if (errorData.fault?.message) {
          errorMessage = `생성 실패: ${errorData.fault.message}`;
        } else if (errorData.computeFault?.message) {
          errorMessage = `생성 실패: ${errorData.computeFault.message}`;
        } else if (typeof errorData === 'string') {
          errorMessage = `생성 실패: ${errorData}`;
        }
      } else if (error.message) {
        errorMessage = `생성 실패: ${error.message}`;
      }
      
      toast.error(errorMessage);
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

  // 스냅샷 상태 변경 시 로그 출력 (디버깅용)
  useEffect(() => {
    console.log('🔄 인스턴스 생성 페이지 스냅샷 상태 업데이트:', {
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
    <div className="max-w-4xl mx-auto space-y-6 min-h-screen pb-20">
      {/* 헤더 */}
      <div className="flex items-center space-x-4">
        <button 
          onClick={() => navigate('/compute')}
          className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">가상머신 생성</h1>
          <p className="text-gray-600 dark:text-gray-400">새로운 가상머신 인스턴스를 생성합니다</p>
        </div>
      </div>

      {/* 스텝 표시 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep >= step.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
              }`}>
                <step.icon className="h-4 w-4" />
              </div>
              <div className="ml-3 hidden sm:block">
                <p className={`text-sm font-medium ${
                  currentStep >= step.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {step.title}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`ml-3 w-8 h-px ${
                  currentStep > step.id ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 스텝 1: 기본 정보 */}
        {currentStep === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">기본 정보</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                      className="input w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="my-instance"
                    />
                  )}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  설명
                </label>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      className="input w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="인스턴스 설명"
                    />
                  )}
                />
              </div>



              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  가용 영역
                </label>
                <input
                  type="text"
                  value="nova"
                  disabled
                  className="input w-full bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-300 dark:border-gray-600"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">가용 영역이 nova로 고정되어 있습니다.</p>
              </div>
            </div>
          </div>
        )}

        {/* 스텝 2: 이미지 & 플레이버 */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* 부트 소스 선택 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">부트 소스</h3>
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
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                        }`}>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{option.label}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{option.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* 이미지 선택 */}
            {bootSource === 'image' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">이미지 선택</h3>
              <Controller
                name="image_ref"
                control={control}
                rules={{ required: '이미지를 선택해주세요' }}
                render={({ field }) => (
                  <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
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
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                        }`}>
                          <div className="flex items-center mb-2">
                            <ImageIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2" />
                            <p className="font-medium truncate text-gray-900 dark:text-gray-100">{image.name}</p>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
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
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.image_ref.message}</p>
              )}
            </div>
            )}

            {/* 스냅샷 선택 */}
            {bootSource === 'snapshot' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">스냅샷 선택</h3>
                <Controller
                  name="image_ref"
                  control={control}
                  rules={{ required: '스냅샷을 선택해주세요' }}
                  render={({ field }) => (
                    <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                      {snapshots.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {snapshots.map(snapshot => (
                            <label key={snapshot.id} className="relative">
                              <input
                                type="radio"
                                value={snapshot.id}
                                checked={field.value === snapshot.id}
                                onChange={field.onChange}
                                className="sr-only"
                              />
                              <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                                field.value === snapshot.id
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                              }`}>
                                <div className="flex items-center mb-2">
                                  <ImageIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2" />
                                  <p className="font-medium truncate text-gray-900 dark:text-gray-100">{snapshot.name || `스냅샷 ${snapshot.id.slice(0, 8)}`}</p>
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                                  <p>타입: {snapshot.snapshot_type === 'volume' ? '볼륨 스냅샷' : '이미지 스냅샷'}</p>
                                  <p>크기: {snapshot.size || '-'}GB</p>
                                  <p>상태: {snapshot.status}</p>
                                  <p>생성일: {new Date(snapshot.created_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-500 dark:text-gray-400 mb-2">사용 가능한 스냅샷이 없습니다.</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            스냅샷 개수: {snapshots.length}개
                            (콘솔 로그를 확인해보세요)
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                />
                {errors.image_ref && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.image_ref.message}</p>
                )}
              </div>
            )}

            {/* 볼륨 설정 (볼륨 부팅 시) */}
            {bootSource === 'volume' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">볼륨 설정</h3>
                
                {/* 볼륨 소스 선택 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">볼륨 소스</label>
                  <Controller
                    name="volume_source"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          { value: 'image', label: '새 볼륨 생성 (이미지)', desc: '이미지로부터 새 볼륨 생성', icon: '🖼️' },
                          { value: 'volume', label: '기존 볼륨 선택', desc: '사용 가능한 볼륨 선택', icon: '💽' },
                          { value: 'snapshot', label: '스냅샷에서 생성', desc: '볼륨 스냅샷으로부터 생성', icon: '📸' }
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
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                            }`}>
                              <div className="text-center">
                                <div className="text-2xl mb-2">{option.icon}</div>
                                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{option.label}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{option.desc}</p>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  />
                </div>

                {/* 이미지에서 새 볼륨 생성 */}
                {volumeSource === 'image' && (
                  <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">이미지에서 새 볼륨 생성</h4>
                    
                    {/* 이미지 선택 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">이미지 선택</label>
                      <Controller
                        name="image_ref"
                        control={control}
                        rules={{ required: volumeSource === 'image' ? '이미지를 선택해주세요' : false }}
                        render={({ field }) => (
                          <select 
                            {...field} 
                            className="input w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            onChange={(e) => {
                              field.onChange(e);
                              // 이미지 선택 시 볼륨 크기 자동 설정
                              const selectedImg = images.find(img => img.id === e.target.value);
                              if (selectedImg && selectedImg.min_disk > 0) {
                                const currentVolumeSize = watch('volume_size');
                                if (!currentVolumeSize || currentVolumeSize < selectedImg.min_disk) {
                                  setValue('volume_size', selectedImg.min_disk);
                                }
                              }
                            }}
                          >
                            <option value="">이미지를 선택하세요</option>
                            {images.map(img => (
                              <option key={img.id} value={img.id}>
                                {img.name} {img.min_disk > 0 && `(최소 ${img.min_disk}GB)`}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">볼륨 크기 (GB)</label>
                        <Controller
                          name="volume_size"
                          control={control}
                          rules={{
                            required: '볼륨 크기를 입력해주세요',
                            min: {
                              value: 1,
                              message: '볼륨 크기는 최소 1GB여야 합니다'
                            },
                            validate: (value) => {
                              if (!value) return true; // 값이 없으면 required 규칙에서 처리
                              const selectedImg = images.find(img => img.id === selectedImage);
                              const minSize = selectedImg?.min_disk || 1;
                              if (value < minSize) {
                                return `선택된 이미지는 최소 ${minSize}GB가 필요합니다`;
                              }
                              return true;
                            }
                          }}
                          render={({ field }) => {
                            const selectedImg = images.find(img => img.id === selectedImage);
                            const minSize = selectedImg?.min_disk || 1;
                            return (
                              <div>
                                <input
                                  {...field}
                                  type="number"
                                  min={minSize}
                                  className={`input w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 ${errors.volume_size ? 'border-red-500' : ''}`}
                                  placeholder={`최소 ${minSize}GB`}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    field.onChange(value);
                                  }}
                                />
                                {selectedImg && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    선택된 이미지 최소 크기: {minSize}GB
                                  </p>
                                )}
                                {errors.volume_size && (
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.volume_size.message}</p>
                                )}
                              </div>
                            );
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">볼륨 타입</label>
                        <Controller
                          name="volume_type"
                          control={control}
                          render={({ field }) => (
                            <select {...field} className="input w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                              <option value="">기본값</option>
                              {volumeTypes.map(vt => (
                                <option key={vt.id} value={vt.name}>{vt.name}</option>
                              ))}
                            </select>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 기존 볼륨 선택 */}
                {volumeSource === 'volume' && (
                  <div className="space-y-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">기존 볼륨 선택</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">사용 가능한 볼륨</label>
                      <Controller
                        name="source_volume_id"
                        control={control}
                        rules={{ required: volumeSource === 'volume' ? '볼륨을 선택해주세요' : false }}
                        render={({ field }) => (
                          <div className="space-y-3">
                            {availableVolumes.length > 0 ? (
                              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                                {availableVolumes.map(volume => (
                                  <label key={volume.id} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                                    <input
                                      type="radio"
                                      value={volume.id}
                                      checked={field.value === volume.id}
                                      onChange={field.onChange}
                                      className="mr-3"
                                    />
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900 dark:text-gray-100">{volume.name || volume.id}</p>
                                      <div className="text-sm text-gray-500 dark:text-gray-400 grid grid-cols-2 gap-4">
                                        <span>크기: {volume.size}GB</span>
                                        <span>타입: {volume.volume_type || '기본값'}</span>
                                        <span>상태: {volume.status}</span>
                                        <span>생성일: {new Date(volume.created_at).toLocaleDateString()}</span>
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 dark:text-gray-400 text-center py-4">사용 가능한 볼륨이 없습니다.</p>
                            )}
                          </div>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* 스냅샷에서 볼륨 생성 */}
                {volumeSource === 'snapshot' && (
                  <div className="space-y-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">스냅샷에서 볼륨 생성</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">스냅샷 선택</label>
                      <Controller
                        name="source_snapshot_id"
                        control={control}
                        rules={{ required: volumeSource === 'snapshot' ? '스냅샷을 선택해주세요' : false }}
                        render={({ field }) => (
                          <div className="space-y-3">
                            {snapshots.length > 0 ? (
                              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                                {snapshots.map(snapshot => (
                                  <label key={snapshot.id} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                                    <input
                                      type="radio"
                                      value={snapshot.id}
                                      checked={field.value === snapshot.id}
                                      onChange={field.onChange}
                                      className="mr-3"
                                    />
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900 dark:text-gray-100">{snapshot.name || `스냅샷-${snapshot.id.slice(0, 8)}`}</p>
                                      <div className="text-sm text-gray-500 dark:text-gray-400 grid grid-cols-2 gap-4">
                                        <span>타입: {snapshot.snapshot_type === 'volume' ? '볼륨' : '이미지'}</span>
                                        <span>크기: {snapshot.size || '-'}GB</span>
                                        <span>상태: {snapshot.status}</span>
                                        <span>생성일: {new Date(snapshot.created_at).toLocaleDateString()}</span>
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <p className="text-gray-500 dark:text-gray-400 mb-2">사용 가능한 스냅샷이 없습니다.</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                  스냅샷 개수: {snapshots.length}개
                                  (콘솔 로그를 확인해보세요)
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      />
                    </div>

                    {selectedSnapshot && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">볼륨 크기 (GB)</label>
                        <Controller
                          name="volume_size"
                          control={control}
                          render={({ field }) => {
                            const selectedSnap = snapshots.find(snap => snap.id === selectedSnapshot);
                            const minSize = selectedSnap?.size || 1;
                            return (
                              <div>
                                <input
                                  {...field}
                                  type="number"
                                  min={minSize}
                                  className="input w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                                  placeholder={`최소 ${minSize}GB (스냅샷 크기)`}
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  스냅샷 크기: {minSize}GB (이 크기보다 크게 설정 가능)
                                </p>
                              </div>
                            );
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 공통 옵션 */}
                {volumeSource !== 'volume' && (
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <label className="flex items-center">
                      <Controller
                        name="delete_on_termination"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                          />
                        )}
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">인스턴스 삭제 시 볼륨도 함께 삭제</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* 플레이버 선택 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">플레이버 선택</h3>
              <Controller
                name="flavor_ref"
                control={control}
                rules={{ required: '플레이버를 선택해주세요' }}
                render={({ field }) => (
                  <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
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
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                        }`}>
                          <div className="flex items-center mb-2">
                            <Cpu className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2" />
                            <p className="font-medium text-gray-900 dark:text-gray-100">{flavor.name}</p>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
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
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.flavor_ref.message}</p>
              )}
            </div>
          </div>
        )}

        {/* 스텝 3: 네트워크 & 보안 */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {/* 네트워크 설정 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">네트워크 설정</h3>
              
              <Controller
                name="networks"
                control={control}
                render={({ field }) => (
                  <div className="space-y-4">
                    <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                      <div className="flex items-center">
                        <Network className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">Private 네트워크</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">기본 내부 네트워크 (자동 IP 할당)</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            인스턴스는 private 네트워크에 자동으로 연결됩니다
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              />
              
              {/* 유동 IP 자동 할당 */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                <Controller
                  name="auto_assign_floating_ip"
                  control={control}
                  render={({ field }) => (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                      />
                      <div className="ml-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">유동 IP 자동 할당</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          인스턴스 생성 후 자동으로 유동 IP를 할당하고 연결합니다. 
                          외부에서 인스턴스에 접근하려면 이 옵션을 활성화하세요.
                        </p>
                      </div>
                    </label>
                  )}
                />
              </div>
            </div>

            {/* 보안 그룹 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">보안 그룹</h3>
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
                    {securityGroups
                      .filter((sg, index, self) => 
                        index === self.findIndex(s => s.name === sg.name)
                      )
                      .map(sg => (
                      <label key={sg.id} className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-700">
                        <input
                          type="radio"
                          name="security_group_radio"
                          checked={field.value === sg.name}
                          onChange={() => field.onChange(sg.name)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                        />
                        <div className="ml-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{sg.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{sg.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* 키 페어 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">키 페어</h3>
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
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                      }`}>
                        <div className="flex items-center">
                          <Key className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2" />
                          <p className="font-medium text-gray-900 dark:text-gray-100">키 페어 없음</p>
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
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                        }`}>
                          <div className="flex items-center mb-2">
                            <Key className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2" />
                            <p className="font-medium truncate text-gray-900 dark:text-gray-100">{kp.name}</p>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">사용자 데이터</h3>
              <Controller
                name="user_data"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={45}
                    className="input w-full font-mono text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
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
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                인스턴스 시작 시 실행될 스크립트를 입력하세요 (cloud-init 형식)
              </p>
            </div>

            {/* 메타데이터 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">메타데이터</h3>
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
                      <div key={key} className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{key}</span>
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-gray-900 dark:text-gray-100">{value}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMetadata(key)}
                          className="p-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {Object.keys(field.value).length === 0 && (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-4">메타데이터가 없습니다</p>
                    )}
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {/* 스텝 5: 검토 & 생성 */}
        {currentStep === 5 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">설정 검토</h3>
            
            <div className="space-y-6">
              {/* 기본 정보 요약 */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">기본 정보</h4>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">이름</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{watch('name')}</dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">가용 영역</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{watch('availability_zone') || '자동 선택'}</dd>
                  </div>
                </dl>
              </div>

              {/* 이미지 & 플레이버 요약 */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">이미지 & 플레이버</h4>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">이미지</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{getSelectedImageInfo()?.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">플레이버</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{getSelectedFlavorInfo()?.name}</dd>
                  </div>
                </dl>
              </div>

              {/* 네트워크 & 보안 요약 */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">네트워크 & 보안</h4>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">네트워크</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center space-x-2">
                        <Network className="h-4 w-4 text-gray-400" />
                        <span>Private 네트워크 (자동 선택)</span>
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          ACTIVE
                        </span>
                      </div>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">보안 그룹</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4 text-gray-400" />
                        <span>{watch('security_groups') || 'default'}</span>
                      </div>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">키 페어</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center space-x-2">
                        <Key className="h-4 w-4 text-gray-400" />
                        <span>{watch('key_name') || '없음'}</span>
                      </div>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">유동 IP 자동 할당</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <span className={watch('auto_assign_floating_ip') ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
                          {watch('auto_assign_floating_ip') ? '예 (외부 접근 가능)' : '아니오 (내부 네트워크만)'}
                        </span>
                      </div>
                    </dd>
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
            className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">보안그룹 생성</h3>
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
                  setValue('security_groups', newSecurityGroup.security_group.name);
                  
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    이름
                  </label>
                  <input
                    name="sg_name"
                    type="text"
                    required
                    className="input w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    placeholder="my-security-group"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    설명
                  </label>
                  <textarea
                    name="sg_description"
                    rows={3}
                    className="input w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    placeholder="보안그룹 설명"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateSecurityGroup(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-700"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">키페어 생성</h3>
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
                  
                  const trimmedName = name.trim();
                  
                  // OpenStack Nova 키페어 이름 규칙 검증 (더 엄격한 규칙)
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
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    키페어 이름
                  </label>
                  <input
                    name="kp_name"
                    type="text"
                    required
                    className="input w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    placeholder="my-keypair"
                  />
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    키페어 생성 후 개인키(.pem 파일)가 자동으로 다운로드됩니다.
                    이 파일을 안전한 곳에 보관하세요.
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateKeyPair(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-700"
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