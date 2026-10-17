// News ticker: scrolling banner of active announcements
(async function () {
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    let items = [];
    try {
        const res = await fetch('/api/announcements');
        if (!res.ok) return;
        items = await res.json();
    } catch (err) {
        return;
    }
    if (!items.length) return;

    const labels = { urgent: 'URGENT', update: 'UPDATE', notice: 'NOTICE' };

    const oneSet = items.map(a => `
        <span class="ticker-item">
            <span class="ticker-tag ${a.announcement_type === 'urgent' ? 'is-urgent' : ''}">${labels[a.announcement_type] || 'NEWS'}</span>
            ${esc(a.title)}${a.content ? ' — ' + esc(a.content) : ''}
        </span>
        <span class="ticker-sep">•</span>
    `).join('');

    const bar = document.createElement('div');
    bar.className = 'ticker';
    bar.setAttribute('aria-label', 'Latest announcements');
    bar.innerHTML = `
        <div class="ticker-track">
            <div class="ticker-content">${oneSet}</div>
            <div class="ticker-content" aria-hidden="true">${oneSet}</div>
        </div>
    `;

    bar.querySelector('.ticker-track').style.animationDuration = Math.max(20, items.length * 8) + 's';

    const nav = document.querySelector('nav');
    if (nav) nav.insertAdjacentElement('afterend', bar);
    else document.body.prepend(bar);
})();