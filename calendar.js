/* ========== calendar.js — month/week/day grid rendering + drag & drop ========== */

const Calendar = {
  DAY_START_HOUR: 6,
  DAY_END_HOUR: 22,

  init() {
    document.querySelectorAll('.view-switch button[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        App.state.calendarView = btn.getAttribute('data-view');
        this.render();
      });
    });
    document.getElementById('cal-prev').addEventListener('click', () => this.shift(-1));
    document.getElementById('cal-next').addEventListener('click', () => this.shift(1));
    document.getElementById('cal-today').addEventListener('click', () => { App.state.currentDate = new Date(); this.render(); });
  },

  shift(direction) {
    const d = new Date(App.state.currentDate);
    const view = App.state.calendarView;
    if (view === 'month') d.setMonth(d.getMonth() + direction);
    else if (view === 'week') d.setDate(d.getDate() + direction * 7);
    else d.setDate(d.getDate() + direction);
    App.state.currentDate = d;
    this.render();
  },

  render() {
    document.querySelectorAll('.view-switch button[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === App.state.calendarView);
    });
    const view = App.state.calendarView;
    document.getElementById('month-view').classList.toggle('hidden', view !== 'month');
    document.getElementById('grid-view').classList.toggle('hidden', view === 'month');

    if (view === 'month') this.renderMonth();
    else if (view === 'week') this.renderGrid(this.weekDates(App.state.currentDate));
    else this.renderGrid([new Date(App.state.currentDate)]);
  },

  weekDates(base) {
    const d = new Date(base);
    const dow = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => { const nd = new Date(d); nd.setDate(d.getDate() + i); return nd; });
  },

  // ---------- Month view ----------
  renderMonth() {
    const base = App.state.currentDate;
    document.getElementById('cal-period-label').textContent = base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const firstOfMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - startOffset);

    const days = Array.from({ length: 42 }, (_, i) => { const nd = new Date(gridStart); nd.setDate(gridStart.getDate() + i); return nd; });
    const rangeStart = App.dateKey(days[0]);
    const rangeEnd = App.dateKey(days[days.length - 1]);

    App.showLoading('Loading calendar...');
    google.script.run
      .withSuccessHandler(res => {
        App.hideLoading();
        if (!res.success) return App.toast(res.error, true);
        const byDay = this.groupByDay(res.data);
        const container = document.getElementById('month-days');
        container.innerHTML = days.map(d => {
          const key = App.dateKey(d);
          const isOther = d.getMonth() !== base.getMonth();
          const isToday = key === App.state.today;
          const dayEvents = (byDay[key] || []).sort((a, b) => a.startTime.localeCompare(b.startTime));
          const shown = dayEvents.slice(0, 3);
          const more = dayEvents.length - shown.length;
          return `<div class="month-cell ${isOther ? 'other-month' : ''} ${isToday ? 'today' : ''}" data-date="${key}">
            <div class="day-num">${d.getDate()}</div>
            ${shown.map(e => `<div class="month-event" data-id="${e.id}" style="background:${App.colorFor(e.category)}">${e.startTime} ${App.escape(e.title)}</div>`).join('')}
            ${more > 0 ? `<div class="month-more">+${more} more</div>` : ''}
          </div>`;
        }).join('');

        container.querySelectorAll('.month-event').forEach(el => {
          el.addEventListener('click', ev => { ev.stopPropagation(); Modal.openDetail(el.getAttribute('data-id')); });
        });
        container.querySelectorAll('.month-cell').forEach(el => {
          el.addEventListener('click', () => {
            App.state.currentDate = new Date(el.getAttribute('data-date') + 'T00:00:00');
            App.state.calendarView = 'day';
            this.render();
          });
        });
      })
      .withFailureHandler(err => App.onError(err))
      .getEvents(rangeStart, rangeEnd);
  },

  groupByDay(events) {
    const map = {};
    events.forEach(e => { (map[e.startDate] = map[e.startDate] || []).push(e); });
    return map;
  },

  // ---------- Week / Day grid ----------
  renderGrid(dates) {
    const label = dates.length === 1
      ? dates[0].toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
      : `${dates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${dates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    document.getElementById('cal-period-label').textContent = label;

    const timeCol = document.getElementById('time-col');
    timeCol.innerHTML = `<div style="height:40px"></div>` + Array.from(
      { length: this.DAY_END_HOUR - this.DAY_START_HOUR + 1 }, (_, i) => {
        const h = this.DAY_START_HOUR + i;
        return `<div class="hour-label">${String(h).padStart(2, '0')}:00</div>`;
      }).join('');

    const dayColumns = document.getElementById('day-columns');
    dayColumns.style.gridTemplateColumns = `repeat(${dates.length}, 1fr)`;
    dayColumns.innerHTML = dates.map(d => {
      const key = App.dateKey(d);
      const isToday = key === App.state.today;
      const hourRows = Array.from({ length: this.DAY_END_HOUR - this.DAY_START_HOUR }, () => `<div class="hour-row"></div>`).join('');
      return `<div class="day-col" data-date="${key}">
        <div class="day-col-header ${isToday ? 'today' : ''}">
          <div class="dow">${d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
          <div class="num">${d.getDate()}</div>
        </div>
        <div class="day-col-body" style="position:relative">${hourRows}</div>
      </div>`;
    }).join('');

    const rangeStart = App.dateKey(dates[0]);
    const rangeEnd = App.dateKey(dates[dates.length - 1]);
    App.showLoading('Loading calendar...');
    google.script.run
      .withSuccessHandler(res => {
        App.hideLoading();
        if (!res.success) return App.toast(res.error, true);
        this.placeEvents(res.data);
        this.placeNowIndicator(dates);
      })
      .withFailureHandler(err => App.onError(err))
      .getEvents(rangeStart, rangeEnd);
  },

  hourHeight() { return 48; },

  placeEvents(events) {
    const byDay = this.groupByDay(events);
    document.querySelectorAll('.day-col').forEach(col => {
      const key = col.getAttribute('data-date');
      const body = col.querySelector('.day-col-body');
      (byDay[key] || []).forEach(e => {
        const startMin = this.timeToMinutes(e.startTime);
        const endMin = this.timeToMinutes(e.endTime);
        const gridStartMin = this.DAY_START_HOUR * 60;
        const top = ((startMin - gridStartMin) / 60) * this.hourHeight();
        const height = Math.max(20, ((endMin - startMin) / 60) * this.hourHeight());
        const el = document.createElement('div');
        el.className = 'time-event';
        el.setAttribute('data-id', e.id);
        el.setAttribute('draggable', 'true');
        el.style.top = top + 'px';
        el.style.height = height + 'px';
        el.style.background = App.colorFor(e.category);
        el.innerHTML = `<div class="t-title">${App.escape(e.title)}</div><div class="t-time">${e.startTime}–${e.endTime}</div>`;
        el.addEventListener('click', ev => { ev.stopPropagation(); Modal.openDetail(e.id); });
        this.bindDrag(el, e);
        body.appendChild(el);
      });
    });
  },

  timeToMinutes(hm) { const [h, m] = hm.split(':').map(Number); return h * 60 + m; },

  placeNowIndicator(dates) {
    const now = new Date();
    const key = App.dateKey(now);
    const col = document.querySelector(`.day-col[data-date="${key}"] .day-col-body`);
    if (!col) return;
    const min = now.getHours() * 60 + now.getMinutes();
    const gridStartMin = this.DAY_START_HOUR * 60;
    if (min < gridStartMin || min > this.DAY_END_HOUR * 60) return;
    const top = ((min - gridStartMin) / 60) * this.hourHeight();
    const line = document.createElement('div');
    line.className = 'now-indicator';
    line.style.top = top + 'px';
    col.appendChild(line);
  },

  // ---------- Drag & drop (mouse-based, no HTML5 DnD quirks) ----------
  bindDrag(el, event) {
    let dragging = false, startY = 0, originalTop = 0, col = el.parentElement;

    el.addEventListener('mousedown', e => {
      dragging = true; startY = e.clientY; originalTop = parseFloat(el.style.top);
      el.style.zIndex = 10; e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const delta = e.clientY - startY;
      el.style.top = (originalTop + delta) + 'px';
    });

    document.addEventListener('mouseup', e => {
      if (!dragging) return;
      dragging = false;
      el.style.zIndex = '';

      // snap to nearest 15-minute increment
      const rawTop = parseFloat(el.style.top);
      const minutesFromGridStart = (rawTop / this.hourHeight()) * 60;
      const snapped = Math.round(minutesFromGridStart / 15) * 15;
      const gridStartMin = this.DAY_START_HOUR * 60;
      const newStartMin = gridStartMin + snapped;
      const newDate = col.parentElement.getAttribute('data-date');
      const newTime = this.minutesToHM(newStartMin);

      App.showLoading('Saving...');
      google.script.run
        .withSuccessHandler(res => {
          App.hideLoading();
          if (!res.success) { App.toast(res.error, true); this.render(); return; }
          if (!res.data.moved) { App.toast(res.data.message, true); this.render(); return; }
          App.toast('Schedule updated.');
          this.render();
        })
        .withFailureHandler(err => { App.onError(err); this.render(); })
        .moveEvent(event.id, newDate, newTime);
    });
  },

  minutesToHM(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
};

document.addEventListener('DOMContentLoaded', () => Calendar.init());
