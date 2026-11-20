// =====================================================================
// Gmail — Gmail-style client-side app.
// All email data comes from EMAILS in data.js. Nothing here needs to
// change when you swap in your own 200 emails — just edit data.js.
// =====================================================================

// Edit this to customize the account switcher popup (top-right avatar).
const ACCOUNT = {
  name: "Aman Gourav Sethi",
  email: "719MM1041@nitrkl.ac.in",
  avatarColor: "#4285F4",
  otherAccounts: [
    { name: "Aman Beta", email: "amanbeta115@gmail.com", avatarColor: "#8430ce" }
  ],
  storagePercent: 16,
  storageTotal: "15 GB"
};

const LABEL_COLORS = {
  Primary:    "#1a73e8",
  Social:     "#e91e63",
  Promotions: "#188038",
  Updates:    "#f9ab00",
  Forums:     "#8430ce"
};

const PAGE_SIZE = 50;

let state = {
  emails: JSON.parse(JSON.stringify(EMAILS)),
  filter: "inbox",       // inbox | starred | sent | important | label:<name>
  tab: "Primary",
  search: "",
  page: 0,
  selected: new Set(),
  openEmailId: null
};

// -------------------- helpers --------------------
// email.date is a full ISO datetime string (e.g. "2026-03-14T09:32:00").
// Dates/times are fixed at data-generation time, so they don't shift
// depending on when the page happens to be opened.
function relativeDate(dateStr){
  const d = new Date(dateStr);
  const now = new Date();
  const startOfDay = x => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 0 && diffDays < 7) return d.toLocaleDateString(undefined,{weekday:'short'});
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}

function initials(name){
  return name.trim().charAt(0).toUpperCase();
}

// Deterministic pseudo-random hex string (looks like a real mailing-list id,
// but generated purely client-side from the email's own data — no real
// tracking/identifiers involved).
function pseudoHex(seed, length){
  let x = Math.abs(seed) % 2147483647;
  if (x <= 0) x += 2147483646;
  let out = '';
  while (out.length < length){
    x = (x * 16807) % 2147483647;
    out += x.toString(16);
  }
  return out.slice(0, length);
}

function seedFromString(str){
  let h = 0;
  for (let i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i)) | 0; }
  return h;
}

function fullDateTime(email){
  const d = new Date(email.date);
  const dateStr = d.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});
  const timeStr = d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
  return `${dateStr}, ${timeStr}`;
}

// Builds the "show original" style details popup content for an email.
function buildDetailsPopup(email){
  const domain = (email.fromEmail.split('@')[1] || 'example.com').toLowerCase();
  const parts = domain.split('.');
  const rootDomain = parts.length > 2 ? parts.slice(-2).join('.') : domain;
  const showMailingList = email.label !== 'Primary';
  const seed = seedFromString(email.id + '|' + email.subject);
  const mailingListId = pseudoHex(seed, 40);
  const dt = fullDateTime(email);

  let rows = `
    <div class="popup-row"><span class="popup-label">from:</span><span class="popup-value"><strong>${escapeHtml(email.from)}</strong> &lt;${email.fromEmail}&gt;</span></div>
    <div class="popup-row"><span class="popup-label">to:</span><span class="popup-value">${escapeHtml(email.to || 'me')}</span></div>
    <div class="popup-row"><span class="popup-label">date:</span><span class="popup-value">${dt}</span></div>
    <div class="popup-row"><span class="popup-label">subject:</span><span class="popup-value">${escapeHtml(email.subject)}</span></div>
  `;

  if (showMailingList){
    rows += `
    <div class="popup-row"><span class="popup-label">mailing list:</span>
      <span class="popup-value">
        &lt;${mailingListId}@${domain}&gt;<br>
        <a href="#" class="filter-list-link" data-label="${email.label}">Filter messages from this mailing list</a>
      </span>
    </div>`;
  }

  rows += `
    <div class="popup-row"><span class="popup-label">mailed-by:</span><span class="popup-value">${domain}</span></div>
    <div class="popup-row"><span class="popup-label">signed-by:</span><span class="popup-value">${rootDomain}</span></div>
    <div class="popup-row"><span class="popup-label">security:</span><span class="popup-value">🔒 Standard encryption (TLS)</span></div>
  `;
  return rows;
}

