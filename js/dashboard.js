document.addEventListener("DOMContentLoaded", () => {
    renderPastMeetings();
});

function renderPastMeetings() {
    const container = document.getElementById('meetings-container') || document.querySelector('.dashboard-content');
    if (!container) return;

    let history = [];
    try {
        history = JSON.parse(localStorage.getItem('platypusMeetings')) || [];
    } catch (e) {
        history = [];
    }

    container.innerHTML = '';

    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg class="cassette-icon" width="24" height="17" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin:0 auto 16px;"><rect x="0.6" y="0.6" width="18.8" height="12.8" rx="2.6" stroke="currentColor" stroke-width="1.1"/><circle class="reel reel-a" cx="6" cy="7" r="2.1" stroke="currentColor" stroke-width="1.1"/><circle class="reel reel-b" cx="14" cy="7" r="2.1" stroke="currentColor" stroke-width="1.1"/><path d="M6 5.6V7L7.1 6.3" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 5.6V7L15.1 6.3" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <p>No past meetings yet — start one to see it here.</p>
            </div>
        `;
        return;
    }

    history.slice().reverse().forEach(item => {
        const card = document.createElement('div');
        card.className = 'meeting-card';

        card.innerHTML = `
            <div class="meeting-card-top">
                <div>
                    <span class="meeting-card-date">${escapeHtml(item.date)}</span>
                    <h3 class="meeting-card-title">${escapeHtml(item.title)}</h3>
                </div>

                <button onclick="deleteMeeting(${item.id})" class="delete-btn" aria-label="Delete meeting">
                    🗑️
                </button>
            </div>

            <div class="summary-block">
                <strong>Extractive summary</strong>
                <p>${escapeHtml(item.summary)}</p>
            </div>

            <details>
                <summary>View full transcript</summary>
                <p>${escapeHtml(item.transcript)}</p>
            </details>
        `;
        container.appendChild(card);
    });
}

window.deleteMeeting = function(meetingId) {
    const isConfirmed = confirm("Delete this meeting record?");
    if (!isConfirmed) return;

    let history = JSON.parse(localStorage.getItem('platypusMeetings')) || [];
    history = history.filter(meeting => meeting.id !== meetingId);
    localStorage.setItem('platypusMeetings', JSON.stringify(history));
    
    renderPastMeetings();
};

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
