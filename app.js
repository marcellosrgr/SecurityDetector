// ==========================================
// 1. INISIALISASI ELEMEN DOM
// ==========================================
// Vision / AutoZoom Elements
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const fpsDisplay = document.getElementById('fpsDisplay');

const toggleAutoZoom = document.getElementById('toggleAutoZoom');
const sliderMaxZoom = document.getElementById('sliderMaxZoom');
const sliderLerp = document.getElementById('sliderLerp');
const sliderPadding = document.getElementById('sliderPadding');
const btnRestart = document.getElementById('btnRestart');

const maxZoomVal = document.getElementById('maxZoomVal');
const lerpVal = document.getElementById('lerpVal');
const paddingVal = document.getElementById('paddingVal');

// Noise Detector Elements
const dbDisplay = document.getElementById('dbDisplay');
const dbCircle = document.getElementById('dbCircle');
const soundBar = document.getElementById('soundBar');
const thresholdMarker = document.getElementById('thresholdMarker');
const thresholdLabel = document.getElementById('thresholdLabel');
const noiseAlertBadge = document.getElementById('noiseAlertBadge');
const sliderThreshold = document.getElementById('sliderThreshold');
const sliderSensitivity = document.getElementById('sliderSensitivity');
const thresholdVal = document.getElementById('thresholdVal');
const sensVal = document.getElementById('sensVal');
const btnToggleMic = document.getElementById('btnToggleMic');
const btnCalibrateMic = document.getElementById('btnCalibrateMic');

// Drowsiness Elements
const toggleDrowsy = document.getElementById('toggleDrowsy');
const sliderDrowsyThreshold = document.getElementById('sliderDrowsyThreshold');
const drowsyThresholdVal = document.getElementById('drowsyThresholdVal');
const sliderDrowsyTime = document.getElementById('sliderDrowsyTime');
const drowsyTimeVal = document.getElementById('drowsyTimeVal');
const drowsyBadge = document.getElementById('drowsyBadge');
const toggleDrowsySound = document.getElementById('toggleDrowsySound');
const drowsyModal = document.getElementById('drowsyModal');
const btnDismissDrowsy = document.getElementById('btnDismissDrowsy');

// MQTT Settings Elements
const mqttTriggerMode = document.getElementById('mqttTriggerMode');
const mqttHost = document.getElementById('mqttHost');
const mqttTopicZoom = document.getElementById('mqttTopicZoom');
const mqttTopicNoise = document.getElementById('mqttTopicNoise');
const mqttTopicDrowsy = document.getElementById('mqttTopicDrowsy');
const btnConnectMqtt = document.getElementById('btnConnectMqtt');
const mqttStatusBadge = document.getElementById('mqttStatusBadge');

// ==========================================
// 2. STATE & PARAMETER PENGATURAN
// ==========================================
let mqttClient = null;
let lastZoomBuzzerState = null;
let lastNoiseBuzzerState = null;
let lastDrowsyBuzzerState = null;
let lastZoomSendTime = 0;
let lastNoiseSendTime = 0;
let lastDrowsySendTime = 0;

// Drowsiness State Tracking
let eyeClosedStartTime = 0;
let isDrowsyAlertActive = false;
let lastAlarmBeepTime = 0;

