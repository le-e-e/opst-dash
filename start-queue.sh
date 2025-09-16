#!/bin/bash

echo "🚀 간단한 대기열 서버 시작"
echo "=========================="

# Node.js 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 필요합니다"
    exit 1
fi

# npm 확인
if ! command -v npm &> /dev/null; then
    echo "❌ npm이 필요합니다"
    exit 1
fi

# package.json 복사
if [ ! -f "package.json" ]; then
    echo "📦 package.json 생성..."
    cp queue-package.json package.json
fi

# 의존성 설치
echo "📦 의존성 설치..."
npm install express cors

echo "✅ 준비 완료!"
echo "🌐 서버 시작: http://localhost:3001"
echo "🔍 상태 확인: http://localhost:3001/api/health"
echo ""

# 서버 시작
node queue-server.js
