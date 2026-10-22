/* Общий скрипт для обоих вариантов сайта: контакты, шапка, меню, появление блоков, форма заявки. */
(function () {
  'use strict';
  var C = window.CONTACTS || {};
  var L = window.LEADS || { demo: true };

  /* ---------- контакты из config.js ---------- */
  var links = { telegram: C.telegram, whatsapp: C.whatsapp, phone: C.phone && 'tel:' + C.phone, email: C.email && 'mailto:' + C.email };
  document.querySelectorAll('[data-href]').forEach(function (a) { var v = links[a.getAttribute('data-href')]; if (v) a.href = v; });
  document.querySelectorAll('[data-text]').forEach(function (el) { var v = C[el.getAttribute('data-text')]; if (v) el.textContent = v; });
  var ld = document.getElementById('ld-org');
  if (ld) {
    try {
      var d = JSON.parse(ld.textContent);
      if (C.phone) d.telephone = C.phone;
      if (C.email) d.email = C.email;
      d.sameAs = [C.telegram, C.whatsapp].filter(Boolean);
      ld.textContent = JSON.stringify(d);
    } catch (e) {}
  }

  /* ---------- шапка: тёмный фон после 120 px прокрутки (без обработчика scroll) ---------- */
  var h = document.querySelector('.hdr');
  var mark = document.createElement('div');
  mark.setAttribute('aria-hidden', 'true');
  mark.style.cssText = 'position:absolute;top:120px;left:0;width:1px;height:1px;pointer-events:none';
  document.body.prepend(mark);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { h.classList.toggle('fix', !e[0].isIntersecting); }).observe(mark);
  } else {
    h.classList.add('fix');
  }

  /* ---------- логотип: плавно наверх ---------- */
  document.querySelectorAll('[data-top]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      if (h.classList.contains('open')) setMenu(false);
    });
  });

  /* ---------- бургер-меню ---------- */
  var b = h.querySelector('.burger'), menu = document.getElementById('menu');
  function setMenu(open) {
    h.classList.toggle('open', open);
    b.setAttribute('aria-expanded', open);
    b.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  }
  if (b && menu) {
    b.addEventListener('click', function () { setMenu(!h.classList.contains('open')); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    window.matchMedia('(min-width:1180px)').addEventListener('change', function () { setMenu(false); });
  }

  /* ---------- буквы AIM уходят за здания при прокрутке ----------
     Работает во всех браузерах. Цикл крутится только пока первый экран виден. */
  var hero = document.querySelector('.hero'), word = document.querySelector('.bigword'), stage = document.querySelector('.stage');
  if (hero && word && stage && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var heroOn = false, lastY = -1;
    var sink = function () {
      if (!heroOn) return;
      var y = window.pageYOffset;
      if (y !== lastY) {
        lastY = y;
        var base = Math.min(hero.offsetHeight * 0.75, stage.offsetHeight * 0.5);
        var k = Math.min(1, Math.max(0, y / base));
        word.style.transform = 'translate3d(0,' + (k * 60).toFixed(2) + '%,0) scale(' + (1 - k * 0.06).toFixed(4) + ')';
      }
      requestAnimationFrame(sink);
    };
    new IntersectionObserver(function (e) {
      var was = heroOn;
      heroOn = e[0].isIntersecting;
      if (heroOn && !was) requestAnimationFrame(sink);
    }).observe(hero);
  }

  /* ---------- появление блоков при прокрутке ---------- */
  var rv = document.querySelectorAll('[data-reveal]');
  if (rv.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('rv-on');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    rv.forEach(function (el) { io.observe(el); });
  }

  /* ---------- форма заявки ---------- */
  var form = document.getElementById('lead-form');
  if (!form) return;
  var el = form.elements; // form.name занят свойством формы, поэтому поля берём через elements
  var box = form.closest('.lf');
  var btn = form.querySelector('[type=submit]');
  var tg = form.querySelector('[data-tg]');

  form.addEventListener('change', function (e) {
    if (e.target.name === 'method' && tg) {
      tg.hidden = e.target.value !== 'telegram';
      if (tg.hidden) check('telegram');
    }
    var f = e.target.closest('.f');
    if (f && f.classList.contains('bad')) check(f.getAttribute('data-f'));
  });
  form.addEventListener('input', function (e) {
    var f = e.target.closest('.f');
    if (f && f.classList.contains('bad')) check(f.getAttribute('data-f'));
  });
  // проверка телефона и ника сразу после ввода, а не только при отправке
  form.addEventListener('focusout', function (e) {
    if (e.target === el.phone && el.phone.value.trim()) {
      if (!rules.phone()) el.phone.value = prettyPhone(el.phone.value);
      check('phone');
    }
    if (el.telegram && e.target === el.telegram && el.telegram.value.trim()) check('telegram');
  });

  /* Телефон: российский номер +7 / 8 и 10 цифр с настоящим кодом (3xx, 4xx, 8xx, 9xx)
     или иностранный, если начинается с + и другого кода страны. */
  function phoneError(v) {
    var d = v.replace(/\D/g, '');
    if (!d) return 'Укажите телефон, чтобы мы могли связаться';
    if (/[^\d\s()+\-.]/.test(v)) return 'В номере могут быть только цифры, пробелы, скобки и дефисы';
    if (/^\s*\+/.test(v) && !/^\s*\+\s*7/.test(v)) {
      return d.length >= 10 && d.length <= 15 ? '' : 'Проверьте номер: не хватает цифр';
    }
    if (d.length === 10) d = '7' + d;
    if (d.length !== 11 || (d[0] !== '7' && d[0] !== '8')) return 'Номер в формате +7 (900) 000-00-00: 11 цифр';
    if (!/^[3489]/.test(d.slice(1))) return 'Проверьте код: российские номера начинаются с +7 3, 4, 8 или 9';
    if (/^(\d)\1+$/.test(d.slice(4))) return 'Похоже, номер набран не до конца';
    return '';
  }
  function prettyPhone(v) {
    var d = v.replace(/\D/g, '');
    if (/^\s*\+/.test(v) && !/^\s*\+\s*7/.test(v)) return v.trim();
    if (d.length === 10) d = '7' + d;
    return '+7 (' + d.slice(1, 4) + ') ' + d.slice(4, 7) + '-' + d.slice(7, 9) + '-' + d.slice(9, 11);
  }
  /* Ник Telegram: @nick или ссылка t.me/nick; 5-32 символа, латиница, цифры и _, начинается с буквы. */
  function tgNick(v) {
    v = v.trim();
    var m = v.match(/^(?:https?:\/\/)?(?:t|telegram)\.me\/([^\/?#\s]+)/i);
    return m ? m[1] : v.replace(/^@/, '');
  }
  function tgError(v) {
    var n = tgNick(v);
    if (/^[+\d][\d\s()\-]*$/.test(n)) return 'Здесь нужен ник, а не номер: телефон уже указан выше';
    if (/[а-яё]/i.test(n)) return 'Ник в Telegram пишется латиницей';
    if (n.length < 5 || n.length > 32) return 'Ник в Telegram: от 5 до 32 символов';
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(n)) return 'Ник начинается с буквы, дальше только буквы, цифры и _';
    if (/_$/.test(n) || /__/.test(n)) return 'Проверьте ник: такого в Telegram не бывает';
    return '';
  }

  var rules = {
    name: function () {
      var v = el['name'].value.trim();
      return v.length < 2 ? 'Напишите, как к вам обращаться' : '';
    },
    phone: function () {
      return phoneError(el.phone.value);
    },
    telegram: function () {
      if (!tg || tg.hidden || !el.telegram.value.trim()) return '';
      return tgError(el.telegram.value);
    },
    work: function () {
      return form.querySelector('[name=work]:checked') ? '' : 'Выберите хотя бы один вариант';
    },
    consent: function () {
      return el.consent.checked ? '' : 'Нужно согласие, иначе мы не сможем принять заявку';
    }
  };

  function check(key) {
    var f = form.querySelector('[data-f="' + key + '"]');
    if (!f || !rules[key]) return true;
    var msg = rules[key]();
    var err = f.querySelector('.err');
    f.classList.toggle('bad', !!msg);
    f.querySelectorAll('input,textarea').forEach(function (i) {
      if (msg) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
    });
    if (err) err.textContent = msg;
    return !msg;
  }

  function values(name) {
    return [].map.call(form.querySelectorAll('[name="' + name + '"]:checked'), function (i) { return i.value; });
  }

  function show(state, demo) {
    box.setAttribute('data-state', state);
    var panel = box.querySelector('[data-panel="' + state + '"]');
    if (panel) {
      var note = panel.querySelector('[data-demo]');
      if (note) note.hidden = !demo;
      panel.focus();
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = Object.keys(rules).filter(function (k) { return !check(k); });
    if (bad.length) {
      var first = form.querySelector('[data-f="' + bad[0] + '"] input, [data-f="' + bad[0] + '"] textarea');
      if (first) first.focus();
      return;
    }
    if (el.company && el.company.value) { show('ok', false); return; } // ловушка для спам-ботов

    var data = {
      name: el['name'].value.trim(),
      phone: el.phone.value.trim(),
      method: values('method')[0] || '',
      telegram: el.telegram && tg && !tg.hidden && el.telegram.value.trim() ? '@' + tgNick(el.telegram.value) : '',
      work: values('work'),
      object: values('object')[0] || '',
      area: values('area')[0] || '',
      docs: values('docs')[0] || '',
      start: values('start')[0] || '',
      address: el.address.value.trim(),
      comment: el.comment.value.trim(),
      page: location.pathname
    };

    btn.disabled = true;
    box.setAttribute('aria-busy', 'true');
    var done = function (ok) {
      btn.disabled = false;
      box.removeAttribute('aria-busy');
      if (ok) { form.reset(); if (tg) tg.hidden = true; }
      show(ok ? 'ok' : 'fail', !!L.demo);
    };

    if (L.demo) { setTimeout(function () { done(true); }, 700); return; }
    fetch(L.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { done(r.ok); })
      .catch(function () { done(false); });
  });

  box.querySelectorAll('[data-again]').forEach(function (a) {
    a.addEventListener('click', function () { box.setAttribute('data-state', 'form'); form.querySelector('input').focus(); });
  });
})();