// Web Audio Oscillator untuk Alarm Suara Kantuk di Browser
let alarmAudioCtx = null;
function playDrowsyAlarmTone() {
    if (!toggleDrowsySound || !toggleDrowsySound.checked) return;
    try {
        if (!alarmAudioCtx) {
            alarmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const osc = alarmAudioCtx.createOscillator();
        const gain = alarmAudioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, alarmAudioCtx.currentTime); // 880 Hz High Pitch Alarm
        gain.gain.setValueAtTime(0.2, alarmAudioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, alarmAudioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(alarmAudioCtx.destination);
        osc.start();
        osc.stop(alarmAudioCtx.currentTime + 0.35);
    } catch (e) {
        console.warn("Audio alarm warning:", e);
    }
}

// Audio Context & Analyser
let audioContext = null;
let analyser = null;
let micStream = null;
let isMicActive = false;
let dbCalibrationOffset = 20; // Offset baseline dB

// Slider Event Listeners
sliderMaxZoom.oninput = () => maxZoomVal.innerText = `${parseFloat(sliderMaxZoom.value).toFixed(1)}x`;
sliderLerp.oninput = () => lerpVal.innerText = parseFloat(sliderLerp.value).toFixed(2);
sliderPadding.oninput = () => paddingVal.innerText = `${parseFloat(sliderPadding.value).toFixed(1)}x`;

sliderThreshold.oninput = () => {
    const val = parseInt(sliderThreshold.value);
    thresholdVal.innerText = `${val} dB`;
    thresholdLabel.innerText = `Ambang: ${val} dB`;
    // Posisikan threshold marker di bar (0 - 120 dB)
    const pct = Math.min(100, Math.max(0, (val / 120) * 100));
    thresholdMarker.style.left = `${pct}%`;
};

sliderSensitivity.oninput = () => sensVal.innerText = `${parseFloat(sliderSensitivity.value).toFixed(1)}x`;

if (sliderDrowsyThreshold) {
    sliderDrowsyThreshold.oninput = () => {
        drowsyThresholdVal.innerText = parseFloat(sliderDrowsyThreshold.value).toFixed(2);
    };
}

if (sliderDrowsyTime) {
    sliderDrowsyTime.oninput = () => {
        drowsyTimeVal.innerText = `${parseFloat(sliderDrowsyTime.value).toFixed(1)} detik`;
    };
}

// ==========================================
// TAB NAVIGATION SWITCHER
// ==========================================
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTabId = btn.getAttribute('data-tab');

        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPane = document.getElementById(targetTabId);
        if (targetPane) targetPane.classList.add('active');
    });
});

// ==========================================
// 3. MQTT LOGIC & PUBLISHER
// ==========================================
const navMqttDot = document.getElementById('navMqttDot');

function updateMqttStatus(connected, text) {
    if (mqttStatusBadge) mqttStatusBadge.innerText = text;
    if (navMqttDot) {
        if (connected) {
            navMqttDot.className = "status-indicator-dot connected";
        } else {
            navMqttDot.className = "status-indicator-dot";
        }
    }
    if (btnConnectMqtt) {
        if (connected) {
            btnConnectMqtt.innerText = "🔌 Putuskan MQTT";
            btnConnectMqtt.style.background = "#dc2626";
        } else {
            btnConnectMqtt.innerText = "⚡ Hubungkan MQTT";
            btnConnectMqtt.style.background = "linear-gradient(135deg, #3b82f6, #2563eb)";
        }
    }
}

function connectMqttClient() {
    if (mqttClient && mqttClient.connected) {
        return;
    }

    let brokerUrl = mqttHost.value.trim();
    if (!brokerUrl) {
        brokerUrl = "wss://broker.emqx.io:8084/mqtt";
    }

    updateMqttStatus(false, "Connecting...");

    try {
        mqttClient = mqtt.connect(brokerUrl, {
            clientId: 'AutoZoomHub_' + Math.random().toString(16).substring(2, 10),
            clean: true,
            connectTimeout: 6000,
            reconnectPeriod: 3000
        });

        mqttClient.on('connect', () => {
            updateMqttStatus(true, "Connected");
            console.log("[MQTT] ✅ Berhasil terhubung otomatis ke " + brokerUrl);
        });

        mqttClient.on('error', (err) => {
            console.warn("[MQTT] Percobaan koneksi:", err.message);
            updateMqttStatus(false, "Error");
        });

        mqttClient.on('close', () => {
            updateMqttStatus(false, "Disconnected");
        });
    } catch (e) {
        console.error("Format URL MQTT tidak valid: " + e.message);
        updateMqttStatus(false, "Error");
    }
}

btnConnectMqtt.onclick = () => {
    if (mqttClient && mqttClient.connected) {
        mqttClient.end();
        mqttClient = null;
        updateMqttStatus(false, "Disconnected");
    } else {
        connectMqttClient();
    }
};

// Auto-Connect MQTT saat halaman pertama kali dibuka
window.addEventListener('DOMContentLoaded', () => {
    connectMqttClient();
});
setTimeout(() => {
    if (!mqttClient || !mqttClient.connected) {
        connectMqttClient();
    }
}, 500);

