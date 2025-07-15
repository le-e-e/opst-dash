export const OPENSTACK_ENDPOINTS = {
  KEYSTONE: '/keystone/',
  NOVA: '/nova',
  NEUTRON: '/neutron',
  GLANCE: '/glance',
  CINDER: '/cinder',
  PLACEMENT: '/placement'
} as const;

export const AUTH_CONFIG = {
  PROJECT_DOMAIN_NAME: 'Default',
  USER_DOMAIN_NAME: 'Default',
  PROJECT_NAME: 'admin',
  USERNAME: 'admin',
  PASSWORD: '292747187bb383f8fe73',
  AUTH_URL: '/keystone',
  IDENTITY_API_VERSION: '3',
  IMAGE_API_VERSION: '2'
} as const; 