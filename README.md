# OpenStack Dashboard

OpenStack 클라우드 인프라 관리를 위한 현대적인 웹 대시보드입니다.

## 주요 기능

- **인증 관리**: Keystone 서비스를 통한 안전한 로그인/로그아웃
- **컴퓨트 관리**: Nova 서비스를 통한 가상 머신 인스턴스 관리
- **네트워크 관리**: Neutron 서비스를 통한 네트워크, 서브넷, 라우터 관리
- **스토리지 관리**: Cinder 서비스를 통한 볼륨 및 스냅샷 관리
- **이미지 관리**: Glance 서비스를 통한 VM 이미지 관리
- **실시간 모니터링**: 리소스 사용량 및 상태 모니터링
- **반응형 UI**: 모바일 및 데스크톱 환경 모두 지원

## 기술 스택

- **Frontend**: React 18 + TypeScript
- **UI Framework**: Tailwind CSS
- **상태 관리**: Zustand
- **라우팅**: React Router
- **차트**: Recharts
- **아이콘**: Lucide React
- **폼 관리**: React Hook Form
- **알림**: React Hot Toast
- **HTTP 클라이언트**: Axios
- **빌드 도구**: Vite

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 에 접속하여 대시보드를 확인할 수 있습니다.

### 3. 프로덕션 빌드

```bash
npm run build
```

### 4. 빌드 결과 미리보기

```bash
npm run preview
```

## 설정

### OpenStack 엔드포인트 설정

`src/config/endpoints.ts` 파일에서 OpenStack 서비스 엔드포인트를 설정할 수 있습니다:

```typescript
export const OPENSTACK_ENDPOINTS = {
  KEYSTONE: 'http://controller:5000/v3/',
  NOVA: 'http://controller:8774/v2.1',
  NEUTRON: 'http://controller:9696',
  GLANCE: 'http://controller:9292',
  CINDER: 'http://controller:8776/v3/e70a1557498a46e08839fdfb88fd9a1d',
  PLACEMENT: 'http://controller:8778'
};
```

### 인증 설정

기본 인증 설정을 `src/config/endpoints.ts`에서 수정할 수 있습니다:

```typescript
export const AUTH_CONFIG = {
  PROJECT_DOMAIN_NAME: 'Default',
  USER_DOMAIN_NAME: 'Default',
  PROJECT_NAME: 'admin',
  USERNAME: 'admin',
  PASSWORD: '292747187bb383f8fe73',
  AUTH_URL: 'http://controller:5000/v3',
  IDENTITY_API_VERSION: '3',
  IMAGE_API_VERSION: '2'
};
```

## 사용 방법

### 1. 로그인

- OpenStack 관리자 계정으로 로그인
- 기본 설정을 사용하거나 사용자 지정 프로젝트/도메인 지정 가능

### 2. 대시보드

- 전체 리소스 현황 요약
- 실시간 사용량 차트
- 최근 활동 로그

### 3. 컴퓨트 관리

- 가상 머신 인스턴스 목록 조회
- 인스턴스 재시작/삭제
- 인스턴스 생성 (UI 준비됨)

### 4. 네트워크 관리

- 네트워크, 서브넷, 라우터 관리
- 탭 기반 분류된 인터페이스
- 네트워크 리소스 생성/삭제

### 5. 볼륨 관리

- 블록 스토리지 볼륨 관리
- 스냅샷 관리
- 볼륨 생성/삭제

### 6. 이미지 관리

- VM 이미지 업로드/다운로드
- 이미지 메타데이터 관리
- 이미지 보호 설정

## 프로젝트 구조

```
src/
├── components/          # 재사용 가능한 컴포넌트
│   ├── LoginPage.tsx   # 로그인 페이지
│   └── Layout.tsx      # 메인 레이아웃
├── pages/              # 페이지 컴포넌트
│   ├── Dashboard.tsx   # 대시보드 메인
│   ├── ComputePage.tsx # 컴퓨트 관리
│   ├── NetworkPage.tsx # 네트워크 관리
│   ├── VolumePage.tsx  # 볼륨 관리
│   └── ImagesPage.tsx  # 이미지 관리
├── services/           # API 서비스
│   ├── auth.ts        # 인증 서비스
│   └── openstack.ts   # OpenStack API 클라이언트
├── store/             # 상태 관리
│   └── auth.ts        # 인증 상태
└── config/            # 설정 파일
    └── endpoints.ts   # API 엔드포인트
```

## 보안 고려사항

- 모든 API 호출은 인증 토큰을 통해 보호됨
- 토큰은 브라우저 로컬 스토리지에 저장되며 만료 시 자동 갱신
- HTTPS 사용 권장
- 프로덕션 환경에서는 민감한 정보 환경 변수 사용 필요

## 기여 방법

1. 저장소 포크
2. 기능 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경 사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 푸시 (`git push origin feature/AmazingFeature`)
5. 풀 리퀘스트 생성

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 지원

문제가 발생하거나 기능 요청이 있으시면 GitHub Issues를 통해 문의해주세요. 