// Publisher sinyal AutoZoom
function handleVisionBuzzerTrigger(hasFace) {
    if (!mqttClient || !mqttClient.connected) return;
    const mode = mqttTriggerMode ? mqttTriggerMode.value : "face_present";
    if (mode === "none") return;

    let shouldBeep = false;
    if (mode === "face_present" && hasFace) shouldBeep = true;
    else if (mode === "face_absent" && !hasFace) shouldBeep = true;

    const now = Date.now();
    if (shouldBeep !== lastZoomBuzzerState) {
        lastZoomBuzzerState = shouldBeep;
        lastZoomSendTime = now;
        const payload = shouldBeep ? "BEEP_ON" : "BEEP_OFF";
        const topic = (mqttTopicZoom && mqttTopicZoom.value.trim()) || "autozoom/buzzer";
        mqttClient.publish(topic, payload, { qos: 0 }, (err) => {
            if (err) console.error("[MQTT] Gagal publish vision:", err);
            else console.log(`[MQTT PUBLISH] Topik: ${topic} => ${payload}`);
        });
    }
}

// State Noise Hold Timer untuk Mencegah Spam Bising
let noiseAlertStartTime = 0;
let lastNoisePublishedState = null;

// Publisher sinyal NoiseDetector (Hanya kirim saat Mic Aktif & Debounced)
function handleNoiseBuzzerTrigger(isNoiseOverThreshold) {
    if (!mqttClient || !mqttClient.connected || !isMicActive) return;
    const now = Date.now();

    // Jika bising terdeteksi, tahan status alarm minimal 1.2 detik agar tidak spam bolak-balik
    if (isNoiseOverThreshold) {
        noiseAlertStartTime = now;
    }

    const isEffectiveNoiseAlert = isNoiseOverThreshold || (now - noiseAlertStartTime < 1200);

    if (isEffectiveNoiseAlert !== lastNoisePublishedState) {
        lastNoisePublishedState = isEffectiveNoiseAlert;
        lastNoiseSendTime = now;
        const payload = isEffectiveNoiseAlert ? "NOISE_ALERT" : "NOISE_CLEAR";
        const topic = (mqttTopicNoise && mqttTopicNoise.value.trim()) || "noisedetector/buzzer";
        mqttClient.publish(topic, payload, { qos: 0 }, (err) => {
            if (err) console.error("[MQTT] Gagal publish noise:", err);
            else console.log(`[MQTT PUBLISH] Topik: ${topic} => ${payload}`);
        });
    }
}

// Publisher sinyal Drowsiness (Deteksi Kantuk)
function handleDrowsyTrigger(isDrowsy) {
    if (!mqttClient || !mqttClient.connected) return;
    const now = Date.now();
    if (isDrowsy !== lastDrowsyBuzzerState || (now - lastDrowsySendTime > 2000)) {
        lastDrowsyBuzzerState = isDrowsy;
        lastDrowsySendTime = now;
        const payload = isDrowsy ? "DROWSY_ALERT" : "DROWSY_CLEAR";
        const topic = (mqttTopicDrowsy && mqttTopicDrowsy.value.trim()) || "autozoom/drowsy";
        mqttClient.publish(topic, payload, { qos: 0 }, (err) => {
            if (err) console.error("[MQTT] Gagal publish drowsy:", err);
            else console.log(`[MQTT PUBLISH] Topik: ${topic} => ${payload}`);
        });
    }
}

// ==========================================
// 4. NOISE DETECTOR & AUDIO PROCESSING
// ==========================================
async function startMicrophone() {
    try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.3;

        const source = audioContext.createMediaStreamSource(micStream);
        source.connect(analyser);

        isMicActive = true;
        btnToggleMic.innerText = "🛑 Hentikan Mikrofon";
        btnToggleMic.style.background = "#dc2626";

        processAudioLoop();
    } catch (err) {
        alert("Gagal mengakses mikrofon: " + err.message);
    }
}

