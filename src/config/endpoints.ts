export const OPENSTACK_ENDPOINTS = {
  KEYSTONE: 'http://controller:5000/v3/',
  NOVA: 'http://controller:8774/v2.1',
  NEUTRON: 'http://controller:9696',
  GLANCE: 'http://controller:9292',
  CINDER: 'http://controller:8776/v3/e70a1557498a46e08839fdfb88fd9a1d',
  PLACEMENT: 'http://controller:8778'
} as const;

export const AUTH_CONFIG = {
  PROJECT_DOMAIN_NAME: 'Default',
  USER_DOMAIN_NAME: 'Default',
  PROJECT_NAME: 'admin',
  USERNAME: 'admin',
  PASSWORD: '292747187bb383f8fe73',
  AUTH_URL: 'http://controller:5000/v3',
  IDENTITY_API_VERSION: '3',
  IMAGE_API_VERSION: '2'
} as const; 