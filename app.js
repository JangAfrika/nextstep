/* ========== app.js — core state, navigation, dashboard, settings, search ========== */

const App = {
  state: {
    section: 'dashboard',        // dashboard | calendar | availability | settings
    calendarView: 'month',       // month | week | day
    currentDate: new Date(),
    events: [],                  // cache for the currently loaded range
    settings: {},
    categories: [],
    today: null
  },

  CATEGORY_COLORS: {
    work: 'var(--cat-work)', meeting: 'var(--cat-meeting)', teaching: 'var(--cat-teaching)',
    personal: 'var(--cat-personal)', appointment: 'var(--cat-appointment)', other: 'var(--cat-other)'
  },

  colorFor(category) {
    return this.CATEGORY_COLORS[(category || 'other').toLowerCase()] || this.CATEGORY_COLORS.other;
  },

  init() {
    this.bindNav();
    this.bindTopbar();
    this.showLoading('Loading calendar...');
    google.script.run
      .withSuccessHandler(res => this.onBootstrap(res))
      .withFailureHandler(err => this.onError(err))
      .getBootstrapData();
  },

  onBootstrap(res) {
    this.hideLoading();
    if (!res.success) return this.toast(res.error, true);
    this.state.settings = res.data.settings;
    this.state.categories = res.data.categories;
    this.state.today = res.data.today;
    this.state.currentDate = new Date();
    Modal.populateCategories(this.state.categories);
    this.renderSidebarCategories();
    this.goToSection('dashboard');
  },

  onError(err) {
    this.hideLoading();
    this.toast((err && err.message) || 'Something went wrong.', true);
  },

  // ---------- Navigation ----------
  bindNav() {
    document.querySelectorAll('.nav-item[data-section]').forEach(el => {
      el.addEventListener('click', () => {
        this.goToSection(el.getAttribute('data-section'));
        document.getElementById('sidebar').classList.remove('open');
      });
    });
  },

  goToSection(section) {
    this.state.section = section;
    document.querySelectorAll('.nav-item[data-section]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-section') === section);
    });
    ['dashboard', 'calendar', 'availability', 'settings'].forEach(s => {
      document.getElementById('view-' + s).classList.toggle('hidden', s !== section);
    });
    if (section === 'dashboard') this.renderDashboard();
    if (section === 'calendar') Calendar.render();
    if (section === 'availability') Availability.render();
    if (section === 'settings') this.renderSettings();
  },

  renderSidebarCategories() {
    const wrap = document.getElementById('sidebar-categories');
    wrap.innerHTML = this.state.categories.map(c =>
      `<div class="category-item"><span class="category-dot" style="background:${this.colorFor(c)}"></span>${this.escape(c)}</div>`
    ).join('');
  },

  // ---------- Topbar ----------
  bindTopbar() {
    document.getElementById('menu-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
    document.getElementById('create-btn').addEventListener('click', () => Modal.openCreate());
    document.getElementById('fab-btn').addEventListener('click', () => Modal.openCreate());

    const searchInput = document.getElementById('search-input');
    let debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      const q = searchInput.value.trim();
      debounce = setTimeout(() => this.runSearch(q), 250);
    });
  },

  runSearch(query) {
    const resultsEl = document.getElementById('search-results');
    if (!query) { resultsEl.classList.add('hidden'); return; }
    google.script.run
      .withSuccessHandler(res => {
        if (!res.success) return;
        resultsEl.classList.remove('hidden');
        if (!res.data.length) {
          resultsEl.innerHTML = `<div class="empty-state">No matching events.</div>`;
          return;
        }
        resultsEl.innerHTML = res.data.map(e => `
          <div class="agenda-item" style="cursor:pointer" data-id="${e.id}">
            <div class="agenda-dot" style="background:${this.colorFor(e.category)}"></div>
            <div>
              <div class="agenda-title">${this.escape(e.title)}</div>
              <div class="agenda-sub">${e.startDate} • ${e.startTime}–${e.endTime}</div>
            </div>
          </div>`).join('');
        resultsEl.querySelectorAll('[data-id]').forEach(el => {
          el.addEventListener('click', () => { resultsEl.classList.add('hidden'); Modal.openDetail(el.getAttribute('data-id')); });
        });
      })
      .withFailureHandler(err => this.onError(err))
      .searchEvents(query);
  },

  // ---------- Dashboard ----------
  renderDashboard() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    document.getElementById('dashboard-greeting').textContent = `${greeting}, Ebrima`;
    document.getElementById('dashboard-date').textContent = this.formatLongDate(now);

    const todayKey = this.dateKey(now);
    this.showLoading('Loading calendar...');
    google.script.run
      .withSuccessHandler(res => {
        this.hideLoading();
        if (!res.success) return this.toast(res.error, true);
        const events = res.data.sort((a, b) => a.startTime.localeCompare(b.startTime));
        document.getElementById('stat-today-count').textContent = events.length;
        const next = events.find(e => e.startTime >= this.hm(now));
        document.getElementById('stat-next-event').textContent = next ? `${next.title} @ ${next.startTime}` : 'None';

        const agenda = document.getElementById('dashboard-agenda');
        agenda.innerHTML = events.length ? events.map(e => `
          <div class="agenda-item" style="cursor:pointer" data-id="${e.id}">
            <div class="agenda-time">${e.startTime}</div>
            <div class="agenda-dot" style="background:${this.colorFor(e.category)}"></div>
            <div>
              <div class="agenda-title">${this.escape(e.title)}</div>
              <div class="agenda-sub">${e.category} • ${e.startTime}–${e.endTime}</div>
            </div>
          </div>`).join('') : `<div class="empty-state">Nothing scheduled today.</div>`;
        agenda.querySelectorAll('[data-id]').forEach(el => {
          el.addEventListener('click', () => Modal.openDetail(el.getAttribute('data-id')));
        });
      })
      .withFailureHandler(err => this.onError(err))
      .getEvents(todayKey, todayKey);

    google.script.run
      .withSuccessHandler(res => {
        if (!res.success) return;
        const free = res.data.segments.filter(s => s.type === 'free').reduce((a, s) => a + s.minutes, 0);
        document.getElementById('stat-available').textContent = this.formatMinutes(free);
      })
      .withFailureHandler(() => {})
      .getAvailability(todayKey, 0);
  },

  // ---------- Settings ----------
  renderSettings() {
    const s = this.state.settings;
    const form = document.getElementById('settings-form');
    form.NotificationEmail.value = s.NotificationEmail || '';
    TimePicker.setValue('field-morning-start', s.MorningStart || '06:00');
    TimePicker.setValue('field-morning-end', s.MorningEnd || '12:00');
    TimePicker.setValue('field-afternoon-start', s.AfternoonStart || '12:00');
    TimePicker.setValue('field-afternoon-end', s.AfternoonEnd || '17:00');
    TimePicker.setValue('field-evening-start', s.EveningStart || '17:00');
    TimePicker.setValue('field-evening-end', s.EveningEnd || '22:00');
    form.DefaultReminderMinutes.value = s.DefaultReminderMinutes || '30';
  },

  saveSettings(e) {
    e.preventDefault();
    const form = document.getElementById('settings-form');
    const payload = {
      NotificationEmail: form.NotificationEmail.value.trim(),
      MorningStart: form.MorningStart.value,
      MorningEnd: form.MorningEnd.value,
      AfternoonStart: form.AfternoonStart.value,
      AfternoonEnd: form.AfternoonEnd.value,
      EveningStart: form.EveningStart.value,
      EveningEnd: form.EveningEnd.value,
      DefaultReminderMinutes: form.DefaultReminderMinutes.value
    };
    this.showLoading('Saving settings...');
    google.script.run
      .withSuccessHandler(res => {
        this.hideLoading();
        if (!res.success) return this.toast(res.error, true);
        this.state.settings = res.data;
        this.toast('Settings saved.');
      })
      .withFailureHandler(err => this.onError(err))
      .updateSettings(payload);
  },

  // ---------- Helpers ----------
  dateKey(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  hm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); },
  formatLongDate(d) { return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); },
  formatMinutes(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  },
  escape(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  showLoading(msg) {
    const el = document.getElementById('loading-overlay');
    el.querySelector('span').textContent = msg || 'Loading...';
    el.classList.remove('hidden');
  },
  hideLoading() { document.getElementById('loading-overlay').classList.add('hidden'); },
  toast(message, isError) {
    const wrap = document.getElementById('toast-wrap');
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' error' : '');
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
