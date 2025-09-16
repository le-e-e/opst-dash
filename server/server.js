const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3001;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());

// 데이터 파일 경로
const PENDING_USERS_FILE = path.join(__dirname, 'data', 'pending-users.json');
const DATA_DIR = path.join(__dirname, 'data');

// 데이터 디렉토리 생성
async function ensureDataDir() {
  try {
    await fs.ensureDir(DATA_DIR);
    
    // 대기 사용자 파일이 없으면 생성
    if (!await fs.pathExists(PENDING_USERS_FILE)) {
      await fs.writeJson(PENDING_USERS_FILE, []);
      console.log('✅ 대기 사용자 파일 생성 완료');
    }
  } catch (error) {
    console.error('❌ 데이터 디렉토리 생성 실패:', error);
  }
}

// 대기 사용자 목록 읽기
async function getPendingUsers() {
  try {
    const users = await fs.readJson(PENDING_USERS_FILE);
    return Array.isArray(users) ? users : [];
  } catch (error) {
    console.error('대기 사용자 읽기 실패:', error);
    return [];
  }
}

// 대기 사용자 목록 저장
async function savePendingUsers(users) {
  try {
    await fs.writeJson(PENDING_USERS_FILE, users, { spaces: 2 });
    return true;
  } catch (error) {
    console.error('대기 사용자 저장 실패:', error);
    return false;
  }
}

// API 라우트들

// 1. 회원가입 요청
app.post('/api/register', async (req, res) => {
  try {
    const { name, username, password } = req.body;
    
    // 입력 검증
    if (!name?.trim() || !username?.trim() || !password?.trim()) {
      return res.status(400).json({
        success: false,
        message: '모든 필드를 입력해주세요.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '비밀번호는 최소 6자 이상이어야 합니다.'
      });
    }

    // 기존 사용자 확인
    const pendingUsers = await getPendingUsers();
    const existingUser = pendingUsers.find(user => 
      user.username === username.trim()
    );

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `사용자명 "${username}"이 이미 존재합니다.`
      });
    }

    // 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 새 사용자 생성
    const newUser = {
      id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      username: username.trim(),
      password: hashedPassword,
      email: username.trim(),
      description: `${name.trim()} - Pending approval`,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      enabled: false,
      domain: { id: 'default', name: 'Default' },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    // 사용자 추가 및 저장
    pendingUsers.push(newUser);
    const saved = await savePendingUsers(pendingUsers);

    if (!saved) {
      return res.status(500).json({
        success: false,
        message: '회원가입 정보 저장에 실패했습니다.'
      });
    }

    console.log(`✅ 새 회원가입 요청: ${username} (${name})`);

    res.json({
      success: true,
      message: `회원가입 요청이 완료되었습니다. 사용자명 "${username}"로 관리자 승인을 기다려주세요.`,
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        status: newUser.status,
        requestedAt: newUser.requestedAt
      }
    });

  } catch (error) {
    console.error('회원가입 처리 실패:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 2. 대기 사용자 목록 조회
app.get('/api/pending-users', async (req, res) => {
  try {
    const pendingUsers = await getPendingUsers();
    
    // 비밀번호 제거하고 반환
    const safeUsers = pendingUsers.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });

    res.json({
      success: true,
      users: safeUsers
    });
  } catch (error) {
    console.error('대기 사용자 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '대기 사용자 목록을 불러오는데 실패했습니다.'
    });
  }
});

// 3. 사용자 승인
app.post('/api/approve-user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const pendingUsers = await getPendingUsers();
    const userIndex = pendingUsers.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '승인할 사용자를 찾을 수 없습니다.'
      });
    }

    const userToApprove = pendingUsers[userIndex];
    
    // 승인된 사용자를 배열에서 제거
    pendingUsers.splice(userIndex, 1);
    await savePendingUsers(pendingUsers);

    console.log(`✅ 사용자 승인: ${userToApprove.username} (${userToApprove.name})`);

    res.json({
      success: true,
      message: `${userToApprove.name} 사용자가 승인되었습니다.`,
      user: {
        ...userToApprove,
        password: undefined // 비밀번호는 반환하지 않음
      }
    });

  } catch (error) {
    console.error('사용자 승인 실패:', error);
    res.status(500).json({
      success: false,
      message: '사용자 승인 처리에 실패했습니다.'
    });
  }
});

// 4. 사용자 거부
app.post('/api/reject-user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const pendingUsers = await getPendingUsers();
    const userIndex = pendingUsers.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '거부할 사용자를 찾을 수 없습니다.'
      });
    }

    const userToReject = pendingUsers[userIndex];
    
    // 거부된 사용자를 배열에서 제거
    pendingUsers.splice(userIndex, 1);
    await savePendingUsers(pendingUsers);

    console.log(`❌ 사용자 거부: ${userToReject.username} (${userToReject.name})`);

    res.json({
      success: true,
      message: `${userToReject.name} 사용자 요청이 거부되었습니다.`
    });

  } catch (error) {
    console.error('사용자 거부 실패:', error);
    res.status(500).json({
      success: false,
      message: '사용자 거부 처리에 실패했습니다.'
    });
  }
});

// 5. 서버 상태 확인
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'OpenStack Dashboard Server is running',
    timestamp: new Date().toISOString(),
    pendingUsersFile: PENDING_USERS_FILE
  });
});

// 6. 통계 정보
app.get('/api/stats', async (req, res) => {
  try {
    const pendingUsers = await getPendingUsers();
    
    res.json({
      success: true,
      stats: {
        totalPendingUsers: pendingUsers.length,
        oldestRequest: pendingUsers.length > 0 
          ? Math.min(...pendingUsers.map(u => new Date(u.requestedAt).getTime()))
          : null,
        newestRequest: pendingUsers.length > 0
          ? Math.max(...pendingUsers.map(u => new Date(u.requestedAt).getTime()))
          : null
      }
    });
  } catch (error) {
    console.error('통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '통계 정보를 불러오는데 실패했습니다.'
    });
  }
});

// 서버 시작
async function startServer() {
  await ensureDataDir();
  
  app.listen(PORT, () => {
    console.log(`
🚀 OpenStack Dashboard Server Started!
📍 Port: ${PORT}
📁 Data Directory: ${DATA_DIR}
📋 Pending Users File: ${PENDING_USERS_FILE}
🌐 Health Check: http://localhost:${PORT}/api/health
    `);
  });
}

startServer().catch(console.error);
