/** 
 * @fileoverview Main JavaScript file for the British Gas Smart Metering
 * Apprenticeship quiz app. Handles quiz selection, question rendering,
 * scoring, and results display.
 * @author Chris Thodesen <christopherjames.thodesen@britishgas.co.uk>
*/

// ── State ─────────────────────────────────────────────────────────────────────
let quizRegistry = [];
let currentQuiz = null;
let quiz = [];
let current = 0;
let score = 0;
let answered = false;
let wrongAnswers = [];
let testMode = false;
let selectedAnswers = [];
const PASS_THRESHOLD = 80;
const LIVE_QUIZ_BASE = "https://christhodesen.github.io/bg-quiz-app";

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function prepareQuestions(questions, count) {
  const prepared = questions.map(q => {
    const correctAnswer = q.answers[q.correct];
    const aoaIndex = q.answers.findIndex(a =>
      a.toLowerCase().includes("all of the above")
    );
    let aoa = null;
    const rest = [...q.answers];
    if (aoaIndex !== -1) aoa = rest.splice(aoaIndex, 1)[0];
    shuffle(rest);
    const shuffled = aoa ? [...rest, aoa] : rest;
    return {
      ...q,
      answers: shuffled,
      correct: shuffled.indexOf(correctAnswer),
    };
  });
  const shuffledAll = shuffle(prepared);
  return count ? shuffledAll.slice(0, count) : shuffledAll;
}

// ── Main menu ─────────────────────────────────────────────────────────────────

const MENU_CATEGORIES = [
  {
    category: 'mocopa',
    icon: '⚡',
    title: 'MOCOPA Quiz',
    subtitle: 'Meter Operator Certificate of Practical Assessment',
    action: null
  },
  {
    category: 'gsg',
    icon: '📖',
    title: 'Gas Safety Guide',
    subtitle: 'Section-by-section revision from the Technical Guide',
    action: 'submenu'
  },
  {
    category: 'acs',
    icon: '🎯',
    title: 'ACS Prep',
    subtitle: 'Re-ACS mock exam and core knowledge quizzes',
    action: 'submenu'
  },
  {
    category: 'materials',
    icon: '📚',
    title: 'Learning Materials',
    subtitle: 'Cheat sheets and calculation reference guides',
    action: 'materials'   // special — loads materials.json, not quiz registry
  }
];

function showQuizSelector() {
  document.getElementById('quizExitBtn').style.display = 'none'; 
  document.getElementById('progressSection').style.display = 'none';
  document.getElementById('quizSubtitle').textContent = '⚡ Smart Metering Apprenticeship Training ⚡';

  const card = document.getElementById('quizCard');
  card.className = 'quiz-card fade-in';

  fetch('./data/index.json')
    .then(r => r.json())
    .then(registry => {
      quizRegistry = registry;

      card.innerHTML = `
        <p class="quiz-select-title">What would you like to do?</p>
        <div class="quiz-list">
          ${MENU_CATEGORIES.map(cat => {
            // Materials has its own registry — never check quizRegistry for it
            const isMaterials = cat.action === 'materials';
            const quizzesInCat = isMaterials ? [] : quizRegistry.filter(q => q.category === cat.category);
            const comingSoon = !isMaterials && quizzesInCat.length === 0;
            const showChevron = !comingSoon && (cat.action === 'submenu' || isMaterials);

            return `
              <button class="quiz-card-btn${comingSoon ? ' quiz-card-btn--disabled' : ''}"
                ${comingSoon ? 'disabled' : `onclick="handleMenuAction('${cat.category}')"`}>
                <div class="quiz-card-icon">${cat.icon}</div>
                <div>
                  <div class="quiz-card-title">${cat.title}${comingSoon ? ' <span class="coming-soon-badge">Coming soon</span>' : ''}</div>
                  <div class="quiz-card-subtitle">${cat.subtitle}</div>
                </div>
                ${showChevron ? '<div class="quiz-card-chevron">›</div>' : ''}
              </button>
            `;
          }).join('')}

          <button class="quiz-card-btn quiz-card-btn--join" onclick="showJoinQuiz()">
            <div class="quiz-card-icon">🔗</div>
            <div>
              <div class="quiz-card-title">Join a Quiz</div>
              <div class="quiz-card-subtitle">Enter a room code to join a live class quiz</div>
            </div>
          </button>
        </div>
      `;
    })
    .catch(err => {
      console.error('Error loading quiz registry:', err);
      card.innerHTML = `<p class="start-desc">Could not load quiz list. Please check data/index.json exists. ${err}</p>`;
    });
}