function stopMicrophone() {
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    isMicActive = false;
    btnToggleMic.innerText = "🎙️ Aktifkan Mikrofon";
    btnToggleMic.style.background = "#059669";
    dbDisplay.innerText = "0.0";
    soundBar.style.width = "0%";
    dbCircle.classList.remove("danger");
}

btnToggleMic.onclick = () => {
    if (isMicActive) stopMicrophone();
    else startMicrophone();
};

btnCalibrateMic.onclick = () => {
    if (!isMicActive) {
        alert("Aktifkan mikrofon terlebih dahulu sebelum kalibrasi!");
        return;
    }
    dbCalibrationOffset = 15;
    alert("Kalibrasi selesai! Baseline suara di ruangan telah disesuaikan.");
};

function processAudioLoop() {
    if (!isMicActive || !analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Hitung RMS (Root Mean Square) Audio Level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);

    // Konversi RMS ke dB perkiraan (skala 30 - 110 dB)
    const sensitivity = parseFloat(sliderSensitivity.value);
    let calculatedDb = 0;
    if (rms > 0) {
        calculatedDb = Math.round((20 * Math.log10(rms) + dbCalibrationOffset) * sensitivity);
    }
    calculatedDb = Math.max(30, Math.min(120, calculatedDb));

    // Update UI Desibel
    dbDisplay.innerText = calculatedDb.toFixed(1);
    const barPct = Math.min(100, Math.max(0, (calculatedDb / 120) * 100));
    soundBar.style.width = `${barPct}%`;

    const threshold = parseInt(sliderThreshold.value);
    const isOver = calculatedDb >= threshold;

    if (isOver) {
        dbCircle.classList.add("danger");
        noiseAlertBadge.innerText = "🚨 BISING / MELEBIHI AMBANG!";
        noiseAlertBadge.style.background = "#dc2626";
        noiseAlertBadge.style.color = "#fecaca";
    } else {
        dbCircle.classList.remove("danger");
        noiseAlertBadge.innerText = "NORMAL";
        noiseAlertBadge.style.background = "#059669";
        noiseAlertBadge.style.color = "#a7f3d0";
    }

    handleNoiseBuzzerTrigger(isOver);
    requestAnimationFrame(processAudioLoop);
}

// ==========================================
// 5. AUTOZOOM & MEDIAPIPE FACE TRACKING
// ==========================================
// 5. AUTOZOOM & MEDIAPIPE FACE MESH (EYELID EAR DETECTION)
// ==========================================
let currentCrop = { x: 0.0, y: 0.0, w: 1.0, h: 1.0 };
let lastFaceSeenTime = Date.now();
const GRACE_PERIOD_MS = 2000;

let frameCount = 0;
let lastFpsUpdate = performance.now();

function lerp(start, end, factor) {
    return start + (end - start) * factor;
}

// Rumus Jarak Euclidean 2D
function dist2D(pt1, pt2) {
    return Math.hypot(pt1.x - pt2.x, pt1.y - pt2.y);
}

// Hitung Eye Aspect Ratio (EAR) dari Kelopak Mata Atas vs Kelopak Bawah
// Landmark Indeks MediaPipe Face Mesh untuk Mata:
// Mata Kiri: 362 (luar), 263 (dalam), 386 (atas 1), 374 (bawah 1), 385 (atas 2), 380 (bawah 2)
// Mata Kanan: 33 (luar), 133 (dalam), 159 (atas 1), 145 (bawah 1), 158 (atas 2), 153 (bawah 2)
function calculateEAR(landmarks, eyeIndices) {
    const p1 = landmarks[eyeIndices[0]]; // Sudut Luar
    const p4 = landmarks[eyeIndices[3]]; // Sudut Dalam

    const p2 = landmarks[eyeIndices[1]]; // Kelopak Atas 1
    const p6 = landmarks[eyeIndices[5]]; // Kelopak Bawah 1

    const p3 = landmarks[eyeIndices[2]]; // Kelopak Atas 2
    const p5 = landmarks[eyeIndices[4]]; // Kelopak Bawah 2

    // Jarak Vertikal Kelopak Atas ke Bawah
    const verticalDist1 = dist2D(p2, p6);
    const verticalDist2 = dist2D(p3, p5);

    // Jarak Horizontal Sudut Mata
    const horizontalDist = dist2D(p1, p4);

    if (horizontalDist === 0) return 0;
    return (verticalDist1 + verticalDist2) / (2.0 * horizontalDist);
}

