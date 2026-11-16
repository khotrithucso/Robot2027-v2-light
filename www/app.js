// Robot 2027 - V2.1 Complete Smart Companion Engine
// Supports: Online/Offline auto-detection, Mode 1 (Direct API) & Mode 2 (API + Local LLM),
// 18 Diverse Personas, Proactive Name Asking ("What's your name?"), Local Family Memory & Sync Queue.

let isModelReady = false;
let activeModelName = '';
let isGenerating = false;
let awaitingUserName = false;

// Family Memory Structure stored in localStorage
let familyState = {
  activeMemberId: null, // null = unknown speaker (Robot will proactively ask "What's your name?")
  members: []           // [{ id, name, age, gender, familyRole, preferredPersona, chatCount, lastSeen, notes }]
};

const statusEl = document.getElementById('modelStatus');
const metricEl = document.getElementById('speedMetric');
const netBadgeEl = document.getElementById('netBadge');
const faceStage = document.getElementById('faceStage');
const stateLabel = document.getElementById('stateLabel');
const speakerBadge = document.getElementById('speakerBadge');
const chatArea = document.getElementById('chatArea');

function getNativeLLM() {
  return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalLLM;
}

// =========================================================================
// 1. UI & DRAWER HELPERS
// =========================================================================
function toggleDrawer(id) {
  const el = document.getElementById(id);
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('.drawer').forEach(d => d.classList.remove('open'));
  if (!isOpen) el.classList.add('open');
}

function setFaceState(state) {
  faceStage.className = 'face-stage gpu-layer ' + (state || 'idle').toLowerCase();
  stateLabel.textContent = 'STATE: ' + (state || 'IDLE').toUpperCase();
}

