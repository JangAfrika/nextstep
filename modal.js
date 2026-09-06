/* ========== modal.js — Create/Edit/Detail modal + smart schedule check ========== */

const Modal = {
  state: { mode: 'create', editingId: null },

  init() {
    document.getElementById('modal-close').addEventListener('click', () => this.close());
    document.getElementById('modal-backdrop').addEventListener('click', e => {
      if (e.target.id === 'modal-backdrop') this.close();
    });
    document.getElementById('event-form').addEventListener('submit', e => this.submit(e));
    document.getElementById('delete-btn').addEventListener('click', () => this.confirmDelete());
    document.getElementById('edit-btn').addEventListener('click', () => this.switchToEdit());
    document.getElementById('settings-form').addEventListener('submit', e => App.saveSettings(e));
  },

  populateCategories(categories) {
    const select = document.getElementById('field-category');
    select.innerHTML = categories.map(c => `<option value="${App.escape(c)}">${App.escape(c)}</option>`).join('');
  },

  openCreate(prefill) {
    this.state.mode = 'create';
    this.state.editingId = null;
    document.getElementById('modal-title').textContent = 'Create schedule';
    document.getElementById('event-form').reset();
    document.getElementById('field-date').value = (prefill && prefill.date) || App.dateKey(App.state.currentDate || new Date());
    document.getElementById('field-duration-value').value = 30;
    document.getElementById('field-duration-unit').value = 'Minutes';
    document.getElementById('field-period').value = 'Any Time';
    document.getElementById('field-reminder').value = App.state.settings.DefaultReminderMinutes || '30';
    TimePicker.setValue('field-start-time', (prefill && prefill.startTime) || '09:00');
    this.clearBanner();
    this.clearSuggestions();
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('event-form').classList.remove('hidden');
    document.getElementById('form-footer').classList.remove('hidden');
    document.getElementById('detail-footer').classList.add('hidden');
    this.open();
  },

  openDetail(id) {
    App.showLoading('Loading...');
    google.script.run
      .withSuccessHandler(res => {
        App.hideLoading();
        if (!res.success) return App.toast(res.error, true);
        this.state.mode = 'detail';
        this.state.editingId = id;
        const e = res.data;
        document.getElementById('modal-title').textContent = e.title;
        document.getElementById('detail-view').innerHTML = `
          <div class="form-group"><label>Description</label><div>${e.description ? App.escape(e.description) : '<span style="color:var(--text-muted)">None</span>'}</div></div>
          <div class="form-row">
            <div class="form-group"><label>Category</label><div>${App.escape(e.category)}</div></div>
            <div class="form-group"><label>Date</label><div>${e.startDate}</div></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Start</label><div>${e.startTime}</div></div>
            <div class="form-group"><label>End</label><div>${e.endTime}</div></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Duration</label><div>${e.durationMinutes} minutes</div></div>
            <div class="form-group"><label>Reminder</label><div>${e.reminderMinutes ? e.reminderMinutes + ' min before' : 'None'}</div></div>
          </div>`;
        document.getElementById('detail-view').classList.remove('hidden');
        document.getElementById('event-form').classList.add('hidden');
        document.getElementById('form-footer').classList.add('hidden');
        document.getElementById('detail-footer').classList.remove('hidden');
        this._detailCache = e;
        this.open();
      })
      .withFailureHandler(err => App.onError(err))
      .getEventById(id);
  },

  switchToEdit() {
    const e = this._detailCache;
    this.state.mode = 'edit';
    document.getElementById('modal-title').textContent = 'Edit schedule';
    document.getElementById('field-title').value = e.title;
    document.getElementById('field-description').value = e.description || '';
    const categorySelect = document.getElementById('field-category');
    if (![...categorySelect.options].some(o => o.value === e.category)) {
      // Google Calendar-sourced events carry a category that isn't in your
      // Sheet's category list — add it so the dropdown reflects reality
      // instead of silently showing whatever option happens to be first.
      const opt = document.createElement('option');
      opt.value = e.category;
      opt.textContent = e.category;
      categorySelect.appendChild(opt);
    }
    categorySelect.value = e.category;
    document.getElementById('field-date').value = e.startDate;
    TimePicker.setValue('field-start-time', e.startTime);
    document.getElementById('field-duration-value').value = e.durationMinutes;
    document.getElementById('field-duration-unit').value = 'Minutes';
    document.getElementById('field-period').value = 'Any Time';
    document.getElementById('field-reminder').value = e.reminderMinutes || '';
    this.clearBanner();
    this.clearSuggestions();
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('event-form').classList.remove('hidden');
    document.getElementById('form-footer').classList.remove('hidden');
    document.getElementById('detail-footer').classList.add('hidden');
  },

  confirmDelete() {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    App.showLoading('Deleting...');
    google.script.run
      .withSuccessHandler(res => {
        App.hideLoading();
        if (!res.success) return App.toast(res.error, true);
        this.close();
        App.toast('Schedule deleted.');
        this.refreshCurrentView();
      })
      .withFailureHandler(err => App.onError(err))
      .deleteEvent(this.state.editingId);
  },

  open() { document.getElementById('modal-backdrop').classList.add('open'); },
  close() { document.getElementById('modal-backdrop').classList.remove('open'); },

  clearBanner() { document.getElementById('form-banner').innerHTML = ''; },
  clearSuggestions() { document.getElementById('suggestions-wrap').innerHTML = ''; },

  showError(message) {
    document.getElementById('form-banner').innerHTML = `<div class="banner banner-error">${App.escape(message)}</div>`;
  },

  submit(e) {
    e.preventDefault();
    this.clearBanner();
    this.clearSuggestions();
    const form = e.target;
    const input = {
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      category: form.category.value,
      date: form.date.value,
      startTime: form.startTime.value,
      durationValue: form.durationValue.value,
      durationUnit: form.durationUnit.value,
      preferredPeriod: form.period.value,
      reminderMinutes: form.reminder.value ? Number(form.reminder.value) : ''
    };

    if (!input.title) return this.showError('Event title is required.');
    if (!input.date) return this.showError('Date is required.');

    App.showLoading(this.state.mode === 'edit' ? 'Saving...' : 'Creating schedule...');
    const handler = res => {
      App.hideLoading();
      if (!res.success) return this.showError(res.error);
      if (!res.data.saved) {
        this.showError(`This time conflicts with "${res.data.conflict.title}" from ${res.data.conflict.startTime} to ${res.data.conflict.endTime}.`);
        this.renderSuggestions(res.data.suggestions, input);
        return;
      }
      this.close();
      App.toast(this.state.mode === 'edit' ? 'Schedule updated.' : 'Schedule created successfully.');
      this.refreshCurrentView();
    };

    if (this.state.mode === 'edit') {
      google.script.run.withSuccessHandler(handler).withFailureHandler(err => { App.hideLoading(); App.onError(err); })
        .updateEvent(this.state.editingId, input);
    } else {
      google.script.run.withSuccessHandler(handler).withFailureHandler(err => { App.hideLoading(); App.onError(err); })
        .createEvent(input);
    }
  },

  renderSuggestions(suggestionsByPeriod, input) {
    const wrap = document.getElementById('suggestions-wrap');
    const periods = Object.keys(suggestionsByPeriod || {});
    if (!periods.length) {
      wrap.innerHTML = `<div class="banner banner-error">No availability found for the requested duration.</div>`;
      return;
    }
    const anyStartTimes = periods.some(p => suggestionsByPeriod[p].startTimes.length);
    if (!anyStartTimes) {
      wrap.innerHTML = `<div class="banner banner-error">No continuous period is available for that duration in the selected time range.</div>`;
      return;
    }
    wrap.innerHTML = `<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">Available times</div>` +
      periods.map(p => {
        const times = suggestionsByPeriod[p].startTimes;
        if (!times.length) return '';
        return `<div class="suggestion-group">
          <h4>${p}</h4>
          <div class="chip-row">${times.map(t => `<button type="button" class="chip" data-time="${t}">${t}</button>`).join('')}</div>
        </div>`;
      }).join('');
    wrap.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        TimePicker.setValue('field-start-time', chip.getAttribute('data-time'));
        this.clearBanner();
        this.clearSuggestions();
        App.toast('Start time set to ' + chip.getAttribute('data-time') + '. Click Save to confirm.');
      });
    });
  },

  refreshCurrentView() {
    if (App.state.section === 'dashboard') App.renderDashboard();
    else if (App.state.section === 'calendar') Calendar.render();
    else if (App.state.section === 'availability') Availability.render();
  }
};

document.addEventListener('DOMContentLoaded', () => Modal.init());
