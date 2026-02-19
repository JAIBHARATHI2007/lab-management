// API Base URL
const API_BASE = 'http://localhost:3000/api';

// Global variables
let html5QrCode = null;
let isScanning = false;
let qrCanvas = null;
let logs = [];

// Screen transitions
function enterLab() {
    const welcome = document.getElementById('welcomeScreen');
    welcome.style.opacity = '0';
    welcome.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        welcome.style.display = 'none';
        const lab = document.getElementById('labScreen');
        lab.classList.add('active');
    }, 800);
}

function backToWelcome() {
    const lab = document.getElementById('labScreen');
    lab.style.opacity = '0';
    
    setTimeout(() => {
        lab.classList.remove('active');
        const welcome = document.getElementById('welcomeScreen');
        welcome.style.display = 'flex';
        welcome.style.opacity = '1';
        welcome.style.transform = 'scale(1)';
    }, 800);
}

// Initialize
window.addEventListener('load', async () => {
    await loadUsers();
    await loadLogs();
});

// Load users dropdown
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`);
        const users = await response.json();
        const userSelect = document.getElementById('userSelect');
        userSelect.innerHTML = '<option value="">Select User</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.id} - ${user.name}`;
            userSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Load logs
async function loadLogs() {
    try {
        const response = await fetch(`${API_BASE}/logs`);
        logs = await response.json();
        displayLogs();
    } catch (error) {
        console.error('Error loading logs:', error);
    }
}

function displayLogs() {
    const tbody = document.querySelector('#logTable tbody');
    tbody.innerHTML = '';
    logs.forEach(log => {
        const row = tbody.insertRow();
        row.className = log.action === 'Entry' ? 'log-entry' : 'log-exit';
        row.innerHTML = `
            <td>${log.id}</td> <!-- Log row ID -->
            <td>${log.userId}</td> <!-- Student Register Number -->
            <td>${log.name} <span class="status-indicator ${log.status.toLowerCase()}">${log.status}</span></td>
            <td>${log.role}</td>
            <td>${log.action}</td>
            <td>${log.status}</td>
            <td>${new Date(log.timestamp).toLocaleString()}</td>
        `;
    });
}



// API: log entry/exit
async function logEvent(id = null) {
    const inputId = id || document.getElementById('rfidInput').value.toUpperCase().trim();
    if (!inputId) return;
    try {
        const response = await fetch(`${API_BASE}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: inputId })
        });
        const result = await response.json();
        if (result.success) {
            showStatus(result.message, true);
            await loadLogs();
            document.getElementById('rfidInput').value = '';
        } else {
            showStatus(result.message, false);
        }
    } catch (error) {
        showStatus('Server error. Please try again.', false);
    }
}

// Generate QR using backend user validation
async function generateQR() {
    const selectVal = document.getElementById('userSelect').value;
    const customVal = document.getElementById('customId').value.toUpperCase().trim();
    const id = selectVal || customVal;
    if (!id) return showStatus('Enter or select an ID.', false);
    try {
        const response = await fetch(`${API_BASE}/users/${id}`);
        if (!response.ok) throw new Error('User not found');
        
        const qrDiv = document.getElementById('qrCode');
        qrDiv.innerHTML = '';
        new QRCode(qrDiv, {
            text: id,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff"
        });
        qrCanvas = qrDiv.querySelector('canvas');
        document.getElementById('downloadBtn').disabled = false;
        showStatus(`QR for ${id} generated.`, true);
    } catch (error) {
        showStatus('User not found in database.', false);
    }
}

function downloadQR() {
    if (qrCanvas) {
        const link = document.createElement('a');
        link.download = 'lab-qr.png';
        link.href = qrCanvas.toDataURL();
        link.click();
    }
}

// QR Scanner
document.getElementById('rfidInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') logEvent();
});

function toggleQRScanner() {
    const qrReader = document.getElementById('qr-reader');
    const qrButton = document.getElementById('qrButton');
    if (!isScanning) {
        qrReader.style.display = 'block';
        qrButton.textContent = 'Stop Scanner';
        qrButton.disabled = true;
        startQRScanner();
    } else {
        stopQRScanner();
        qrReader.style.display = 'none';
        qrButton.textContent = 'Start QR Scanner';
        qrButton.disabled = false;
    }
}

async function startQRScanner() {
    html5QrCode = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    try {
        await html5QrCode.start({ facingMode: "environment" }, config, onQRScan, undefined);
        isScanning = true;
    } catch (err) {
        showStatus("Camera error. Check permissions.", false);
        toggleQRScanner();
    }
}

function stopQRScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            isScanning = false;
            html5QrCode = null;
        }).catch(console.error);
    }
}

function onQRScan(decodedText) {
    logEvent(decodedText.toUpperCase());
    stopQRScanner();
    document.getElementById('qrButton').textContent = 'Start QR Scanner';
    document.getElementById('qrButton').disabled = false;
    document.getElementById('qr-reader').style.display = 'none';
}

// Status popup
function showStatus(message, isSuccess) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = isSuccess ? 'success' : 'error';
    status.style.display = 'block';
    setTimeout(() => { status.style.display = 'none'; }, 3000);
}

// Mouse trail effect (optional)
document.addEventListener('mousemove', (e) => {
    const trail = document.createElement('div');
    trail.style.cssText = `
        position: fixed; left: ${e.pageX}px; top: ${e.pageY}px;
        width: 4px; height: 4px; background: rgba(0,255,204,0.8);
        border-radius: 50%; pointer-events: none; z-index: 30;
        animation: fadeOut 0.5s ease-out forwards;
    `;
    document.body.appendChild(trail);
    setTimeout(() => trail.remove(), 500);
});

const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        to { opacity: 0; transform: scale(2) translateY(-20px); }
    }
`;
document.head.appendChild(style);