function avatarColor(name){
  const colors = ["#EA4335","#4285F4","#34A853","#FBBC05","#8430ce","#e91e63","#00897b"];
  let hash = 0;
  for (let i=0;i<name.length;i++) hash = name.charCodeAt(i) + ((hash<<5)-hash);
  return colors[Math.abs(hash) % colors.length];
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=>t.classList.remove('show'), 2500);
}

// -------------------- derived data --------------------
function getLabels(){
  const set = new Set(state.emails.map(e=>e.label));
  return Array.from(set);
}

function getFilteredEmails(){
  const now = Date.now();
  state.emails.forEach(e=>{ if(e.snoozedUntil && new Date(e.snoozedUntil).getTime() <= now) e.snoozedUntil = null; });
  let list = state.emails;

  if (state.filter === "inbox") {
    list = list.filter(e => e.tab !== 'sent' && !e.archived && !e.deleted && !e.spam && !e.snoozedUntil);
    list = list.filter(e => e.label === state.tab);
  } else if (state.filter === "starred") {
    list = list.filter(e => e.starred && !e.deleted && !e.spam);
  } else if (state.filter === "sent") {
    list = list.filter(e => (e.folder === 'sent' || e.sentByMe) && !e.deleted);
  } else if (state.filter === "important") {
    list = list.filter(e => e.important && !e.deleted && !e.spam);
  } else if (state.filter === "snoozed") {
    list = list.filter(e => e.snoozedUntil && new Date(e.snoozedUntil) > new Date() && !e.deleted);
  } else if (state.filter === "drafts") {
    list = list.filter(e => e.isDraft && !e.deleted);
  } else if (state.filter === "purchases") {
    list = list.filter(e => /order|purchase|payment|receipt|delivery|booking/i.test(e.subject + ' ' + e.preview) && !e.deleted && !e.archived);
  } else if (state.filter === "scheduled") {
    list = list.filter(e => e.scheduled && !e.deleted);
  } else if (state.filter === "allmail") {
    list = list.filter(e => !e.deleted && !e.spam);
  } else if (state.filter === "spam") {
    list = list.filter(e => e.spam && !e.deleted);
  } else if (state.filter === "trash") {
    list = list.filter(e => e.deleted);
  } else if (["Social","Updates","Forums","Promotions"].includes(state.filter)) {
    list = list.filter(e => e.label === state.filter && !e.deleted && !e.spam && !e.archived);
  } else if (state.filter.startsWith("label:")) {
    const lbl = state.filter.slice(6);
    list = list.filter(e => (e.label === lbl || (e.customLabels||[]).includes(lbl)) && !e.deleted);
  }

  if (state.search.trim()) {
    const q = state.search.toLowerCase();
    list = list.filter(e =>
      e.from.toLowerCase().includes(q) ||
      e.subject.toLowerCase().includes(q) ||
      e.preview.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q)
    );
  }

  return list.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
}

// -------------------- rendering --------------------
function renderSidebarCounts(){
  const unread = state.emails.filter(e=>!e.read && !e.archived && !e.deleted && !e.spam && !e.sentByMe && !e.snoozedUntil).length;
  document.getElementById('inboxCount').textContent = unread > 0 ? unread : "";
  const counts={Social:0,Updates:0,Forums:0,Promotions:0};
  state.emails.forEach(e=>{if(counts[e.label]!==undefined && !e.read && !e.deleted && !e.archived && !e.spam) counts[e.label]++;});
}

function renderLabels(){
  const el = document.getElementById('labelList');
  const labels = Array.from(new Set([...getLabels(), ...(state.customLabels||[])]));
  el.innerHTML = labels.map(l => `
    <li class="nav-item" data-filter="label:${l}">
      <span class="label-dot" style="background:${LABEL_COLORS[l]||'#999'}"></span>
      <span>${l}</span>
    </li>
  `).join('');
  el.querySelectorAll('.nav-item').forEach(item=>{
    item.addEventListener('click', ()=>{
      state.filter = item.dataset.filter;
      if (state.filter === 'subscriptions') { showToast('Subscription management is not connected to a mail provider'); return; }
      if (state.filter === 'manage-labels') { showToast('Use the Labels section to create and apply labels'); return; }
      if (["Social","Updates","Forums","Promotions"].includes(state.filter)) state.tab = state.filter;
      state.page = 0;
      closeDetail();
      setActiveNav(item);
      render();
    });
  });
}

