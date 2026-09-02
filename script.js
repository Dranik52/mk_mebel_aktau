'use strict';

const WHATSAPP_NUMBER = '77016006609';
const SUBMIT_COOLDOWN_MS = 5000;
let lastSubmitAt = 0;

function sanitizeText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
    .replace(/[<>`"'\\]/g, '')
    .trim()
    .slice(0, maxLen);
}

function sanitizePhone(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  if (digits.length !== 11 || !digits.startsWith('7')) return '';
  return '+7 ' + digits.slice(1, 4) + ' ' + digits.slice(4, 7) + ' ' + digits.slice(7, 9) + ' ' +
    digits.slice(9, 11);
}

function isSafeExternalUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return parsed.href.startsWith('https://wa.me/') ||
      parsed.href.startsWith('https://www.instagram.com/');
  } catch (_) {
    return false;
  }
}

function openExternal(url) {
  if (!isSafeExternalUrl(url)) return;
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (win) win.opener = null;
}

function showFieldError(id, message) {
  const input = document.getElementById(id);
  const error = document.getElementById(id + '-error');
  if (!input || !error) return;
  input.classList.toggle('invalid', Boolean(message));
  error.textContent = message || '';
  error.classList.toggle('show', Boolean(message));
}

function clearFormErrors() {
  ['fname', 'fphone', 'fmsg'].forEach(function(id) {
    showFieldError(id, '');
  });
}

const langBtns = document.querySelectorAll('.lang-switch button');
let currentLang = 'ru';

function applyLang(lang) {
  if (lang !== 'ru' && lang !== 'kz') return;
  currentLang = lang;
  document.documentElement.lang = lang === 'ru' ? 'ru' : 'kk';
  document.querySelectorAll('.i18n').forEach(function(el) {
    const val = el.dataset[lang];
    if (val !== undefined) el.textContent = val;
  });
  document.querySelectorAll('[data-ru-ph]').forEach(function(el) {
    const key = lang === 'ru' ? 'ruPh' : 'kzPh';
    if (el.dataset[key]) el.setAttribute('placeholder', el.dataset[key]);
  });
  langBtns.forEach(function(b) {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
}
langBtns.forEach(function(b) {
  b.addEventListener('click', function() {
    applyLang(b.dataset.lang);
  });
});

// ---------- PORTFOLIO SLIDESHOW ----------
// Файлы берутся из images/examples/. Имена задаются в data-images у каждого .p-tile.
document.querySelectorAll('.p-tile').forEach(function(tile) {
  const swatch = tile.querySelector('.swatch');
  const prev = tile.querySelector('.p-arrow.prev');
  const next = tile.querySelector('.p-arrow.next');

  const images = (tile.dataset.images || '')
    .split(',')
    .map(function(name) {
      return name.trim();
    })
    .filter(Boolean);

  if (!images.length) return;

  let current = 0;

  function showImage(index) {
    current = (index + images.length) % images.length;
    const src = 'images/examples/' + images[current];
    swatch.style.backgroundImage = 'url("' + src.replace(/"/g, '\\"') + '")';
  }

  showImage(0);

  prev.addEventListener('click', function(e) {
    e.stopPropagation();
    showImage(current - 1);
  });

  next.addEventListener('click', function(e) {
    e.stopPropagation();
    showImage(current + 1);
  });

  tile.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowLeft') showImage(current - 1);
    if (e.key === 'ArrowRight') showImage(current + 1);
  });

  tile.setAttribute('tabindex', '0');
});


// ---------- KITCHEN COST CALCULATOR ----------
(function() {
  const calc = document.getElementById('kitchenCalculator');
  if (!calc) return;

  const state = {
    step: 1,
    shape: 'straight',
    material: 'standard',
    price: 165000
  };

  const shapeNames = {
    ru: {
      straight: 'Прямая',
      corner: 'Угловая',
      p: 'П-образная',
      parallel: 'Параллельная'
    },
    kz: {
      straight: 'Түзу',
      corner: 'Бұрыштық',
      p: 'П-тәрізді',
      parallel: 'Параллель'
    }
  };
  const materialNames = {
    ru: {
      economy: 'Эконом',
      standard: 'Стандарт',
      lux: 'Люкс'
    },
    kz: {
      economy: 'Эконом',
      standard: 'Стандарт',
      lux: 'Люкс'
    }
  };
  const shapeCoef = {
    straight: 1,
    corner: 1.10,
    p: 1.18,
    parallel: 1.12
  };
  const shapeParts = {
    straight: 1,
    corner: 2,
    p: 3,
    parallel: 2
  };

  const steps = calc.querySelectorAll('[data-calc-step]');
  const progress = calc.querySelectorAll('[data-calc-progress]');
  const a = document.getElementById('calcA');
  const b = document.getElementById('calcB');
  const c = document.getElementById('calcC');
  const bWrap = document.getElementById('calcBWrap');
  const cWrap = document.getElementById('calcCWrap');
  const hint = document.getElementById('calcDimensionHint');
  const error = document.getElementById('calcDimensionError');

  function t(ru, kz) {
    return currentLang === 'ru' ? ru : kz;
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('ru-RU').format(Math.round(value)) + ' ₸';
  }

  function updateDimensions() {
    const parts = shapeParts[state.shape];
    bWrap.style.display = parts >= 2 ? '' : 'none';
    cWrap.style.display = parts >= 3 ? '' : 'none';

    const messages = {
      straight: ['Для прямой кухни укажите только длину A.',
        'Түзу асхана үшін тек A ұзындығын көрсетіңіз.'
      ],
      corner: ['Для угловой кухни итоговая длина = A + B.',
        'Бұрыштық асханада жалпы ұзындық = A + B.'
      ],
      p: ['Для П-образной кухни итоговая длина = A + B + C.',
        'П-тәрізді асханада жалпы ұзындық = A + B + C.'
      ],
      parallel: ['Для параллельной кухни учитываем две линии: A + B.',
        'Параллель асханада екі сызық есептеледі: A + B.'
      ]
    };
    hint.textContent = t(messages[state.shape][0], messages[state.shape][1]);
  }

  function setStep(step) {
    state.step = step;
    steps.forEach(function(el) {
      el.classList.toggle('active', Number(el.dataset.calcStep) === step);
    });
    progress.forEach(function(el) {
      el.classList.toggle('active', Number(el.dataset.calcProgress) <= step);
    });
    if (step === 2) updateDimensions();
    calc.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  function validNumber(input) {
    const n = Number(input.value);
    return Number.isFinite(n) && n >= 0.5 && n <= 10;
  }

  function getMeters() {
    const values = [a, b, c];
    const needed = shapeParts[state.shape];
    for (let i = 0; i < needed; i++) {
      if (!validNumber(values[i])) return null;
    }
    return values.slice(0, needed).reduce(function(sum, input) {
      return sum + Number(input.value);
    }, 0);
  }

  function renderResult() {
    const meters = getMeters();
    if (meters === null) return;
    const coef = shapeCoef[state.shape];
    const total = meters * state.price * coef;
    const rounded = Math.round(total / 100) * 100;

    document.getElementById('calcTotal').textContent = formatMoney(rounded);
    document.getElementById('calcTotalNote').textContent =
      t('Примерно для ' + meters.toFixed(1) + ' пог. м с учётом формы.',
        'Пішінді ескере отырып, ' + meters.toFixed(1) + ' пог. м үшін шамамен.');

    document.getElementById('calcShapeValue').textContent = shapeNames[currentLang][state
    .shape];
    document.getElementById('calcMetersValue').textContent = meters.toFixed(1) + ' м';
    document.getElementById('calcMaterialValue').textContent = materialNames[currentLang][state
      .material
    ];
    document.getElementById('calcRateValue').textContent = formatMoney(state.price) + ' / м';
    document.getElementById('calcCoefValue').textContent = '× ' + coef.toFixed(2);

    const compare = document.getElementById('calcCompare');
    const packages = [
      ['Эконом', 135000],
      ['Стандарт', 165000],
      ['Люкс', 210000]
    ];
    const max = Math.max.apply(null, packages.map(function(x) {
      return x[1];
    }));
    compare.innerHTML =
      '<div class="calc-compare-title">' + t('Ориентир по материалам',
        'Материал бойынша бағдар') + '</div>' +
      packages.map(function(item) {
        const width = Math.round(item[1] / max * 100);
        const label = materialNames[currentLang][item[0].toLowerCase() === 'эконом' ?
          'economy' : item[0].toLowerCase() === 'стандарт' ? 'standard' : 'lux'
        ];
        return '<div class="calc-bar-row"><span>' + label +
          '</span><div class="calc-bar"><i style="width:' + width + '%"></i></div><b>' +
          formatMoney(item[1]) + '</b></div>';
      }).join('');

    setStep(4);
  }

  calc.querySelectorAll('.calc-shape').forEach(function(button) {
    button.addEventListener('click', function() {
      calc.querySelectorAll('.calc-shape').forEach(function(el) {
        el.classList.remove('selected');
      });
      button.classList.add('selected');
      state.shape = button.dataset.shape;
      updateDimensions();
    });
  });

  calc.querySelectorAll('.calc-material').forEach(function(button) {
    button.addEventListener('click', function() {
      calc.querySelectorAll('.calc-material').forEach(function(el) {
        el.classList.remove('selected');
      });
      button.classList.add('selected');
      state.material = button.dataset.material;
      state.price = Number(button.dataset.price);
    });
  });

  calc.querySelectorAll('[data-calc-next]').forEach(function(button) {
    button.addEventListener('click', function() {
      if (Number(button.dataset.calcNext) === 2) {
        error.textContent = '';
        if (getMeters() === null) {
          error.textContent = t('Введите корректные размеры от 0,5 до 10 м.',
            '0,5–10 м аралығындағы дұрыс өлшемдерді енгізіңіз.');
          return;
        }
      }
      setStep(Math.min(4, Number(button.dataset.calcNext) + 1));
    });
  });

  calc.querySelectorAll('[data-calc-prev]').forEach(function(button) {
    button.addEventListener('click', function() {
      setStep(Number(button.dataset.calcPrev) - 1);
    });
  });

  calc.querySelector('[data-calc-finish]').addEventListener('click', function() {
    error.textContent = '';
    if (getMeters() === null) {
      error.textContent = t('Введите корректные размеры от 0,5 до 10 м.',
        '0,5–10 м аралығындағы дұрыс өлшемдерді енгізіңіз.');
      setStep(2);
      return;
    }
    renderResult();
  });

  calc.querySelector('[data-calc-restart]').addEventListener('click', function() {
    state.step = 1;
    state.shape = 'straight';
    state.material = 'standard';
    state.price = 165000;
    calc.querySelectorAll('.calc-shape').forEach(function(el) {
      el.classList.toggle('selected', el.dataset.shape === state.shape);
    });
    calc.querySelectorAll('.calc-material').forEach(function(el) {
      el.classList.toggle('selected', el.dataset.material === state.material);
    });
    a.value = '3.2';
    b.value = '2.0';
    c.value = '1.6';
    error.textContent = '';
    setStep(1);
  });

  document.getElementById('calcWhatsApp').addEventListener('click', function() {
    const meters = getMeters();
    if (meters === null) return;
    const total = Math.round(meters * state.price * shapeCoef[state.shape] / 100) * 100;
    const message = [
      t('Расчёт кухни с сайта MK Mebel', 'MK Mebel сайтынан асхана есебі'),
      t('Форма: ', 'Пішін: ') + shapeNames[currentLang][state.shape],
      t('Размер: ', 'Өлшем: ') + meters.toFixed(1) + ' м',
      t('Материал: ', 'Материал: ') + materialNames[currentLang][state.material],
      t('Ориентировочная стоимость: ', 'Болжамды құны: ') + formatMoney(total)
    ].join('\n');
    openExternal('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(
      message));
  });

  updateDimensions();

  // Re-render dynamic calculator labels when the site language changes.
  const originalApplyLang = window.applyLang;
  // applyLang is defined in this script scope, so the event below is handled by a tiny observer.
  document.querySelectorAll('.lang-switch button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setTimeout(function() {
        updateDimensions();
        if (state.step === 4) renderResult();
      }, 0);
    });
  });
})();

document.querySelectorAll('.faq-item').forEach(function(item) {
  const q = item.querySelector('.faq-q');
  if (!q) return;
  q.addEventListener('click', function() {
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(function(openItem) {
      if (openItem !== item) openItem.classList.remove('open');
    });
    item.classList.toggle('open', !wasOpen);
  });
});

const io = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, {
  threshold: 0.12
});
document.querySelectorAll('.reveal').forEach(function(el) {
  io.observe(el);
});

const header = document.querySelector('header');
window.addEventListener('scroll', function() {
  header.style.boxShadow = window.scrollY > 12 ? '0 8px 24px -18px rgba(0,0,0,0.4)' : 'none';
}, {
  passive: true
});

document.getElementById('leadForm').addEventListener('submit', function(e) {
  e.preventDefault();
  clearFormErrors();

  if (document.getElementById('fwebsite').value.trim()) return;

  const now = Date.now();
  if (now - lastSubmitAt < SUBMIT_COOLDOWN_MS) return;
  lastSubmitAt = now;

  const name = sanitizeText(document.getElementById('fname').value, 80);
  const phoneRaw = document.getElementById('fphone').value;
  const phone = sanitizePhone(phoneRaw);
  const msg = sanitizeText(document.getElementById('fmsg').value, 500);

  const errName = currentLang === 'ru' ? 'Введите имя (2–80 символов)' :
    'Атыңызды енгізіңіз (2–80 таңба)';
  const errPhone = currentLang === 'ru' ? 'Введите номер в формате +7 7XX XXX XX XX' :
    'Нөмірді +7 7XX XXX XX XX форматында енгізіңіз';

  let hasError = false;
  if (name.length < 2) {
    showFieldError('fname', errName);
    hasError = true;
  }
  if (!phone) {
    showFieldError('fphone', errPhone);
    hasError = true;
  }
  if (hasError) return;

  document.getElementById('fname').value = name;
  document.getElementById('fphone').value = phone;

  const labelName = currentLang === 'ru' ? 'Имя' : 'Аты';
  const labelPhone = 'Телефон';
  const labelReq = currentLang === 'ru' ? 'Заявка с сайта' : 'Сайттан өтінім';
  const lines = [labelReq, labelName + ': ' + name, labelPhone + ': ' + phone];
  if (msg) lines.push(msg);

  const url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(lines.join(
    '\n'));
  openExternal(url);
});

document.getElementById('fphone').addEventListener('input', function(e) {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
  if (!digits.length) {
    e.target.value = '';
    return;
  }
  let formatted = '+7';
  if (digits.length > 1) formatted += ' ' + digits.slice(1, 4);
  if (digits.length > 4) formatted += ' ' + digits.slice(4, 7);
  if (digits.length > 7) formatted += ' ' + digits.slice(7, 9);
  if (digits.length > 9) formatted += ' ' + digits.slice(9, 11);
  e.target.value = formatted;
});

const mobileMenu = document.getElementById('mobileMenu');
const burgerBtn = document.querySelector('.burger');
const closeBtn = document.getElementById('mobileClose');

function openMenu() {
  mobileMenu.classList.add('open');
  document.body.classList.add('menu-open');
}

function closeMenu() {
  mobileMenu.classList.remove('open');
  document.body.classList.remove('menu-open');
}
burgerBtn.addEventListener('click', openMenu);
closeBtn.addEventListener('click', closeMenu);
mobileMenu.querySelectorAll('a').forEach(function(a) {
  a.addEventListener('click', closeMenu);
});
window.addEventListener('resize', function() {
  if (window.innerWidth > 900) closeMenu();
});

if (location.hash && !/^#[a-z][\w-]*$/i.test(location.hash)) {
  history.replaceState(null, '', location.pathname);
}