function handleMenuAction(category) {
  if (category === 'materials') {
    showMaterialsMenu();
    return;
  }

  const quizzesInCat = quizRegistry.filter(q => q.category === category);

  if (category === 'mocopa' && quizzesInCat.length === 1) {
    currentQuiz = quizzesInCat[0];
    showModeSelector();
    return;
  }

  showCategoryMenu(category);
}

function showCategoryMenu(category) {
  document.getElementById('quizExitBtn').style.display = 'none'; 
  const quizzesInCat = quizRegistry.filter(q => q.category === category);
  const catDef = MENU_CATEGORIES.find(c => c.category === category);

  document.getElementById('quizSubtitle').textContent = catDef ? catDef.title : category;

  const card = document.getElementById('quizCard');
  card.className = 'quiz-card fade-in';

  card.innerHTML = `
    <button class="back-btn" onclick="showQuizSelector()">&#8592; Main menu</button>
    <p class="quiz-select-title">${catDef ? catDef.title : category}</p>
    <div class="quiz-list">
      ${quizzesInCat.map(q => `
        <button class="quiz-card-btn" onclick="selectQuiz('${q.id}')">
          <div class="quiz-card-icon">${q.icon}</div>
          <div>
            <div class="quiz-card-title">${q.title}</div>
            <div class="quiz-card-subtitle">${q.subtitle}</div>
          </div>
        </button>
      `).join('')}
    </div>
  `;
}

function showMaterialsMenu() {
  document.getElementById('quizExitBtn').style.display = 'none'; 
  document.getElementById('quizSubtitle').textContent = 'Learning Materials';

  const card = document.getElementById('quizCard');
  card.className = 'quiz-card fade-in';

  card.innerHTML = `
    <button class="back-btn" onclick="showQuizSelector()">&#8592; Main menu</button>
    <p class="quiz-select-title">Learning Materials</p>
    <p class="quiz-select-desc">Quick-reference cheat sheets sourced from the Gas Safety Technical Guide v5.0.</p>
    <div class="quiz-list" id="materialsList">
      <p style="opacity:0.5;font-size:0.85rem;padding:1rem 0">Loading…</p>
    </div>
  `;

  fetch('./data/materials.json')
    .then(r => r.json())
    .then(materials => {
      document.getElementById('materialsList').innerHTML = materials.map(m => `
        <button class="quiz-card-btn quiz-card-btn--material" onclick="window.open('${m.file}', '_blank')">
          <div class="quiz-card-icon">${m.icon}</div>
          <div>
            <div class="quiz-card-title">${m.title}</div>
            <div class="quiz-card-subtitle">${m.subtitle}</div>
            <div class="material-ref">${m.ref}</div>
          </div>
          <div class="quiz-card-chevron">↗</div>
        </button>
      `).join('');
    })
    .catch(err => {
      document.getElementById('materialsList').innerHTML =
        `<p style="color:var(--danger)">Could not load materials list. ${err}</p>`;
    });
}

function selectQuiz(id) {
  currentQuiz = quizRegistry.find(q => q.id === id);
  showModeSelector();
}

function showModeSelector() {
  document.getElementById('quizExitBtn').style.display = 'none';
 
  const card = document.getElementById('quizCard');
  card.className = 'quiz-card fade-in';
  document.getElementById('quizSubtitle').textContent = currentQuiz.subtitle;
 
  // Generator-based quizzes can't be hosted live (questions generated client-side)
  const canHost = !currentQuiz.generator;
 
  card.innerHTML = `
    <button class="back-btn" onclick="showQuizSelector()">&#8592; All quizzes</button>
    <p class="selected-quiz-name">${currentQuiz.title}</p>
    <div class="mode-btns">
      <button class="mode-btn mode-practice" onclick="loadAndStart('practice')">
        <span class="mode-icon">📝</span>
        <span class="mode-label">Practice Mode</span>
        <span class="mode-hint">Instant feedback after each answer</span>
      </button>
      <button class="mode-btn mode-test" onclick="loadAndStart('test')">
        <span class="mode-icon">🎯</span>
        <span class="mode-label">Test Mode</span>
        <span class="mode-hint">Results revealed at the end — pass mark ${currentQuiz.passmark}%</span>
      </button>
      ${canHost ? `
      <button class="mode-btn mode-host" onclick="hostQuiz('${currentQuiz.id}')">
        <span class="mode-icon">🎮</span>
        <span class="mode-label">Host a Quiz</span>
        <span class="mode-hint">Run a live session — opens the host screen</span>
      </button>
      ` : ''}
    </div>
  `;
}
 
