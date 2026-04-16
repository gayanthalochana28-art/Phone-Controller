// Global Variables
let currentDeviceId = null;
let targetDeviceId = null;
let autoVibrate = false;
let cameraStream = null;
let screenStream = null;
let currentFacingMode = 'user';
let remoteViewActive = false;
let frameInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await initializeDevice();
    setupFirebaseListeners();
    startSystemMonitoring();
    addLog('✅ App initialized! Set target device to start', 'success');
});

// Initialize device
async function initializeDevice() {
    currentDeviceId = localStorage.getItem('deviceId');
    if (!currentDeviceId) {
        currentDeviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', currentDeviceId);
    }
    
    document.getElementById('deviceId').textContent = currentDeviceId;
    
    // Register in Firebase
    if (window.dbSet) {
        const deviceRef = window.dbRef(window.db, `devices/${currentDeviceId}`);
        await window.dbSet(deviceRef, {
            id: currentDeviceId,
            status: 'online',
            lastSeen: Date.now(),
            name: navigator.userAgent
        });
    }
    
    // Load saved target
    const savedTarget = localStorage.getItem('targetDevice');
    if (savedTarget) {
        document.getElementById('targetDevice').value = savedTarget;
        targetDeviceId = savedTarget;
        document.getElementById('targetStatus').innerHTML = `✅ Target: ${targetDeviceId}`;
    }
}

// Setup Firebase listeners
function setupFirebaseListeners() {
    if (!window.dbOnValue) return;
    
    // Listen for commands
    const commandsRef = window.dbRef(window.db, `commands/${currentDeviceId}`);
    window.dbOnValue(commandsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            handleCommand(data);
            window.dbRemove(window.dbRef(window.db, `commands/${currentDeviceId}`));
        }
    });
    
    // Listen for remote screen share
    const screenRef = window.dbRef(window.db, `streams/${currentDeviceId}/screen`);
    window.dbOnValue(screenRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.image && remoteViewActive) {
            displayRemoteStream(data.image);
        }
    });
    
    // Listen for remote camera
    const cameraRef = window.dbRef(window.db, `streams/${currentDeviceId}/camera`);
    window.dbOnValue(cameraRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.image && remoteViewActive) {
            displayRemoteStream(data.image);
        }
    });
}

// Handle incoming commands
async function handleCommand(command) {
    addLog(`📨 Received: ${command.type}`, 'info');
    
    switch(command.type) {
        case 'vibrate':
            executeVibration(command.intensity, command.pattern);
            break;
        case 'auto_vibrate':
            autoVibrate = command.enabled;
            document.getElementById('autoVibeBtn').innerHTML = 
                `🔄 Auto-Vibrate: ${autoVibrate ? 'ON' : 'OFF'}`;
            break;
        case 'request_camera':
            startCameraAndStream();
            break;
        case 'request_screen':
            startScreenShare();
            break;
        case 'photo':
            displayReceivedPhoto(command.image);
            break;
        case 'play_video':
            playVideoOnDevice(command.url);
            break;
        case 'notification':
            showNotification(command.message);
            break;
    }
}

// Send command to target
async function sendCommand(command) {
    if (!targetDeviceId) {
        addLog('⚠️ No target device set!', 'error');
        alert('Please set target device first!');
        return false;
    }
    
    try {
        const commandRef = window.dbRef(window.db, `commands/${targetDeviceId}`);
        await window.dbSet(commandRef, {
            ...command,
            from: currentDeviceId,
            timestamp: Date.now()
        });
        addLog(`✅ Command sent to ${targetDeviceId}`, 'success');
        return true;
    } catch(error) {
        addLog(`❌ Error: ${error.message}`, 'error');
        return false;
    }
}