function setActiveNav(activeEl){
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
  activeEl.classList.add('active');
}

function renderTabs(){
  const showTabs = state.filter === "inbox";
  const tabs = document.getElementById('tabs');
  tabs.style.display = showTabs ? 'flex' : 'none';
  tabs.querySelectorAll('.tab').forEach(tab=>{
    const category = tab.dataset.tab;
    const group = state.emails.filter(e=>e.label===category && !e.deleted && !e.archived && !e.spam && e.tab!=='sent');
    const unread = group.filter(e=>!e.read).length;
    const latest = group.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
    let meta = tab.querySelector('.tab-meta');
    if(!meta){ meta=document.createElement('span'); meta.className='tab-meta'; tab.appendChild(meta); }
    meta.innerHTML = `<span class="tab-unread">${unread ? unread+' new' : ''}</span><span class="tab-preview">${latest ? escapeHtml(latest.from+' — '+latest.preview).slice(0,65) : ''}</span>`;
  });
}

function renderList(){
  const all = getFilteredEmails();
  const start = state.page * PAGE_SIZE;
  const pageItems = all.slice(start, start + PAGE_SIZE);
  const listEl = document.getElementById('emailList');
  const emptyEl = document.getElementById('emptyState');

  document.getElementById('listRange').textContent = all.length
    ? `${start+1}–${Math.min(start+PAGE_SIZE, all.length)} of ${all.length}`
    : '';

  if (pageItems.length === 0) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  document.getElementById('selectAllCheckbox').checked = pageItems.length > 0 && pageItems.every(e=>state.selected.has(e.id));
  document.getElementById('selectAllCheckbox').indeterminate = pageItems.some(e=>state.selected.has(e.id)) && !pageItems.every(e=>state.selected.has(e.id));
  document.getElementById('listToolbar').classList.toggle('has-selection', state.selected.size > 0);
  listEl.innerHTML = pageItems.map(e => `
    <div class="email-row ${e.read ? '' : 'unread'} ${state.selected.has(e.id) ? 'selected':''}" data-id="${e.id}">
      <input type="checkbox" class="row-checkbox" data-id="${e.id}" ${state.selected.has(e.id)?'checked':''}>
      <span class="row-star ${e.starred?'starred':''}" data-id="${e.id}">
        <svg viewBox="0 0 24 24"><path d="M12 2l3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 18.3 5.6 21.7 7 14.5l-5.3-5 7.2-.9L12 2z" fill="${e.starred?'currentColor':'none'}" stroke="currentColor" stroke-width="1.6"/></svg>
      </span>
      ${e.important ? `<span class="row-important"><svg viewBox="0 0 24 24"><path d="M13 2L3 14h7l-1 8 11-13h-7l1-7z" fill="currentColor"/></svg></span>` : `<span class="row-important"></span>`}
      <span class="row-from">${e.from}</span>
      <span class="row-content">
        <span class="row-subject">${escapeHtml(e.subject)}</span> — <span class="email-preview">${escapeHtml(e.preview)}</span>
      </span>
      <span class="row-date">${relativeDate(e.date)}</span>
    </div>
  `).join('');

  // row click -> open
  listEl.querySelectorAll('.email-row').forEach(row=>{
    row.addEventListener('click', (ev)=>{
      if (ev.target.closest('.row-checkbox') || ev.target.closest('.row-star')) return;
      openEmail(parseInt(row.dataset.id));
    });
  });
  listEl.querySelectorAll('.row-checkbox').forEach(cb=>{
    cb.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const id = parseInt(cb.dataset.id);
      if (cb.checked) state.selected.add(id); else state.selected.delete(id);
      renderList();
    });
  });
  listEl.querySelectorAll('.row-star').forEach(star=>{
    star.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const id = parseInt(star.dataset.id);
      const email = state.emails.find(e=>e.id===id);
      email.starred = !email.starred;
      renderList();
    });
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openEmail(id){
  const email = state.emails.find(e=>e.id===id);
  if (!email) return;
  if(email.isDraft){ openCompose({to:email.to||'',subject:email.subject==='(no subject)'?'':email.subject,body:email.body||'',draftId:email.id}); return; }
  email.read = true;
  state.openEmailId = id;

  document.getElementById('emailList').style.display = 'none';
  document.getElementById('tabs').style.display = 'none';
  document.getElementById('listToolbar').style.display = 'none';
  const detail = document.getElementById('emailDetail');
  detail.hidden = false;
  document.getElementById('detailRestore').hidden = state.filter !== 'trash' && state.filter !== 'spam';

  document.getElementById('detailBody').innerHTML = `
    <h1 class="detail-subject">${escapeHtml(email.subject)}</h1>
    <div class="detail-meta">
      <div class="detail-avatar" style="background:${avatarColor(email.from)}">${initials(email.from)}</div>
      <div class="detail-meta-text">
        <div class="detail-from-name">${escapeHtml(email.from)} <span class="detail-from-email">&lt;${email.fromEmail}&gt;</span></div>
        <div class="detail-to-row">
          <span class="detail-to">to ${escapeHtml(email.to || 'me')}</span>
          <button class="detail-caret" id="detailCaret" title="Show details">
            <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div class="detail-date">${relativeDate(email.date)}</div>
    </div>
    <div class="detail-popup" id="detailPopup" hidden>${buildDetailsPopup(email)}</div>
    <div class="detail-content">${escapeHtml(email.body)}</div>
    <div class="detail-reply-bar">
      <button class="reply-btn" id="replyBtn">↩ Reply</button>
      <button class="reply-btn" id="forwardBtn">➜ Forward</button>
    </div>
  `;

  const caretBtn = document.getElementById('detailCaret');
  const popup = document.getElementById('detailPopup');
  caretBtn.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    popup.hidden = !popup.hidden;
  });
  popup.querySelectorAll('.filter-list-link').forEach(a=>{
    a.addEventListener('click', (ev)=>{
      ev.preventDefault();
      const label = a.dataset.label;
      popup.hidden = true;
      state.filter = 'label:' + label;
      state.page = 0;
      closeDetail();
      document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
      const target = document.querySelector(`.nav-item[data-filter="label:${label}"]`);
      if (target) target.classList.add('active');
      render();
      showToast(`Filtered by ${label} mailing list`);
    });
  });

  const starBtn = document.getElementById('detailStar');
  starBtn.querySelector('svg path').setAttribute('fill', email.starred ? 'currentColor' : 'none');
  starBtn.onclick = ()=>{
    email.starred = !email.starred;
    starBtn.querySelector('svg path').setAttribute('fill', email.starred ? 'currentColor' : 'none');
    renderSidebarCounts();
  };

  document.getElementById('replyBtn').onclick = ()=>{
    openCompose({to: email.fromEmail, subject: `Re: ${email.subject}`, body: `\n\nOn ${relativeDate(email.date)}, ${email.from} wrote:\n> ${email.body}`});
  };
  document.getElementById('forwardBtn').onclick = ()=>{
    openCompose({to: '', subject: `Fwd: ${email.subject}`, body: `\n\n---------- Forwarded message ----------\nFrom: ${email.from} <${email.fromEmail}>\n\n${email.body}`});
  };

  renderSidebarCounts();
  renderList();
}