function hostQuiz(quizId) {
  window.open(`${LIVE_QUIZ_BASE}/host.html?quiz=${encodeURIComponent(quizId)}`, '_blank');
}


function showJoinQuiz() {
  document.getElementById('quizExitBtn').style.display = 'none'; 
  document.getElementById('quizSubtitle').textContent = 'Join a Live Quiz';

  const card = document.getElementById('quizCard');
  card.className = 'quiz-card fade-in';

  card.innerHTML = `
    <button class="back-btn" onclick="showQuizSelector()">&#8592; Main menu</button>
    <p class="quiz-select-title">Join a Live Quiz</p>
    <p class="quiz-select-desc">Enter the room code shown on screen by your instructor.</p>
    <div class="join-quiz-form">
      <input
        class="room-code-input"
        id="roomCodeInput"
        type="text"
        maxlength="6"
        placeholder="e.g. ABC123"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        oninput="this.value = this.value.toUpperCase()"
        onkeydown="if(event.key==='Enter') joinRoom()"
      />
      <button class="mode-btn mode-practice" style="margin-top:1rem" onclick="joinRoom()">
        <span class="mode-icon">🔗</span>
        <span class="mode-label">Join Room</span>
      </button>
    </div>
    <p class="join-quiz-note">The live quiz feature will open in a new tab.</p>
  `;

  document.getElementById('roomCodeInput').focus();
}

function joinRoom() {
  const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  if (!code || code.length < 4) {
    alert('Please enter a valid room code.');
    return;
  }
  window.open(
    `${LIVE_QUIZ_BASE}/player.html?room=${encodeURIComponent(code)}`,
    '_blank'
  );
}


// ── Feedback ──────────────────────────────────────────────────────────────────
function feedbackHTML(prefix, q, fallback) {
  let body = prefix;
  if (q.explanation) body += ' ' + q.explanation;
  if (fallback) body += ' ' + fallback;
  const ref = q.source
    ? `<span class="feedback-source">📖 Guide ref: ${q.source}</span>`
    : '';
  return `<span class="feedback-body">${body}</span>${ref}`;
}

// ── Generator support ─────────────────────────────────────────────────────────
const loadedGenerators = new Set();

function loadGeneratorScript(src) {
  if (loadedGenerators.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => { loadedGenerators.add(src); resolve(); };
    script.onerror = () => reject(new Error(`Failed to load generator script: ${src}`));
    document.head.appendChild(script);
  });
}

function getQuestionCount(mode) {
  return mode === 'test' ? currentQuiz.testCount : currentQuiz.practiceCount;
}

function loadAndStart(mode) {
  const gen = currentQuiz.generator;

  if (gen) {
    loadGeneratorScript(gen.script)
      .then(() => {
        const api = window[gen.global];
        if (!api || typeof api.generateQuiz !== 'function') {
          throw new Error(`Generator "${gen.global}" not found or missing generateQuiz()`);
        }
        const count = getQuestionCount(mode);
        const questions = api.generateQuiz(count);
        startQuiz(mode, questions);
      })
      .catch(err => {
        console.error('Error loading generated quiz:', err);
        alert('Could not generate quiz questions. Please try again.');
      });
    return;
  }

  fetch(currentQuiz.file)
    .then(r => r.json())
    .then(questions => startQuiz(mode, questions))
    .catch(err => {
      console.error('Error loading quiz questions:', err);
      alert('Could not load quiz questions. Please check the data file exists.');
    });
}