// ============ CAMERA FUNCTIONS - FIXED ============
async function startCamera() {
    addLog('📷 Starting camera...', 'info');
    
    try {
        // Stop any existing stream
        if (cameraStream) {
            stopCamera();
        }
        
        const constraints = {
            video: {
                facingMode: { exact: currentFacingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };
        
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const videoElement = document.getElementById('cameraVideo');
        videoElement.srcObject = cameraStream;
        
        // Hide overlay
        document.getElementById('cameraOverlay').style.display = 'none';
        
        // Update UI
        document.getElementById('cameraStatus').innerHTML = 'Active';
        document.getElementById('cameraStatus').style.background = '#4caf50';
        document.getElementById('stopCameraBtn').disabled = false;
        document.getElementById('captureBtn').disabled = false;
        document.getElementById('switchCameraBtn').disabled = false;
        document.getElementById('startCameraBtn').disabled = true;
        
        addLog('✅ Camera started successfully!', 'success');
        
        // Auto start streaming to target
        startStreamingToTarget();
        
    } catch(error) {
        addLog(`❌ Camera error: ${error.message}`, 'error');
        
        // Try without facing mode constraint
        try {
            const simpleConstraints = { video: true, audio: false };
            cameraStream = await navigator.mediaDevices.getUserMedia(simpleConstraints);
            
            const videoElement = document.getElementById('cameraVideo');
            videoElement.srcObject = cameraStream;
            document.getElementById('cameraOverlay').style.display = 'none';
            
            addLog('✅ Camera started (compatibility mode)!', 'success');
            
        } catch(e) {
            addLog(`❌ Still failed: ${e.message}. Check permissions`, 'error');
            alert('Camera access denied or not available. Please check permissions.');
        }
    }
}

function stopCamera() {
    addLog('⏹️ Stopping camera...', 'info');
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    const videoElement = document.getElementById('cameraVideo');
    videoElement.srcObject = null;
    
    // Show overlay
    document.getElementById('cameraOverlay').style.display = 'flex';
    
    // Update UI
    document.getElementById('cameraStatus').innerHTML = 'Inactive';
    document.getElementById('cameraStatus').style.background = '#ff9800';
    document.getElementById('stopCameraBtn').disabled = true;
    document.getElementById('captureBtn').disabled = true;
    document.getElementById('switchCameraBtn').disabled = true;
    document.getElementById('startCameraBtn').disabled = false;
    
    // Stop streaming
    if (frameInterval) {
        clearInterval(frameInterval);
        frameInterval = null;
    }
    
    addLog('Camera stopped', 'info');
}

function switchCamera() {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    addLog(`🔄 Switching to ${currentFacingMode === 'user' ? 'front' : 'back'} camera...`, 'info');
    startCamera();
}

function capturePhoto() {
    if (!cameraStream) {
        addLog('Camera not active!', 'error');
        alert('Please start camera first');
        return;
    }
    
    const video = document.getElementById('cameraVideo');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const photoData = canvas.toDataURL('image/jpeg', 0.8);
    document.getElementById('capturedImage').src = photoData;
    document.getElementById('photoPreview').style.display = 'block';
    
    addLog('📸 Photo captured!', 'success');
}

async function sendPhotoToTarget() {
    const photoData = document.getElementById('capturedImage').src;
    if (!photoData || photoData === '') {
        alert('No photo to send');
        return;
    }
    
    await sendCommand({
        type: 'photo',
        image: photoData,
        from: currentDeviceId
    });
    
    addLog('📤 Photo sent to target!', 'success');
}

function closePreview() {
    document.getElementById('photoPreview').style.display = 'none';
}

function displayReceivedPhoto(imageData) {
    addLog('📸 Received photo from target', 'info');
    
    // Show notification
    const preview = document.getElementById('photoPreview');
    document.getElementById('capturedImage').src = imageData;
    preview.style.display = 'block';
    
    // Also show in log
    addLog('Photo received! Check preview above', 'success');
}

// Start streaming camera to target
function startStreamingToTarget() {
    if (frameInterval) {
        clearInterval(frameInterval);
    }
    
    frameInterval = setInterval(() => {
        if (cameraStream && targetDeviceId) {
            const video = document.getElementById('cameraVideo');
            if (video.videoWidth > 0) {
                const canvas = document.createElement('canvas');
                canvas.width = 640; // Resize for performance
                canvas.height = 360;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const imageData = canvas.toDataURL('image/jpeg', 0.5);
                
                const streamRef = window.dbRef(window.db, `streams/${targetDeviceId}/camera`);
                window.dbSet(streamRef, {
                    active: true,
                    image: imageData,
                    timestamp: Date.now(),
                    from: currentDeviceId
                });
            }
        }
    }, 500); // 2 frames per second
}

// ============ SCREEN SHARE FUNCTIONS ============
async function startScreenShare() {
    addLog('🖥️ Starting screen share...', 'info');
    
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: false
        });
        
        const videoElement = document.getElementById('screenVideo');
        videoElement.srcObject = screenStream;
        document.getElementById('screenOverlay').style.display = 'none';
        
        document.getElementById('stopScreenShareBtn').disabled = false;
        document.getElementById('startScreenShareBtn').disabled = true;
        
        // Start streaming screen frames
        startScreenStreaming();
        
        screenStream.getVideoTracks()[0].onended = () => {
            stopScreenShare();
        };
        
        addLog('✅ Screen share started!', 'success');
        
    } catch(error) {
        addLog(`❌ Screen share failed: ${error.message}`, 'error');
    }
}