function closeDetail(){
  state.openEmailId = null;
  document.getElementById('emailDetail').hidden = true;
  document.getElementById('emailList').style.display = '';
  document.getElementById('listToolbar').style.display = '';
  renderTabs();
}

// -------------------- compose --------------------
function openCompose({to='', subject='', body='', draftId=null} = {}){
  closeCompose.draftId=draftId; closeCompose.skipDraft=false;
  const win = document.getElementById('composeWindow');
  win.hidden = false;
  win.classList.remove('minimized');
  document.getElementById('composeTo').value = to;
  document.getElementById('composeSubject').value = subject;
  document.getElementById('composeBody').value = body;
  document.getElementById('composeBody').focus();
}
function closeCompose(){
  const win = document.getElementById('composeWindow');
  const to=document.getElementById('composeTo').value.trim();
  const subject=document.getElementById('composeSubject').value.trim();
  const body=document.getElementById('composeBody').value.trim();
  if(!closeCompose.skipDraft && (to || subject || body)){
    const draft={id:closeCompose.draftId||('draft-'+Date.now()),from:ACCOUNT.name,fromEmail:ACCOUNT.email,to,subject:subject||'(no subject)',preview:body.slice(0,120),body,date:new Date().toISOString(),label:'Primary',tab:'sent',folder:'drafts',isDraft:true,read:true,starred:false,important:false,archived:false,deleted:false};
    const existing=state.emails.find(e=>e.isDraft && e.id===draft.id);
    if(existing) Object.assign(existing,draft); else state.emails.unshift(draft);
    closeCompose.draftId=draft.id;
    showToast('Draft saved');
  }
  closeCompose.skipDraft=false;
  win.hidden = true;
  win.classList.remove('minimized');
  render();
}
function toggleMinimizeCompose(){
  document.getElementById('composeWindow').classList.toggle('minimized');
}

