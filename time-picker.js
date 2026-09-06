/* ========== time-picker.js — explicit Hour / Minute / AM-PM control ==========
 * Replaces native <input type="time">, which renders inconsistently across
 * browsers/devices (12h vs 24h) and is exactly what caused "1:00" to be
 * saved as 01:00 (AM) when the user meant 13:00 (PM). Every picker forces
 * an explicit AM/PM choice, then writes a plain 24-hour "HH:mm" string into
 * a hidden <input> so nothing else in the app needs to change.
 *
 * Markup contract, repeated per field:
 *   <div class="time-picker" data-target="field-id">
 *     <select class="tp-hour"></select><span class="tp-colon">:</span>
 *     <select class="tp-minute"></select>
 *     <div class="tp-ampm">
 *       <button type="button" class="tp-ampm-btn active" data-val="AM">AM</button>
 *       <button type="button" class="tp-ampm-btn" data-val="PM">PM</button>
 *     </div>
 *   </div>
 *   <input type="hidden" name="..." id="field-id">
 */

const TimePicker = {
  init() {
    document.querySelectorAll('.time-picker').forEach(tp => this.build(tp));
  },

  build(tp) {
    const hiddenId = tp.getAttribute('data-target');
    const hidden = document.getElementById(hiddenId);
    if (!hidden) return;
    const hourSelect = tp.querySelector('.tp-hour');
    const minuteSelect = tp.querySelector('.tp-minute');
    const ampmBtns = tp.querySelectorAll('.tp-ampm-btn');

    if (!hourSelect.options.length) {
      for (let h = 1; h <= 12; h++) {
        const opt = document.createElement('option');
        opt.value = String(h);
        opt.textContent = String(h);
        hourSelect.appendChild(opt);
      }
    }
    if (!minuteSelect.options.length) {
      for (let m = 0; m < 60; m++) {
        const opt = document.createElement('option');
        opt.value = String(m).padStart(2, '0');
        opt.textContent = String(m).padStart(2, '0');
        minuteSelect.appendChild(opt);
      }
    }

    const sync = () => {
      const h12 = Number(hourSelect.value);
      const m = Number(minuteSelect.value);
      const activeBtn = tp.querySelector('.tp-ampm-btn.active') || ampmBtns[0];
      const period = activeBtn.getAttribute('data-val');
      let h24 = h12 % 12;
      if (period === 'PM') h24 += 12;
      hidden.value = String(h24).padStart(2, '0') + ':' + String(m).padStart(2, '0');
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    };

    hourSelect.addEventListener('change', sync);
    minuteSelect.addEventListener('change', sync);
    ampmBtns.forEach(btn => btn.addEventListener('click', () => {
      ampmBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sync();
    }));

    this.setValue(hiddenId, hidden.value || '09:00');
  },

  /** Programmatically set a picker's value. hhmm is 24-hour "HH:mm" (e.g. "13:00"). */
  setValue(hiddenId, hhmm) {
    const hidden = document.getElementById(hiddenId);
    if (!hidden) return;
    const tp = document.querySelector('.time-picker[data-target="' + hiddenId + '"]');
    const clean = (hhmm && /^\d{1,2}:\d{2}$/.test(hhmm)) ? hhmm : '09:00';
    const [hStr, mStr] = clean.split(':');
    const h24 = Math.min(23, Number(hStr));
    const m = Math.min(59, Number(mStr));
    const period = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;

    if (tp) {
      const hourSelect = tp.querySelector('.tp-hour');
      const minuteSelect = tp.querySelector('.tp-minute');
      if (hourSelect) hourSelect.value = String(h12);
      if (minuteSelect) minuteSelect.value = String(m).padStart(2, '0');
      tp.querySelectorAll('.tp-ampm-btn').forEach(b =>
        b.classList.toggle('active', b.getAttribute('data-val') === period));
    }
    hidden.value = String(h24).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
};

document.addEventListener('DOMContentLoaded', () => TimePicker.init());
