/* ========== availability.js — Availability page ========== */

const Availability = {
  init() {
    document.getElementById('avail-date').addEventListener('change', () => this.render());
    document.getElementById('avail-min-duration').addEventListener('change', () => this.render());
  },

  render() {
    const dateInput = document.getElementById('avail-date');
    if (!dateInput.value) dateInput.value = App.state.today;
    const dateStr = dateInput.value;
    const minDuration = Number(document.getElementById('avail-min-duration').value) || 0;

    document.getElementById('avail-heading').textContent = new Date(dateStr + 'T00:00:00')
      .toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    App.showLoading('Loading calendar...');
    google.script.run
      .withSuccessHandler(res => {
        App.hideLoading();
        if (!res.success) return App.toast(res.error, true);
        const list = document.getElementById('avail-list');
        if (!res.data.segments.length) {
          list.innerHTML = `<div class="empty-state">No data for this day.</div>`;
          return;
        }
        list.innerHTML = res.data.segments.map(s => `
          <div class="avail-segment ${s.type}">
            <span class="seg-label">${s.start} – ${s.end}</span>
            <span>${s.type === 'free' ? 'AVAILABLE' : App.escape(s.title || 'Busy')}</span>
          </div>`).join('');
      })
      .withFailureHandler(err => App.onError(err))
      .getAvailability(dateStr, minDuration);
  }
};

document.addEventListener('DOMContentLoaded', () => Availability.init());