// -------------------- account switcher --------------------
function renderAccountPopup(){
  const displayName = ACCOUNT.name.trim();
  document.getElementById('accountEmailText').textContent = ACCOUNT.email;
  document.getElementById('accountFirstName').textContent = displayName;
  const photo = document.getElementById('accountPhoto');
  photo.textContent = initials(ACCOUNT.name);
  photo.style.background = ACCOUNT.avatarColor;

  document.getElementById('otherAccountsList').innerHTML = ACCOUNT.otherAccounts.map(acc => `
    <div class="account-row" data-email="${acc.email}">
      <div class="account-row-avatar" style="background:${acc.avatarColor}">${initials(acc.name)}</div>
      <div class="account-row-text">
        <div class="account-row-name">${escapeHtml(acc.name)}</div>
        <a class="account-row-email" href="https://accounts.google.com/" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;color:inherit;position:relative;z-index:2">${escapeHtml(acc.email)}</a>
      </div>
    </div>
  `).join('');

  document.getElementById('storageInfo').innerHTML =
    `☁️ ${ACCOUNT.storagePercent}% of ${ACCOUNT.storageTotal} used`;

  document.querySelectorAll('#otherAccountsList .account-row').forEach(row=>{
    row.addEventListener('click', (event)=>{
      // Clicking the email address must follow its Google Accounts link,
      // not trigger the surrounding account-row selection handler.
      if (event.target.closest('a.account-row-email')) return;
      showToast(`Switched to ${row.dataset.email}`);
      closeAccountPopup();
    });
  });
}

function openAccountPopup(){
  document.getElementById('accountPopup').hidden = false;
}
function closeAccountPopup(){
  document.getElementById('accountPopup').hidden = true;
}

// -------------------- bulk actions --------------------
function applyToSelected(fn){
  if (state.selected.size === 0) { showToast('Select a conversation first'); return; }
  state.emails.forEach(e=>{ if (state.selected.has(e.id)) fn(e); });
  state.selected.clear();
  renderList();
  renderSidebarCounts();
}

