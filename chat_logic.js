document.addEventListener('DOMContentLoaded', () => {
    // --- SELECTOR ELEMENT ---
    const chatContainer = document.getElementById('chat-container');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const chatStatus = document.getElementById('chat-status');
    const onlineText = document.getElementById('online-text');
    const displayName = document.getElementById('display-name');
    const displayId = document.getElementById('display-id');

    // --- SELECTOR TOMBOL AKSI ---
    const btnCreate = document.getElementById('btn-create');
    const btnJoin = document.getElementById('btn-join');
    const btnLeave = document.getElementById('btn-leave');
    const btnDelete = document.getElementById('btn-delete');

    // --- SELECTOR MODAL & TRIGGER ---
    const nameModal = document.getElementById('name-modal-overlay');
    const toggleNameBtn = document.getElementById('toggle-name-btn');
    const nameInputModal = document.getElementById('name-input-modal');
    const saveNameBtnModal = document.getElementById('save-name-btn-modal');
    const cancelNameBtn = document.getElementById('cancel-name-btn');
    const chatTrigger = document.getElementById('chat-trigger');
    const closeChatBtn = document.getElementById('close-chat');

    // --- STATE GLOBAL ---
    let peer = null;
    let conn = null;          
    let connections = [];     
    let isRoomMode = false;
    let isHost = false;
    let currentRoomCode = "";
    let chatHistory = JSON.parse(localStorage.getItem("furina_history")) || [];
    let myName = localStorage.getItem("furina_nick") || "User_" + Math.floor(Math.random() * 1000);
    let activePeers = new Set();
    // Penanda agar sistem tidak menganggap koneksi terputus saat sedang transisi jadi Master
    let isTransitioning = false; 

    // --- VARIASI BALASAN FURINA ---
    const furinaGreetings = [
        "Halo! Aku Furina. Ada yang bisa aku bantu di jaringan lokal ini?",
        "Senang melihatmu kembali! Ingin membuat room atau bergabung dengan yang lain?",
        "Ah, kamu datang di waktu yang tepat! Apa rencanamu hari ini?",
        "Bonjour! Aku siap menemanimu mengobrol. Silakan gunakan fitur room jika ingin mengobrol privat.",
        "Sistem siap! Aku akan memantau aktivitas di sini. Jangan ragu untuk bertanya ya!"
    ];

    const furinaReplies = [
        "Aku mendengarkan... katakan lebih banyak.",
        "Hmm, begitu ya? Menarik sekali!",
        "Aku di sini untukmu. Apa ada hal lain?",
        "Oh! Aku baru saja memikirkan hal yang sama.",
        "Menarik! Tapi aku lebih suka jika kita mengobrol di dalam Room bersama yang lain."
    ];

    // typing indicator logic
    let typingTimeout = null;
    let isTyping = false;
    let remoteTypingTimer = null; 
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'typing-indicator';
    typingIndicator.style = "display: none; align-items: center; gap: 8px; padding: 8px 15px; margin: 5px 10px; background: rgba(168, 85, 247, 0.1); border-radius: 15px; width: fit-content; transition: opacity 0.3s ease;";
    typingIndicator.innerHTML = `
        <span style="font-size: 11px; color: #a855f7; font-weight: bold;" class="typing-name"></span>
        <div class="typing-dots" style="display: flex; gap: 3px;">
            <style>
                .typing-dots span { width: 6px; height: 6px; background: #a855f7; border-radius: 50%; animation: bounce 1.3s infinite ease-in-out; }
                .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
                .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
            </style>
            <span></span><span></span><span></span>
        </div>
    `;

    // --- AFK & PROGRESS BAR STATE ---
    let afkInterval = null; 
    let remainingTime = 60;
    const TOTAL_AFK_TIME = 60; 

    let afkBar = document.getElementById('afk-progress-bar');
    if (!afkBar) {
        afkBar = document.createElement('div');
        afkBar.id = 'afk-progress-bar';
        afkBar.style = "position: absolute; top: 0; left: 0; height: 3px; background: #ef4444; width: 0%; transition: width 1s linear; z-index: 100; box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);";
        chatContainer.appendChild(afkBar);
    }

    function startAfkTimer() {
        if (!isRoomMode) return;
        stopAfkTimer(); 
        remainingTime = TOTAL_AFK_TIME;
        if (afkBar) afkBar.style.width = "0%";
        afkInterval = setInterval(() => {
            remainingTime--;
            const percentage = ((TOTAL_AFK_TIME - remainingTime) / TOTAL_AFK_TIME) * 100;
            if (afkBar) afkBar.style.width = percentage + "%";
            if (remainingTime <= 0) {
                clearInterval(afkInterval);
                addMessage("Waktu habis. Membubarkan room...", "ai", "System");
                setTimeout(() => {
                    if (isHost) broadcast({ type: 'ROOM_DELETED' });
                    exitRoom(true); 
                }, 2000);
            }
        }, 1000);
    }

    function stopAfkTimer() {
        if (afkInterval) clearInterval(afkInterval);
        if (afkBar) afkBar.style.width = "0%";
    }

    function resetAfkTimer() {
        if (isRoomMode) startAfkTimer();
    }

    function updateButtonStates() {
        if (isRoomMode) {
            btnCreate.style.opacity = "0.4"; btnCreate.disabled = true;
            btnJoin.style.opacity = "0.4"; btnJoin.disabled = true;
            btnLeave.style.opacity = "1"; btnLeave.disabled = false;
            toggleNameBtn.style.opacity = "0.5";
            if (isHost) {
                btnDelete.style.opacity = "1"; btnDelete.disabled = false;
            } else {
                btnDelete.style.opacity = "0.4"; btnDelete.disabled = true;
            }
        } else {
            btnCreate.style.opacity = "1"; btnCreate.disabled = false;
            btnJoin.style.opacity = "1"; btnJoin.disabled = false;
            btnLeave.style.opacity = "0.4"; btnLeave.disabled = true;
            btnDelete.style.opacity = "0.4"; btnDelete.disabled = true;
            toggleNameBtn.style.opacity = "1";
        }
    }

    function updateProfileUI() {
        if (displayName && displayId) {
            displayName.innerText = myName;
            const idSuffix = (peer && peer.id) ? peer.id.split('-').pop() : "000";
            displayId.innerText = `ID: #${idSuffix}`;
        }
    }

    function updateVisitorUI() {
        if (onlineText) {
            let count = isRoomMode ? (isHost ? (connections.length + 1) : 2) : (activePeers.size + 1);
            let label = isRoomMode ? "Di Room" : "Online (Lokal)";
            onlineText.innerText = `${count} ${label}`;
        }
    }

    function showTyping(name) {
        if (name === myName) return; 
        typingIndicator.querySelector('.typing-name').innerText = name;
        typingIndicator.style.display = 'flex';
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
        
        if (remoteTypingTimer) clearTimeout(remoteTypingTimer);
        remoteTypingTimer = setTimeout(() => { 
            typingIndicator.style.display = 'none'; 
        }, 4000); 
    }

    function handleTypingEvent() {
        if (!isRoomMode) return;
        resetAfkTimer();
        
        if (!isTyping) {
            isTyping = true;
            const data = { type: 'TYPING', name: myName };
            if (isHost) broadcast(data); 
            else if (conn && conn.open) conn.send(data);
            
            setTimeout(() => { isTyping = false; }, 2000);
        }
    }

    // --- CORE MESSAGING ---
    function addMessage(text, sender, name = "Furina", isSync = false) {
        if (!isSync) {
            chatHistory.push({ text, sender, name });
            localStorage.setItem("furina_history", JSON.stringify(chatHistory.slice(-50)));
            if (name !== "System") resetAfkTimer(); 
        }

        const messageWrapper = document.createElement('div');
        if (name === "System") {
            messageWrapper.className = 'system-msg-container';
            messageWrapper.innerHTML = `<div class="system-bubble">${text}</div>`;
        } else {
            const visualSender = (name === myName) ? 'user' : 'ai';
            messageWrapper.className = `message ${visualSender === 'user' ? 'user-msg' : 'ai-msg'}`;
            messageWrapper.innerHTML = `<small style="display:block; font-size:10px; opacity:0.6; margin-bottom:4px;">${name}</small>${text}`;
        }

        chatMessages.insertBefore(messageWrapper, typingIndicator);
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    }

    function broadcast(data, excludePeerId = null) {
        connections.forEach(c => { 
            if (c.open && c.peer !== excludePeerId) { 
                c.send(data); 
            } 
        });
    }

    function clearAllChat() {
        chatHistory = [];
        localStorage.removeItem("furina_history");
        chatMessages.innerHTML = "";
        chatMessages.appendChild(typingIndicator);
    }

    // --- NETWORKING LOGIC (UPDATED WITH RETRY) ---
    function setupAsHost(roomCode, retryCount = 0) {
        if (!roomCode) return;
        chatStatus.innerText = `Mencoba membuat room...`;
        chatStatus.style.color = "#ff9900";
        if (peer && !peer.destroyed) peer.destroy();

        peer = new Peer('furina-host-' + roomCode);

        peer.on('open', () => {
            isRoomMode = true; isHost = true; currentRoomCode = roomCode;
            isTransitioning = false; // Transisi selesai
            chatStatus.innerText = `Master Room : ${roomCode}`;
            chatStatus.style.color = "#000000";
            addMessage(`Kamu sekarang adalah Master di room "${roomCode}".`, 'ai', 'System');
            updateProfileUI(); updateVisitorUI(); updateButtonStates(); startAfkTimer();
        });

        peer.on('error', (err) => {
            if (err.type === 'unavailable-id') {
                // JIKA ID MASIH DIPAKAI, COBA LAGI HINGGA 3 KALI
                if (retryCount < 3) {
                    addMessage(`Menunggu jalur ID room bebas... (Percobaan ${retryCount + 1})`, 'ai', 'System');
                    setTimeout(() => setupAsHost(roomCode, retryCount + 1), 2000);
                } else {
                    addMessage(`Gagal: Kode room "${roomCode}" tetap sibuk.`, 'ai', 'System');
                    chatStatus.innerText = "MODE: AI FURINA";
                    chatStatus.style.color = "#00ff00";
                    isTransitioning = false;
                    exitRoom(false);
                }
            }
        });

        peer.on('connection', (connection) => {
            connection.on('open', () => {
                connections.push(connection);
                updateVisitorUI();
                connection.send({ type: 'SYNC_HISTORY', history: chatHistory });
            });

            connection.on('data', (data) => {
                resetAfkTimer();
                if (data.type === 'JOIN_NOTIFY') {
                    connection.peerName = data.name; 
                    addMessage(`${data.name} bergabung ke room.`, 'ai', 'System');
                }
                if (data.type === 'TYPING') { 
                    showTyping(data.name); 
                    broadcast(data, connection.peer); 
                }
                if (data.type === 'CHAT') {
                    addMessage(data.text, 'ai', data.name);
                    broadcast({ type: 'CHAT', text: data.text, name: data.name, sender: 'ai' }, connection.peer);
                }
            });

            connection.on('close', () => {
                connections = connections.filter(c => c.peer !== connection.peer);
                updateVisitorUI();
                addMessage(`${connection.peerName || 'Member'} meninggalkan room.`, 'ai', 'System');
            });
        });
    }

    function joinRoom(roomCode) {
        if (!roomCode) return;
        if (peer) peer.destroy();
        
        peer = new Peer(); 
        peer.on('open', () => {
            chatStatus.innerText = `Mencoba Bergabung Room...`;
            chatStatus.style.color = "#ff9900";
            const connection = peer.connect('furina-host-' + roomCode, { reliable: true });
            
            const connTimeout = setTimeout(() => {
                if (!conn || !conn.open) {
                    addMessage(`Gagal: Room "${roomCode}" tidak merespon.`, 'ai', 'System');
                    chatStatus.innerText = "MODE: AI FURINA";
                    chatStatus.style.color = "#00ff00";
                    exitRoom(false);
                }
            }, 5000);

            connection.on('open', () => {
                clearTimeout(connTimeout);
                conn = connection;
                isRoomMode = true; isHost = false; currentRoomCode = roomCode;
                isTransitioning = false;
                clearAllChat();
                conn.send({ type: 'JOIN_NOTIFY', name: myName });
                setupClientEvents();
                chatStatus.innerText = `Member Room: ${roomCode}`;
                chatStatus.style.color = "#000000";
                addMessage(`Berhasil bergabung ke room "${roomCode}".`, 'ai', 'System');
                updateVisitorUI(); updateButtonStates(); startAfkTimer();
            });
        });
    }

    function setupClientEvents() {
        conn.on('data', (data) => {
            resetAfkTimer();
            if (data.type === 'TYPING') showTyping(data.name);
            if (data.type === 'CHAT') addMessage(data.text, 'ai', data.name, true);
            if (data.type === 'SYNC_HISTORY') {
                chatMessages.innerHTML = ""; 
                chatMessages.appendChild(typingIndicator);
                data.history.forEach(msg => addMessage(msg.text, msg.sender, msg.name, true));
                addMessage("Riwayat chat dipulihkan", "ai", "System");
            }
            if (data.type === 'ROOM_DELETED') {
                addMessage("Master membubarkan room. Menghapus data...", "ai", "System");
                setTimeout(() => exitRoom(true), 1500);
            }
            if (data.type === 'BECOME_HOST') {
                isTransitioning = true; // KUNCI AGAR TIDAK EXIT SAAT DISCONNECT
                addMessage("Memindahkan Room Master: Kamu adalah Master baru!", "ai", "System");
                const targetRoom = currentRoomCode;
                if (conn) conn.close();
                conn = null;
                // Beri jeda agar server PeerJS membersihkan ID lama
                setTimeout(() => {
                    setupAsHost(targetRoom);
                }, 2000);
            }
        });

        conn.on('close', () => {
            // Beri waktu pengecekan transisi BECOME_HOST
            setTimeout(() => {
                if (isRoomMode && !isHost && !isTransitioning && (!conn || !conn.open)) {
                    addMessage("Koneksi Host terputus.", "ai", "System");
                    exitRoom(false);
                }
            }, 4000);
        });
    }

    function exitRoom(clearChat = false) {
        if (!isRoomMode) return;

        if (isHost) {
            if (clearChat) {
                addMessage(`Membubarkan room...`, 'ai', 'System');
                broadcast({ type: 'ROOM_DELETED' });
            } else if (connections.length > 0) {
                addMessage(`Mentransfer kepemimpinan...`, 'ai', 'System');
                connections[0].send({ type: 'BECOME_HOST' });
            }
        } else {
            addMessage(`Kamu keluar dari room.`, 'ai', 'System');
        }
        
        stopAfkTimer();
        
        setTimeout(() => {
            if (conn) conn.close();
            if (peer) peer.destroy();
            
            isRoomMode = false; 
            isHost = false; 
            currentRoomCode = "";
            conn = null; 
            connections = [];
            isTransitioning = false;
            
            chatStatus.innerText = "MODE: AI FURINA";
            chatStatus.style.color = "#00ff00";
            
            if (clearChat) clearAllChat();
            
            updateButtonStates();
            initLocalPresence();
        }, 2000);
    }

    function initLocalPresence() {
        if (isRoomMode) return;
        if (peer && !peer.destroyed) peer.destroy();
        peer = new Peer('furina-presence-' + (Math.floor(Math.random() * 10) + 1));
        peer.on('open', () => { updateProfileUI(); updateVisitorUI(); scanOtherPeers(); });
        peer.on('connection', (c) => {
            activePeers.add(c.peer); updateVisitorUI();
            c.on('close', () => { activePeers.delete(c.peer); updateVisitorUI(); });
        });
    }

    function scanOtherPeers() {
        if (isRoomMode || !peer || peer.destroyed) return;
        for (let i = 1; i <= 5; i++) {
            const tid = 'furina-presence-' + i;
            if (tid === peer.id) continue;
            const c = peer.connect(tid);
            c.on('open', () => { activePeers.add(tid); updateVisitorUI(); setTimeout(() => c.close(), 500); });
        }
    }

    // --- BINDING EVENT ---
    btnCreate.onclick = () => { const c = prompt("Kode Room:"); if(c) { clearAllChat(); setupAsHost(c.trim()); } };
    btnJoin.onclick = () => { const c = prompt("Kode Room:"); if(c) joinRoom(c.trim()); };
    btnLeave.onclick = () => { if(confirm("Keluar dari room? Jabatan akan dialihkan.")) exitRoom(false); };
    btnDelete.onclick = () => { if(confirm("Hapus room secara permanen?")) exitRoom(true); };

    function handleSend() {
        const text = userInput.value.trim();
        if (!text) return;
        addMessage(text, 'user', myName);
        if (isRoomMode) {
            if (isHost) broadcast({ type: 'CHAT', text: text, name: myName, sender: 'ai' });
            else if (conn && conn.open) conn.send({ type: 'CHAT', text: text, name: myName });
        } else {
            const randomReply = furinaReplies[Math.floor(Math.random() * furinaReplies.length)];
            setTimeout(() => addMessage(randomReply, 'ai', 'Furina'), 1000);
        }
        userInput.value = ""; 
        isTyping = false;
        typingIndicator.style.display = 'none';
        resetAfkTimer();
    }

    sendBtn.onclick = handleSend;
    userInput.addEventListener('input', handleTypingEvent);
    userInput.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
    
    chatTrigger.onclick = () => { chatContainer.classList.add('active'); chatTrigger.classList.add('hidden'); };
    closeChatBtn.onclick = () => { chatContainer.classList.remove('active'); setTimeout(() => chatTrigger.classList.remove('hidden'), 500); };
    
    toggleNameBtn.onclick = (e) => { 
        e.stopPropagation(); 
        if (isRoomMode) return;
        nameModal.classList.remove('modal-hidden'); 
        nameInputModal.value = myName; 
        nameInputModal.focus(); 
    };

    cancelNameBtn.onclick = () => nameModal.classList.add('modal-hidden');
    saveNameBtnModal.onclick = () => {
        if (nameInputModal.value.trim()) {
            myName = nameInputModal.value.trim();
            localStorage.setItem("furina_nick", myName);
            updateProfileUI(); nameModal.classList.add('modal-hidden');
            addMessage(`Nama diganti: ${myName}`, 'ai', 'System');
        }
    };

    chatMessages.appendChild(typingIndicator);
    if (chatHistory.length > 0) chatHistory.forEach(msg => addMessage(msg.text, msg.sender, msg.name, true));
    
    updateButtonStates(); 
    initLocalPresence();

    if (!isRoomMode) {
        const startMsg = furinaGreetings[Math.floor(Math.random() * furinaGreetings.length)];
        setTimeout(() => addMessage(startMsg, 'ai', 'Furina'), 1200);
    }
    setInterval(scanOtherPeers, 30000);

    // Mencegah teks diseret (drag)
document.addEventListener('dragstart', (e) => e.preventDefault());

// Mencegah seleksi melalui JavaScript (tambahan untuk Chrome)
document.onselectstart = (e) => {
    // Izinkan seleksi hanya jika targetnya adalah input atau textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return true;
    }
    return false;
};
});