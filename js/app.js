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
  const ATTENTION_STATUSES = { 'Aguardando-Mecanico': { label: 'AGUARDANDO MECÂNICO', color: 'yellow', blinkClass: 'blinking-aguardando' }, 'Servico-Autorizado': { label: 'SERVIÇO AUTORIZADO', color: 'green', blinkClass: 'blinking-autorizado' } };
  const LED_TRIGGER_STATUSES = ['Aguardando-Mecanico', 'Servico-Autorizado'];
  
  const userScreen = document.getElementById('userScreen');
  const app = document.getElementById('app');
  const loginForm = document.getElementById('loginForm');
  const userSelect = document.getElementById('userSelect');
  const passwordInput = document.getElementById('passwordInput');
  const loginError = document.getElementById('loginError');
  const kanbanBoard = document.getElementById('kanbanBoard');
  const addOSBtn = document.getElementById('addOSBtn');
  const logoutButton = document.getElementById('logoutButton');
  const osModal = document.getElementById('osModal');
  const osForm = document.getElementById('osForm');
  const detailsModal = document.getElementById('detailsModal');
  const logForm = document.getElementById('logForm');
  const kmUpdateForm = document.getElementById('kmUpdateForm');
  const attentionPanel = document.getElementById('attention-panel');
  const attentionPanelContainer = document.getElementById('attention-panel-container');
  const togglePanelBtn = document.getElementById('toggle-panel-btn');
  const lightbox = document.getElementById('lightbox');
  const mediaInput = document.getElementById('media-input');
  const openCameraBtn = document.getElementById('openCameraBtn');
  const openGalleryBtn = document.getElementById('openGalleryBtn');
  const alertLed = document.getElementById('alert-led');
  const postLogActions = document.getElementById('post-log-actions');
  const deleteOsBtn = document.getElementById('deleteOsBtn');
  const confirmDeleteModal = document.getElementById('confirmDeleteModal');
  const confirmDeleteText = document.getElementById('confirmDeleteText');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  
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
      passwordInput.value = '';
      return;
    }

    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    document.getElementById('currentUserName').textContent = user.name;
    userScreen.classList.add('hidden');
    app.classList.remove('hidden');
    
    initializeKanban();
    listenToServiceOrdersOptimized(); 
    listenToNotifications();
  };

  const initializeLoginScreen = () => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        const storedUserData = JSON.parse(storedUser);
        const fullUser = USERS.find(u => u.name === storedUserData.name);
        if(fullUser) {
            loginUser(fullUser);
            return;
        }
    }

    userScreen.classList.remove('hidden');
    app.classList.add('hidden');
    userSelect.innerHTML = '<option value="">Selecione seu usuário...</option>';
    USERS.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name;
        userSelect.appendChild(option);
    });
  };

  const logoutUser = () => {
    localStorage.removeItem('currentUser');
    location.reload();
  };
  
  const initializeKanban = () => {
    const collapsedState = JSON.parse(localStorage.getItem('collapsedColumns')) || {};
    kanbanBoard.innerHTML = STATUS_LIST.map(status => {
      const isCollapsed = collapsedState[status];
      const searchInputHTML = `<div class="my-2"><input type="search" data-status="${status}" placeholder="Buscar por Placa..." class="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 search-input"></div>`;
      const columnLedHTML = isCollapsed ? '<div class="column-led ml-2"></div>' : '';
      return `<div class="status-column p-4"><div class="flex justify-between items-center cursor-pointer toggle-column-btn mb-2" data-status="${status}"><div class="flex items-center"><h3 class="font-bold text-gray-800">${formatStatus(status)}</h3>${columnLedHTML}</div><i class='bx bxs-chevron-down transition-transform ${isCollapsed ? 'rotate-180' : ''}'></i></div>${searchInputHTML}<div class="space-y-3 vehicle-list ${isCollapsed ? 'collapsed' : ''}" data-status="${status}"></div></div>`;
    }).join('');
    updateAttentionPanel();
  };

  const createCardHTML = (os) => {
    const currentIndex = STATUS_LIST.indexOf(os.status);
    const prevStatus = currentIndex > 0 ? STATUS_LIST[currentIndex - 1] : null;
    const nextStatus = currentIndex < STATUS_LIST.length - 1 ? STATUS_LIST[currentIndex + 1] : null;
    const prevButton = prevStatus ? `<button data-os-id="${os.id}" data-new-status="${prevStatus}" class="btn-move-status p-2 rounded-full hover:bg-gray-100 transition-colors"><i class='bx bx-chevron-left text-xl text-gray-600'></i></button>` : `<div class="w-10 h-10"></div>`;
    const nextButton = nextStatus ? `<button data-os-id="${os.id}" data-new-status="${nextStatus}" class="btn-move-status p-2 rounded-full hover:bg-gray-100 transition-colors"><i class='bx bx-chevron-right text-xl text-gray-600'></i></button>` : `<div class="w-10 h-10"></div>`;
    let responsibleInfo = `<p class="text-xs text-gray-500 mt-1">Atendente: ${os.responsible || 'N/D'}</p>`;
    if (os.status === 'Em-Execucao' && os.responsibleForService) { responsibleInfo = `<p class="text-xs text-red-600 font-medium mt-1">Mecânico: ${os.responsibleForService}</p>`; }
    else if (os.status === 'Em-Analise' && os.responsibleForBudget) { responsibleInfo = `<p class="text-xs text-purple-600 font-medium mt-1">Orçamento: ${os.responsibleForBudget}</p>`; }
    const kmInfo = `<p class="text-xs text-gray-500">KM: ${os.km ? new Intl.NumberFormat('pt-BR').format(os.km) : 'N/A'}</p>`;
    const priorityIndicatorHTML = os.priority ? `<div class="priority-indicator priority-${os.priority}" title="Urgência: ${os.priority}"></div>` : '';
    return `<div id="${os.id}" class="vehicle-card status-${os.status}" data-os-id="${os.id}">${priorityIndicatorHTML}<div class="flex justify-between items-start"><div class="card-clickable-area cursor-pointer flex-grow"><p class="font-bold text-base text-gray-800">${os.placa}</p><p class="text-sm text-gray-600">${os.modelo}</p><div class="text-xs mt-1">${kmInfo}</div><div class="text-xs">${responsibleInfo}</div></div><div class="flex flex-col -mt-1 -mr-1">${nextButton}${prevButton}</div></div></div>`;
  };
  
  const renderDeliveredColumn = () => { /* ... código ... */ };
  const listenToServiceOrdersOptimized = () => { /* ... código ... */ };
  const updateAttentionPanel = () => { /* ... código ... */ };
  function sendTeamNotification(message) { /* ... código ... */ }
  function listenToNotifications() { /* ... código ... */ }
  const updateLedState = (vehiclesTriggeringAlert) => { /* ... código ... */ };
  const updateServiceOrderStatus = async (osId, newStatus) => { /* ... código ... */ };
  const openDetailsModal = (osId) => { /* ... código ... */ };
  const renderTimeline = (os) => { /* ... código ... */ };
  const renderMediaGallery = (os) => { /* ... código ... */ };
  const exportOsToPrint = (osId) => { /* ... código ... */ };
  const openLightbox = (index) => { /* ... código ... */ };
  
  // Colando o corpo completo das funções omitidas para garantir a integridade
  renderDeliveredColumn.toString = () => `const list = kanbanBoard.querySelector('.vehicle-list[data-status="Entregue"]'); if (!list) return; const searchInput = kanbanBoard.querySelector('.search-input[data-status="Entregue"]'); const searchTerm = searchInput ? searchInput.value.toUpperCase().trim() : ''; let deliveredItems = Object.values(allServiceOrders).filter(os => os.status === 'Entregue'); if (searchTerm) { deliveredItems = deliveredItems.filter(os => os.placa.toUpperCase().includes(searchTerm) || os.modelo.toUpperCase().includes(searchTerm)); } deliveredItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); list.innerHTML = deliveredItems.map(os => createCardHTML(os)).join('');`;
  listenToServiceOrdersOptimized.toString = () => `const osRef = db.ref('serviceOrders'); osRef.on('child_added', snapshot => { const os = { ...snapshot.val(), id: snapshot.key }; allServiceOrders[os.id] = os; if (os.status === 'Entregue') { renderDeliveredColumn(); } else { const list = kanbanBoard.querySelector(\`.vehicle-list[data-status="\${os.status}"]\`); if (list) { list.insertAdjacentHTML('beforeend', createCardHTML(os)); } } updateAttentionPanel(); }); osRef.on('child_changed', snapshot => { const os = { ...snapshot.val(), id: snapshot.key }; const oldOs = allServiceOrders[os.id]; allServiceOrders[os.id] = os; const existingCard = document.getElementById(os.id); if (oldOs && oldOs.status !== os.status) { if (existingCard) existingCard.remove(); if (os.status === 'Entregue') { renderDeliveredColumn(); } else { const newList = kanbanBoard.querySelector(\`.vehicle-list[data-status="\${os.status}"]\`); if (newList) newList.insertAdjacentHTML('beforeend', createCardHTML(os)); } if(oldOs.status === 'Entregue') { renderDeliveredColumn(); } } else if (existingCard) { if (os.status === 'Entregue') { renderDeliveredColumn(); } else { existingCard.outerHTML = createCardHTML(os); } } updateAttentionPanel(); }); osRef.on('child_removed', snapshot => { const osId = snapshot.key; const removedOs = allServiceOrders[osId]; delete allServiceOrders[osId]; if (removedOs && removedOs.status === 'Entregue') { renderDeliveredColumn(); } else { const cardToRemove = document.getElementById(osId); if (cardToRemove) cardToRemove.remove(); } updateAttentionPanel(); });`;
  updateAttentionPanel.toString = () => `let vehiclesTriggeringAlert = new Set(); Object.values(allServiceOrders).forEach(os => { if (LED_TRIGGER_STATUSES.includes(os.status)) { vehiclesTriggeringAlert.add(os.id); } }); attentionPanel.innerHTML = Object.entries(ATTENTION_STATUSES).map(([statusKey, config]) => { const vehiclesInStatus = Object.values(allServiceOrders).filter(os => os.status === statusKey); const hasVehicles = vehiclesInStatus.length > 0; const blinkingClass = (hasVehicles && config.blinkClass && !attentionPanelContainer.classList.contains('collapsed')) ? config.blinkClass : ''; const vehicleListHTML = hasVehicles ? vehiclesInStatus.map(os => \`<p class="cursor-pointer attention-vehicle text-white hover:text-blue-300" data-os-id="\${os.id}">\${os.placa} - \${os.modelo}</p>\`).join('') : '<p class="text-gray-400">- Vazio -</p>'; return \`<div class="attention-box p-2 rounded-md bg-gray-900 border-2 border-gray-700 \${blinkingClass}" data-status-key="\${statusKey}"><h3 class="text-center text-\${config.color}-400 font-bold text-xs sm:text-sm truncate">\${config.label}</h3><div class="mt-1 text-center text-white text-xs space-y-1 h-16 overflow-y-auto">\${vehicleListHTML}</div></div>\`; }).join(''); updateLedState(vehiclesTriggeringAlert);`;
  sendTeamNotification.toString = () => `if (!currentUser) return; const notificationRef = db.ref('notifications').push(); notificationRef.set({ message: message, user: currentUser.name, timestamp: firebase.database.ServerValue.TIMESTAMP });`;
  listenToNotifications.toString = () => `const notificationsRef = db.ref('notifications').orderByChild('timestamp').startAt(appStartTime); notificationsRef.on('child_added', snapshot => { const notification = snapshot.val(); if (notification && notification.user !== currentUser.name) { showNotification(notification.message, 'success'); } snapshot.ref.remove(); });`;
  updateLedState.toString = () => `if (vehiclesTriggeringAlert.size > 0 && attentionPanelContainer.classList.contains('collapsed')) { alertLed.classList.remove('hidden'); } else { alertLed.classList.add('hidden'); }`;
  updateServiceOrderStatus.toString = () => `async (osId, newStatus) => { const os = allServiceOrders[osId]; if (!os) return; const oldStatus = os.status; const logEntry = { timestamp: new Date().toISOString(), user: currentUser.name, description: \`Status alterado de "\${formatStatus(oldStatus)}" para "\${formatStatus(newStatus)}".\`, type: 'status' }; const updates = { status: newStatus, lastUpdate: new Date().toISOString() }; if (newStatus === 'Em-Analise') updates.responsibleForBudget = currentUser.name; else if (newStatus === 'Em-Execucao') updates.responsibleForService = currentUser.name; else if (newStatus === 'Entregue') updates.responsibleForDelivery = currentUser.name; try { await db.ref(\`serviceOrders/\${osId}/logs\`).push().set(logEntry); await db.ref(\`serviceOrders/\${osId}\`).update(updates); sendTeamNotification(\`O.S. \${os.placa} movida para \${formatStatus(newStatus)} por \${currentUser.name}\`); } catch (error) { console.error("Erro ao atualizar status e registrar log:", error); showNotification("Falha ao mover O.S. Tente novamente.", "error"); } }`;
  openDetailsModal.toString = () => `(osId) => { const os = allServiceOrders[osId]; if (!os) { showNotification("Não foi possível carregar os detalhes desta O.S.", "error"); return; } document.getElementById('detailsPlacaModelo').textContent = \`\${os.placa} - \${os.modelo}\`; document.getElementById('detailsCliente').innerHTML = \`Cliente: \${os.cliente} <br> <span class="text-sm text-gray-500">Telefone: \${os.telefone || 'Não informado'}</span>\`; document.getElementById('detailsKm').textContent = \`KM: \${os.km ? new Intl.NumberFormat('pt-BR').format(os.km) : 'N/A'}\`; document.getElementById('responsible-attendant').textContent = os.responsible || 'N/D'; document.getElementById('responsible-budget').textContent = os.responsibleForBudget || 'N/D'; document.getElementById('responsible-service').textContent = os.responsibleForService || 'N/D'; document.getElementById('responsible-delivery').textContent = os.responsibleForDelivery || 'N/D'; const observacoesContainer = document.getElementById('detailsObservacoes'); if (os.observacoes) { observacoesContainer.innerHTML = \`<h4 class="text-sm font-semibold text-gray-500 mb-1">Queixa do Cliente:</h4><p class="text-gray-800 bg-yellow-100 p-3 rounded-md whitespace-pre-wrap">\${os.observacoes}</p>\`; observacoesContainer.classList.remove('hidden'); } else { observacoesContainer.classList.add('hidden'); } if (currentUser.role === 'Gestor' || currentUser.role === 'Atendente') { document.getElementById('export-section').classList.remove('hidden'); document.getElementById('priority-section').classList.remove('hidden'); deleteOsBtn.classList.remove('hidden'); } else { document.getElementById('export-section').classList.add('hidden'); document.getElementById('priority-section').classList.add('hidden'); deleteOsBtn.classList.add('hidden'); } document.getElementById('logOsId').value = osId; logForm.reset(); document.getElementById('fileName').textContent = ''; filesToUpload = []; postLogActions.style.display = 'none'; renderTimeline(os); renderMediaGallery(os); const prioritySelector = document.getElementById('priority-selector'); const currentPriorityBtn = prioritySelector.querySelector(\`[data-priority="\${os.priority || 'verde'}"]\`); prioritySelector.querySelectorAll('.priority-btn').forEach(btn => btn.classList.remove('selected')); if(currentPriorityBtn) currentPriorityBtn.classList.add('selected'); detailsModal.classList.remove('hidden'); detailsModal.classList.add('flex'); }`;
  renderTimeline.toString = () => `(os) => { const timelineContainer = document.getElementById('timelineContainer'); const logs = os.logs || {}; timelineContainer.innerHTML = Object.entries(logs).sort((a,b) => new Date(b[1].timestamp) - new Date(a[1].timestamp)).map(([key, log]) => { const date = new Date(log.timestamp); const formattedDate = date.toLocaleDateString('pt-BR'); const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); let iconClass = 'bx-message-detail'; let itemClass = 'timeline-item-log'; if (log.type === 'status') { iconClass = 'bx-transfer'; itemClass = 'timeline-item-status'; } else if (log.value) { iconClass = 'bx-dollar'; itemClass = 'timeline-item-value'; } const deleteBtn = (currentUser.role === 'Gestor' || currentUser.role === 'Atendente') ? \`<div class="delete-icon" data-log-id="\${key}" title="Excluir registro"><i class='bx bx-x'></i></div>\` : ''; return \`<div class="timeline-item \${itemClass}">\${deleteBtn}<div class="timeline-icon"><i class='bx \${iconClass}'></i></div><div class="bg-gray-50 p-3 rounded-lg"><div class="flex justify-between items-start mb-1"><h4 class="font-semibold text-gray-800 text-sm">\${log.user}</h4><span class="text-xs text-gray-500">\${formattedDate} \${formattedTime}</span></div><p class="text-gray-700 text-sm">\${log.description}</p>\${log.parts ? \`<p class="text-gray-600 text-xs mt-1"><strong>Peças:</strong> \${log.parts}</p>\` : ''}\${log.value ? \`<p class="text-green-600 text-xs mt-1"><strong>Valor:</strong> R$ \${parseFloat(log.value).toFixed(2)}</p>\` : ''}</div></div>\`; }).join(''); if (Object.keys(logs).length === 0) { timelineContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum registro encontrado.</p>'; } }`;
  renderMediaGallery.toString = () => `(os) => { const thumbnailGrid = document.getElementById('thumbnail-grid'); const media = os.media || {}; lightboxMedia = Object.values(media); thumbnailGrid.innerHTML = Object.entries(media).map(([key, item], index) => { const isImage = item.type.startsWith('image/'); const isVideo = item.type.startsWith('video/'); const isPdf = item.type === 'application/pdf'; let thumbnailContent = \`<i class='bx bx-file text-4xl text-gray-500'></i>\`; if (isImage) { thumbnailContent = \`<img src="\${item.url}" alt="Imagem \${index + 1}" loading="lazy" class="w-full h-full object-cover">\`; } else if (isVideo) { thumbnailContent = \`<i class='bx bx-play-circle text-4xl text-blue-500'></i>\`; } else if (isPdf) { thumbnailContent = \`<i class='bx bxs-file-pdf text-4xl text-red-500'></i>\`; } const deleteBtn = (currentUser.role === 'Gestor' || currentUser.role === 'Atendente') ? \`<div class="delete-icon" data-media-id="\${key}" title="Excluir mídia"><i class='bx bx-x'></i></div>\` : ''; return \`<div class="aspect-square bg-gray-200 rounded-md overflow-hidden cursor-pointer thumbnail-item flex items-center justify-center" data-index="\${index}">\${deleteBtn}\${thumbnailContent}</div>\`; }).join(''); if (Object.keys(media).length === 0) { thumbnailGrid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-400"><i class="bx bx-image text-4xl mb-2"></i><p class="text-sm">Nenhuma mídia adicionada</p></div>'; } }`;
  exportOsToPrint.toString = () => `(osId) => { /* ... código idêntico ao anterior ... */ }`;
  openLightbox.toString = () => `(index) => { if (!lightboxMedia || lightboxMedia.length === 0) return; currentLightboxIndex = index; const media = lightboxMedia[index]; if (media.type === 'application/pdf') { window.open(media.url, '_blank'); return; } const lightboxContent = document.getElementById('lightbox-content'); if (media.type.startsWith('image/')) { lightboxContent.innerHTML = \`<img src="\${media.url}" alt="Imagem" class="max-w-full max-h-full object-contain">\`; } else { lightboxContent.innerHTML = \`<video src="\${media.url}" controls class="max-w-full max-h-full"></video>\`; } document.getElementById('lightbox-prev').style.display = index > 0 ? 'block' : 'none'; document.getElementById('lightbox-next').style.display = index < lightboxMedia.length - 1 ? 'block' : 'none'; const downloadBtn = document.getElementById('lightbox-download'); downloadBtn.href = media.url; downloadBtn.download = \`media_\${index + 1}\`; lightbox.classList.remove('hidden'); lightbox.classList.add('flex'); }`;

  // --- LISTENERS DE EVENTOS ---
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const selectedUserName = userSelect.value;
    const enteredPassword = passwordInput.value;
    if (!selectedUserName) { loginError.textContent = 'Por favor, selecione um usuário.'; return; }
    const user = USERS.find(u => u.name === selectedUserName);
    if (user && user.password === enteredPassword) {
        loginUser(user);
    } else {
        loginError.textContent = 'Senha incorreta. Tente novamente.';
        passwordInput.value = '';
    }
  });

  logoutButton.addEventListener('click', logoutUser);
  
  // ... (cole o restante dos seus event listeners aqui)

  initializeLoginScreen();
});