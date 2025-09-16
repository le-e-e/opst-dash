#!/bin/bash

echo "🚀 OpenStack Dashboard Server 시작"
echo "======================================"

# 현재 디렉토리 확인
if [ ! -f "package.json" ]; then
    echo "❌ server 디렉토리에서 실행해주세요"
    exit 1
fi

# Node.js 설치 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되지 않았습니다"
    echo "Node.js를 설치해주세요: https://nodejs.org/"
    exit 1
fi

# npm 의존성 설치
echo "📦 의존성 설치 중..."
npm install

# 데이터 디렉토리 확인
if [ ! -d "data" ]; then
    echo "📁 데이터 디렉토리 생성 중..."
    mkdir -p data
fi

echo ""
echo "✅ 준비 완료!"
echo "🌐 서버 주소: http://localhost:3001"
echo "🔍 Health Check: http://localhost:3001/api/health"
echo ""
echo "서버를 중지하려면 Ctrl+C를 누르세요"
echo ""

# 서버 시작
npm start