function addBubble(text, type = 'bot', meta = '') {
  const div = document.createElement('div');
  div.className = 'bubble ' + type;
  div.innerHTML = text + (meta ? `<div class="meta">${meta}</div>` : '');
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function updateNetworkBadge() {
  const online = navigator.onLine;
  if (online) {
    netBadgeEl.className = 'pill ready';
    netBadgeEl.textContent = '🟢 Online';
  } else {
    netBadgeEl.className = 'pill err';
    netBadgeEl.textContent = '🔴 Offline';
  }
  return online;
}

window.addEventListener('online', () => {
  updateNetworkBadge();
  addBubble('🌐 Đã có kết nối mạng trở lại! Sẵn sàng gọi Server API.', 'sys');
});
window.addEventListener('offline', () => {
  updateNetworkBadge();
  if (isModelReady) {
    addBubble('📡 Mất kết nối mạng! Tự động chuyển sang dùng Bộ não AI cục bộ trên máy.', 'sys');
  } else {
    addBubble('⚠️ Mất kết nối mạng và máy chưa tải Bộ não AI cục bộ. Hãy kết nối mạng để tải Model AI!', 'sys');
  }
});

// =========================================================================
// 2. 18 PERSONAS INITIALIZATION & AUTO-SWITCHING
// =========================================================================
function initPersonasDropdown() {
  const sel = document.getElementById('personaSelect');
  sel.innerHTML = '';
  ROBOT_PERSONAS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.icon} ${p.label}`;
    sel.appendChild(opt);
  });
}

function getActivePersonaObj() {
  const id = document.getElementById('personaSelect').value;
  return ROBOT_PERSONAS.find(p => p.id === id) || ROBOT_PERSONAS[0];
}

function onPersonaManualChange() {
  const p = getActivePersonaObj();
  const member = getActiveMember();
  if (member) {
    member.preferredPersona = p.id;
    saveFamilyMemory();
  }
  addBubble(`Đã đổi vai trò Robot sang: <b>${p.icon} ${p.label}</b>`, 'sys');
}

function detectPersonaSwitchFromText(text) {
  const lower = text.toLowerCase();
  // Only trigger if user explicitly asks to switch/act/be a role
  const intentTriggers = ['be my', 'act like', 'pretend to be', 'switch to', 'become a', 'you are a', 'teach me', 'tell me a story'];
  const hasTrigger = intentTriggers.some(t => lower.includes(t));
  if (!hasTrigger) return null;

  for (const p of ROBOT_PERSONAS) {
    if (p.keywords.some(kw => lower.includes(kw))) {
      document.getElementById('personaSelect').value = p.id;
      const member = getActiveMember();
      if (member) {
        member.preferredPersona = p.id;
        saveFamilyMemory();
      }
      return p;
    }
  }
  return null;
}

// =========================================================================
// 3. FAMILY MEMORY & PROACTIVE USER RECOGNITION ("What's your name?")
// =========================================================================
function loadFamilyMemory() {
  try {
    const raw = localStorage.getItem('robot2027_family_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.members)) {
        familyState = parsed;
      }
    }
  } catch (e) {
    console.warn('loadFamilyMemory error:', e);
  }
  renderFamilyUI();
}

function saveFamilyMemory() {
  localStorage.setItem('robot2027_family_v2', JSON.stringify(familyState));
  renderFamilyUI();
}

function getActiveMember() {
  if (!familyState.activeMemberId) return null;
  return familyState.members.find(m => m.id === familyState.activeMemberId) || null;
}

function renderFamilyUI() {
  const speakerSel = document.getElementById('speakerSelect');
  speakerSel.innerHTML = '';

  const unknownOpt = document.createElement('option');
  unknownOpt.value = '';
  unknownOpt.textContent = '❓ Người mới (Tự nhận diện)';
  speakerSel.appendChild(unknownOpt);

  familyState.members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `👤 ${m.name} (${m.age || '?'}t)`;
    speakerSel.appendChild(opt);
  });

  speakerSel.value = familyState.activeMemberId || '';

  const active = getActiveMember();
  if (active) {
    speakerBadge.textContent = `👤 ${active.name} (${active.age || '?'}t)`;
    if (active.preferredPersona) {
      document.getElementById('personaSelect').value = active.preferredPersona;
    }
  } else {
    speakerBadge.textContent = '👤 Chưa rõ tên';
  }

  // Render list inside Family Drawer
  const listEl = document.getElementById('familyList');
  if (familyState.members.length === 0) {
    listEl.innerHTML = '<div style="color:#94a3b8;font-size:11px;">Chưa lưu thành viên nào. Hãy trò chuyện để Bot tự hỏi tên và ghi nhớ từng người trong gia đình!</div>';
    return;
  }

  listEl.innerHTML = '';
  familyState.members.forEach(m => {
    const isAct = m.id === familyState.activeMemberId;
    const pObj = ROBOT_PERSONAS.find(p => p.id === m.preferredPersona) || ROBOT_PERSONAS[0];
    const card = document.createElement('div');
    card.className = 'member-card' + (isAct ? ' active' : '');
    card.innerHTML = `
      <div class="member-info" onclick="switchActiveMember('${m.id}')" style="cursor:pointer;flex:1;">
        <b>${m.name}</b> • ${m.age || '?'} tuổi • ${m.familyRole || 'Thành viên'}
        <div class="member-sub">Vai trò thích: ${pObj.icon} ${pObj.id} • Đã nói: ${m.chatCount || 0} lượt</div>
      </div>
      <div style="display:flex;gap:4px;">
        <button class="btn-sm ${isAct ? 'green' : 'gray'}" onclick="switchActiveMember('${m.id}')">${isAct ? 'Đang nói' : 'Chọn'}</button>
        <button class="btn-sm red" onclick="deleteMember('${m.id}')">✕</button>
      </div>
    `;
    listEl.appendChild(card);
  });
}

function onSpeakerSelectChange() {
  const val = document.getElementById('speakerSelect').value;
  if (!val) {
    startNewPersonGreeting();
  } else {
    switchActiveMember(val);
  }
}

function switchActiveMember(memberId) {
  familyState.activeMemberId = memberId;
  awaitingUserName = false;
  saveFamilyMemory();
  const m = getActiveMember();
  if (m) {
    const greet = `Welcome back, ${m.name}! What would you like to talk about today?`;
    addBubble(greet, 'bot', `Đã nhận diện thành viên: ${m.name} (${m.age || '?'} tuổi)`);
    speakEnglish(greet, 'happy_jump');
  }
}

function startNewPersonGreeting() {
  familyState.activeMemberId = null;
  awaitingUserName = true;
  saveFamilyMemory();
  const promptAsk = "Hello! I am Robot 2027. What is your name?";
  addBubble(promptAsk, 'bot', '🤖 Bot chủ động chào & hỏi danh tính');
  speakEnglish(promptAsk, 'curious_tilt');
}

function manualAddMember() {
  const name = document.getElementById('newMemberName').value.trim();
  const age = parseInt(document.getElementById('newMemberAge').value || '6', 10);
  if (!name) return;

  upsertFamilyMember(name, age, 'Thành viên');
  document.getElementById('newMemberName').value = '';
  document.getElementById('newMemberAge').value = '';
  toggleDrawer('familyDrawer');
}

function deleteMember(id) {
  familyState.members = familyState.members.filter(m => m.id !== id);
  if (familyState.activeMemberId === id) {
    familyState.activeMemberId = familyState.members[0]?.id || null;
  }
  saveFamilyMemory();
}

function upsertFamilyMember(name, age = null, familyRole = null) {
  const cleanName = name.charAt(0).toUpperCase() + name.slice(1);
  let existing = familyState.members.find(m => m.name.toLowerCase() === cleanName.toLowerCase());

  if (existing) {
    if (age) existing.age = age;
    if (familyRole) existing.familyRole = familyRole;
    existing.lastSeen = new Date().toISOString();
    familyState.activeMemberId = existing.id;
    saveFamilyMemory();
    return { member: existing, isNew: false };
  }

  // Infer family role & default age if obvious
  let inferredRole = familyRole || 'Child';
  let inferredAge = age || 6;
  const lower = cleanName.toLowerCase();
  if (['dad', 'father', 'bố', 'ba'].includes(lower)) {
    inferredRole = 'Parent (Dad)';
    inferredAge = age || 35;
  } else if (['mom', 'mother', 'mẹ', 'má'].includes(lower)) {
    inferredRole = 'Parent (Mom)';
    inferredAge = age || 33;
  } else if (['grandma', 'grandpa', 'ông', 'bà'].includes(lower)) {
    inferredRole = 'Grandparent';
    inferredAge = age || 65;
  }

  const newMember = {
    id: 'mem_' + Date.now(),
    name: cleanName,
    age: inferredAge,
    familyRole: inferredRole,
    preferredPersona: document.getElementById('personaSelect').value || 'ENGLISH_TEACHER',
    chatCount: 1,
    lastSeen: new Date().toISOString()
  };

  familyState.members.push(newMember);
  familyState.activeMemberId = newMember.id;
  saveFamilyMemory();
  return { member: newMember, isNew: true };
}

// Extracts user name & age from natural English sentences
function extractIdentityFromSpeech(text) {
  const clean = text.trim();
  let detectedName = null;
  let detectedAge = null;

  // Extract age (e.g., "I am 6", "6 years old", "age 8")
  const ageMatch = clean.match(/(?:i am|i'm|age|is)\s+(\d{1,2})/i) || clean.match(/(\d{1,2})\s+years?\s+old/i);
  if (ageMatch) {
    detectedAge = parseInt(ageMatch[1], 10);
  }

  // Extract name patterns
  const namePatterns = [
    /(?:my name is|my name's|call me|this is|it is|it's)\s+([a-zA-ZÀ-ỹ]{2,15})/i,
    /(?:i am|i'm)\s+([a-zA-ZÀ-ỹ]{2,15})/i
  ];

  const ignoredWords = new Set([
    'a', 'an', 'the', 'good', 'fine', 'happy', 'sad', 'tired', 'hungry', 'ready',
    'here', 'back', 'sorry', 'playing', 'studying', 'learning', 'six', 'seven', 'eight', 'five', 'old'
  ]);

  for (const pat of namePatterns) {
    const m = clean.match(pat);
    if (m && m[1] && !ignoredWords.has(m[1].toLowerCase())) {
      detectedName = m[1];
      break;
    }
  }

  // If bot just asked "What is your name?" and user answered with a short 1-2 word name (e.g. "Bi" or "Minh")
  if (!detectedName && awaitingUserName) {
    const words = clean.replace(/[^a-zA-ZÀ-ỹ\s]/g, '').trim().split(/\s+/);
    if (words.length >= 1 && words.length <= 2 && !ignoredWords.has(words[0].toLowerCase())) {
      detectedName = words[words.length - 1];
    }
  }

  if (detectedName) {
    awaitingUserName = false;
    return upsertFamilyMember(detectedName, detectedAge);
  }
  return null;
}

function exportFamilySyncJson() {
  const pre = document.getElementById('syncJsonPreview');
  if (pre.style.display === 'block') {
    pre.style.display = 'none';
    return;
  }
  const syncPayload = {
    bot_id: 'BOT_VN_001',
    synced_at: new Date().toISOString(),
    family_members: familyState.members
  };
  pre.textContent = JSON.stringify(syncPayload, null, 2);
  pre.style.display = 'block';
}

// =========================================================================
// 4. FIRST-LAUNCH SETUP MODAL & ON-DEMAND MODEL DOWNLOADER
// =========================================================================
function dismissSetupModal() {
  localStorage.setItem('robot2027_dismissed_modal', '1');
  document.getElementById('setupModal').classList.remove('show');
}

function acceptDownloadFromModal() {
  document.getElementById('setupModal').classList.remove('show');
  toggleDrawer('modelDrawer');
  startDownloadModel();
}

function onPresetChange() {
  const val = document.getElementById('modelPresetSelect').value;
  const parts = val.split('|');
  if (parts[1]) {
    document.getElementById('modelUrlInput').value = parts[1];
  }
}

async function initAppStartup() {
  updateNetworkBadge();
  initPersonasDropdown();
  loadFamilyMemory();

  const savedUrl = localStorage.getItem('robot_backend_url');
  if (savedUrl) document.getElementById('backendUrlInput').value = savedUrl;
  const savedTier = localStorage.getItem('robot_tier');
  if (savedTier) document.getElementById('tierSelect').value = savedTier;

  const LocalLLM = getNativeLLM();
  if (LocalLLM) {
    LocalLLM.addListener('downloadProgress', (info) => {
      const wrap = document.getElementById('progressWrap');
      const bar = document.getElementById('progressBar');
      const txt = document.getElementById('downloadText');
      wrap.style.display = 'block';
      bar.style.width = (info.percent || 0) + '%';
      txt.textContent = `Đang tải từ Internet: ${info.downloadedMB} MB / ${info.totalMB} MB (${info.percent}%)`;
    });

    try {
      const check = await LocalLLM.checkModels();
      if (check.models && check.models.length > 0) {
        const preferred = localStorage.getItem('robot_active_model');
        const found = check.models.find(m => m.name === preferred) || check.models[0];
        await loadLocalModelFile(found.name, true);
      } else {
        statusEl.className = 'pill warn';
        statusEl.textContent = '📦 Chưa tải AI';
        // Show first-launch prompt asking user to download AI brain
        if (!localStorage.getItem('robot2027_dismissed_modal')) {
          document.getElementById('setupModal').classList.add('show');
        }
      }
    } catch (e) {
      console.warn('checkModels err:', e);
    }
  } else {
    statusEl.className = 'pill warn';
    statusEl.textContent = '🌐 Web Mode';
  }

  // Proactive greeting based on whether we know the user yet
  const active = getActiveMember();
  if (active) {
    const welcome = `Hello ${active.name}! I am Robot 2027. Ready to chat in English?`;
    addBubble(welcome, 'bot', `Đã nhận diện: ${active.name} (${active.age} tuổi)`);
  } else {
    awaitingUserName = true;
    const askName = "Hello! I am Robot 2027. What is your name?";
    addBubble(askName, 'bot', '🤖 Bot chủ động chào & hỏi tên người dùng mới');
  }
}

async function startDownloadModel() {
  const LocalLLM = getNativeLLM();
  if (!LocalLLM) {
    alert('Tính năng tải Model C++ chỉ chạy khi cài file APK trên điện thoại Android!');
    return;
  }

  const url = document.getElementById('modelUrlInput').value.trim();
  if (!url) return;

  let fileName = url.split('/').pop().split('?')[0];
  if (!fileName.endsWith('.gguf')) fileName = 'brain_local.gguf';

  const btn = document.getElementById('btnDownloadModel');
  btn.disabled = true;
  btn.textContent = '⏳ Đang tải...';
  statusEl.className = 'pill warn';
  statusEl.textContent = '⬇️ Đang tải AI...';

  try {
    const res = await LocalLLM.downloadModel({ url, fileName });
    document.getElementById('downloadText').textContent = `Tải xong ${res.fileName} (${res.sizeMB} MB)! Đang nạp vào RAM...`;
    await loadLocalModelFile(res.fileName, false);
    toggleDrawer('modelDrawer');
  } catch (err) {
    statusEl.className = 'pill err';
    statusEl.textContent = '❌ Lỗi tải AI';
    document.getElementById('downloadText').textContent = 'Lỗi tải: ' + (err.message || JSON.stringify(err));
  } finally {
    btn.disabled = false;
    btn.textContent = '⬇️ Tải & Kích hoạt Model';
  }
}

async function loadLocalModelFile(fileName, silent = false) {
  const LocalLLM = getNativeLLM();
  statusEl.className = 'pill warn';
  statusEl.textContent = '⏳ Nạp C++...';
  const t0 = performance.now();

  await LocalLLM.loadModel({
    fileName: fileName,
    nCtx: 384,
    nThreads: 4
  });

  const ms = Math.round(performance.now() - t0);
  isModelReady = true;
  activeModelName = fileName;
  localStorage.setItem('robot_active_model', fileName);

  // Default to Mode 2 (API + Local AI) once model is ready
  document.getElementById('modeSelect').value = 'API_PLUS_LLM';

  statusEl.className = 'pill ready';
  statusEl.textContent = '✅ ' + fileName.split('-')[0].toUpperCase();
  metricEl.textContent = `Nạp: ${ms} ms`;
  if (!silent) {
    addBubble(`✅ Đã tải & kích hoạt xong bộ não <b>${fileName}</b> (${ms} ms)! Bot sẵn sàng nói chuyện cả Online lẫn Offline.`, 'sys');
  }
}

// =========================================================================
// 5. SERVER API SETTINGS & CALLER WITH TIMEOUT
// =========================================================================
function saveApiSettings() {
  localStorage.setItem('robot_backend_url', document.getElementById('backendUrlInput').value.trim());
  localStorage.setItem('robot_tier', document.getElementById('tierSelect').value);
  toggleDrawer('apiDrawer');
  addBubble('Đã lưu cấu hình Server API.', 'sys');
}

function setQuickUrl(url) {
  document.getElementById('backendUrlInput').value = url;
  saveApiSettings();
}

async function callBackendApi(userText, member, personaObj) {
  const apiUrl = document.getElementById('backendUrlInput').value.trim();
  const payload = {
    bot_id: 'BOT_VN_001',
    member_name: member ? member.name : 'Friend',
    member_age: member ? (member.age || 6) : 6,
    persona: personaObj.backendRole,
    tier: document.getElementById('tierSelect').value,
    text: userText
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout -> fallback offline

  const t0 = performance.now();
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    const apiMs = Math.round(performance.now() - t0);

    const top = data.candidates && data.candidates[0];
    const fact = top ? (top.fact || '') : '';
    const followUp = top ? (top.follow_up || '') : '';
    const combined = `${fact} ${followUp}`.trim();

    return {
      ok: true,
      apiMs,
      topic: data.topic || 'general',
      anim: data.anim || 'IDLE',
      strict: !!data.strict,
      combined
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// =========================================================================
// 6. MAIN CONVERSATION PIPELINE (ONLINE / OFFLINE + 2 MODES + IDENTITY)
// =========================================================================
function quickAsk(text) {
  document.getElementById('textInput').value = text;
  sendChat();
}

async function sendChat() {
  if (isGenerating) return;
  const inputEl = document.getElementById('textInput');
  const userText = inputEl.value.trim();
  if (!userText) return;

  inputEl.value = '';
  addBubble(userText, 'user');

  // Step 1: Check if user introduced their name/age or requested a new persona
  const identityResult = extractIdentityFromSpeech(userText);
  const switchedPersona = detectPersonaSwitchFromText(userText);

  const member = getActiveMember();
  if (member) {
    member.chatCount = (member.chatCount || 0) + 1;
    member.lastSeen = new Date().toISOString();
    saveFamilyMemory();
  }

  const personaObj = getActivePersonaObj();
  const mode = document.getElementById('modeSelect').value;
  const LocalLLM = getNativeLLM();
  const isOnline = updateNetworkBadge();

  isGenerating = true;
  setFaceState('thinking');

  try {
    // If user just introduced themselves for the first time, greet & remember them immediately
    if (identityResult && identityResult.isNew) {
      const m = identityResult.member;
      const welcomeNew = `Nice to meet you, ${m.name}! I saved you in my family memory. How can I help you today?`;
      addBubble(welcomeNew, 'bot', `🧠 Đã ghi nhớ thành viên mới: ${m.name} (${m.age} tuổi • ${m.familyRole})`);
      await speakEnglish(welcomeNew, 'heart_eyes');
      return;
    }

    if (switchedPersona && userText.split(' ').length <= 6) {
      const roleAck = `Okay${member ? ', ' + member.name : ''}! I am now your ${switchedPersona.label.split('(')[1]?.replace(')', '') || switchedPersona.id}. Let's start!`;
      addBubble(roleAck, 'bot', `🎭 Đã hóa thân: ${switchedPersona.icon} ${switchedPersona.id}`);
      await speakEnglish(roleAck, 'happy_jump');
      return;
    }

    // ---------------------------------------------------------------------
    // BRANCH A: ONLINE MODE (Mode 1: Direct API | Mode 2: API + Local LLM)
    // ---------------------------------------------------------------------
    if (isOnline && mode !== 'OFFLINE_LLM') {
      try {
        const api = await callBackendApi(userText, member, personaObj);

        // MODE 1: Trả lời thẳng từ API
        if (mode === 'API_DIRECT') {
          const reply = api.combined || "Beep boop! Can you say that again?";
          metricEl.textContent = `⚡ API: ${api.apiMs} ms`;
          addBubble(reply, 'bot', `🌐 Chế độ 1 (Thẳng API) • Topic: ${api.topic} • ${api.apiMs} ms`);
          await speakEnglish(reply, api.anim);
          return;
        }

        // MODE 2: API Backend + Model Local xử lý
        if (mode === 'API_PLUS_LLM') {
          if (api.strict && api.combined) {
            metricEl.textContent = `⚡ STRICT: ${api.apiMs} ms`;
            addBubble(api.combined, 'bot', `🔒 STRICT MODE • ${api.apiMs} ms`);
            await speakEnglish(api.combined, api.anim);
            return;
          }

          if (LocalLLM && isModelReady) {
            const speakerInfo = member ? `${member.name} (age ${member.age})` : 'a friendly user';
            const sysPrompt = `You are Robot 2027 acting as ${personaObj.style}, talking to ${speakerInfo}. Rewrite this guidance into 1 short, lively sentence: "${api.combined}"`;
            const chatML = `<|im_start|>system\n${sysPrompt}<|im_end|>\n<|im_start|>user\n${userText}<|im_end|>\n<|im_start|>assistant\n`;

            const tLlm = performance.now();
            const gen = await LocalLLM.generate({ prompt: chatML, maxTokens: 34 });
            const llmMs = Math.round(performance.now() - tLlm);

            let reply = cleanLlmOutput(gen.text) || api.combined;
            metricEl.textContent = `⚡ ${api.apiMs + llmMs} ms`;
            addBubble(reply, 'bot', `🌐+🧠 Chế độ 2 (API ${api.apiMs}ms + AI ${llmMs}ms) • ${personaObj.icon} ${personaObj.id}`);
            await speakEnglish(reply, api.anim);
            return;
          } else {
            // Online but local model not downloaded yet -> fallback cleanly to API output
            const fallbackApi = api.combined || "Please download the local AI brain for smarter replies!";
            metricEl.textContent = `⚡ API: ${api.apiMs} ms`;
            addBubble(fallbackApi, 'bot', `🌐 Chưa tải Model máy -> Dùng thẳng API (${api.apiMs} ms)`);
            await speakEnglish(fallbackApi, api.anim);
            return;
          }
        }
      } catch (networkErr) {
        // Server unreachable or timed out -> gracefully drop into Offline Branch B below!
        addBubble('⚠️ Server không phản hồi, chuyển sang xử lý trực tiếp bằng Bộ não AI trên máy...', 'sys');
      }
    }

    // ---------------------------------------------------------------------
    // BRANCH B: OFFLINE MODE (Check if Local Model exists -> Reply or Alert)
    // ---------------------------------------------------------------------
    if (!LocalLLM || !isModelReady) {
      const warnMsg = '⚠️ Thiết bị đang <b>Offline</b> (hoặc mất kết nối Server) và chưa có <b>Bộ não AI</b> trên máy. Vui lòng bật mạng và bấm nút <b>🧠 Model</b> ở góc trên để tải bộ não AI về cập nhật cho thiết bị!';
      addBubble(warnMsg, 'bot', '❌ Cần tải Model AI để chạy Offline');
      setFaceState('idle');
      return;
    }

    const speakerInfo = member ? `${member.name} (age ${member.age}, ${member.familyRole})` : 'a new friend (ask their name if needed)';
    const sysOffline = `You are Robot 2027 acting as ${personaObj.style}, talking to ${speakerInfo}. Reply in 1 short, natural, friendly English sentence.`;
    const chatML = `<|im_start|>system\n${sysOffline}<|im_end|>\n<|im_start|>user\n${userText}<|im_end|>\n<|im_start|>assistant\n`;

    const t0 = performance.now();
    const gen = await LocalLLM.generate({ prompt: chatML, maxTokens: 34 });
    const llmMs = Math.round(performance.now() - t0);

    let reply = cleanLlmOutput(gen.text) || "Beep boop! Tell me more!";
    metricEl.textContent = `⚡ ${llmMs} ms`;
    addBubble(reply, 'bot', `📡 Offline AI (${activeModelName}) • ${personaObj.icon} ${personaObj.id} • ${llmMs} ms`);
    await speakEnglish(reply, 'happy_jump');

  } finally {
    isGenerating = false;
  }
}