function stopScreenShare() {
    addLog('⏹️ Stopping screen share...', 'info');
    
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    
    const videoElement = document.getElementById('screenVideo');
    videoElement.srcObject = null;
    document.getElementById('screenOverlay').style.display = 'flex';
    
    document.getElementById('stopScreenShareBtn').disabled = true;
    document.getElementById('startScreenShareBtn').disabled = false;
    
    addLog('Screen share stopped', 'info');
}

function startScreenStreaming() {
    if (frameInterval) {
        clearInterval(frameInterval);
    }
    
    frameInterval = setInterval(() => {
        if (screenStream && targetDeviceId) {
            const video = document.getElementById('screenVideo');
            if (video.videoWidth > 0) {
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 360;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const imageData = canvas.toDataURL('image/jpeg', 0.5);
                
                const streamRef = window.dbRef(window.db, `streams/${targetDeviceId}/screen`);
                window.dbSet(streamRef, {
                    active: true,
                    image: imageData,
                    timestamp: Date.now(),
                    from: currentDeviceId
                });
            }
        }
    }, 500);
}

function viewRemoteScreen() {
    if (!targetDeviceId) {
        alert('Please set target device first!');
        return;
    }
    
    startRemoteView();
    addLog(`👁️ Viewing screen from ${targetDeviceId}`, 'info');
}

// ============ REMOTE VIEW FUNCTIONS ============
function startRemoteView() {
    if (!targetDeviceId) {
        alert('Please set target device first!');
        return;
    }
    
    remoteViewActive = true;
    document.getElementById('remoteOverlay').style.display = 'none';
    addLog('📡 Remote view started', 'success');
}

function stopRemoteView() {
    remoteViewActive = false;
    document.getElementById('remoteOverlay').style.display = 'flex';
    const video = document.getElementById('remoteVideo');
    video.src = '';
    addLog('⏹️ Remote view stopped', 'info');
}

function displayRemoteStream(imageData) {
    const video = document.getElementById('remoteVideo');
    video.src = imageData;
}

// ============ VIBRATION FUNCTIONS ============
async function sendVibrate() {
    const intensity = document.getElementById('intensity').value;
    const pattern = document.getElementById('vibePattern').value;
    
    await sendCommand({
        type: 'vibrate',
        intensity: intensity,
        pattern: pattern
    });
    
    // Preview locally
    executeVibration(intensity, pattern);
}

function executeVibration(intensity, pattern) {
    addLog(`📳 Vibrating: ${pattern}`, 'vibrate');
    
    if ('vibrate' in navigator) {
        let patternArray = [];
        
        switch(pattern) {
            case 'pulse':
                patternArray = [200, 100, 200, 100, 200];
                break;
            case 'long':
                patternArray = [800];
                break;
            case 'short':
                patternArray = [100];
                break;
            case 'heartbeat':
                patternArray = [200, 100, 200];
                break;
            case 'sos':
                patternArray = [100, 100, 100, 500, 500, 500, 100, 100, 100];
                break;
            default:
                patternArray = [300];
        }
        
        navigator.vibrate(patternArray);
        
        // Visual feedback
        document.body.style.backgroundColor = '#ff9800';
        setTimeout(() => document.body.style.backgroundColor = '', 200);
    }
}

