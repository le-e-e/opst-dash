const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// 대기열 파일
const QUEUE_FILE = './pending-users.json';

// 파일 초기화
if (!fs.existsSync(QUEUE_FILE)) {
  fs.writeFileSync(QUEUE_FILE, '[]');
  console.log('✅ 대기열 파일 생성됨');
}

// 상태 확인
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Queue Server is running',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// 회원가입
app.post('/api/register', (req, res) => {
  console.log('📝 회원가입 요청:', req.body);
  
  try {
    const { name, username, password } = req.body;
    
    if (!name || !username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '모든 필드를 입력해주세요.' 
      });
    }

    // 기존 대기열 읽기
    const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8') || '[]');
    
    // 중복 확인
    if (queue.find(user => user.username === username)) {
      return res.status(409).json({ 
        success: false, 
        message: `사용자명 "${username}"이 이미 존재합니다.` 
      });
    }

    // 새 사용자 추가
    const newUser = {
      id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim(),
      username: username.trim(),
      password: password, // 실제로는 해시화 필요
      status: 'pending',
      requestedAt: new Date().toISOString(),
      ipAddress: req.ip
    };

    queue.push(newUser);
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

    console.log(`✅ 새 회원가입: ${username} (${name})`);
    
    res.json({ 
      success: true, 
      message: `회원가입 요청이 완료되었습니다. 사용자명 "${username}"로 관리자 승인을 기다려주세요.`,
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        status: newUser.status
      }
    });
  } catch (error) {
    console.error('❌ 회원가입 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 대기 사용자 목록
app.get('/api/pending-users', (req, res) => {
  try {
    const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8') || '[]');
    const safeQueue = queue.map(({ password, ...user }) => user); // 비밀번호 제거
    
    res.json({ 
      success: true, 
      users: safeQueue 
    });
  } catch (error) {
    console.error('❌ 대기열 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '대기 사용자 목록을 불러오는데 실패했습니다.' 
    });
  }
});

// 승인
app.post('/api/approve-user/:id', (req, res) => {
  try {
    const { id } = req.params;
    let queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8') || '[]');
    
    const userIndex = queue.findIndex(user => user.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: '승인할 사용자를 찾을 수 없습니다.' 
      });
    }

    const user = queue[userIndex];
    queue.splice(userIndex, 1); // 대기열에서 제거
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

    console.log(`✅ 사용자 승인: ${user.username} (${user.name})`);
    
    res.json({ 
      success: true, 
      message: `${user.name} 사용자가 승인되었습니다.`,
      user: { ...user, password: undefined } // 비밀번호 제거
    });
  } catch (error) {
    console.error('❌ 승인 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '사용자 승인에 실패했습니다.' 
    });
  }
});

// 거부
app.post('/api/reject-user/:id', (req, res) => {
  try {
    const { id } = req.params;
    let queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8') || '[]');
    
    const userIndex = queue.findIndex(user => user.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: '거부할 사용자를 찾을 수 없습니다.' 
      });
    }

    const user = queue[userIndex];
    queue.splice(userIndex, 1); // 대기열에서 제거
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));

    console.log(`❌ 사용자 거부: ${user.username} (${user.name})`);
    
    res.json({ 
      success: true, 
      message: `${user.name} 사용자 요청이 거부되었습니다.` 
    });
  } catch (error) {
    console.error('❌ 거부 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '사용자 거부에 실패했습니다.' 
    });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`
🚀 간단한 대기열 서버 시작!
📍 포트: ${PORT}
📋 파일: ${QUEUE_FILE}
🌐 상태확인: http://localhost:${PORT}/api/health
  `);
});