function cleanLlmOutput(raw) {
  if (!raw) return '';
  return raw
    .replace(/<\|im_end\|>/g, '')
    .replace(/<\|endoftext\|>/g, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

// =========================================================================
// 7. TEXT-TO-SPEECH & MICROPHONE SPEECH-TO-TEXT
// =========================================================================
async function speakEnglish(text, endAnim = 'idle') {
  setFaceState('speaking');
  try {
    const TTS = window.Capacitor?.Plugins?.TextToSpeech;
    if (TTS) {
      await TTS.speak({
        text: text,
        lang: 'en-US',
        rate: 0.98,
        pitch: 1.12,
        volume: 1.0
      });
    } else if ('speechSynthesis' in window) {
      await new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 0.98;
        u.pitch = 1.12;
        u.onend = resolve;
        u.onerror = resolve;
        window.speechSynthesis.speak(u);
      });
    }
  } catch (e) {
    console.warn('TTS error:', e);
  } finally {
    setFaceState(endAnim);
    if (endAnim && endAnim.toLowerCase() !== 'idle') {
      setTimeout(() => setFaceState('idle'), 2000);
    }
  }
}

let recognition = null;
function toggleMic() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    alert('Trình duyệt WebView chưa hỗ trợ nhận diện giọng nói, bạn hãy gõ chữ vào ô chat nhé!');
    return;
  }
  const micBtn = document.getElementById('micBtn');
  if (recognition) {
    recognition.stop();
    recognition = null;
    micBtn.classList.remove('active');
    setFaceState('idle');
    return;
  }

  recognition = new SpeechRec();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  micBtn.classList.add('active');
  setFaceState('listening');

  recognition.onresult = (event) => {
    document.getElementById('textInput').value = event.results[0][0].transcript;
    sendChat();
  };
  recognition.onerror = () => {
    micBtn.classList.remove('active');
    setFaceState('idle');
    recognition = null;
  };
  recognition.onend = () => {
    micBtn.classList.remove('active');
    recognition = null;
  };

  recognition.start();
}

window.addEventListener('DOMContentLoaded', initAppStartup);
