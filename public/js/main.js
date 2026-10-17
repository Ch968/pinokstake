// ---------- Mobile menu ----------
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => navMenu.classList.toggle('active'));
    navMenu.querySelectorAll('a').forEach(a =>
        a.addEventListener('click', () => navMenu.classList.remove('active'))
    );
}

// ---------- Helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);

function showMessage(el, msg) {
    el.innerHTML = `<p>${esc(msg)}</p>`;
}

async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Request failed');
    return res.json();
}

// ---------- Renderers ----------
function renderBrands(el, brands) {
    if (!brands.length) return showMessage(el, 'No brands available yet.');
    el.innerHTML = brands.map(b => `
        <div class="brand-card">
            ${b.logo
                ? `<img src="${esc(b.logo)}" alt="${esc(b.name)} logo" class="brand-logo">`
                : '<div class="brand-icon">🏢</div>'}
            <h3>${esc(b.name)}</h3>
            ${b.category ? `<p class="brand-category">${esc(b.category)}</p>` : ''}
            <p>${esc(b.description || '')}</p>
            ${b.website ? `<a href="${esc(b.website)}" target="_blank" rel="noopener" class="brand-link">Visit Website &rarr;</a>` : ''}
        </div>
    `).join('');
}

function renderNews(el, articles) {
    if (!articles.length) return showMessage(el, 'No news yet.');
    el.innerHTML = articles.map(a => `
        <div class="article-card">
            ${a.featured_image ? `<img src="${esc(a.featured_image)}" alt="" class="article-image">` : ''}
            <h3>${esc(a.title)}</h3>
            <p class="meta">${new Date(a.published_at).toLocaleDateString()} &middot; ${esc(a.category || '')}</p>
            <p>${esc(a.excerpt || (a.content || '').slice(0, 150))}...</p>
            <a href="/article/${encodeURIComponent(a.slug)}" class="brand-link">Read More &rarr;</a>
        </div>
    `).join('');
}

function renderLeaders(el, leaders) {
    if (!leaders.length) return showMessage(el, 'No leadership profiles yet.');
    el.innerHTML = leaders.map(l => {
        const initials = String(l.name || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        return `
            <div class="leader-card">
                <div class="leader-photo">
                    ${l.photo ? `<img src="${esc(l.photo)}" alt="${esc(l.name)}">` : esc(initials)}
                </div>
                <h3>${esc(l.name)}</h3>
                <p class="position">${esc(l.position)}</p>
                ${l.brand ? `<p class="brand">${esc(l.brand)}</p>` : ''}
                ${l.bio ? `<p>${esc(l.bio)}</p>` : ''}
            </div>
        `;
    }).join('');
}

function renderOpportunities(el, opps) {
    if (!opps.length) return showMessage(el, 'No opportunities available at this time.');
    el.innerHTML = opps.map(o => `
        <div class="opportunity-card">
            <h3>${esc(o.title)}</h3>
            ${o.category ? `<p class="category">${esc(o.category)}</p>` : ''}
            <p>${esc(o.description || '')}</p>
            <a href="/opportunities" class="brand-link">Learn More &rarr;</a>
        </div>
    `).join('');
}

// ---------- Load each section if it exists on the page ----------
async function load(id, url, render, limit) {
    const el = $(id);
    if (!el) return;
    try {
        const data = await getJSON(url);
        render(el, limit ? data.slice(0, limit) : data);
    } catch (err) {
        showMessage(el, 'Could not load content right now.');
    }
}

load('brandsGrid', '/api/brands', renderBrands);
load('brandsList', '/api/brands', renderBrands);
load('newsGrid', '/api/articles?limit=3', renderNews);
load('leadershipGrid', '/api/leaders', renderLeaders, 3);
load('leadershipList', '/api/leaders', renderLeaders);
load('opportunitiesGrid', '/api/opportunities', renderOpportunities, 3);

// ---------- Smooth scroll for in-page links ----------
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});