function startQuiz(mode, questions) {
  testMode        = (mode === 'test');
  quiz            = prepareQuestions(questions,
    testMode ? currentQuiz.testCount : currentQuiz.practiceCount);
  current         = 0;
  score           = 0;
  wrongAnswers    = [];
  selectedAnswers = [];
  answered        = false;

  const modeBadge = document.getElementById('modeBadge');
  modeBadge.textContent = testMode ? 'Test' : 'Practice';
  modeBadge.className   = 'mode-badge ' + (testMode ? 'badge-test' : 'badge-practice');

  document.getElementById('progressSection').style.display = 'block';
  document.getElementById('quizExitBtn').style.display = 'inline-flex';
  renderQuestion();
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function updateProgress() {
  const percent = (current / quiz.length) * 100;
  document.getElementById('progressFill').style.width = percent + '%';
  document.getElementById('progressText').textContent =
    `Question ${current + 1} of ${quiz.length}`;
}


function renderQuestion() {
  answered = false;
 
  const card = document.getElementById('quizCard');
  card.className = 'quiz-card fade-in';
 
  const q = quiz[current];
  updateProgress();
 
  card.innerHTML = `
    <p class="question-text">${q.question}</p>
    <div class="answers" id="answers" role="radiogroup"></div>
    <div class="feedback" id="feedback" style="display:none" aria-live="polite" aria-atomic="true"></div>
    <button class="next-btn" id="nextBtn" style="display:none" onclick="nextQuestion()">
      ${current < quiz.length - 1 ? 'Next question &#8594;' : 'See results'}
    </button>
  `;
 
  const answersDiv = document.getElementById('answers');
  q.answers.forEach((answer, i) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.setAttribute('tabindex', i === 0 ? '0' : '-1');
    btn.innerHTML = `
      <span class="answer-letter">${String.fromCharCode(65 + i)}</span>
      <span class="answer-text">${answer}</span>
    `;
    btn.addEventListener('click', () => selectAnswer(btn, i));
    btn.addEventListener('keydown', (e) => handleAnswerKeydown(e, i));
    answersDiv.appendChild(btn);
  });
}
 
function confirmExit() {
  const msg = testMode
    ? 'Exit this test? Your progress will be lost.'
    : 'Exit this practice session?';
  if (confirm(msg)) {
    document.getElementById('progressSection').style.display = 'none';
    showModeSelector();
  }
}
 


function handleAnswerKeydown(e, index) {
  const buttons = Array.from(document.querySelectorAll('.answer-btn'));
  const count = buttons.length;
  let targetIndex = null;

  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      targetIndex = (index + 1) % count;
      break;
    case 'ArrowUp':
    case 'ArrowLeft':
      targetIndex = (index - 1 + count) % count;
      break;
    default: return;
  }

  e.preventDefault();
  moveRovingFocus(buttons, targetIndex);
  selectAnswer(buttons[targetIndex], targetIndex);
}

function moveRovingFocus(buttons, targetIndex) {
  buttons.forEach((btn, i) => {
    btn.setAttribute('tabindex', i === targetIndex ? '0' : '-1');
  });
  buttons[targetIndex].focus();
}

function selectAnswer(button, index) {
  if (!testMode) {
    if (answered) return;
    answered = true;
  }

  const correctIndex = quiz[current].correct;
  const buttons = document.querySelectorAll('.answer-btn');

  if (!testMode) {
    if (index === correctIndex) {
      score++;
    } else {
      wrongAnswers.push({
        question: quiz[current].question,
        selected: quiz[current].answers[index],
        correct: quiz[current].answers[correctIndex]
      });
    }
  }

  if (testMode) {
    selectedAnswers[current] = index;
    buttons.forEach((btn, i) => {
      btn.classList.remove('selected');
      btn.setAttribute('aria-checked', 'false');
      btn.setAttribute('tabindex', i === index ? '0' : '-1');
      if (i === index) {
        btn.classList.add('selected');
        btn.setAttribute('aria-checked', 'true');
      }
    });

    const feedback = document.getElementById('feedback');
    feedback.textContent = 'Selection saved. You can change it before continuing.';
    feedback.className = 'feedback neutral-feedback';
    feedback.style.display = 'block';
  } else {
    buttons.forEach((btn, i) => {
      btn.disabled = true;
      btn.setAttribute('tabindex', i === index ? '0' : '-1');
      if (i === correctIndex) btn.classList.add('correct', 'anim-correct');
      else if (i === index) btn.classList.add('wrong', 'anim-wrong');
      btn.setAttribute('aria-checked', i === index ? 'true' : 'false');
    });

    const feedback = document.getElementById('feedback');
    if (index === correctIndex) {
      feedback.innerHTML = feedbackHTML('Correct!', quiz[current]);
      feedback.className = 'feedback correct-feedback';
    } else {
      feedback.innerHTML = feedbackHTML('Incorrect', quiz[current],
        `the correct answer was: ${quiz[current].answers[correctIndex]}`);
      feedback.className = 'feedback wrong-feedback';
    }
    feedback.style.display = 'block';
  }

  document.getElementById('nextBtn').style.display = 'flex';
}