// -------------------- event wiring --------------------
function initEvents(){
  // nav items (inbox/starred/sent/important)
  document.querySelectorAll('#navList .nav-item[data-filter], #extraNav .nav-item[data-filter]').forEach(item=>{
    item.addEventListener('click', ()=>{
      state.filter = item.dataset.filter;
      if (state.filter === 'subscriptions') { showToast('Subscription management is not connected to a mail provider'); return; }
      if (state.filter === 'manage-labels') { showToast('Use the Labels section to create and apply labels'); return; }
      if (["Social","Updates","Forums","Promotions"].includes(state.filter)) state.tab = state.filter;
      state.page = 0;
      state.selected.clear();
      closeDetail();
      setActiveNav(item);
      render();
    });
  });

  // tabs
  document.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      state.tab = tab.dataset.tab;
      state.page = 0;
      render();
    });
  });

  // search
  const searchInput = document.getElementById('searchInput');
  let searchTimer;
  searchInput.addEventListener('input', ()=>{
    clearTimeout(searchTimer);
    searchTimer = setTimeout(()=>{
      state.search = searchInput.value;
      state.page = 0;
      closeDetail();
      render();
    }, 150);
  });

  // menu toggle (collapse sidebar)
  document.getElementById('sidebarMore').addEventListener('click', ()=>{
    const nav=document.getElementById('extraNav'); nav.classList.toggle('expanded');
    document.getElementById('sidebarMore').textContent=nav.classList.contains('expanded')?'Less':'More';
  });
  document.getElementById('menuToggle').addEventListener('click', ()=>{
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // refresh
  document.getElementById('refreshBtn').addEventListener('click', ()=>{
    showToast('Inbox refreshed');
    render();
  });

  // compose
  document.getElementById('composeBtn').addEventListener('click', ()=>openCompose());
  document.getElementById('closeCompose').addEventListener('click', closeCompose);
  document.getElementById('minimizeCompose').addEventListener('click', (ev)=>{
    ev.stopPropagation();
    toggleMinimizeCompose();
  });
  document.querySelector('.compose-header').addEventListener('click', ()=>{
    const win = document.getElementById('composeWindow');
    if (win.classList.contains('minimized')) win.classList.remove('minimized');
  });
  document.getElementById('discardCompose').addEventListener('click', ()=>{
    closeCompose.skipDraft=true; if(closeCompose.draftId) state.emails=state.emails.filter(e=>e.id!==closeCompose.draftId); closeCompose.draftId=null;
    closeCompose();
    showToast('Draft discarded');
  });
  document.getElementById('sendBtn').addEventListener('click', ()=>{
    const to = document.getElementById('composeTo').value.trim();
    const subject = document.getElementById('composeSubject').value.trim();
    const body = document.getElementById('composeBody').value.trim();
    if (!to) { showToast('Add a recipient first'); return; }
    const now = new Date().toISOString();
    if(closeCompose.draftId) state.emails=state.emails.filter(e=>e.id!==closeCompose.draftId);
    closeCompose.skipDraft=true; closeCompose.draftId=null;
    const message = {
      id: 'sent-' + Date.now(), from: ACCOUNT.name, fromEmail: ACCOUNT.email, to,
      subject: subject || '(no subject)', preview: body.slice(0,120), body, date: now,
      label: 'Primary', tab: 'sent', folder: 'sent', sentByMe: true, read: true,
      starred: false, important: false, archived: false, deleted: false
    };
    state.emails.unshift(message);
    state.filter = 'sent'; state.page = 0; state.selected.clear();
    closeCompose(); render();
    document.querySelectorAll('#navList .nav-item').forEach(i=>i.classList.toggle('active',i.dataset.filter==='sent'));
    showToast('Message added to Sent');
  });

  // account switcher
  document.getElementById('avatarBtn').addEventListener('click', (ev)=>{
    ev.stopPropagation();
    const popup = document.getElementById('accountPopup');
    popup.hidden ? openAccountPopup() : closeAccountPopup();
  });
  document.getElementById('closeAccountPopup').addEventListener('click', closeAccountPopup);
  document.getElementById('addAccountBtn').addEventListener('click', ()=>{
    closeAccountPopup();
    showToast('Account addition is not available here');
  });
  document.getElementById('signOutAllBtn').addEventListener('click', ()=>{
    closeAccountPopup();
    showToast('Account sign-out is not connected');
  });

  // Create custom labels
  const createLabel = ()=>{ const name=prompt('Enter a label name'); if(!name || !name.trim()) return; const clean=name.trim(); if(!state.customLabels) state.customLabels=[]; if(!state.customLabels.includes(clean)) state.customLabels.push(clean); renderLabels(); showToast('Label created'); };
  document.getElementById('createLabelBtn').addEventListener('click', createLabel);
  document.getElementById('createLabelPlus').addEventListener('click', createLabel);

  // back button from detail view
  document.getElementById('backBtn').addEventListener('click', closeDetail);

  // close the "show details" popup when clicking outside it
  document.addEventListener('click', (ev)=>{
    const popup = document.getElementById('detailPopup');
    const caret = document.getElementById('detailCaret');
    if (popup && !popup.hidden) {
      if (!popup.contains(ev.target) && ev.target !== caret && !(caret && caret.contains(ev.target))) {
        popup.hidden = true;
      }
    }
    const accountPopup = document.getElementById('accountPopup');
    const avatarBtn = document.getElementById('avatarBtn');
    if (accountPopup && !accountPopup.hidden) {
      if (!accountPopup.contains(ev.target) && ev.target !== avatarBtn && !avatarBtn.contains(ev.target)) {
        accountPopup.hidden = true;
      }
    }
  });
  document.addEventListener('keydown', (ev)=>{
    if (ev.key === 'Escape'){
      const popup = document.getElementById('detailPopup');
      if (popup && !popup.hidden) popup.hidden = true;
      const accountPopup = document.getElementById('accountPopup');
      if (accountPopup && !accountPopup.hidden) accountPopup.hidden = true;
    }
  });

  // detail archive/delete
  document.getElementById('detailSpam').addEventListener('click', ()=>{const e=state.emails.find(x=>x.id===state.openEmailId);if(e)e.spam=true;closeDetail();render();showToast('Moved to Spam');});
  document.getElementById('detailRestore').addEventListener('click', ()=>{const e=state.emails.find(x=>x.id===state.openEmailId);if(e){e.deleted=false;e.spam=false;e.archived=false;}closeDetail();render();showToast('Conversation restored');});
  document.getElementById('detailArchive').addEventListener('click', ()=>{
    const e = state.emails.find(e=>e.id===state.openEmailId);
    if (e) e.archived = true;
    closeDetail();
    render();
    showToast('Conversation archived');
  });
  document.getElementById('detailDelete').addEventListener('click', ()=>{
    const e = state.emails.find(e=>e.id===state.openEmailId);
    if (e) { if (state.filter === 'trash') { state.emails = state.emails.filter(x=>x.id!==e.id); } else e.deleted = true; }
    closeDetail();
    render();
    showToast(state.filter === 'trash' ? 'Conversation permanently deleted' : 'Moved to Trash');
  });

  // select all
  document.getElementById('selectAllCheckbox').addEventListener('change', (ev)=>{
    const all = getFilteredEmails();
    const start = state.page*PAGE_SIZE;
    const pageItems = all.slice(start, start+PAGE_SIZE);
    if (ev.target.checked) pageItems.forEach(e=>state.selected.add(e.id));
    else pageItems.forEach(e=>state.selected.delete(e.id));
    renderList();
  });

  // bulk toolbar actions
  document.getElementById('archiveSelected').addEventListener('click', ()=>{
    applyToSelected(e=>e.archived=true);
    showToast('Archived');
    render();
  });
  document.getElementById('deleteSelected').addEventListener('click', ()=>{
    if(state.filter==='trash') { const ids=state.selected; state.emails=state.emails.filter(e=>!ids.has(e.id)); state.selected.clear(); render(); showToast('Permanently deleted'); }
    else { applyToSelected(e=>e.deleted=true); showToast('Moved to Trash'); render(); }
  });
  document.getElementById('markReadSelected').addEventListener('click', ()=>{
    if(!state.selected.size){showToast('Select a conversation first');return;}
    const selected=state.emails.filter(e=>state.selected.has(e.id));
    const markAsRead=!selected.every(e=>e.read);
    applyToSelected(e=>e.read=markAsRead);
    showToast(markAsRead?'Marked as read':'Marked as unread');
    render();
  });
  document.getElementById('tasksSelected').addEventListener('click', ()=>{
    applyToSelected(e=>{e.taskAdded=true;}); showToast('Added to tasks'); render();
  });
  document.getElementById('spamSelected').addEventListener('click', ()=>{ applyToSelected(e=>{e.spam=true;e.archived=false;}); showToast('Moved to Spam'); render(); });
  document.getElementById('snoozeSelected').addEventListener('click', ()=>{
    const choice = prompt('Snooze until (YYYY-MM-DD HH:MM)', new Date(Date.now()+86400000).toISOString().slice(0,16).replace('T',' '));
    if(!choice) return; const when = new Date(choice.replace(' ','T'));
    if(isNaN(when)) { showToast('Enter a valid date and time'); return; }
    applyToSelected(e=>{e.snoozedUntil=when.toISOString();}); showToast('Conversation snoozed'); render();
  });
  document.getElementById('moveSelected').addEventListener('click', ()=>{
    const target = prompt('Move selected messages to: Inbox, Archive, Spam or Trash', 'Archive'); if(!target) return;
    const v=target.toLowerCase();
    if(!['inbox','archive','spam','trash'].includes(v)){showToast('Choose Inbox, Archive, Spam or Trash');return;}
    applyToSelected(e=>{e.archived=v==='archive';e.spam=v==='spam';e.deleted=v==='trash';if(v==='inbox'){e.archived=false;e.deleted=false;e.spam=false;}}); showToast('Messages moved'); render();
  });
  document.getElementById('labelSelected').addEventListener('click', ()=>{
    const label=prompt('Apply label name'); if(!label) return;
    applyToSelected(e=>{e.customLabels=Array.from(new Set([...(e.customLabels||[]),label]));}); showToast('Label applied'); render();
  });
  document.getElementById('moreSelected').addEventListener('click', ()=>{
    const action=prompt('More actions: Mark unread, Mark important, Remove importance, Restore'); if(!action) return;
    const a=action.toLowerCase();
    if(a==='mark unread') applyToSelected(e=>e.read=false);
    else if(a==='mark important') applyToSelected(e=>e.important=true);
    else if(a==='remove importance') applyToSelected(e=>e.important=false);
    else if(a==='restore') applyToSelected(e=>{e.deleted=false;e.spam=false;e.archived=false;});
    else {showToast('Action not recognised');return;}
    showToast('Action completed'); render();
  });

  // pagination
  document.getElementById('nextPage').addEventListener('click', ()=>{
    const maxPage = Math.ceil(getFilteredEmails().length / PAGE_SIZE) - 1;
    if (state.page < maxPage) { state.page++; renderList(); }
  });
  document.getElementById('prevPage').addEventListener('click', ()=>{
    if (state.page > 0) { state.page--; renderList(); }
  });
}

function persistState(){
  try { localStorage.setItem('gmail-local-state-v1', JSON.stringify({emails:state.emails, customLabels:state.customLabels||[]})); }
  catch(error){ console.warn('Local changes could not be saved in this browser.', error); }
}
function restoreState(){
  try {
    const saved=JSON.parse(localStorage.getItem('gmail-local-state-v1')||'null');
    if(saved && Array.isArray(saved.emails)){
      const byId=new Map(saved.emails.map(e=>[String(e.id),e]));
      state.emails=state.emails.map(base=>byId.get(String(base.id))||base);
      saved.emails.filter(e=>!state.emails.some(base=>String(base.id)===String(e.id))).forEach(e=>state.emails.push(e));
      state.customLabels=saved.customLabels||[];
    }
  } catch(error){ console.warn('Saved browser state could not be restored.', error); }
}
function render(){
  renderTabs();
  renderList();
  renderSidebarCounts();
  persistState();
}


// Theme preference
function applyTheme(mode){
  document.body.classList.toggle('dark-theme', mode === 'dark');
  const btn = document.getElementById('themeToggle');
  if (btn) { btn.textContent = mode === 'dark' ? '☀' : '◐'; btn.title = mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'; }
}

async function loadSheetEmails(){
  const endpoint = window.SHEETS_API_URL;
  if (!endpoint) return;
  try {
    const response = await fetch(endpoint, {cache:'no-store'});
    if (!response.ok) throw new Error('Unable to load messages');
    const records = await response.json();
    if (!Array.isArray(records)) return;
    const mapped = records.map((r, index) => ({
      id: r.id || ('sheet-' + index), from: r.from || '', fromEmail: r.fromEmail || '',
      to: r.to || ACCOUNT.email, subject: r.subject || '', preview: r.preview || (r.body || '').slice(0,120),
      body: r.body || '', date: r.date || new Date().toISOString(), label: r.label || 'Primary',
      tab: r.folder === 'sent' ? 'sent' : (r.tab || r.label || 'Primary'), folder: r.folder || 'inbox',
      sentByMe: r.folder === 'sent', read: String(r.read).toLowerCase() === 'true',
      starred: String(r.starred).toLowerCase() === 'true', important: String(r.important).toLowerCase() === 'true',
      archived: String(r.archived).toLowerCase() === 'true', deleted: String(r.deleted).toLowerCase() === 'true'
    }));
    const existing = new Set(state.emails.map(e=>String(e.id)));
    mapped.forEach(e=>{ if (!existing.has(String(e.id))) state.emails.push(e); });
    renderLabels(); render();
  } catch (error) { console.error('Email data could not be refreshed.', error); }
}

// -------------------- init --------------------
document.addEventListener('DOMContentLoaded', ()=>{
  restoreState();
  const theme = localStorage.getItem('gmail-theme') || 'light';
  applyTheme(theme);
  document.getElementById('themeToggle').addEventListener('click', ()=>{
    const next = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
    localStorage.setItem('gmail-theme', next); applyTheme(next);
  });
  renderAccountPopup();
  renderLabels();
  initEvents();
  render();
  loadSheetEmails();
});
