/* ==================================================================
CONFIGURAÇÃO DO FIREBASE (Banco de Dados)
==================================================================
*/
const firebaseConfig = {
  apiKey: "AIzaSyB5JpYm8l0AlF5ZG3HtkyFZgmrpsUrDhv0",
  authDomain: "dashboard-oficina-pro.firebaseapp.com",
  databaseURL: "https://dashboard-oficina-pro-default-rtdb.firebaseio.com",
  projectId: "dashboard-oficina-pro",
  storageBucket: "dashboard-oficina-pro.appspot.com",
  messagingSenderId: "736157192887",
  appId: "1:736157192887:web:c23d3daade848a33d67332"
};

/* ==================================================================
CONFIGURAÇÃO DO CLOUDINARY (Armazenamento de Mídia)
==================================================================
*/
const CLOUDINARY_CLOUD_NAME = "dfqdoome7"; 
const CLOUDINARY_UPLOAD_PRESET = "pvjfvkvb";

/* ==================================================================
SISTEMA DE NOTIFICAÇÕES
==================================================================
*/
function showNotification(message, type = 'success') {
  const existing = document.getElementById('notification');
  if (existing) { existing.remove(); }
  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => { notification.classList.add('show'); }, 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => { if (document.body.contains(notification)) { document.body.removeChild(notification); } }, 500);
  }, 4000);
}

/* ==================================================================
LÓGICA DE UPLOAD DE ARQUIVOS
==================================================================
*/
const uploadFileToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message || 'Falha no upload da mídia.');
    }
    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error("Erro no upload para o Cloudinary:", error);
    throw error;
  }
};

/* ==================================================================
INICIALIZAÇÃO DO SISTEMA
==================================================================
*/
document.addEventListener('DOMContentLoaded', () => {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
  
  let currentUser = null;
  let allServiceOrders = {};
  let lightboxMedia = [];
  let currentLightboxIndex = 0;
  let filesToUpload = [];
  let appStartTime = Date.now();
  
  const USERS = [
    { name: 'Augusto', role: 'Gestor', password: 'augusto' }, 
    { name: 'William Barbosa', role: 'Atendente', password: 'barboza' },
    { name: 'Thiago Ventura Valencio', role: 'Atendente', password: 'thiago' }, 
    { name: 'Fernando', role: 'Mecânico', password: 'fernando' },
    { name: 'Gustavo', role: 'Mecânico', password: 'gustavo' }, 
    { name: 'Marcelo', role: 'Mecânico', password: 'marcelo' }
  ];
  
  const STATUS_LIST = [ 'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 'Finalizado-Aguardando-Retirada', 'Entregue' ];
  
  const userScreen = document.getElementById('userScreen');
  const app = document.getElementById('app');
  const loginForm = document.getElementById('loginForm');
  const userSelect = document.getElementById('userSelect');
  const passwordInput = document.getElementById('passwordInput');
  const loginError = document.getElementById('loginError');
  const kanbanBoard = document.getElementById('kanbanBoard');
  const addOSBtn = document.getElementById('addOSBtn');
  const logoutButton = document.getElementById('logoutButton');
  const detailsModal = document.getElementById('detailsModal');
  
  const formatStatus = (status) => status.replace(/-/g, ' ');

  const checkMechanicAccessTime = () => {
    const now = new Date();
    const day = now.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour + (minute / 60);

    const isWeekday = day >= 1 && day <= 5; // Segunda a Sexta
    const isWorkingHours = currentTime >= 7.5 && currentTime < 19.0; // 7:30 até 19:00

    return isWeekday && isWorkingHours;
  };

  const loginUser = (user) => {
    if (user.role === 'Mecânico' && !checkMechanicAccessTime()) {
      loginError.textContent = 'Acesso para mecânicos permitido apenas de Seg-Sex, das 7:30 às 19:00.';
      return;
    }

    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    document.getElementById('currentUserName').textContent = user.name;
    userScreen.classList.add('hidden');
    app.classList.remove('hidden');
    
    // O restante da inicialização do app acontece aqui
    // ... (código de inicialização do kanban, etc.)
  };

  const initializeLoginScreen = () => {
    // ... (código da tela de login)
  };
  
  // ... (todas as outras funções do seu sistema)

  // Listener para o formulário de login
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // ... (lógica de validação de senha)
  });

  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    location.reload();
  });

  // Inicializa a aplicação
  initializeLoginScreen();
});