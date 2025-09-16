# OpenStack Dashboard Server

다른 네트워크에서도 회원가입과 승인이 가능한 백엔드 서버입니다.

## 🚀 설치 및 실행

### 1. 의존성 설치
```bash
cd server
npm install
```

### 2. 서버 시작
```bash
# 개발 모드 (자동 재시작)
npm run dev

# 프로덕션 모드
npm start
```

### 3. 서버 확인
- Health Check: http://localhost:3001/api/health
- 통계: http://localhost:3001/api/stats

## 📁 데이터 저장

- 대기 사용자 정보: `./data/pending-users.json`
- 자동으로 `data` 폴더와 JSON 파일이 생성됩니다.

## 🌐 API 엔드포인트

### 회원가입
```bash
POST http://localhost:3001/api/register
Content-Type: application/json

{
  "name": "홍길동",
  "username": "gildong",
  "password": "password123"
}
```

### 대기 사용자 목록
```bash
GET http://localhost:3001/api/pending-users
```

### 사용자 승인
```bash
POST http://localhost:3001/api/approve-user/{userId}
```

### 사용자 거부
```bash
POST http://localhost:3001/api/reject-user/{userId}
```

## 🔧 설정

### 포트 변경
`server.js` 파일에서 `PORT` 변수를 수정하세요.

### CORS 설정
다른 도메인에서 접근하려면 `cors` 설정을 수정하세요.

## 🔒 보안

- 비밀번호는 bcrypt로 해시화됩니다.
- 요청 IP 주소와 User-Agent가 기록됩니다.
- 실제 운영 환경에서는 HTTPS를 사용하세요.

## 📊 로그

서버 콘솔에서 다음 정보를 확인할 수 있습니다:
- 새 회원가입 요청
- 사용자 승인/거부
- API 오류

## 🔄 데이터 백업

`data/pending-users.json` 파일을 정기적으로 백업하세요.
