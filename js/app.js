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
  if (existing) existing.remove();
  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 500);
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
    if (!response.ok) throw new Error('Falha no upload da mídia.');
    const data = await response.json();
    return { url: data.secure_url, public_id: data.public_id };
  } catch (error) {
    console.error("Erro no upload para o Cloudinary:", error);
    throw error;
  }
};


/* ==================================================================
INICIALIZAÇÃO DO SISTEMA E VARIÁVEIS GLOBAIS
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
  let USERS = [];

  const STATUS_LIST = [ 'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 'Finalizado-Aguardando-Retirada', 'Entregue' ];
  const ATTENTION_STATUSES = { 'Aguardando-Mecanico': { label: 'AGUARDANDO MECÂNICO', color: 'yellow', blinkClass: 'blinking-aguardando' }, 'Servico-Autorizado': { label: 'SERVIÇO AUTORIZADO', color: 'green', blinkClass: 'blinking-autorizado' } };
  const LED_TRIGGER_STATUSES = ['Aguardando-Mecanico', 'Servico-Autorizado'];

  // Seletores de elementos DOM
  const userScreen = document.getElementById('userScreen'), app = document.getElementById('app'), loginForm = document.getElementById('loginForm'), userSelect = document.getElementById('userSelect'), passwordInput = document.getElementById('passwordInput'), loginError = document.getElementById('loginError'), kanbanBoard = document.getElementById('kanbanBoard'), addOSBtn = document.getElementById('addOSBtn'), logoutButton = document.getElementById('logoutButton'), osModal = document.getElementById('osModal'), osForm = document.getElementById('osForm'), detailsModal = document.getElementById('detailsModal'), logForm = document.getElementById('logForm'), kmUpdateForm = document.getElementById('kmUpdateForm'), attentionPanel = document.getElementById('attention-panel'), attentionPanelContainer = document.getElementById('attention-panel-container'), togglePanelBtn = document.getElementById('toggle-panel-btn'), lightbox = document.getElementById('lightbox'), mediaInput = document.getElementById('media-input'), openCameraBtn = document.getElementById('openCameraBtn'), openGalleryBtn = document.getElementById('openGalleryBtn'), alertLed = document.getElementById('alert-led'), postLogActions = document.getElementById('post-log-actions'), deleteOsBtn = document.getElementById('deleteOsBtn'), confirmDeleteModal = document.getElementById('confirmDeleteModal'), confirmDeleteText = document.getElementById('confirmDeleteText'), cancelDeleteBtn = document.getElementById('cancelDeleteBtn'), confirmDeleteBtn = document.getElementById('confirmDeleteBtn'), globalSearchInput = document.getElementById('globalSearchInput'), globalSearchResults = document.getElementById('globalSearchResults'), timelineContainer = document.getElementById('timelineContainer'), confirmDeleteLogModal = document.getElementById('confirmDeleteLogModal'), confirmDeleteLogText = document.getElementById('confirmDeleteLogText'), cancelDeleteLogBtn = document.getElementById('cancelDeleteLogBtn'), confirmDeleteLogBtn = document.getElementById('confirmDeleteLogBtn');
  const adminPanelBtn = document.getElementById('adminPanelBtn'), adminModal = document.getElementById('adminModal'), adminTabs = document.querySelectorAll('.admin-tab'), addUserForm = document.getElementById('addUserForm'), userList = document.getElementById('userList'), changePasswordModal = document.getElementById('changePasswordModal'), changePasswordForm = document.getElementById('changePasswordForm'), cancelChangePasswordBtn = document.getElementById('cancelChangePasswordBtn'), userLabelForPasswordChange = document.getElementById('userLabelForPasswordChange'), generateReportBtn = document.getElementById('generateReportBtn'), exportPdfZipBtn = document.getElementById('exportPdfZipBtn'), reportOutput = document.getElementById('reportOutput');
  const confirmDeleteMediaModal = document.getElementById('confirmDeleteMediaModal'), cancelDeleteMediaBtn = document.getElementById('cancelDeleteMediaBtn'), confirmDeleteMediaBtn = document.getElementById('confirmDeleteMediaBtn');

  const formatStatus = (status) => status ? status.replace(/-/g, ' ') : '';
  
  const hasPermission = (level) => {
    if (!currentUser) return false;
    const roles = { 'Atendente': 1, 'Mecânico': 1, 'Gestor': 2, 'Gestor de Sistema': 3 };
    const requiredLevel = level === 'admin' ? 3 : (level === 'manager' ? 2 : 1);
    return roles[currentUser.role] >= requiredLevel;
  }

  const logoutUser = () => {
    localStorage.removeItem('currentUser');
    location.reload();
  };

  const scheduleDailyLogout = () => {
    const now = new Date();
    const logoutTime = new Date();
    logoutTime.setHours(19, 0, 0, 0);
    if (now > logoutTime) logoutTime.setDate(logoutTime.getDate() + 1);
    const timeUntilLogout = logoutTime.getTime() - now.getTime();
    console.log(`Logout automático agendado para: ${logoutTime.toLocaleString('pt-BR')}`);
    setTimeout(() => {
      if (localStorage.getItem('currentUser')) {
        showNotification('Sessão encerrada por segurança.', 'success');
        setTimeout(logoutUser, 2000);
      }
    }, timeUntilLogout);
  };

  const loginUser = (user) => {
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    document.getElementById('currentUserName').textContent = user.name;
    if(hasPermission('admin')) adminPanelBtn.classList.remove('hidden');
    userScreen.classList.add('hidden');
    app.classList.remove('hidden');
    initializeKanban();
    listenToServiceOrders();
    listenToNotifications();
    scheduleDailyLogout();
  };

  const initializeLoginScreen = () => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        loginUser(JSON.parse(storedUser));
        return;
    }
    userScreen.classList.remove('hidden');
    app.classList.add('hidden');
    userSelect.innerHTML = '<option value="">Selecione seu usuário...</option>';
    USERS.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        userSelect.appendChild(option);
    });
  };

  const initializeKanban = () => {
    const collapsedState = JSON.parse(localStorage.getItem('collapsedColumns')) || {};
    kanbanBoard.innerHTML = STATUS_LIST.map(status => {
      const isCollapsed = collapsedState[status];
      const searchInputHTML = status === 'Entregue' ? `<div class="my-2"><input type="search" data-status="${status}" placeholder="Buscar por Placa..." class="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 search-input-entregue"></div>` : '';
      const columnLedHTML = isCollapsed ? '<div class="column-led ml-2"></div>' : '';
      return `<div class="status-column p-4"><div class="flex justify-between items-center cursor-pointer toggle-column-btn mb-2" data-status="${status}"><div class="flex items-center"><h3 class="font-bold text-gray-800">${formatStatus(status)}</h3>${columnLedHTML}</div><i class='bx bxs-chevron-down transition-transform ${isCollapsed ? 'rotate-180' : ''}'></i></div>${searchInputHTML}<div class="space-y-3 vehicle-list ${isCollapsed ? 'collapsed' : ''}" data-status="${status}"></div></div>`;
    }).join('');
  };

  const createCardHTML = (os) => {
    const currentIndex = STATUS_LIST.indexOf(os.status);
    const prevStatus = currentIndex > 0 ? STATUS_LIST[currentIndex - 1] : null;
    const nextStatus = currentIndex < STATUS_LIST.length - 1 ? STATUS_LIST[currentIndex + 1] : null;
    const prevButton = prevStatus ? `<button data-os-id="${os.id}" data-new-status="${prevStatus}" class="btn-move-status p-2 rounded-full hover:bg-gray-100 transition-colors"><i class='bx bx-chevron-left text-xl text-gray-600'></i></button>` : `<div class="w-10 h-10"></div>`;
    const nextButton = nextStatus ? `<button data-os-id="${os.id}" data-new-status="${nextStatus}" class="btn-move-status p-2 rounded-full hover:bg-gray-100 transition-colors"><i class='bx bx-chevron-right text-xl text-gray-600'></i></button>` : `<div class="w-10 h-10"></div>`;
    let responsibleInfo = `<p class="text-xs text-gray-500 mt-1">Atendente: ${os.responsible || 'N/D'}</p>`;
    if (os.status === 'Em-Execucao' && os.responsibleForService) responsibleInfo = `<p class="text-xs text-red-600 font-medium mt-1">Mecânico: ${os.responsibleForService}</p>`;
    else if (os.status === 'Em-Analise' && os.responsibleForBudget) responsibleInfo = `<p class="text-xs text-purple-600 font-medium mt-1">Orçamento: ${os.responsibleForBudget}</p>`;
    const kmInfo = `<p class="text-xs text-gray-500">KM: ${os.km ? new Intl.NumberFormat('pt-BR').format(os.km) : 'N/A'}</p>`;
    const priorityIndicatorHTML = os.priority ? `<div class="priority-indicator priority-${os.priority}" title="Urgência: ${os.priority}"></div>` : '';
    return `<div id="${os.id}" class="vehicle-card status-${os.status}" data-os-id="${os.id}">${priorityIndicatorHTML}<div class="flex justify-between items-start"><div class="card-clickable-area cursor-pointer flex-grow"><p class="font-bold text-base text-gray-800">${os.placa}</p><p class="text-sm text-gray-600">${os.modelo}</p><div class="text-xs mt-1">${kmInfo}</div><div class="text-xs">${responsibleInfo}</div></div><div class="flex flex-col -mt-1 -mr-1">${nextButton}${prevButton}</div></div></div>`;
  };

  const renderDeliveredColumn = () => {
      const list = kanbanBoard.querySelector('.vehicle-list[data-status="Entregue"]');
      if (!list) return;
      const searchInput = kanbanBoard.querySelector('.search-input-entregue');
      const searchTerm = searchInput ? searchInput.value.toUpperCase().trim() : '';
      let deliveredItems = Object.values(allServiceOrders).filter(os => os.status === 'Entregue');
      if (searchTerm) deliveredItems = deliveredItems.filter(os => (os.placa && os.placa.toUpperCase().includes(searchTerm)) || (os.modelo && os.modelo.toUpperCase().includes(searchTerm)));
      deliveredItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      list.innerHTML = deliveredItems.map(os => createCardHTML(os)).join('');
  };

  const listenToServiceOrders = () => {
    const osRef = db.ref('serviceOrders');
    osRef.on('child_added', snapshot => {
      const os = { ...snapshot.val(), id: snapshot.key };
      allServiceOrders[os.id] = os;
      if (os.status === 'Entregue') renderDeliveredColumn();
      else {
        const list = kanbanBoard.querySelector(`.vehicle-list[data-status="${os.status}"]`);
        if (list) list.insertAdjacentHTML('beforeend', createCardHTML(os));
      }
      updateAttentionPanel();
    });
    osRef.on('child_changed', snapshot => {
      const os = { ...snapshot.val(), id: snapshot.key };
      const oldOs = allServiceOrders[os.id];
      allServiceOrders[os.id] = os;
      const existingCard = document.getElementById(os.id);
      if (oldOs && oldOs.status !== os.status) {
        if (existingCard) existingCard.remove();
        if (os.status === 'Entregue') renderDeliveredColumn();
        else {
          const newList = kanbanBoard.querySelector(`.vehicle-list[data-status="${os.status}"]`);
          if (newList) newList.insertAdjacentHTML('beforeend', createCardHTML(os));
        }
        if(oldOs.status === 'Entregue') renderDeliveredColumn();
      }
      else if (existingCard) {
        if (os.status === 'Entregue') renderDeliveredColumn();
        else existingCard.outerHTML = createCardHTML(os);
      }
       if (detailsModal.classList.contains('flex') && document.getElementById('logOsId').value === os.id) {
            renderTimeline(os);
            renderMediaGallery(os);
       }
      updateAttentionPanel();
    });
    osRef.on('child_removed', snapshot => {
      const osId = snapshot.key;
      const removedOs = allServiceOrders[osId];
      delete allServiceOrders[osId];
      if (removedOs && removedOs.status === 'Entregue') renderDeliveredColumn();
      else {
          const cardToRemove = document.getElementById(osId);
          if (cardToRemove) cardToRemove.remove();
      }
      updateAttentionPanel();
    });
  };

  const updateAttentionPanel = () => {
    let vehiclesTriggeringAlert = new Set();
    Object.values(allServiceOrders).forEach(os => {
        if (LED_TRIGGER_STATUSES.includes(os.status)) vehiclesTriggeringAlert.add(os.id);
    });
    attentionPanel.innerHTML = Object.entries(ATTENTION_STATUSES).map(([statusKey, config]) => {
        const vehiclesInStatus = Object.values(allServiceOrders).filter(os => os.status === statusKey);
        const hasVehicles = vehiclesInStatus.length > 0;
        const blinkingClass = (hasVehicles && config.blinkClass && !attentionPanelContainer.classList.contains('collapsed')) ? config.blinkClass : '';
        const vehicleListHTML = hasVehicles ? vehiclesInStatus.map(os => `<p class="cursor-pointer attention-vehicle text-white hover:text-blue-300" data-os-id="${os.id}">${os.placa} - ${os.modelo}</p>`).join('') : `<p class="text-gray-400">- Vazio -</p>`;
        return `<div class="attention-box p-2 rounded-md bg-gray-900 border-2 border-gray-700 ${blinkingClass}" data-status-key="${statusKey}"><h3 class="text-center text-${config.color}-400 font-bold text-xs sm:text-sm truncate">${config.label}</h3><div class="mt-1 text-center text-white text-xs space-y-1 h-16 overflow-y-auto">${vehicleListHTML}</div></div>`;
    }).join('');
    updateLedState(vehiclesTriggeringAlert);
  };
  
  function sendTeamNotification(message) {
      if (!currentUser) return;
      db.ref('notifications').push().set({ message: message, user: currentUser.name, timestamp: firebase.database.ServerValue.TIMESTAMP });
  }

  function listenToNotifications() {
      db.ref('notifications').orderByChild('timestamp').startAt(appStartTime).on('child_added', snapshot => {
          const notification = snapshot.val();
          if (notification && notification.user !== currentUser.name) showNotification(notification.message, 'success');
          snapshot.ref.remove();
      });
  }
  
  const updateLedState = (vehiclesTriggeringAlert) => alertLed.classList.toggle('hidden', !(vehiclesTriggeringAlert.size > 0 && attentionPanelContainer.classList.contains('collapsed')));
  
  const updateServiceOrderStatus = async (osId, newStatus) => {
    const os = allServiceOrders[osId];
    if (!os) return;
    const oldStatus = os.status;
    const logEntry = { timestamp: new Date().toISOString(), user: currentUser.name, description: `Status alterado de "${formatStatus(oldStatus)}" para "${formatStatus(newStatus)}".`, type: 'status' };
    const updates = { status: newStatus, lastUpdate: new Date().toISOString() };
    if (newStatus === 'Em-Analise') updates.responsibleForBudget = currentUser.name;
    else if (newStatus === 'Em-Execucao') updates.responsibleForService = currentUser.name;
    else if (newStatus === 'Entregue') { 
        updates.responsibleForDelivery = currentUser.name;
        updates.deliveredAt = new Date().toISOString();
    }
    try {
        await db.ref(`serviceOrders/${osId}/logs`).push().set(logEntry);
        await db.ref(`serviceOrders/${osId}`).update(updates);
        sendTeamNotification(`O.S. ${os.placa} movida para ${formatStatus(newStatus)} por ${currentUser.name}`);
    } catch (error) {
        showNotification("Falha ao mover O.S.", "error");
    }
  };
  
  const openDetailsModal = (osId) => {
    const os = allServiceOrders[osId];
    if (!os) return;
    document.getElementById('detailsPlacaModelo').textContent = `${os.placa} - ${os.modelo}`;
    document.getElementById('detailsCliente').innerHTML = `Cliente: ${os.cliente} <br> <span class="text-sm text-gray-500">Telefone: ${os.telefone || 'Não informado'}</span>`;
    document.getElementById('detailsKm').textContent = `KM: ${os.km ? new Intl.NumberFormat('pt-BR').format(os.km) : 'N/A'}`;
    document.getElementById('responsible-attendant').textContent = os.responsible || 'N/D';
    document.getElementById('responsible-budget').textContent = os.responsibleForBudget || 'N/D';
    document.getElementById('responsible-service').textContent = os.responsibleForService || 'N/D';
    document.getElementById('responsible-delivery').textContent = os.responsibleForDelivery || 'N/D';
    const observacoesContainer = document.getElementById('detailsObservacoes');
    observacoesContainer.innerHTML = os.observacoes ? `<h4 class="text-sm font-semibold text-gray-500 mb-1">Queixa do Cliente:</h4><p class="text-gray-800 bg-yellow-100 p-3 rounded-md whitespace-pre-wrap">${os.observacoes}</p>` : '';
    observacoesContainer.classList.toggle('hidden', !os.observacoes);
    deleteOsBtn.classList.toggle('hidden', !hasPermission('manager'));
    document.getElementById('logOsId').value = osId;
    logForm.reset();
    document.getElementById('fileName').textContent = '';
    filesToUpload = [];
    postLogActions.style.display = 'none';
    renderTimeline(os);
    renderMediaGallery(os);
    detailsModal.classList.remove('hidden');
    detailsModal.classList.add('flex');
  };
  
  const renderTimeline = (os) => {
    const logs = os.logs || {};
    const logEntries = Object.entries(logs).sort(([,a], [,b]) => new Date(b.timestamp) - new Date(a.timestamp));
    timelineContainer.innerHTML = logEntries.map(([logId, log]) => {
      const date = new Date(log.timestamp);
      const formattedDateTime = date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      let iconClass = 'bx-message-detail', itemClass = 'timeline-item-log';
      if (log.type === 'status') { iconClass = 'bx-transfer'; itemClass = 'timeline-item-status'; }
      else if (log.value) { iconClass = 'bx-dollar'; itemClass = 'timeline-item-value'; }
      const canDelete = hasPermission('manager') && log.description && !log.description.startsWith('ATT EXCLUIDA');
      const deleteButtonHTML = canDelete ? `<button class="delete-log-btn" data-os-id="${os.id}" data-log-id="${logId}" title="Excluir esta atualização"><i class='bx bx-x text-lg'></i></button>` : '';
      const descriptionHTML = log.description && log.description.startsWith('ATT EXCLUIDA') ? `<p class="text-red-500 italic text-sm">${log.description}</p>` : `<p class="text-gray-700 text-sm">${log.description || ''}</p>`;
      return `<div class="timeline-item ${itemClass}"><div class="timeline-icon"><i class='bx ${iconClass}'></i></div><div class="bg-gray-50 p-3 rounded-lg relative">${deleteButtonHTML}<div class="flex justify-between items-start mb-1"><h4 class="font-semibold text-gray-800 text-sm">${log.user}</h4><span class="text-xs text-gray-500">${formattedDateTime}</span></div>${descriptionHTML}${log.parts ? `<p class="text-gray-600 text-xs mt-1"><strong>Peças:</strong> ${log.parts}</p>` : ''}${log.value ? `<p class="text-green-600 text-xs mt-1"><strong>Valor:</strong> R$ ${parseFloat(log.value).toFixed(2)}</p>` : ''}</div></div>`;
    }).join('');
    if (logEntries.length === 0) timelineContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum registro encontrado.</p>';
  };
  
  const renderMediaGallery = (os) => {
    const thumbnailGrid = document.getElementById('thumbnail-grid');
    const media = os.media || {};
    lightboxMedia = Object.entries(media).map(([key, value]) => ({...value, key}));
    thumbnailGrid.innerHTML = lightboxMedia.map((item, index) => {
        if (!item || !item.type) return '';
        const isImage = item.type.startsWith('image/'), isVideo = item.type.startsWith('video/'), isPdf = item.type === 'application/pdf';
        let thumbnailContent = `<i class='bx bx-file text-4xl text-gray-500'></i>`; 
        if (isImage) thumbnailContent = `<img src="${item.url}" alt="Imagem ${index + 1}" loading="lazy" class="w-full h-full object-cover">`;
        else if (isVideo) thumbnailContent = `<i class='bx bx-play-circle text-4xl text-blue-500'></i>`;
        else if (isPdf) thumbnailContent = `<i class='bx bxs-file-pdf text-4xl text-red-500'></i>`;
        const deleteBtn = hasPermission('admin') ? `<button class="delete-media-btn" data-os-id="${os.id}" data-media-key="${item.key}" title="Excluir Mídia"><i class='bx bxs-trash'></i></button>` : '';
        return `<div class="aspect-square bg-gray-200 rounded-md overflow-hidden thumbnail-item flex items-center justify-center" data-index="${index}">${thumbnailContent}${deleteBtn}</div>`;
    }).join('');
    if (lightboxMedia.length === 0) thumbnailGrid.innerHTML = `<div class="col-span-full text-center py-8 text-gray-400"><i class='bx bx-image text-4xl mb-2'></i><p class="text-sm">Nenhuma mídia adicionada</p></div>`;
  };
  
  const generatePrintableOsHtml = (os) => {
    const formatDate = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
    const logs = os.logs ? Object.values(os.logs).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)) : [];
    let totalValue = 0;
    const timelineHtml = logs.map(log => {
        if (log.value) totalValue += parseFloat(log.value);
        return `<tr><td>${formatDate(log.timestamp)}</td><td>${log.user}</td><td>${log.description}</td><td>${log.parts||'---'}</td><td style="text-align:right;">${log.value?`R$ ${parseFloat(log.value).toFixed(2)}`:'---'}</td></tr>`;
    }).join('');
    const photosHtml = os.media ? Object.values(os.media).filter(item => item && item.type.startsWith('image/')).map(p => `<img src="${p.url}" style="width:100%; max-width: 200px; margin: 5px; border: 1px solid #ccc; border-radius: 4px;">`).join('') : '';
    return `<html><head><title>OS - ${os.placa}</title><style>body{font-family:sans-serif;margin:20px}h1,h2{text-align:center}.section{margin-bottom:20px;border:1px solid #ccc;border-radius:8px;padding:15px;page-break-inside:avoid}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;font-size:12px}th{background-color:#f2f2f2}.photo-gallery{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}</style></head><body><h1>CHEVRON Bosch Car Service</h1><h2>Ordem de Serviço</h2><div class="section"><strong>Placa:</strong> ${os.placa} | <strong>Modelo:</strong> ${os.modelo} | <strong>Cliente:</strong> ${os.cliente} | <strong>KM:</strong> ${os.km} | <strong>Abertura:</strong> ${formatDate(os.createdAt)}</div>${os.observacoes?`<div class="section"><h3>Queixa do Cliente</h3><p>${os.observacoes}</p></div>`:''}<table><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Descrição</th><th>Peças</th><th style="text-align:right;">Valor</th></tr></thead><tbody>${timelineHtml}</tbody></table><div style="text-align:right;font-size:18px;font-weight:bold;margin-top:20px">Total: R$ ${totalValue.toFixed(2)}</div>${photosHtml?`<div class="section"><h3>Fotos</h3><div class="photo-gallery">${photosHtml}</div></div>`:''}</body></html>`;
  }

  const exportOsToPrint = (osId) => {
    const os = allServiceOrders[osId];
    if (!os) return;
    const printHtml = generatePrintableOsHtml(os);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHtml + '<script>window.onload=()=>{window.print();setTimeout(()=>{window.close()},100)}</script>');
    printWindow.document.close();
  };
  
  const openLightbox = (index) => {
    if (!lightboxMedia || lightboxMedia.length === 0) return;
    currentLightboxIndex = index;
    const media = lightboxMedia[index];
    if (!media || !media.type) return; 
    if (media.type === 'application/pdf') { window.open(media.url, '_blank'); return; }
    const lightboxContent = document.getElementById('lightbox-content');
    lightboxContent.innerHTML = media.type.startsWith('image/') ? `<img src="${media.url}" class="max-w-full max-h-full">` : `<video src="${media.url}" controls class="max-w-full max-h-full"></video>`;
    document.getElementById('lightbox-prev').style.display = index > 0 ? 'block' : 'none';
    document.getElementById('lightbox-next').style.display = index < lightboxMedia.length - 1 ? 'block' : 'none';
    document.getElementById('lightbox-download').href = media.url;
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
  };

  // --- PAINEL DO GESTOR ---
  const populateUserList = () => {
    userList.innerHTML = USERS.map(user => `
        <div class="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
            <div>
                <p class="font-semibold">${user.name}</p>
                <p class="text-sm text-gray-500">${user.role}</p>
            </div>
            <div class="flex gap-2">
                <button class="change-password-btn btn btn-sm bg-gray-200 text-gray-700" data-user-id="${user.id}">Alterar Senha</button>
                ${(currentUser.id !== user.id) ? `<button class="delete-user-btn btn btn-sm bg-red-100 text-red-700" data-user-id="${user.id}" data-user-name="${user.name}"><i class='bx bxs-trash'></i></button>` : ''}
            </div>
        </div>
    `).join('');
  };

  const openAdminModal = () => {
    populateUserList();
    adminModal.classList.remove('hidden');
    adminModal.classList.add('flex');
  };
  
  // --- LISTENERS DE EVENTOS ---
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userId = userSelect.value;
    const user = USERS.find(u => u.id === userId);
    if (user && user.password === passwordInput.value) loginUser(user);
    else loginError.textContent = 'Senha incorreta.';
  });
  
  logoutButton.addEventListener('click', logoutUser);
  togglePanelBtn.addEventListener('click', () => {
    attentionPanelContainer.classList.toggle('collapsed');
    togglePanelBtn.querySelector('i').classList.toggle('rotate-180');
    updateAttentionPanel();
  });
  
  attentionPanel.addEventListener('click', (e) => e.target.closest('.attention-vehicle') && openDetailsModal(e.target.closest('.attention-vehicle').dataset.osId));
  
  kanbanBoard.addEventListener('click', (e) => {
    const card = e.target.closest('.vehicle-card'), moveBtn = e.target.closest('.btn-move-status'), clickableArea = e.target.closest('.card-clickable-area'), toggleBtn = e.target.closest('.toggle-column-btn');
    if (moveBtn) {
      e.stopPropagation();
      updateServiceOrderStatus(moveBtn.dataset.osId, moveBtn.dataset.newStatus);
    } else if (clickableArea && card) {
      openDetailsModal(card.dataset.osId);
    } else if (toggleBtn) {
      const status = toggleBtn.dataset.status;
      const vehicleList = kanbanBoard.querySelector(`.vehicle-list[data-status="${status}"]`);
      vehicleList.classList.toggle('collapsed');
      toggleBtn.querySelector('i').classList.toggle('rotate-180');
      const collapsedState = JSON.parse(localStorage.getItem('collapsedColumns')) || {};
      collapsedState[status] = vehicleList.classList.contains('collapsed');
      localStorage.setItem('collapsedColumns', JSON.stringify(collapsedState));
      const columnLed = toggleBtn.querySelector('.column-led');
      if (columnLed) columnLed.style.display = (collapsedState[status] && vehicleList.children.length > 0) ? 'block' : 'none';
    }
  });

  kanbanBoard.addEventListener('input', (e) => e.target.matches('.search-input-entregue') && renderDeliveredColumn());

  globalSearchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toUpperCase().trim();
    if (!searchTerm) {
        globalSearchResults.classList.add('hidden');
        return;
    }
    const matching = Object.values(allServiceOrders).filter(os => os.placa && os.placa.toUpperCase().includes(searchTerm)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); 
    globalSearchResults.innerHTML = matching.length > 0
        ? matching.map(os => `<div class="search-result-item" data-os-id="${os.id}"><p class="font-bold">${os.placa} - ${os.modelo}</p><p class="text-sm text-gray-600">Status: <span class="font-semibold text-blue-700">${formatStatus(os.status)}</span></p></div>`).join('')
        : '<div class="p-3 text-center text-gray-500">Nenhum veículo encontrado.</div>';
    globalSearchResults.classList.remove('hidden');
  });
  
  globalSearchResults.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (item) {
          openDetailsModal(item.dataset.osId);
          globalSearchInput.value = ''; 
          globalSearchResults.classList.add('hidden');
      }
  });

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target.closest('.btn-close-modal')) {
        target.closest('.modal').classList.add('hidden');
    }
    if (!target.closest('.search-container')) globalSearchResults.classList.add('hidden');
    const thumb = target.closest('.thumbnail-item');
    if (thumb && thumb.dataset.index !== undefined) openLightbox(parseInt(thumb.dataset.index));
  });

  detailsModal.addEventListener('click', (e) => {
    if (e.target.closest('#exportOsBtn')) exportOsToPrint(document.getElementById('logOsId').value);
    const delMediaBtn = e.target.closest('.delete-media-btn');
    if(delMediaBtn) {
        confirmDeleteMediaBtn.dataset.osId = delMediaBtn.dataset.osId;
        confirmDeleteMediaBtn.dataset.mediaKey = delMediaBtn.dataset.mediaKey;
        confirmDeleteMediaModal.classList.remove('hidden');
    }
  });
  
  addOSBtn.addEventListener('click', () => {
    document.getElementById('osModalTitle').textContent = 'Nova Ordem de Serviço';
    osForm.reset();
    document.getElementById('osResponsavel').innerHTML = '<option value="">Selecione...</option>' + USERS.filter(u => u.role.includes('Atendente') || u.role.includes('Gestor')).map(u => `<option value="${u.name}">${u.name}</option>`).join('');
    osModal.classList.remove('hidden');
  });
  
  osForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const osData = {
      placa: document.getElementById('osPlaca').value.toUpperCase(),
      modelo: document.getElementById('osModelo').value,
      cliente: document.getElementById('osCliente').value,
      telefone: document.getElementById('osTelefone').value,
      km: parseInt(document.getElementById('osKm').value) || 0,
      responsible: document.getElementById('osResponsavel').value,
      observacoes: document.getElementById('osObservacoes').value,
      priority: document.querySelector('input[name="osPrioridade"]:checked').value,
      status: 'Aguardando-Mecanico',
      createdAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString()
    };
    db.ref('serviceOrders').push().set(osData);
    sendTeamNotification(`Nova O.S. para ${osData.placa} criada por ${currentUser.name}`);
    osModal.classList.add('hidden');
  });
  
  logForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Salvando...`;
    const osId = document.getElementById('logOsId').value;
    const logEntry = { timestamp: new Date().toISOString(), user: currentUser.name, description: document.getElementById('logDescricao').value, type: 'log', parts: document.getElementById('logPecas').value || null, value: document.getElementById('logValor').value || null };
    try {
        if (filesToUpload.length > 0) {
            submitBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Enviando mídia...`;
            const mediaPromises = filesToUpload.map(file => uploadFileToCloudinary(file).then(data => ({ type: file.type, url: data.url, name: file.name, timestamp: new Date().toISOString() })));
            const mediaResults = await Promise.all(mediaPromises);
            const mediaRef = db.ref(`serviceOrders/${osId}/media`);
            mediaResults.forEach(media => mediaRef.push(media));
        }
        await db.ref(`serviceOrders/${osId}/logs`).push().set(logEntry);
        logForm.reset(); filesToUpload = [];
        document.getElementById('fileName').textContent = '';
        postLogActions.style.display = 'block';
        sendTeamNotification(`Novo registro na O.S. ${allServiceOrders[osId].placa} por ${currentUser.name}`);
    } catch (error) { showNotification(`Erro: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class='bx bx-message-square-add'></i> Adicionar`;
    }
  });
  
  document.getElementById('btn-move-next').addEventListener('click', () => {
    const osId = document.getElementById('logOsId').value;
    const nextStatus = STATUS_LIST[STATUS_LIST.indexOf(allServiceOrders[osId].status) + 1];
    if (nextStatus) { updateServiceOrderStatus(osId, nextStatus); detailsModal.classList.add('hidden'); }
  });
  
  document.getElementById('btn-move-prev').addEventListener('click', () => {
    const osId = document.getElementById('logOsId').value;
    const prevStatus = STATUS_LIST[STATUS_LIST.indexOf(allServiceOrders[osId].status) - 1];
    if (prevStatus) { updateServiceOrderStatus(osId, prevStatus); detailsModal.classList.add('hidden'); }
  });
  
  document.getElementById('btn-stay').addEventListener('click', () => postLogActions.style.display = 'none');
  
  kmUpdateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const osId = document.getElementById('logOsId').value;
    const newKm = parseInt(document.getElementById('updateKmInput').value);
    if (newKm > 0) {
      await db.ref(`serviceOrders/${osId}/km`).set(newKm);
      const log = { timestamp: new Date().toISOString(), user: currentUser.name, description: `KM atualizado para ${new Intl.NumberFormat('pt-BR').format(newKm)} km.`, type: 'log' };
      await db.ref(`serviceOrders/${osId}/logs`).push().set(log);
      document.getElementById('updateKmInput').value = '';
      showNotification('KM atualizado!', 'success');
    }
  });
  
  deleteOsBtn.addEventListener('click', () => {
    const os = allServiceOrders[document.getElementById('logOsId').value];
    confirmDeleteText.innerHTML = `Excluir O.S. da placa <strong>${os.placa}</strong>? Ação irreversível.`;
    confirmDeleteBtn.dataset.osId = os.id;
    delete confirmDeleteBtn.dataset.userId; // Garante que não vai excluir usuário
    confirmDeleteModal.classList.remove('hidden');
  });

  confirmDeleteBtn.addEventListener('click', (e) => {
    const { osId, userId, userName } = e.currentTarget.dataset;
    if (osId) {
        db.ref(`serviceOrders/${osId}`).remove();
        detailsModal.classList.add('hidden');
        showNotification(`O.S. excluída.`, 'success');
    }
    if (userId) {
        db.ref(`users/${userId}`).remove();
        showNotification(`Usuário ${userName} excluído.`, 'success');
    }
    confirmDeleteModal.classList.add('hidden');
  });

  cancelDeleteBtn.addEventListener('click', () => confirmDeleteModal.classList.add('hidden'));

  timelineContainer.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.delete-log-btn');
      if (delBtn) {
          confirmDeleteLogText.textContent = 'Excluir esta atualização do histórico?';
          confirmDeleteLogBtn.dataset.osId = delBtn.dataset.osId;
          confirmDeleteLogBtn.dataset.logId = delBtn.dataset.logId;
          confirmDeleteLogModal.classList.remove('hidden');
      }
  });

  confirmDeleteLogBtn.addEventListener('click', async () => {
      const { osId, logId } = confirmDeleteLogBtn.dataset;
      const logRef = db.ref(`serviceOrders/${osId}/logs/${logId}`);
      await logRef.set({
          timestamp: new Date().toISOString(),
          user: currentUser.name,
          description: `ATT EXCLUIDA POR: ${currentUser.name}`,
          type: 'log'
      });
      showNotification('Atualização marcada como excluída.', 'success');
      confirmDeleteLogModal.classList.add('hidden');
  });

  cancelDeleteLogBtn.addEventListener('click', () => confirmDeleteLogModal.classList.add('hidden'));

  confirmDeleteMediaBtn.addEventListener('click', async () => {
      const { osId, mediaKey } = confirmDeleteMediaBtn.dataset;
      await db.ref(`serviceOrders/${osId}/media/${mediaKey}`).remove();
      showNotification('Mídia excluída.', 'success');
      confirmDeleteMediaModal.classList.add('hidden');
  });
  cancelDeleteMediaBtn.addEventListener('click', () => confirmDeleteMediaModal.classList.add('hidden'));

  mediaInput.addEventListener('change', (e) => {
    filesToUpload.push(...e.target.files);
    document.getElementById('fileName').textContent = `${filesToUpload.length} arquivo(s) na fila`;
  });
  
  document.getElementById('lightbox-prev').addEventListener('click', () => openLightbox(currentLightboxIndex - 1));
  document.getElementById('lightbox-next').addEventListener('click', () => openLightbox(currentLightboxIndex + 1));
  document.getElementById('lightbox-close').addEventListener('click', () => lightbox.classList.add('hidden'));
  document.getElementById('lightbox-close-bg').addEventListener('click', () => lightbox.classList.add('hidden'));
  document.getElementById('lightbox-copy').addEventListener('click', () => navigator.clipboard.writeText(lightboxMedia[currentLightboxIndex].url).then(() => showNotification('URL copiada!')));

  // --- LISTENERS PAINEL GESTOR ---
  adminPanelBtn.addEventListener('click', openAdminModal);

  adminTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        adminTabs.forEach(t => t.classList.remove('active-tab'));
        tab.classList.add('active-tab');
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(`${tab.dataset.tab}-tab-content`).classList.remove('hidden');
    });
  });

  addUserForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newUser = {
        name: document.getElementById('newUserName').value,
        password: document.getElementById('newUserPassword').value,
        role: document.getElementById('newUserRole').value
    };
    db.ref('users').push(newUser);
    addUserForm.reset();
    showNotification('Usuário adicionado com sucesso!', 'success');
  });

  userList.addEventListener('click', e => {
    const changePassBtn = e.target.closest('.change-password-btn');
    const deleteUserBtn = e.target.closest('.delete-user-btn');
    if(changePassBtn) {
        const userId = changePassBtn.dataset.userId;
        const user = USERS.find(u => u.id === userId);
        userLabelForPasswordChange.textContent = user.name;
        changePasswordForm.querySelector('#changePasswordUserId').value = userId;
        changePasswordModal.classList.remove('hidden');
    }
    if (deleteUserBtn) {
        const { userId, userName } = deleteUserBtn.dataset;
        confirmDeleteText.innerHTML = `Excluir o usuário <strong>${userName}</strong>? Ação irreversível.`;
        confirmDeleteBtn.dataset.userId = userId;
        confirmDeleteBtn.dataset.userName = userName;
        delete confirmDeleteBtn.dataset.osId;
        confirmDeleteModal.classList.remove('hidden');
    }
  });

  changePasswordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userId = document.getElementById('changePasswordUserId').value;
    const newPass = document.getElementById('newUserPasswordInput').value;
    db.ref(`users/${userId}/password`).set(newPass);
    changePasswordModal.classList.add('hidden');
    changePasswordForm.reset();
    showNotification(`Senha alterada!`, 'success');
  });
  cancelChangePasswordBtn.addEventListener('click', () => changePasswordModal.classList.add('hidden'));

  generateReportBtn.addEventListener('click', () => {
    const startStr = document.getElementById('startDate').value;
    const endStr = document.getElementById('endDate').value;
    if (!startStr || !endStr) {
        showNotification("Por favor, selecione as datas inicial e final.", "error");
        return;
    }
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T23:59:59');
    
    const filtered = Object.values(allServiceOrders).filter(os => {
        const deliveredAt = os.deliveredAt ? new Date(os.deliveredAt) : null;
        return os.status === 'Entregue' && deliveredAt && deliveredAt >= start && deliveredAt <= end;
    });

    if(filtered.length === 0) {
        reportOutput.innerHTML = '<p>Nenhuma O.S. encontrada para o período.</p>';
        return;
    }
    reportOutput.innerHTML = `<p class="mb-2 font-semibold">${filtered.length} O.S. encontradas.</p><table><thead><tr><th>Placa</th><th>Modelo</th><th>Cliente</th><th>Data de Entrega</th></tr></thead><tbody>${filtered.map(os => `<tr><td>${os.placa}</td><td>${os.modelo}</td><td>${os.cliente}</td><td>${new Date(os.deliveredAt).toLocaleDateString('pt-BR')}</td></tr>`).join('')}</tbody></table>`;
  });

  exportPdfZipBtn.addEventListener('click', async () => {
    const startStr = document.getElementById('startDate').value;
    const endStr = document.getElementById('endDate').value;
     if (!startStr || !endStr) {
        showNotification("Por favor, selecione as datas para exportar.", "error");
        return;
    }
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T23:59:59');
    const filtered = Object.values(allServiceOrders).filter(os => os.status === 'Entregue' && os.deliveredAt && new Date(os.deliveredAt) >= start && new Date(os.deliveredAt) <= end);
    if(filtered.length === 0) {
        showNotification('Nenhuma O.S. encontrada para exportar.', 'error');
        return;
    }
    showNotification(`Iniciando exportação de ${filtered.length} O.S....`, 'success');
    const zip = new JSZip();
    filtered.forEach(os => {
        const htmlContent = generatePrintableOsHtml(os);
        zip.file(`OS_${os.placa}_${os.cliente}.html`, htmlContent);
    });
    const zipBlob = await zip.generateAsync({type:"blob"});
    saveAs(zipBlob, `Relatorio_OS_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.zip`);
  });

  // --- INICIALIZAÇÃO ---
  db.ref('users').on('value', snapshot => {
    const usersData = snapshot.val();
    if (usersData) {
        USERS = Object.entries(usersData).map(([id, data]) => ({ id, ...data }));
    } else {
        const defaultUsers = {
            'user-001': { name: 'Thiago Ventura Valencio', role: 'Gestor de Sistema', password: 'thiago' },
            'user-002': { name: 'Augusto', role: 'Gestor', password: 'augusto' },
        };
        db.ref('users').set(defaultUsers);
    }
    
    if (!currentUser) initializeLoginScreen();
    if(!adminModal.classList.contains('hidden')) populateUserList();
  });
});