const LEFT_EYE_INDICES = [362, 385, 386, 263, 374, 380];
const RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144];

const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
    maxNumFaces: 2,
    refineLandmarks: true, // Termasuk iris dan kelopak mata detail
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

faceMesh.onResults(onResults);

function onResults(results) {
    frameCount++;
    const now = performance.now();
    if (now - lastFpsUpdate >= 500) {
        const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
        fpsDisplay.innerText = `FPS: ${fps}`;
        frameCount = 0;
        lastFpsUpdate = now;
    }

    const videoW = videoElement.videoWidth;
    const videoH = videoElement.videoHeight;
    if (!videoW || !videoH) return;

    if (canvasElement.width !== videoW || canvasElement.height !== videoH) {
        canvasElement.width = videoW;
        canvasElement.height = videoH;
    }

    const isAutoZoom = toggleAutoZoom.checked;
    const maxZoom = parseFloat(sliderMaxZoom.value);
    const lerpFactor = parseFloat(sliderLerp.value);
    const headPadding = parseFloat(sliderPadding.value);

    let targetCrop = { x: 0.0, y: 0.0, w: 1.0, h: 1.0 };
    const multiFaceLandmarks = results.multiFaceLandmarks;

    if (multiFaceLandmarks && multiFaceLandmarks.length > 0 && isAutoZoom) {
        lastFaceSeenTime = Date.now();
        const faceCount = multiFaceLandmarks.length;

        if (faceCount >= 2) {
            statusDot.className = "dot";
            statusText.innerText = `Grup (${faceCount} Wajah)`;
        } else {
            statusDot.className = "dot";
            statusText.innerText = "Wajah Terkunci";
        }

        const aspectRatio = videoW / videoH;
        let targetX, targetY, targetCropW, targetCropH;

        if (faceCount === 1) {
            const landmarks = multiFaceLandmarks[0];
            let minX = 1.0, minY = 1.0, maxX = 0.0, maxY = 0.0;
            for (let pt of landmarks) {
                if (pt.x < minX) minX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y > maxY) maxY = pt.y;
            }
            const faceW = maxX - minX;
            const faceH = maxY - minY;
            const faceCenterX = minX + faceW / 2;
            const faceCenterY = minY + faceH / 2;

            targetCropH = Math.max(faceH * headPadding, 0.15);
            targetCropW = targetCropH * aspectRatio;

            if (targetCropW < faceW * headPadding) {
                targetCropW = faceW * headPadding;
                targetCropH = targetCropW / aspectRatio;
            }

            const minCropW = 1.0 / maxZoom;
            const minCropH = minCropW / aspectRatio;

            targetCropW = Math.min(1.0, Math.max(targetCropW, minCropW));
            targetCropH = Math.min(1.0, Math.max(targetCropH, minCropH));

            targetX = faceCenterX - targetCropW / 2;
            targetY = faceCenterY - targetCropH / 2;
        } else {
            let minX = 1.0, minY = 1.0, maxX = 0.0, maxY = 0.0;
            for (let landmarks of multiFaceLandmarks) {
                for (let pt of landmarks) {
                    if (pt.x < minX) minX = pt.x;
                    if (pt.y < minY) minY = pt.y;
                    if (pt.x > maxX) maxX = pt.x;
                    if (pt.y > maxY) maxY = pt.y;
                }
            }

            const groupW = maxX - minX;
            const groupH = maxY - minY;
            const groupPadding = Math.max(headPadding, 1.8);
            targetCropH = Math.max(groupH * groupPadding, 0.45);
            targetCropW = targetCropH * aspectRatio;

            if (targetCropW < groupW * groupPadding) {
                targetCropW = groupW * groupPadding;
                targetCropH = targetCropW / aspectRatio;
            }

            targetCropW = Math.min(1.0, Math.max(targetCropW, 0.35));
            targetCropH = Math.min(1.0, Math.max(targetCropH, 0.35 / aspectRatio));

            targetX = (minX + groupW / 2) - targetCropW / 2;
            targetY = (minY + groupH / 2) - targetCropH / 2;
        }

        targetX = Math.max(0, Math.min(1.0 - targetCropW, targetX));
        targetY = Math.max(0, Math.min(1.0 - targetCropH, targetY));
        targetCrop = { x: targetX, y: targetY, w: targetCropW, h: targetCropH };
    } else {
        if (!isAutoZoom || (Date.now() - lastFaceSeenTime > GRACE_PERIOD_MS)) {
            statusDot.className = "dot searching";
            statusText.innerText = isAutoZoom ? "Mencari Wajah..." : "AutoZoom Mati";
            targetCrop = { x: 0.0, y: 0.0, w: 1.0, h: 1.0 };
        } else {
            targetCrop = { ...currentCrop };
        }
    }

    const hasFace = !!(multiFaceLandmarks && multiFaceLandmarks.length > 0);
    handleVisionBuzzerTrigger(hasFace);

    // ==========================================
    // DETEKSI KANTUK (EYELID ASPECT RATIO / EAR)
    // ==========================================
    let isDrowsyCurrentFrame = false;
    const isAntiDrowsyEnabled = toggleDrowsy ? toggleDrowsy.checked : true;
    const maxDrowsyToleranceSec = sliderDrowsyTime ? parseFloat(sliderDrowsyTime.value) : 1.5;
    let avgEAR = 0.0;
    let currentClosingDurationSec = 0.0;
    let isEyesDrooping = false;

    if (multiFaceLandmarks && multiFaceLandmarks.length > 0 && isAntiDrowsyEnabled) {
        const landmarks = multiFaceLandmarks[0];

        // Hitung EAR Kelopak Mata Kiri & Kanan
        const leftEAR = calculateEAR(landmarks, LEFT_EYE_INDICES);
        const rightEAR = calculateEAR(landmarks, RIGHT_EYE_INDICES);
        avgEAR = (leftEAR + rightEAR) / 2.0;

        const targetThreshold = sliderDrowsyThreshold ? parseFloat(sliderDrowsyThreshold.value) : 0.22;

        // Mata Terpejam jika Rata-rata EAR Kelopak Mata < Ambang (Default 0.22)
        isEyesDrooping = (avgEAR < targetThreshold);

        if (isEyesDrooping) {
            if (eyeClosedStartTime === 0) {
                eyeClosedStartTime = Date.now();
            }
            currentClosingDurationSec = (Date.now() - eyeClosedStartTime) / 1000;
            if (currentClosingDurationSec >= maxDrowsyToleranceSec) {
                isDrowsyCurrentFrame = true;
            }
        } else {
            eyeClosedStartTime = 0;
            currentClosingDurationSec = 0;
        }
    } else {
        eyeClosedStartTime = 0;
        currentClosingDurationSec = 0;
    }

    // Update State & UI Badge Drowsy
    if (isDrowsyCurrentFrame) {
        isDrowsyAlertActive = true;
        if (drowsyModal) drowsyModal.style.display = "flex";

        if (drowsyBadge) {
            drowsyBadge.innerText = "🚨 MENGANTUK!";
            drowsyBadge.style.background = "#dc2626";
            drowsyBadge.style.color = "#fecaca";
        }

        const nowTs = Date.now();
        if (nowTs - lastAlarmBeepTime > 350) {
            lastAlarmBeepTime = nowTs;
            playDrowsyAlarmTone();
        }

        handleDrowsyTrigger(true);
    } else {
        if (!isDrowsyAlertActive) {
            if (drowsyBadge) {
                drowsyBadge.innerText = "MELEK";
                drowsyBadge.style.background = "#059669";
                drowsyBadge.style.color = "#a7f3d0";
            }
        }
    }

    // Event Tombol Verifikasi Bangun / Melek
    if (btnDismissDrowsy) {
        btnDismissDrowsy.onclick = () => {
            isDrowsyAlertActive = false;
            eyeClosedStartTime = 0;
            if (drowsyModal) drowsyModal.style.display = "none";
            if (drowsyBadge) {
                drowsyBadge.innerText = "VERIFIED MELEK ✅";
                drowsyBadge.style.background = "#059669";
                drowsyBadge.style.color = "#a7f3d0";
            }
            handleDrowsyTrigger(false);
            console.log("[DROWSY] Pengguna memverifikasi telah terjaga!");
        };
    }

    // Interpolasi LERP
    currentCrop.x = lerp(currentCrop.x, targetCrop.x, lerpFactor);
    currentCrop.y = lerp(currentCrop.y, targetCrop.y, lerpFactor);
    currentCrop.w = lerp(currentCrop.w, targetCrop.w, lerpFactor);
    currentCrop.h = lerp(currentCrop.h, targetCrop.h, lerpFactor);

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    const sx = currentCrop.x * videoW;
    const sy = currentCrop.y * videoH;
    const sw = currentCrop.w * videoW;
    const sh = currentCrop.h * videoH;

    // Gambar video dengan efek cermin (mirror video feed saja)
    canvasCtx.save();
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(
        videoElement,
        sx, sy, sw, sh,
        0, 0, canvasElement.width, canvasElement.height
    );
    canvasCtx.restore();

    // Gambar Titik Kelopak Mata (Eyelid Mesh) & Face Box
    if (multiFaceLandmarks && multiFaceLandmarks.length > 0) {
        for (let landmarks of multiFaceLandmarks) {
            let minX = 1.0, minY = 1.0, maxX = 0.0, maxY = 0.0;
            for (let pt of landmarks) {
                if (pt.x < minX) minX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y > maxY) maxY = pt.y;
            }

            const faceW = maxX - minX;
            const faceH = maxY - minY;
            const fx = 1.0 - (minX + faceW);
            const fy = minY;

            const boxCanvasX = ((fx - currentCrop.x) / currentCrop.w) * canvasElement.width;
            const boxCanvasY = ((fy - currentCrop.y) / currentCrop.h) * canvasElement.height;
            const boxCanvasW = (faceW / currentCrop.w) * canvasElement.width;
            const boxCanvasH = (faceH / currentCrop.h) * canvasElement.height;

            canvasCtx.save();
            canvasCtx.strokeStyle = isDrowsyAlertActive ? "#ef4444" : "#00f2fe";
            canvasCtx.shadowColor = isDrowsyAlertActive ? "#ef4444" : "#00f2fe";
            canvasCtx.lineWidth = 2.5;
            canvasCtx.shadowBlur = 10;
            canvasCtx.strokeRect(boxCanvasX, boxCanvasY, boxCanvasW, boxCanvasH);

            canvasCtx.fillStyle = isDrowsyAlertActive ? "rgba(239, 68, 68, 0.9)" : "rgba(0, 242, 254, 0.85)";
            canvasCtx.fillRect(boxCanvasX, Math.max(0, boxCanvasY - 24), isDrowsyAlertActive ? 145 : 120, 22);
            canvasCtx.fillStyle = "#0b0f19";
            canvasCtx.font = "bold 11px 'Plus Jakarta Sans', sans-serif";
            canvasCtx.fillText(isDrowsyAlertActive ? "⚠️ DROWSY ALERT!" : "EYELID TRACKED", boxCanvasX + 6, Math.max(15, boxCanvasY - 8));

            // Gambar Titik Kelopak Mata Atas dan Bawah secara presisi
            const eyePoints = [...LEFT_EYE_INDICES, ...RIGHT_EYE_INDICES];
            for (let idx of eyePoints) {
                const pt = landmarks[idx];
                const mirroredPtX = 1.0 - pt.x;
                const lX = ((mirroredPtX - currentCrop.x) / currentCrop.w) * canvasElement.width;
                const lY = ((pt.y - currentCrop.y) / currentCrop.h) * canvasElement.height;
                canvasCtx.beginPath();
                canvasCtx.arc(lX, lY, 2.5, 0, 2 * Math.PI);
                canvasCtx.fillStyle = isEyesDrooping ? "#f87171" : "#38bdf8";
                canvasCtx.fill();
            }

            canvasCtx.restore();
        }
    }

    // Live HUD Status Kelopak Mata di Layar Canvas
    if (isAntiDrowsyEnabled) {
        canvasCtx.save();
        const currentTargetThresh = sliderDrowsyThreshold ? parseFloat(sliderDrowsyThreshold.value).toFixed(2) : "0.22";

        if (eyeClosedStartTime > 0 && !isDrowsyAlertActive) {
            // Kotak Peringatan Menghitung Durasi Terpejam
            canvasCtx.fillStyle = "rgba(15, 23, 42, 0.9)";
            canvasCtx.fillRect(10, canvasElement.height - 54, 300, 44);
            canvasCtx.strokeStyle = "#eab308";
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeRect(10, canvasElement.height - 54, 300, 44);
            canvasCtx.fillStyle = "#fde047";
            canvasCtx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
            canvasCtx.fillText(`⏳ Mata Terpejam: ${currentClosingDurationSec.toFixed(1)}s / ${maxDrowsyToleranceSec.toFixed(1)}s`, 20, canvasElement.height - 32);
            canvasCtx.font = "11px 'Plus Jakarta Sans', sans-serif";
            canvasCtx.fillStyle = "#fef08a";
            canvasCtx.fillText(`Kelopak EAR: ${avgEAR.toFixed(3)} (Batas Merem: < ${currentTargetThresh})`, 20, canvasElement.height - 15);
        } else if (!isDrowsyAlertActive && multiFaceLandmarks && multiFaceLandmarks.length > 0) {
            // Status Normal Melek
            canvasCtx.fillStyle = "rgba(15, 23, 42, 0.8)";
            canvasCtx.fillRect(10, canvasElement.height - 42, 240, 32);
            canvasCtx.fillStyle = "#34d399";
            canvasCtx.font = "bold 11px 'Plus Jakarta Sans', sans-serif";
            canvasCtx.fillText(`👁️ Kelopak Mata: MELEK (${avgEAR.toFixed(3)})`, 18, canvasElement.height - 23);
            canvasCtx.fillStyle = "#94a3b8";
            canvasCtx.font = "10px 'Plus Jakarta Sans', sans-serif";
            canvasCtx.fillText(`Batas Terpejam (EAR): < ${currentTargetThresh}`, 18, canvasElement.height - 9);
        }
        canvasCtx.restore();
    }

    // Efek Laser Border Merah Darurat saat Mengantuk
    if (isDrowsyAlertActive) {
        canvasCtx.save();
        canvasCtx.strokeStyle = "rgba(239, 68, 68, 0.85)";
        canvasCtx.lineWidth = 10;
        canvasCtx.strokeRect(0, 0, canvasElement.width, canvasElement.height);

        // Banner Tengah Layar
        canvasCtx.fillStyle = "rgba(220, 38, 38, 0.85)";
        canvasCtx.fillRect(0, canvasElement.height / 2 - 35, canvasElement.width, 70);
        canvasCtx.fillStyle = "#ffffff";
        canvasCtx.font = "bold 24px 'Plus Jakarta Sans', sans-serif";
        canvasCtx.textAlign = "center";
        canvasCtx.fillText("⚠️ AWAS! ANDA TERDETEKSI MENGANTUK!", canvasElement.width / 2, canvasElement.height / 2 + 8);
        canvasCtx.restore();
    }
}

btnRestart.onclick = () => {
    currentCrop = { x: 0.0, y: 0.0, w: 1.0, h: 1.0 };
};

// Start Camera (Native Browser getUserMedia - Kompatibel di file://, localhost, dan HTTPS)
async function startCameraFeed() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        videoElement.srcObject = stream;
        
        videoElement.onloadedmetadata = () => {
            videoElement.play();
            
            // Loop frame deteksi AI
            async function loopFrame() {
                if (videoElement.readyState >= 2) {
                    await faceMesh.send({ image: videoElement });
                }
                requestAnimationFrame(loopFrame);
            }
            requestAnimationFrame(loopFrame);
        };
    } catch (err) {
        console.error("Camera Error:", err);
        alert("Gagal membuka kamera: " + err.message + "\n\nPastikan kamera tidak sedang dipakai aplikasi lain (VS Code, Zoom, Python, dll).");
    }
}

startCameraFeed();
