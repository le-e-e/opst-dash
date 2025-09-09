import toast from 'react-hot-toast';
import { useNotificationStore } from '../store/notification';

// 통합 알림 시스템
export const notify = {
  success: (title: string, message?: string) => {
    toast.success(title);
    const { addNotification } = useNotificationStore.getState();
    addNotification({
      title,
      message: message || title,
      type: 'success'
    });
  },

  error: (title: string, message?: string) => {
    toast.error(title);
    const { addNotification } = useNotificationStore.getState();
    addNotification({
      title,
      message: message || title,
      type: 'error'
    });
  },

  warning: (title: string, message?: string) => {
    toast(title, { icon: '⚠️' });
    const { addNotification } = useNotificationStore.getState();
    addNotification({
      title,
      message: message || title,
      type: 'warning'
    });
  },

  info: (title: string, message?: string) => {
    toast(title, { icon: 'ℹ️' });
    const { addNotification } = useNotificationStore.getState();
    addNotification({
      title,
      message: message || title,
      type: 'info'
    });
  },

  loading: (title: string, message?: string) => {
    toast.loading(title);
    const { addNotification } = useNotificationStore.getState();
    addNotification({
      title,
      message: message || title,
      type: 'info'
    });
  }
};

// 작업별 알림 템플릿
export const workflowNotifications = {
  // 인스턴스 관련
  instanceCreated: (name: string) => {
    notify.success('인스턴스 생성 완료', `"${name}" 인스턴스가 성공적으로 생성되었습니다.`);
  },
  
  instanceDeleted: (name: string) => {
    notify.success('인스턴스 삭제 완료', `"${name}" 인스턴스가 삭제되었습니다.`);
  },
  
  instanceStarted: (name: string) => {
    notify.success('인스턴스 시작', `"${name}" 인스턴스가 시작되었습니다.`);
  },
  
  instanceStopped: (name: string) => {
    notify.success('인스턴스 정지', `"${name}" 인스턴스가 정지되었습니다.`);
  },

  // 볼륨 관련
  volumeCreated: (name: string, size: number) => {
    notify.success('볼륨 생성 완료', `"${name}" 볼륨 (${size}GB)이 생성되었습니다.`);
  },
  
  volumeAttached: (volumeName: string, instanceName: string) => {
    notify.success('볼륨 연결 완료', `"${volumeName}" 볼륨이 "${instanceName}" 인스턴스에 연결되었습니다.`);
  },
  
  volumeDetached: (volumeName: string) => {
    notify.success('볼륨 분리 완료', `"${volumeName}" 볼륨이 분리되었습니다.`);
  },

  // 네트워크 관련
  securityGroupCreated: (name: string) => {
    notify.success('보안그룹 생성', `"${name}" 보안그룹이 생성되었습니다.`);
  },
  
  securityRuleAdded: (groupName: string) => {
    notify.success('보안규칙 추가', `"${groupName}" 보안그룹에 새 규칙이 추가되었습니다.`);
  },

  // 키페어 관련
  keyPairCreated: (name: string) => {
    notify.success('키페어 생성 완료', `"${name}" 키페어가 생성되고 다운로드되었습니다.`);
  },

  // 스냅샷 관련
  snapshotCreated: (name: string) => {
    notify.success('스냅샷 생성 완료', `"${name}" 스냅샷이 생성되었습니다.`);
  },

  // 오류 알림
  apiError: (operation: string, error?: string) => {
    notify.error('작업 실패', `${operation} 중 오류가 발생했습니다. ${error ? `상세: ${error}` : ''}`);
  },
  
  networkError: () => {
    notify.error('네트워크 오류', '서버와의 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.');
  },

  // 시스템 알림
  systemMaintenance: () => {
    notify.warning('시스템 점검', '시스템 점검이 예정되어 있습니다.');
  },
  
  dataRefreshed: () => {
    notify.info('데이터 새로고침', '최신 데이터로 업데이트되었습니다.');
  }
}; 