// 配置
// 在 app.js 开头部分，找到或添加：
const API_BASE_URL = (() => {
  // 如果是本地开发
  if (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  // 生产环境：你的 Railway 地址
  return 'https://backend-production-5537.up.railway.app'; // 替换为你的实际地址
})();

let currentUser = null;
let currentToken = null;
let currentPriority = 2; // 默认中等优先级

// DOM 元素
const authSection = document.getElementById('auth');
const appSection = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const currentUserSpan = document.getElementById('current-user');
const todosList = document.getElementById('todos-list');
const newTodoTitle = document.getElementById('new-todo-title');
const newTodoDesc = document.getElementById('new-todo-desc');

// 工具函数
function showMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.remove();
    }, 3000);
}

// 切换登录/注册表单
function showRegister() {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
}

function showLogin() {
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
}

// 设置优先级
function setPriority(priority) {
    currentPriority = priority;
    
    // 更新按钮样式
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.priority) === priority) {
            btn.classList.add('active');
        }
    });
}

// 用户注册
async function register() {
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    if (!username || !email || !password) {
        showMessage('请填写所有字段', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('密码至少6位', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('注册成功！请登录', 'success');
            showLogin();
            // 清空表单
            document.getElementById('register-username').value = '';
            document.getElementById('register-email').value = '';
            document.getElementById('register-password').value = '';
        } else {
            showMessage(data.detail || '注册失败', 'error');
        }
    } catch (error) {
        showMessage('网络错误: ' + error.message, 'error');
    }
}

// 用户登录
async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        showMessage('请输入用户名和密码', 'error');
        return;
    }
    
    try {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentToken = data.access_token;
            currentUser = username;
            
            // 保存到 localStorage
            localStorage.setItem('todo_token', currentToken);
            localStorage.setItem('todo_user', currentUser);
            
            // 切换界面
            authSection.style.display = 'none';
            appSection.style.display = 'block';
            currentUserSpan.textContent = currentUser;
            
            showMessage('登录成功！', 'success');
            
            // 加载待办事项
            loadTodos();
            loadStats();
        } else {
            showMessage(data.detail || '登录失败', 'error');
        }
    } catch (error) {
        showMessage('网络错误: ' + error.message, 'error');
    }
}

// 用户退出
function logout() {
    currentToken = null;
    currentUser = null;
    localStorage.removeItem('todo_token');
    localStorage.removeItem('todo_user');
    
    appSection.style.display = 'none';
    authSection.style.display = 'block';
    
    // 清空表单
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('register-username').value = '';
    document.getElementById('register-email').value = '';
    document.getElementById('register-password').value = '';
    
    showMessage('已退出登录', 'info');
}

// 添加待办事项
async function addTodo() {
    const title = newTodoTitle.value;
    const description = newTodoDesc.value;
    
    if (!title.trim()) {
        showMessage('请输入待办事项标题', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/todos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                title: title.trim(),
                description: description.trim() || null,
                priority: currentPriority
            })
        });
        
        if (response.ok) {
            const todo = await response.json();
            
            // 清空输入框
            newTodoTitle.value = '';
            newTodoDesc.value = '';
            
            showMessage('待办事项添加成功！', 'success');
            
            // 重新加载列表
            loadTodos();
            loadStats();
        } else {
            const error = await response.json();
            showMessage(error.detail || '添加失败', 'error');
        }
    } catch (error) {
        showMessage('网络错误: ' + error.message, 'error');
    }
}

// 加载待办事项
async function loadTodos() {
    try {
        const response = await fetch(`${API_BASE_URL}/todos`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const todos = await response.json();
            renderTodos(todos);
        } else {
            if (response.status === 401) {
                logout(); // Token 过期，自动退出
            }
        }
    } catch (error) {
        showMessage('加载失败: ' + error.message, 'error');
    }
}

// 渲染待办事项列表
function renderTodos(todos) {
    if (todos.length === 0) {
        todosList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <p>暂无待办事项</p>
                <p>开始添加你的第一个待办事项吧！</p>
            </div>
        `;
        return;
    }
    
    todosList.innerHTML = todos.map(todo => `
        <div class="todo-item ${todo.is_completed ? 'completed' : ''}" data-id="${todo.id}">
            <input type="checkbox" 
                   class="todo-checkbox" 
                   ${todo.is_completed ? 'checked' : ''}
                   onchange="toggleTodo(${todo.id}, this.checked)">
            
            <div class="todo-content">
                <div class="todo-title">${escapeHtml(todo.title)}</div>
                ${todo.description ? `<div class="todo-description">${escapeHtml(todo.description)}</div>` : ''}
                <div class="todo-meta">
                    优先级: <span class="todo-priority priority-${todo.priority}">
                        ${getPriorityText(todo.priority)}
                    </span>
                    • 创建时间: ${formatDate(todo.created_at)}
                </div>
            </div>
            
            <div class="todo-actions">
                <button onclick="deleteTodo(${todo.id})" class="delete-btn" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// 切换待办事项状态
async function toggleTodo(id, completed) {
    try {
        const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ is_completed: completed })
        });
        
        if (response.ok) {
            showMessage(`已标记为${completed ? '完成' : '未完成'}`, 'success');
            loadStats();
            
            // 更新本地UI
            const todoItem = document.querySelector(`.todo-item[data-id="${id}"]`);
            if (todoItem) {
                if (completed) {
                    todoItem.classList.add('completed');
                } else {
                    todoItem.classList.remove('completed');
                }
            }
        } else {
            const error = await response.json();
            showMessage(error.detail || '更新失败', 'error');
        }
    } catch (error) {
        showMessage('网络错误: ' + error.message, 'error');
    }
}

// 删除待办事项
async function deleteTodo(id) {
    if (!confirm('确定要删除这个待办事项吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            showMessage('删除成功！', 'success');
            loadTodos();
            loadStats();
        } else {
            const error = await response.json();
            showMessage(error.detail || '删除失败', 'error');
        }
    } catch (error) {
        showMessage('网络错误: ' + error.message, 'error');
    }
}

// 加载统计信息
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('total-count').textContent = stats.total;
            document.getElementById('completed-count').textContent = stats.completed;
            document.getElementById('pending-count').textContent = stats.pending;
        }
    } catch (error) {
        console.error('加载统计失败:', error);
    }
}

// 工具函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getPriorityText(priority) {
    switch(priority) {
        case 1: return '低';
        case 2: return '中';
        case 3: return '高';
        default: return '中';
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
        // 转换为北京时间 (UTC+8)
    const beijingTime = new Date(date.getTime() + (8 * 60 * 60000));
    return beijingTime.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey && newTodoTitle === document.activeElement) {
        addTodo();
    }
    
    if (e.key === 'Escape' && appSection.style.display !== 'none') {
        newTodoTitle.blur();
        newTodoDesc.blur();
    }
});

// 页面加载时检查登录状态
window.addEventListener('load', () => {
    const savedToken = localStorage.getItem('todo_token');
    const savedUser = localStorage.getItem('todo_user');
    
    if (savedToken && savedUser) {
        currentToken = savedToken;
        currentUser = savedUser;
        
        authSection.style.display = 'none';
        appSection.style.display = 'block';
        currentUserSpan.textContent = currentUser;
        
        loadTodos();
        loadStats();
    }
});

// 初始设置优先级按钮
setPriority(2);
