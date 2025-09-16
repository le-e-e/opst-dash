export const OPENSTACK_ENDPOINTS = {
  KEYSTONE: '/keystone',
  NOVA: '/nova',
  NEUTRON: '/neutron',
  GLANCE: '/glance',
  CINDER: '/cinder',  // 기본 Cinder 엔드포인트로 복원
  PLACEMENT: '/placement'
} as const;

export const AUTH_CONFIG = {
  PROJECT_DOMAIN_NAME: 'Default',
  USER_DOMAIN_NAME: 'Default',
  PROJECT_NAME: 'admin',
  USERNAME: 'admin',
  PASSWORD: 'qR9oiHHohOK1UMq6EmKCDXJwttooNp0uB4T4yeMe',
  AUTH_URL: '/keystone',
  IDENTITY_API_VERSION: '3',
  IMAGE_API_VERSION: '2',
  REGION_NAME: 'RegionOne',
  INTERFACE: 'internal',
  ENDPOINT_TYPE: 'internalURL'
} as const; 