async function toggleAutoVibrate() {
    autoVibrate = !autoVibrate;
    const btn = document.getElementById('autoVibeBtn');
    btn.innerHTML = `🔄 Auto-Vibrate: ${autoVibrate ? 'ON' : 'OFF'}`;
    
    await sendCommand({
        type: 'auto_vibrate',
        enabled: autoVibrate
    });
}

// ============ VIDEO & NOTIFICATION ============
async function sendVideoToTarget() {
    const url = document.getElementById('videoUrl').value;
    if (!url) {
        alert('Enter video URL');
        return;
    }
    
    await sendCommand({
        type: 'play_video',
        url: url
    });
    
    addLog(`▶️ Video sent to target: ${url}`, 'success');
}

function playVideoOnDevice(url) {
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    video.autoplay = true;
    video.style.position = 'fixed';
    video.style.bottom = '20px';
    video.style.right = '20px';
    video.style.width = '300px';
    video.style.zIndex = '9999';
    video.style.borderRadius = '12px';
    video.style.boxShadow = '0 5px 20px rgba(0,0,0,0.3)';
    
    document.body.appendChild(video);
    
    setTimeout(() => {
        if (video && !video.paused) {
            video.remove();
        }
    }, 30000);
    
    addLog('🎬 Playing video', 'info');
}

async function sendNotificationToTarget() {
    const message = document.getElementById('notificationMsg').value;
    if (!message) {
        alert('Enter message');
        return;
    }
    
    await sendCommand({
        type: 'notification',
        message: message
    });
    
    addLog(`🔔 Notification sent: ${message}`, 'success');
    document.getElementById('notificationMsg').value = '';
}

function showNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('VibeControl', { body: message, icon: '🔔' });
    }
    addLog(`🔔 Notification: ${message}`, 'info');
}

// ============ UTILITY FUNCTIONS ============
function setTargetDevice() {
    const target = document.getElementById('targetDevice').value;
    if (target && target !== currentDeviceId) {
        targetDeviceId = target;
        localStorage.setItem('targetDevice', targetDeviceId);
        document.getElementById('targetStatus').innerHTML = `✅ Target set to: ${targetDeviceId}`;
        document.getElementById('targetStatus').style.background = '#e8f5e9';
        document.getElementById('targetStatus').style.padding = '8px';
        document.getElementById('targetStatus').style.borderRadius = '8px';
        addLog(`🎯 Target device set: ${targetDeviceId}`, 'success');
    } else if (target === currentDeviceId) {
        alert('Cannot target yourself!');
    } else {
        alert('Please enter a valid device ID');
    }
}

function copyDeviceId() {
    navigator.clipboard.writeText(currentDeviceId);
    addLog('📋 Device ID copied!', 'success');
    alert('Device ID copied: ' + currentDeviceId);
}

// System monitoring
async function startSystemMonitoring() {
    // Battery
    if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        updateBattery(battery);
        battery.addEventListener('levelchange', () => updateBattery(battery));
    }
    
    // Time
    setInterval(() => {
        document.getElementById('currentTime').textContent = new Date().toLocaleTimeString();
    }, 1000);
    
    // Signal simulation
    setInterval(() => {
        const signals = ['Excellent', 'Good', 'Fair'];
        document.getElementById('signalStrength').textContent = signals[Math.floor(Math.random() * signals.length)];
    }, 5000);
}

function updateBattery(battery) {
    const level = Math.round(battery.level * 100);
    document.getElementById('batteryLevel').textContent = `${level}%`;
}

// Add log message
function addLog(message, type = 'info') {
    const logContainer = document.getElementById('logMessages');
    const logEntry = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    
    const colors = {
        success: '#4caf50',
        error: '#f44336',
        info: '#2196f3',
        vibrate: '#ff9800'
    };
    
    logEntry.style.color = colors[type] || '#333';
    logEntry.style.padding = '5px';
    logEntry.style.borderBottom = '1px solid #e0e0e0';
    logEntry.innerHTML = `[${timestamp}] ${message}`;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function clearLog() {
    document.getElementById('logMessages').innerHTML = '';
    addLog('Log cleared', 'info');
}

// Request notification permission
if ('Notification' in window) {
    Notification.requestPermission();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
    }
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
    }
});