function nextQuestion() {
  if (testMode) {
    const selected = selectedAnswers[current];
    const correctIndex = quiz[current].correct;

    if (selected === undefined) {
      alert('Please select an answer before continuing.');
      return;
    }

    if (selected === correctIndex) {
      score++;
    } else {
      wrongAnswers.push({
        question: quiz[current].question,
        selected: quiz[current].answers[selected],
        correct: quiz[current].answers[correctIndex]
      });
    }
  }

  current++;
  if (current < quiz.length) {
    renderQuestion();
  } else {
    showResults();
  }
}

// ── Results ───────────────────────────────────────────────────────────────────
function showResults() {
  const percent  = Math.round((score / quiz.length) * 100);
  const passmark = currentQuiz ? currentQuiz.passmark : 80;
  const pass     = percent >= passmark;

  const card = document.getElementById('quizCard');
  card.classList.remove('fade-in');
  void card.offsetWidth;
  card.classList.add('fade-in');

  document.getElementById('progressSection').style.display = 'none';

  let wrongHTML = '';
  if (wrongAnswers.length > 0) {
    wrongHTML = wrongAnswers.map(item => `
      <div class="review-item">
        <p class="review-question">${item.question}</p>
        <p class="review-wrong">✗ Your answer: ${item.selected}</p>
        <p class="review-correct">✓ Correct: ${item.correct}</p>
      </div>
    `).join('');
  }

  const modeLabel = testMode ? 'Test' : 'Practice';

  card.innerHTML = `
    <div class="results">
      <p class="result-mode-label">${modeLabel} mode result</p>
      <div class="result-score-ring">
        <svg viewBox="0 0 120 120" class="ring-svg" aria-hidden="true">
          <circle class="ring-bg" cx="60" cy="60" r="52"/>
          <circle class="ring-fill ${pass ? 'ring-pass' : 'ring-fail'}"
            cx="60" cy="60" r="52"
            stroke-dasharray="${Math.round(2 * Math.PI * 52)}"
            stroke-dashoffset="${Math.round(2 * Math.PI * 52 * (1 - percent / 100))}"/>
        </svg>
        <div class="ring-label">
          <span class="ring-percent">${percent}%</span>
          <span class="ring-verdict ${pass ? 'verdict-pass' : 'verdict-fail'}">${pass ? 'PASS' : 'FAIL'}</span>
        </div>
      </div>

      <p class="result-detail">${score} / ${quiz.length} correct</p>
      <p class="result-threshold">Pass mark: ${passmark}%</p>

      ${wrongAnswers.length > 0 ? `
        <div class="review-section">
          <h3 class="review-heading">Review (${wrongAnswers.length} wrong)</h3>
          ${wrongHTML}
        </div>
      ` : '<p class="perfect">Perfect score! Well done. 🎉</p>'}

      <button class="restart-btn" onclick="showModeSelector()">Try again</button>
      <button class="restart-btn" onclick="showQuizSelector()" style="margin-top:8px">Choose a different quiz</button>
    </div>
  `;
}

// ── Theme toggle ──────────────────────────────────────────────────────────────
const themeSwitch = document.querySelector('input[name=mode]');

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  themeSwitch.checked = dark;
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}

themeSwitch.addEventListener('change', function () {
  document.documentElement.classList.add('transition');
  setTimeout(() => document.documentElement.classList.remove('transition'), 1000);
  applyTheme(this.checked);
});

const savedTheme = localStorage.getItem('theme');
applyTheme(savedTheme === null ? true : savedTheme === 'dark');

// ── Boot ──────────────────────────────────────────────────────────────────────
showQuizSelector();