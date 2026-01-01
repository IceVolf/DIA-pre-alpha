// Mini Telegram — app.js
// Restored: clicking document opens profile+QR editor (create/generate/upload QR)
// Saves user's fullname, photo, dob, passport and QR to per-user storage.
// Also converts generated QR (Google Chart) to dataURL so it's saved like an uploaded photo.

(function(){
  const ACCESS_CODE = 'RustIsReal';

  // Storage keys
  const GLOBAL_STORAGE_KEY = 'mini_telegram_global_v1';
  const USER_KEY_PREFIX = 'mini_telegram_user_';

  // DOM refs
  const bottomNav = document.getElementById('bottom-nav');
  const pagesContainer = document.querySelector('.app-main');
  const pageTitle = document.getElementById('page-title');

  const docCard = document.getElementById('doc-card');
  const userPhotoImg = document.getElementById('user-photo');
  const profileFullname = document.getElementById('profile-fullname');
  const profileDobEl = document.getElementById('profile-dob');
  const profilePassportEl = document.getElementById('profile-passport');

  const newsListEl = document.getElementById('newsList');
  const devListEl = document.getElementById('devList');
  const topTabs = Array.from(document.querySelectorAll('.top-tab'));
  const newsAdminToolbar = document.getElementById('news-admin-toolbar');
  const addNewsBtn = document.getElementById('add-news-btn');
  const addNavBtn = document.getElementById('add-nav-btn');

  const helpBtn = document.getElementById('help-btn');
  const profileModal = document.getElementById('profile-modal');
  const profilePhotoInput = document.getElementById('profile-photo-input');
  const profileNameInput = document.getElementById('profile-name-input');
  const profileDobInput = document.getElementById('profile-dob-input');
  const profilePassportInput = document.getElementById('profile-passport-input');
  const profileSave = document.getElementById('profile-save');
  const profileCancel = document.getElementById('profile-cancel');

  // profile-qr controls
  const profileQrInput = document.getElementById('profile-qr-input');
  const profileQrUpload = document.getElementById('profile-qr-upload');
  const profileGenerateBtn = document.getElementById('profile-generate-qr');
  const profileQrPreview = document.getElementById('profile-qr-preview');

  const devBtn = document.getElementById('dev-btn');
  const devModal = document.getElementById('dev-modal');
  const devInput = document.getElementById('dev-input');
  const devSubmit = document.getElementById('dev-submit');
  const devCancel = document.getElementById('dev-cancel');

  const newsModal = document.getElementById('news-modal');
  const newsTitleInput = document.getElementById('news-title-input');
  const newsBodyInput = document.getElementById('news-body-input');
  const newsSave = document.getElementById('news-save');
  const newsCancelBtn = document.getElementById('news-cancel');

  const navModal = document.getElementById('nav-modal');
  const navLabelInput = document.getElementById('nav-label-input');
  const navIdInput = document.getElementById('nav-id-input');
  const navSave = document.getElementById('nav-save');
  const navCancel = document.getElementById('nav-cancel');

  const qrModal = document.getElementById('qr-modal');
  const qrInput = document.getElementById('qr-input');
  const qrImageUpload = document.getElementById('qr-image-upload');
  const qrSave = document.getElementById('qr-save');
  const qrCancel = document.getElementById('qr-cancel');
  const qrImage = document.getElementById('qr-image');
  const qrTextDisplay = document.getElementById('qr-text-display');
  const editQrBtn = document.getElementById('edit-qr-btn');
  const qrBackBtn = document.getElementById('qr-back-btn');
  const qrHeader = document.getElementById('qr-title-header');

  const servicesListEl = document.getElementById('services-list');
  const servicesToolbar = document.getElementById('services-admin-toolbar');
  const addServiceBtn = document.getElementById('add-service-btn');
  const serviceModal = document.getElementById('service-modal');
  const serviceLabelInput = document.getElementById('service-label-input');
  const serviceTypeInput = document.getElementById('service-type-input');
  const serviceTargetInput = document.getElementById('service-target-input');
  const serviceSave = document.getElementById('service-save');
  const serviceCancel = document.getElementById('service-cancel');

  const manageAdminsBtn = document.getElementById('manage-admins-btn');
  const adminModal = document.getElementById('admin-modal');
  const adminListEl = document.getElementById('admin-list');
  const adminAddInput = document.getElementById('admin-add-input');
  const adminAddBtn = document.getElementById('admin-add-btn');
  const adminCloseBtn = document.getElementById('admin-close-btn');

  // fullscreen QR modal
  const qrFullscreenModal = document.getElementById('qr-fullscreen-modal');
  const qrFullscreenImage = document.getElementById('qr-fullscreen-image');
  const qrFullscreenClose = document.getElementById('qr-fullscreen-close');

  // app state separated into global & per-user
  let globalData = {
    navItems: [
      { id: 'news', label: 'Новини' },
      { id: 'documents', label: 'Документи' },
      { id: 'services', label: 'Послуги' },
      { id: 'menu', label: 'Меню' }
    ],
    documentsText: "Це основний текст сторінки Документи. Натисніть \"Меню → Допомога\", щоб редагувати цей документ.",
    profile: {
      fullname: "Ім'я Прізвище По батькові",
      photo: "https://via.placeholder.com/120x150.png?text=Фото",
      dob: "2003-08-17",
      passport: "123456789"
    },
    qr: {
      content: "https://example.com"
    },
    admins: [
      "304197017"
    ],
    news: {
      news: [
        { id: genId(), title: 'Ласкаво просимо', body: 'Ласкаво просимо у вкладку Новини. Адміністратор може додавати елементи.'}
      ],
      underDevelopment: []
    },
    services: []
  };

  // userData holds per-telegram user data (profile overrides, qr image/content)
  let userData = {
    profile: {},
    qr: {}
  };

  let devMode = false;
  let currentUserId = null;

  // helpers
  function genId(){ return 'i' + Math.random().toString(36).slice(2,9); }
  function showModal(m){ if(m) m.setAttribute('aria-hidden','false'); }
  function closeModal(m){ if(m) m.setAttribute('aria-hidden','true'); }
  function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function getQueryParam(name){ const p = new URLSearchParams(location.search); return p.get(name); }
  function getInjectedUserId(){ if(window.TELEGRAM_USER_ID) return String(window.TELEGRAM_USER_ID); const q = getQueryParam('user'); if(q) return String(q); return null; }

  // storage: global
  function loadGlobalLocal(){
    try {
      const raw = localStorage.getItem(GLOBAL_STORAGE_KEY);
      if(raw) return JSON.parse(raw);
    } catch(e){ console.warn('loadGlobalLocal failed', e); }
    return null;
  }
  function saveGlobalLocal(){
    try {
      localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(globalData));
    } catch(e){ console.warn('saveGlobalLocal failed', e); }
  }

  // storage: per-user
  function userStorageKey(uid){
    if(!uid) return USER_KEY_PREFIX + 'anon';
    return USER_KEY_PREFIX + String(uid);
  }
  function loadUserLocal(uid){
    try {
      const raw = localStorage.getItem(userStorageKey(uid));
      if(raw) return JSON.parse(raw);
    } catch(e){ console.warn('loadUserLocal failed', e); }
    return null;
  }
  function saveUserLocal(uid){
    try {
      localStorage.setItem(userStorageKey(uid), JSON.stringify(userData));
    } catch(e){ console.warn('saveUserLocal failed', e); }
  }

  // remote global loader (data.json)
  async function loadRemoteGlobal(){
    try {
      const res = await fetch('data.json', {cache: 'no-store'});
      if(!res.ok) return null;
      return await res.json();
    } catch(e){ return null; }
  }

  // helper to convert image URL (chart API) to dataURL
  async function fetchImageAsDataURL(url){
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = ()=> resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    } catch(e){
      console.warn('fetchImageAsDataURL failed', e);
      return null;
    }
  }

  // initialize data
  async function initializeData(){
    const remote = await loadRemoteGlobal();
    if(remote) {
      globalData = Object.assign({}, globalData, remote);
    }
    const localGlobal = loadGlobalLocal();
    if(localGlobal) globalData = Object.assign({}, globalData, localGlobal);

    currentUserId = getInjectedUserId();
    const uLocal = loadUserLocal(currentUserId);
    if(uLocal) userData = Object.assign({}, userData, uLocal);

    userData.profile = Object.assign({}, globalData.profile, userData.profile || {});
    userData.qr = Object.assign({}, globalData.qr, userData.qr || {});
  }

  // rendering
  function renderNav(){
    bottomNav.innerHTML = '';
    (globalData.navItems || []).forEach(item=>{
      const btn = document.createElement('button');
      btn.className = 'nav-btn';
      btn.dataset.target = item.id;
      btn.textContent = item.label;
      btn.addEventListener('click', ()=>navigateTo(item.id, btn));
      bottomNav.appendChild(btn);
    });
    const activeBtn = bottomNav.querySelector('.nav-btn.active') || bottomNav.querySelector('.nav-btn');
    if(activeBtn) activeBtn.click();
  }

  function ensurePage(id){
    const existing = document.getElementById(id);
    if(existing) return existing;
    const section = document.createElement('section');
    section.id = id;
    section.className = 'page';
    section.innerHTML = `<h2>${id}</h2><div class="page-content">Ця сторінка створена динамічно.</div>`;
    pagesContainer.appendChild(section);
    return section;
  }

  function renderPages(){
    ['news','documents','services','menu','qr'].forEach(id => ensurePage(id));
    userPhotoImg.src = userData.profile.photo || globalData.profile.photo || '';
    profileFullname.textContent = userData.profile.fullname || globalData.profile.fullname || '';
    const dob = userData.profile.dob || globalData.profile.dob || '';
    if(dob){
      const d = new Date(dob);
      if(!isNaN(d)){
        const dd = String(d.getDate()).padStart(2,'0');
        const mm = String(d.getMonth()+1).padStart(2,'0');
        const yyyy = d.getFullYear();
        profileDobEl.textContent = `${dd}.${mm}.${yyyy}`;
      } else profileDobEl.textContent = dob;
    } else profileDobEl.textContent = '';
    profilePassportEl.textContent = userData.profile.passport || globalData.profile.passport || '';
    renderQR();
    renderServices();
  }

  function renderNews(){
    newsListEl.innerHTML = '';
    devListEl.innerHTML = '';
    (globalData.news.news || []).forEach(item => {
      newsListEl.appendChild(renderNewsItem(item, 'news'));
    });
    (globalData.news.underDevelopment || []).forEach(item => {
      devListEl.appendChild(renderNewsItem(item, 'underDevelopment'));
    });
  }

  function renderNewsItem(item, listKey){
    const el = document.createElement('div');
    el.className = 'news-item';
    el.innerHTML = `<h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.body)}</p>`;
    if(devMode || isUserAdmin(currentUserId)){
      const actions = document.createElement('div'); actions.className = 'item-actions';
      const editBtn = document.createElement('button'); editBtn.className='btn'; editBtn.textContent='Редагувати';
      const delBtn = document.createElement('button'); delBtn.className='btn'; delBtn.textContent='Видалити';
      editBtn.addEventListener('click', ()=>openNewsModal('edit', listKey, item));
      delBtn.addEventListener('click', ()=>{ if(confirm('Видалити цю новину?')){ removeNewsItem(listKey, item.id); } });
      actions.appendChild(editBtn); actions.appendChild(delBtn);
      el.appendChild(actions);
    }
    return el;
  }

  // Services
  function renderServices(){
    servicesListEl.innerHTML = '';
    (globalData.services || []).forEach(s => {
      const btnWrap = document.createElement('div');
      btnWrap.style.position = 'relative';
      const btn = document.createElement('button');
      btn.className = 'service-btn';
      btn.textContent = s.label;
      btn.addEventListener('click', ()=> {
        if(s.type === 'link'){ window.open(s.target, '_blank'); }
        else if(s.type === 'page'){
          ensurePage(s.target);
          const navBtn = Array.from(bottomNav.querySelectorAll('.nav-btn')).find(b=>b.dataset.target===s.target);
          if(navBtn) navBtn.click();
          else navigateTo(s.target);
        }
      });
      btnWrap.appendChild(btn);

      if(devMode || isUserAdmin(currentUserId)){
        const actions = document.createElement('div');
        actions.style.position = 'absolute';
        actions.style.top = '-8px'; actions.style.right = '-8px'; actions.style.display='flex'; actions.style.gap='6px';
        const edit = document.createElement('button'); edit.className='btn'; edit.textContent='E';
        const del = document.createElement('button'); del.className='btn'; del.textContent='X';
        edit.addEventListener('click', ()=> openServiceModal('edit', s));
        del.addEventListener('click', ()=> {
          if(!confirm('Видалити сервіс?')) return;
          globalData.services = (globalData.services || []).filter(x => x.id !== s.id);
          saveGlobalLocal(); renderServices();
        });
        actions.appendChild(edit); actions.appendChild(del);
        btnWrap.appendChild(actions);
      }

      servicesListEl.appendChild(btnWrap);
    });
  }

  // navigation
  function navigateTo(target, btn){
    const allBtns = Array.from(bottomNav.querySelectorAll('.nav-btn'));
    allBtns.forEach(b => b.classList.toggle('active', b === btn));
    const allPages = Array.from(document.querySelectorAll('.page'));
    allPages.forEach(p => p.classList.toggle('active', p.id === target));
    if(target === 'qr'){ pageTitle.textContent = 'qr-код'; qrHeader && (qrHeader.textContent = 'qr-код'); }
    else pageTitle.textContent = (globalData.navItems.find(n=>n.id===target) || {label: target}).label || target;
    if(target === 'documents') document.querySelector('#documents')?.scrollIntoView({behavior:'smooth', block:'start'});
  }

  // admin helpers
  function isUserAdmin(uid){
    if(!uid) return false;
    return Array.isArray(globalData.admins) && globalData.admins.indexOf(String(uid)) !== -1;
  }

  function setDevMode(on){
    devMode = !!on;
    newsAdminToolbar.setAttribute('aria-hidden', devMode ? 'false' : 'true');
    servicesToolbar.setAttribute('aria-hidden', devMode ? 'false' : 'true');
    renderNews();
    renderServices();
    const showManage = devMode || isUserAdmin(currentUserId);
    manageAdminsBtn.style.display = showManage ? '' : 'none';
    devBtn.textContent = devMode ? 'Вийти з режиму розробника' : 'Розробник';
  }

  // News editing
  let editContext = null;
  function openNewsModal(mode, listKey, existing){
    editContext = { mode, listKey, id: existing ? existing.id : null };
    if(mode === 'edit' && existing){ newsTitleInput.value = existing.title; newsBodyInput.value = existing.body; }
    else { newsTitleInput.value = ''; newsBodyInput.value = ''; }
    showModal(newsModal); setTimeout(()=>newsTitleInput.focus(),60);
  }
  function saveNewsFromModal(){
    const t = newsTitleInput.value.trim(); const b = newsBodyInput.value.trim();
    if(!t){ alert('Потрібен заголовок'); return; }
    if(editContext.mode === 'edit'){
      const list = globalData.news[editContext.listKey];
      const idx = list.findIndex(i=>i.id===editContext.id);
      if(idx>=0){ list[idx].title = t; list[idx].body = b; }
    } else {
      const item = { id: genId(), title: t, body: b };
      globalData.news[editContext.listKey] = globalData.news[editContext.listKey] || [];
      globalData.news[editContext.listKey].unshift(item);
    }
    saveGlobalLocal(); renderNews(); closeModal(newsModal);
  }
  function removeNewsItem(listKey, id){
    globalData.news[listKey] = (globalData.news[listKey] || []).filter(i=>i.id !== id);
    saveGlobalLocal(); renderNews();
  }

  // Services modal
  let serviceEditContext = null;
  function openServiceModal(mode, existing){
    serviceEditContext = { mode, id: existing ? existing.id : null };
    if(mode === 'edit' && existing){
      serviceLabelInput.value = existing.label; serviceTypeInput.value = existing.type; serviceTargetInput.value = existing.target;
    } else { serviceLabelInput.value=''; serviceTypeInput.value='page'; serviceTargetInput.value=''; }
    showModal(serviceModal); setTimeout(()=>serviceLabelInput.focus(),60);
  }
  function saveServiceFromModal(){
    const label = serviceLabelInput.value.trim(); const type = serviceTypeInput.value; const target = serviceTargetInput.value.trim();
    if(!label){ alert('Потрібен підпис кнопки'); return; }
    if(!target){ alert('Потрібен ID сторінки або URL'); return; }
    if(serviceEditContext.mode === 'edit' && serviceEditContext.id){
      const idx = (globalData.services || []).findIndex(s=>s.id === serviceEditContext.id);
      if(idx>=0){ globalData.services[idx].label = label; globalData.services[idx].type = type; globalData.services[idx].target = target; }
    } else {
      const id = 's' + Math.random().toString(36).slice(2,8);
      globalData.services = globalData.services || []; globalData.services.push({ id, label, type, target });
      if(type === 'page' && !globalData.navItems.some(n=>n.id === target)) globalData.navItems.push({ id: target, label: label });
    }
    saveGlobalLocal(); renderNav(); renderServices(); closeModal(serviceModal);
  }

  // Profile + QR editor (opened from Menu->Help and clicking document)
  function openProfileModal(){
    profileNameInput.value = userData.profile.fullname || globalData.profile.fullname || '';
    profileDobInput.value = userData.profile.dob || globalData.profile.dob || '';
    profilePassportInput.value = userData.profile.passport || globalData.profile.passport || '';
    profilePhotoInput.value = '';
    profileQrInput.value = (userData.qr && userData.qr.content) || '';
    profileQrUpload.value = '';
    // set preview (prefer saved image)
    if(userData.qr && userData.qr.image) profileQrPreview.src = userData.qr.image;
    else {
      // generate preview from content if present
      const content = (userData.qr && userData.qr.content) || globalData.qr.content || '';
      if(content) profileQrPreview.src = `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(content)}`;
      else profileQrPreview.src = '';
    }
    showModal(profileModal); setTimeout(()=>profileNameInput.focus(),60);
  }

  // convert file to dataURL
  function readFileAsDataURL(file){
    return new Promise((res, rej)=>{
      const fr = new FileReader();
      fr.onload = ()=>res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  // generate QR image (fetch chart and convert to dataURL)
  async function generateQrDataUrl(text){
    const size = 800; // large
    const src = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(text)}`;
    const durl = await fetchImageAsDataURL(src);
    return durl; // may be null on failure
  }

  async function saveProfileFromModal(){
    const name = profileNameInput.value.trim();
    const dob = profileDobInput.value;
    const passport = profilePassportInput.value.trim();

    if(!userData) userData = {};
    if(!userData.profile) userData.profile = {};
    if(name) userData.profile.fullname = name;
    if(dob) userData.profile.dob = dob;
    if(passport) userData.profile.passport = passport;

    const photoFile = profilePhotoInput.files && profilePhotoInput.files[0];
    if(photoFile){
      try { const durl = await readFileAsDataURL(photoFile); userData.profile.photo = durl; } catch(e){ console.warn('photo read failed', e); }
    }

    // handle QR: prefer uploaded image, else explicit qr text, else maybe generate from page data if requested
    const qrFile = profileQrUpload.files && profileQrUpload.files[0];
    const qrText = profileQrInput.value.trim();

    if(qrFile){
      try { const qd = await readFileAsDataURL(qrFile); userData.qr = userData.qr || {}; userData.qr.image = qd; userData.qr.content = qrText || userData.qr.content || ''; } catch(e){ console.warn('qr upload failed', e); }
    } else if(qrText){
      // generate an image from the text and save as dataURL so it's stored like a photo
      try {
        const generated = await generateQrDataUrl(qrText);
        if(generated){
          userData.qr = userData.qr || {};
          userData.qr.image = generated;
          userData.qr.content = qrText;
        } else {
          // fallback: store content only
          userData.qr = userData.qr || {};
          userData.qr.content = qrText;
        }
      } catch(e){
        console.warn('QR generation failed', e);
        userData.qr = userData.qr || {};
        userData.qr.content = qrText;
      }
    } else {
      // no new input: keep existing userData.qr as is
    }

    // persist per-user
    saveUserLocal(currentUserId);
    // re-render page
    renderPages();
    closeModal(profileModal);
  }

  // QR: render (prefer uploaded image saved in userData.qr.image, else generate from userData.qr.content or global)
  function renderQR(){
    const userImg = userData.qr && userData.qr.image;
    const content = (userData.qr && userData.qr.content) || globalData.qr.content || '';
    if(userImg){
      qrImage.src = userImg;
    } else if(content){
      const size = 300;
      qrImage.src = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(content)}`;
    } else {
      qrImage.src = '';
    }
    qrTextDisplay.textContent = content || '';
    // profile-QR preview sync
    if(profileQrPreview){
      if(userImg) profileQrPreview.src = userImg;
      else if(content) profileQrPreview.src = `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(content)}`;
      else profileQrPreview.src = '';
    }
  }

  function openQrModal(){
    qrInput.value = (userData.qr && userData.qr.content) || globalData.qr.content || '';
    qrImageUpload.value = '';
    showModal(qrModal);
    setTimeout(()=>qrInput.focus(), 60);
  }

  async function saveQrFromModal(){
    const content = qrInput.value.trim();
    const file = qrImageUpload.files && qrImageUpload.files[0];
    if(!userData) userData = {};
    if(!userData.qr) userData.qr = {};
    if(content) userData.qr.content = content;
    if(file){
      try{ const durl = await readFileAsDataURL(file); userData.qr.image = durl; }
      catch(e){ console.warn('qr upload failed', e); }
    } else {
      // if only content provided and no file, generate and save as dataURL for consistency
      if(content){
        const generated = await generateQrDataUrl(content);
        if(generated) userData.qr.image = generated;
      }
    }
    saveUserLocal(currentUserId); renderQR(); closeModal(qrModal);
  }

  // Fullscreen QR viewer
  function openQrFullscreen(){
    const src = qrImage.src;
    if(!src) return;
    qrFullscreenImage.src = src;
    showModal(qrFullscreenModal);
  }
  function closeQrFullscreen(){
    qrFullscreenImage.src = '';
    closeModal(qrFullscreenModal);
  }

  // Admins management
  function openAdminModal(){
    adminAddInput.value = '';
    renderAdminList(); showModal(adminModal); setTimeout(()=>adminAddInput.focus(),60);
  }
  function renderAdminList(){
    adminListEl.innerHTML = '';
    (globalData.admins || []).forEach(id => {
      const row = document.createElement('div');
      row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center'; row.style.padding='6px 0';
      row.innerHTML = `<span style="font-family:monospace">${escapeHtml(String(id))}</span>`;
      const rem = document.createElement('button'); rem.className='btn'; rem.textContent='Видалити';
      rem.addEventListener('click', ()=>{ if(!confirm(`Видалити адміністратора ${id}?`)) return; globalData.admins = (globalData.admins||[]).filter(x=>String(x)!==String(id)); saveGlobalLocal(); renderAdminList(); setDevMode(devMode); });
      row.appendChild(rem); adminListEl.appendChild(row);
    });
    if(!(globalData.admins||[]).length) adminListEl.textContent = 'Немає адміністративних ID';
  }
  function addAdminFromModal(){
    const val = adminAddInput.value.trim(); if(!val){ alert('Введіть Telegram ID'); return; }
    if(!/^\d+$/.test(val)){ alert('ID має містити лише цифри'); return; }
    globalData.admins = globalData.admins || [];
    if(globalData.admins.indexOf(val) !== -1){ alert('ID вже є в списку'); return; }
    globalData.admins.push(val); saveGlobalLocal(); renderAdminList(); setDevMode(devMode); adminAddInput.value='';
  }

  // UI bindings
  function bindUI(){
    topTabs.forEach(tb => tb.addEventListener('click', ()=> { topTabs.forEach(t=>t.classList.toggle('active', t===tb)); const list = tb.dataset.list; if(list==='newsList'){ newsListEl.classList.remove('hidden'); devListEl.classList.add('hidden'); } else { devListEl.classList.remove('hidden'); newsListEl.classList.add('hidden'); } }));

    // Menu -> Help opens profile editor
    helpBtn.addEventListener('click', ()=> openProfileModal());
    profileSave.addEventListener('click', saveProfileFromModal);
    profileCancel.addEventListener('click', ()=> closeModal(profileModal));
    document.getElementById('profile-modal-backdrop').addEventListener('click', ()=> closeModal(profileModal));

    // Profile QR upload preview handler
    profileQrUpload.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      try {
        const durl = await readFileAsDataURL(f);
        profileQrPreview.src = durl;
      } catch(e){ console.warn('preview upload failed', e); }
    });

    // Generate QR from current profile fields (compose text automatically)
    profileGenerateBtn.addEventListener('click', async ()=>{
      // compose text: fullname | dob | passport
      const fullname = profileNameInput.value.trim() || userData.profile.fullname || globalData.profile.fullname || '';
      const dob = profileDobInput.value || userData.profile.dob || globalData.profile.dob || '';
      const passport = profilePassportInput.value.trim() || userData.profile.passport || globalData.profile.passport || '';
      const text = `Name:${fullname}\nDOB:${dob}\nPassport:${passport}`;
      profileQrInput.value = text;
      // generate and preview
      const generated = await generateQrDataUrl(text);
      if(generated) profileQrPreview.src = generated;
      else alert('Не вдалося згенерувати QR');
    });

    // Dev button logic
    devBtn.addEventListener('click', ()=> {
      const uid = getInjectedUserId();
      if(uid && isUserAdmin(uid)){ setDevMode(!devMode); const btn = Array.from(bottomNav.querySelectorAll('.nav-btn')).find(b=>b.dataset.target==='news'); btn && btn.click(); return; }
      if(!devMode) showModal(devModal); else setDevMode(false);
    });
    devSubmit.addEventListener('click', ()=> { const code = devInput.value.trim(); if(code === ACCESS_CODE){ setDevMode(true); closeModal(devModal); const btn = Array.from(bottomNav.querySelectorAll('.nav-btn')).find(b=>b.dataset.target==='news'); btn && btn.click(); } else alert('Код доступу невірний'); });
    devCancel.addEventListener('click', ()=> closeModal(devModal));
    document.getElementById('dev-modal-backdrop').addEventListener('click', ()=> closeModal(devModal));

    // News admin actions
    addNewsBtn.addEventListener('click', ()=> { if(!(devMode || isUserAdmin(currentUserId))){ alert('Додавання новин доступне тільки адміністратору або в режимі розробника'); return; } openNewsModal('new','news'); });
    newsSave.addEventListener('click', saveNewsFromModal);
    newsCancelBtn.addEventListener('click', ()=> closeModal(newsModal));
    document.getElementById('news-modal-backdrop').addEventListener('click', ()=> closeModal(newsModal));

    // nav add
    addNavBtn.addEventListener('click', ()=> { if(!(devMode || isUserAdmin(currentUserId))){ alert('Додавання кнопок доступне тільки адміністратору або в режимі розробника'); return; } navLabelInput.value=''; navIdInput.value=''; showModal(navModal); setTimeout(()=>navLabelInput.focus(),60); });
    navSave.addEventListener('click', ()=> {
      const label = navLabelInput.value.trim(); let id = navIdInput.value.trim();
      if(!label){ alert('Потрібен напис кнопки'); return; }
      if(!id) id = label.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,''); else id = id.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'');
      if(globalData.navItems.some(n=>n.id === id)){ alert('Ідентифікатор вже існує, оберіть інший'); return; }
      globalData.navItems.push({ id, label }); saveGlobalLocal(); ensurePage(id); renderNav(); closeModal(navModal);
    });
    navCancel.addEventListener('click', ()=> closeModal(navModal));
    document.getElementById('nav-modal-backdrop').addEventListener('click', ()=> closeModal(navModal));

    // clicking the document card now opens profile+QR editor (this restores the "add QR when clicking document" flow)
    docCard.addEventListener('click', (e)=>{
      if(e.target.closest('button') || e.target.closest('input')) return;
      openProfileModal();
    });

    // QR edit / save / cancel (QR page)
    editQrBtn.addEventListener('click', ()=> openQrModal());
    qrSave.addEventListener('click', saveQrFromModal);
    qrCancel.addEventListener('click', ()=> closeModal(qrModal));
    document.getElementById('qr-modal-backdrop').addEventListener('click', ()=> closeModal(qrModal));

    // clicking the QR image opens fullscreen viewer
    qrImage.addEventListener('click', openQrFullscreen);
    qrFullscreenClose.addEventListener('click', closeQrFullscreen);
    qrFullscreenModal.addEventListener('click', (e)=> { if(e.target === qrFullscreenModal) closeQrFullscreen(); });

    // QR Back button -> go to Documents
    qrBackBtn.addEventListener('click', ()=> { const btn = Array.from(bottomNav.querySelectorAll('.nav-btn')).find(b=>b.dataset.target==='documents'); btn && btn.click(); });

    // Services admin add
    addServiceBtn.addEventListener('click', ()=> { if(!(devMode || isUserAdmin(currentUserId))){ alert('Додавання сервісів доступне тільки адміністратору або в режимі розробника'); return; } openServiceModal('new'); });
    serviceSave.addEventListener('click', saveServiceFromModal);
    serviceCancel.addEventListener('click', ()=> closeModal(serviceModal));
    document.getElementById('service-modal-backdrop').addEventListener('click', ()=> closeModal(serviceModal));
    serviceTypeInput.addEventListener('change', ()=> { const lab = document.getElementById('service-target-label'); lab.textContent = serviceTypeInput.value === 'link' ? 'URL' : 'ID сторінки'; });

    // Admins management
    manageAdminsBtn.addEventListener('click', ()=> { if(!(devMode || isUserAdmin(currentUserId))){ alert('Доступ дозволений тільки адміністратору'); return; } openAdminModal(); });
    adminAddBtn.addEventListener('click', addAdminFromModal);
    adminCloseBtn.addEventListener('click', ()=> closeModal(adminModal));
    document.getElementById('admin-modal-backdrop').addEventListener('click', ()=> closeModal(adminModal));

    // modal backdrop generic close
    document.querySelectorAll('.modal-backdrop').forEach(b => b.addEventListener('click', (e)=> { const modal = b.parentElement; if(modal) closeModal(modal); }));

    // ESC closes modals
    window.addEventListener('keydown', (e)=> { if(e.key === 'Escape') document.querySelectorAll('.modal[aria-hidden="false"]').forEach(m=>closeModal(m)); });
  }

  // init
  async function init(){
    await initializeData();
    renderPages();
    renderNav();
    renderNews();
    renderServices();

    const defaultBtn = Array.from(bottomNav.querySelectorAll('.nav-btn')).find(b=>b.dataset.target==='documents') || bottomNav.querySelector('.nav-btn');
    defaultBtn && defaultBtn.click();

    if(currentUserId && isUserAdmin(currentUserId)) setDevMode(true);

    bindUI();
  }

  // public hooks
  window.miniTelegram = {
    enableDevMode: ()=> setDevMode(true),
    disableDevMode: ()=> setDevMode(false),
    setUserId: (id)=> { window.TELEGRAM_USER_ID = String(id); currentUserId = String(id); const u = loadUserLocal(currentUserId); if(u) userData = Object.assign({}, userData, u); if(isUserAdmin(currentUserId)) setDevMode(true); renderPages(); }
  };

  init();

})();
