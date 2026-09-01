// js/meeting.js

const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get('room') || 'general';
const PASSCODE = urlParams.get('pass') || '';

const socket = io('http://localhost:3000');
const myPeer = new Peer(); // Cloud fallback handles multi-connection automatically

const videoGrid = document.getElementById('video-grid');
let localStream = null;
let recognition = null;
let fullTranscript = '';
let isTranscribing = false;
let isAudioMuted = false;
let isVideoMuted = false;
const peers = {};

async function startMeeting() {
    const roomIdEl = document.getElementById('room-id-display');
    if (roomIdEl) roomIdEl.innerText = ROOM_ID;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        const myVideo = document.createElement('video');
        myVideo.muted = true;
        addVideoStream(myVideo, localStream, "You");

        myPeer.on('call', call => {
            call.answer(localStream);
            const video = document.createElement('video');
            call.on('stream', remoteStream => {
                addVideoStream(video, remoteStream, "Participant");
            });
        });

        socket.on('user-connected', userId => {
            connectToNewUser(userId, localStream);
        });

        socket.on('user-disconnected', userId => {
            if (peers[userId]) peers[userId].close();
        });

        socket.on('error-msg', msg => {
            alert(msg);
            window.location.href = 'index.html';
        });

    } catch (err) {
        console.error("Camera/Mic Error:", err);
        alert("Camera & Microphone access is required.");
    }
}

myPeer.on('open', id => {
    socket.emit('join-room', { roomId: ROOM_ID, passcode: PASSCODE, userId: id });
});

function connectToNewUser(userId, stream) {
    const call = myPeer.call(userId, stream);
    const video = document.createElement('video');
    call.on('stream', remoteStream => {
        addVideoStream(video, remoteStream, "Participant");
    });
    call.on('close', () => {
        if (video.parentElement) video.parentElement.remove();
    });
    peers[userId] = call;
}

function addVideoStream(video, stream, userName) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => video.play());

    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-box';

    const nameLabel = document.createElement('div');
    nameLabel.className = 'user-label';
    nameLabel.innerText = userName;

    videoWrapper.appendChild(video);
    videoWrapper.appendChild(nameLabel);
    videoGrid.appendChild(videoWrapper);
}

// Media Toggles
function toggleMic() {
    if (!localStream) return;
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks()[0].enabled = !isAudioMuted;
    const btn = document.getElementById('mic-btn');
    btn.style.backgroundColor = isAudioMuted ? '#ef4444' : '';
    btn.innerHTML = isAudioMuted ? '🔇 Muted' : '🎙️ Mic On';
}

function toggleCamera() {
    if (!localStream) return;
    isVideoMuted = !isVideoMuted;
    localStream.getVideoTracks()[0].enabled = !isVideoMuted;
    const btn = document.getElementById('cam-btn');
    btn.style.backgroundColor = isVideoMuted ? '#ef4444' : '';
    btn.innerHTML = isVideoMuted ? '🚫 Cam Off' : '📷 Cam On';
}

// Transcription
function startTranscription() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Please use Chrome for Live Transcription.");

    if (isTranscribing) {
        stopTranscription();
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    const transcriptBox = document.getElementById('transcript-box');
    document.getElementById('recording-indicator').style.display = 'block';
    
    const btn = document.getElementById('transcribe-btn');
    btn.innerHTML = '⏹️ Stop Notes';
    btn.style.background = '#ef4444';
    btn.style.color = 'white';

    if (transcriptBox.innerHTML.includes("Start AI Notes")) {
        transcriptBox.innerHTML = '';
    }

    let interimElement = document.createElement('div');
    interimElement.style.color = '#94a3b8';
    transcriptBox.appendChild(interimElement);

    recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                const sentence = event.results[i][0].transcript.trim();
                fullTranscript += sentence + '. ';

                const line = document.createElement('div');
                line.className = 'transcript-line';
                line.innerHTML = `<strong>You:</strong> ${sentence}.`;
                transcriptBox.insertBefore(line, interimElement);
                transcriptBox.scrollTop = transcriptBox.scrollHeight;
            } else {
                interim += event.results[i][0].transcript;
            }
        }
        interimElement.innerHTML = `<em>${interim}</em>`;
    };

    recognition.onend = () => {
        if (isTranscribing) {
            try { recognition.start(); } catch(e) {}
        }
    };

    recognition.start();
    isTranscribing = true;
}

function stopTranscription() {
    isTranscribing = false;
    if (recognition) recognition.stop();
    document.getElementById('recording-indicator').style.display = 'none';
    const btn = document.getElementById('transcribe-btn');
    btn.innerHTML = '📝 Start AI Notes';
    btn.style.background = 'var(--accent-yellow)';
    btn.style.color = '#000';
}

// Summary Algorithm
function generateSummary(text) {
    if (!text || text.trim().length === 0) return "No notes or speech recorded during this meeting.";
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    if (sentences.length <= 3) return text.trim();

    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const wordFreq = {};
    const stopWords = new Set(["the", "is", "in", "and", "to", "a", "of", "it", "that", "this", "for", "on", "with", "as", "we", "you", "i"]);
    
    words.forEach(w => {
        if (!stopWords.has(w)) wordFreq[w] = (wordFreq[w] || 0) + 1;
    });

    const scored = sentences.map((sentence, index) => {
        let score = 0;
        const sWords = sentence.toLowerCase().match(/\b\w+\b/g) || [];
        sWords.forEach(w => { if (wordFreq[w]) score += wordFreq[w]; });
        return { sentence, score, index };
    });

    return scored.sort((a, b) => b.score - a.score)
                 .slice(0, 3)
                 .sort((a, b) => a.index - b.index)
                 .map(s => s.sentence.trim())
                 .join(' ');
}

// End Call & Persistence
let hasSavedThisSession = false;

function saveMeetingData() {
    if (hasSavedThisSession) return; // avoid double-save (leave click + beforeunload)
    hasSavedThisSession = true;

    const summary = generateSummary(fullTranscript);
    const meetingRecord = {
        id: Date.now(),
        title: `Room: ${ROOM_ID}`,
        date: new Date().toLocaleDateString() + " • " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        summary: summary,
        transcript: fullTranscript.trim() || "No transcript recorded — live transcription wasn't started during this meeting."
    };

    let history = [];
    try {
        history = JSON.parse(localStorage.getItem('platypusMeetings')) || [];
    } catch (e) {
        history = [];
    }
    history.push(meetingRecord);
    localStorage.setItem('platypusMeetings', JSON.stringify(history));
}

function leaveMeeting() {
    stopTranscription();
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
    }

    saveMeetingData();
    window.location.href = 'dashboard.html';
}

document.addEventListener('DOMContentLoaded', () => {
    startMeeting();
    document.getElementById('mic-btn').addEventListener('click', toggleMic);
    document.getElementById('cam-btn').addEventListener('click', toggleCamera);
    document.getElementById('transcribe-btn').addEventListener('click', startTranscription);
    document.getElementById('leave-btn').addEventListener('click', leaveMeeting);
});

// Saves even if the tab is closed or refreshed instead of using the Leave button
window.addEventListener('beforeunload', () => {
    saveMeetingData();
});
