(function(){
  "use strict";

  const state = {
    lang: "en",
    category: "all",
    view: "lessons"
  };

  const tabsEl = document.getElementById("tabs");
  const chipsEl = document.getElementById("chips");
  const listEl = document.getElementById("lessonList");
  const overlayEl = document.getElementById("overlay");
  const notebookEl = document.getElementById("notebook");
  const heroNoteEl = document.getElementById("heroNote");
  const viewSwitchEl = document.getElementById("viewSwitch");
  const practiceDashboardEl = document.getElementById("practiceDashboard");

  // ---------- XSS Korumalı HTML Escape ----------
  function escapeHtml(str){
    if(str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ---------- Progress storage ----------
  const STORAGE_KEY = "ineffable_progress_v1";

  function loadProgress(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch(e){ return {}; }
  }
  function saveProgress(p){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
    catch(e){ /* storage unavailable, ignore */ }
  }
  function getLessonProgress(lessonId){
    return loadProgress()[lessonId] || null;
  }
  function recordLessonResult(lessonId, correct, total){
    if(total === 0) return;
    const p = loadProgress();
    const prev = p[lessonId];
    p[lessonId] = {
      best: prev ? Math.max(prev.best, correct) : correct,
      total: total,
      attempts: prev ? prev.attempts + 1 : 1
    };
    saveProgress(p);
  }

  // ---------- Streak tracking ----------
  const STREAK_KEY = "ineffable_streak_v1";

  function loadStreakData(){
    try{ return JSON.parse(localStorage.getItem(STREAK_KEY)) || { streak: 0, lastDate: null }; }
    catch(e){ return { streak: 0, lastDate: null }; }
  }
  function saveStreakData(d){
    try{ localStorage.setItem(STREAK_KEY, JSON.stringify(d)); }
    catch(e){ /* storage unavailable, ignore */ }
  }
  function getStreak(){
    return loadStreakData().streak;
  }
  function updateStreak(){
    const data = loadStreakData();
    const today = new Date().toDateString();

    if(data.lastDate === today) return data.streak;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toDateString();

    let streak;
    if(data.lastDate === yStr) streak = data.streak + 1;
    else streak = 1;

    saveStreakData({ streak: streak, lastDate: today });
    return streak;
  }

  // ---------- Quiz generation ----------
  function shuffle(arr){
    const a = arr.slice();
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function buildMCQ(lesson){
    const types = lesson.pages[0].types;
    if(!types || types.length < 2) return null;
    const targetIdx = Math.floor(Math.random() * types.length);
    const target = types[targetIdx];
    const correct = target.examples[0];
    const distractors = types
      .filter(function(_, i){ return i !== targetIdx; })
      .map(function(t){ return t.examples[0]; });
    const options = shuffle([correct].concat(distractors)).slice(0, 4);
    if(options.indexOf(correct) === -1) options[0] = correct;
    return {
      type: "mcq",
      lessonId: lesson.id,
      lessonTerm: lesson.term,
      question: "Aşağıdakilerden hangisi '" + escapeHtml(target.name) + "' türüne bir örnektir?",
      options: shuffle(options),
      answer: correct
    };
  }

  function buildTF(lesson){
    const types = lesson.pages[0].types;
    if(!types || types.length < 2) return null;
    const idxA = Math.floor(Math.random() * types.length);
    let idxB = Math.floor(Math.random() * types.length);
    while(idxB === idxA) idxB = Math.floor(Math.random() * types.length);
    const isTrue = Math.random() < 0.5;
    const defUsed = isTrue ? types[idxA].def : types[idxB].def;
    return {
      type: "tf",
      lessonId: lesson.id,
      lessonTerm: lesson.term,
      question: "'" + escapeHtml(types[idxA].name) + "' şu şekilde kurulur/anlatılır: " + escapeHtml(defUsed),
      answer: isTrue
    };
  }

  function buildSelf(lesson){
    return {
      type: "self",
      lessonId: lesson.id,
      lessonTerm: lesson.term,
      question: lesson.practice.question,
      hint: lesson.practice.hint
    };
  }

  function buildQuizForLesson(lesson){
    const qs = [];
    const mcq = buildMCQ(lesson);
    if(mcq) qs.push(mcq);
    const tf = buildTF(lesson);
    if(tf) qs.push(tf);
    qs.push(buildSelf(lesson));
    return qs;
  }

  function buildMixedQuiz(lessons){
    const pool = shuffle(lessons).slice(0, 8);
    let all = [];
    pool.forEach(function(lesson){
      all = all.concat(buildQuizForLesson(lesson));
    });
    return all;
  }

  function currentLangData(){
    // grammar.js yüklenmezse güvenli fallback
    if(typeof GRAMMAR_DATA === "undefined" || !GRAMMAR_DATA){
      console.error("GRAMMAR_DATA yüklenemedi!");
      return { label: "?", categories: [], lessons: [] };
    }
    return GRAMMAR_DATA[state.lang];
  }

  // ---------- Event Delegation — Tek Seferlik Listener ----------
  // Tab'lar için event delegation
  tabsEl.addEventListener("click", function(e){
    const btn = e.target.closest(".tab-btn");
    if(!btn) return;
    state.lang = btn.dataset.lang;
    state.category = "all";
    renderAll();
  });

  // View switch için event delegation
  viewSwitchEl.addEventListener("click", function(e){
    const btn = e.target.closest(".view-btn");
    if(!btn) return;
    state.view = btn.dataset.view;
    state.category = "all";
    renderAll();
  });

  // Chips için event delegation
  chipsEl.addEventListener("click", function(e){
    const chip = e.target.closest(".chip");
    if(!chip) return;
    state.category = chip.dataset.cat || "all";
    renderAll();
  });

  // Practice dashboard — event delegation
  practiceDashboardEl.addEventListener("click", function(e){
    const btn = e.target.closest("#pdMixBtn");
    if(!btn) return;
    const data = currentLangData();
    const lessons = sortedLessons(data, state.category);
    if(lessons.length === 0) return;
    const qs = buildMixedQuiz(lessons);
    startQuiz(qs);
  });

  // Lesson list — event delegation
  listEl.addEventListener("click", function(e){
    const card = e.target.closest(".lesson-card");
    if(!card) return;
    const lessonId = card.dataset.lessonId;
    const data = currentLangData();
    const lesson = data.lessons.find(function(l){ return l.id === lessonId; });
    if(lesson) openLesson(lesson);
  });

  // Practice rows — event delegation
  listEl.addEventListener("click", function(e){
    const btn = e.target.closest(".pr-btn");
    if(!btn) return;
    const lessonId = btn.dataset.lessonId;
    const data = currentLangData();
    const lesson = data.lessons.find(function(l){ return l.id === lessonId; });
    if(lesson) startQuiz(buildQuizForLesson(lesson));
  });

  function renderTabs(){
    tabsEl.innerHTML = "";
    ["en","ru"].forEach(function(langKey){
      const data = GRAMMAR_DATA[langKey];
      const btn = document.createElement("button");
      btn.className = "tab-btn" + (state.lang === langKey ? " active" : "");
      btn.dataset.lang = langKey;
      btn.innerHTML = '<span class="dot"></span>' + escapeHtml(data.label) + " Grameri";
      tabsEl.appendChild(btn);
    });
  }

  function renderViewSwitch(){
    const btns = viewSwitchEl.querySelectorAll(".view-btn");
    btns.forEach(function(btn){
      btn.classList.toggle("active", btn.dataset.view === state.view);
    });
  }

  function renderChips(){
    chipsEl.innerHTML = "";
    const data = currentLangData();

    const allChip = document.createElement("button");
    allChip.className = "chip" + (state.category === "all" ? " active" : "");
    allChip.dataset.cat = "all";
    allChip.innerHTML = '<span class="mark">✦</span> Tümü';
    chipsEl.appendChild(allChip);

    data.categories.forEach(function(cat){
      const chip = document.createElement("button");
      chip.className = "chip" + (state.category === cat.id ? " active" : "");
      chip.dataset.cat = cat.id;
      chip.innerHTML = '<span class="mark">' + escapeHtml(cat.mark) + '</span>' + escapeHtml(cat.label);
      chipsEl.appendChild(chip);
    });
  }

  const LEVEL_RANK = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

  function sortedLessons(data, categoryFilter){
    const categoryOrder = {};
    data.categories.forEach(function(c, i){ categoryOrder[c.id] = i; });

    return data.lessons
      .filter(function(l){ return categoryFilter === "all" || l.category === categoryFilter; })
      .slice()
      .sort(function(a, b){
        const catDiff = (categoryOrder[a.category] || 0) - (categoryOrder[b.category] || 0);
        if(catDiff !== 0) return catDiff;
        const lvlDiff = (LEVEL_RANK[a.level] || 0) - (LEVEL_RANK[b.level] || 0);
        return lvlDiff;
      });
  }

  function progressBadgeHtml(lessonId){
    const prog = getLessonProgress(lessonId);
    if(!prog) return "";
    const cls = prog.best >= prog.total ? "full" : "partial";
    const icon = prog.best >= prog.total ? "✓ " : "";
    return '<span class="progress-badge ' + cls + '">' + icon + prog.best + "/" + prog.total + '</span>';
  }

  function renderList(){
    listEl.innerHTML = "";
    const data = currentLangData();
    const lessons = sortedLessons(data, state.category);

    if(state.view === "practice"){
      renderPracticeDashboard(data, lessons);
      renderPracticeRows(lessons);
      return;
    }

    practiceDashboardEl.innerHTML = "";

    if(lessons.length === 0){
      const empty = document.createElement("p");
      empty.style.color = "var(--muted)";
      empty.style.fontSize = "13px";
      empty.style.padding = "10px 0";
      empty.textContent = "Bu kategoride henüz ders yok.";
      listEl.appendChild(empty);
      return;
    }

    let lastCategory = null;
    const showHeaders = state.category === "all";

    lessons.forEach(function(lesson){
      if(showHeaders && lesson.category !== lastCategory){
        lastCategory = lesson.category;
        const catInfo = data.categories.find(function(c){ return c.id === lesson.category; });
        if(catInfo){
          const header = document.createElement("div");
          header.className = "list-section-header";
          header.innerHTML = '<span class="mark">' + escapeHtml(catInfo.mark) + '</span>' + escapeHtml(catInfo.label);
          listEl.appendChild(header);
        }
      }

      const card = document.createElement("button");
      card.className = "lesson-card";
      card.dataset.lessonId = lesson.id;
      card.innerHTML =
        '<span class="lc-left">' +
          '<span class="lc-term">' + escapeHtml(lesson.term) + '</span>' +
          '<span class="lc-def">' + escapeHtml(lesson.pages[0].definition) + '</span>' +
        '</span>' +
        '<span style="display:flex;align-items:center;gap:8px;flex:0 0 auto;">' +
          '<span class="level-badge">' + escapeHtml(lesson.level) + '</span>' +
          progressBadgeHtml(lesson.id) +
        '</span>';
      listEl.appendChild(card);
    });
  }

  function renderPracticeDashboard(data, lessons){
    const progress = loadProgress();
    let practiced = 0, totalCorrect = 0, totalPossible = 0;
    lessons.forEach(function(l){
      const p = progress[l.id];
      if(p){
        practiced++;
        totalCorrect += p.best;
        totalPossible += p.total;
      }
    });
    const pct = totalPossible > 0 ? Math.round((totalCorrect / totalPossible) * 100) : 0;

    practiceDashboardEl.innerHTML =
      '<div class="pd-stats">' +
        '<div class="pd-stat"><span class="num">' + practiced + "/" + lessons.length + '</span><span class="lbl">Denenen Ders</span></div>' +
        '<div class="pd-stat"><span class="num">' + pct + '%</span><span class="lbl">Başarı Oranı</span></div>' +
      "</div>" +
      '<button id="pdMixBtn" class="pd-mix-btn"' + (lessons.length === 0 ? ' disabled' : '') + '>🎲 Karışık Alıştırma</button>';
  }

  function renderPracticeRows(lessons){
    if(lessons.length === 0){
      const empty = document.createElement("p");
      empty.style.color = "var(--muted)";
      empty.style.fontSize = "13px";
      empty.style.padding = "10px 0";
      empty.textContent = "Bu kategoride henüz ders yok.";
      listEl.appendChild(empty);
      return;
    }

    lessons.forEach(function(lesson){
      const row = document.createElement("div");
      row.className = "practice-row";
      row.innerHTML =
        '<span class="pr-term">' + escapeHtml(lesson.term) + '</span>' +
        '<span style="display:flex;align-items:center;gap:8px;">' +
          progressBadgeHtml(lesson.id) +
          '<button class="pr-btn" data-lesson-id="' + escapeHtml(lesson.id) + '">Alıştır</button>' +
        '</span>';
      listEl.appendChild(row);
    });
  }

  function renderHeroNote(){
    const data = currentLangData();
    const notes = {
      en: "İngilizcenin temel yapı taşlarını — isimlerden zamanlara, artikellerden kip fiillere — Türkçe açıklamalarla, defter düzeninde öğren.",
      ru: "Rusçanın hâllerini, fiil görünüşünü ve cinsiyet sistemini Türkçe açıklamalarla, kısa ve düzenli derslerle keşfet."
    };
    heroNoteEl.textContent = notes[state.lang] || "";
  }

  function renderStreak(){
    let badge = document.getElementById("streakBadge");
    if(!badge){
      badge = document.createElement("div");
      badge.id = "streakBadge";
      badge.className = "streak-badge";
      if(heroNoteEl && heroNoteEl.parentNode){
        heroNoteEl.parentNode.insertBefore(badge, heroNoteEl);
      }
    }
    const streak = getStreak();
    badge.textContent = streak > 0 ? "🔥 " + streak + " günlük seri" : "";
  }

  let currentLesson = null;
  let currentPage = 0;

  function openLesson(lesson){
    currentLesson = lesson;
    currentPage = 0;
    renderPage();
    overlayEl.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeLesson(){
    overlayEl.classList.remove("open");
    document.body.style.overflow = "";
    currentLesson = null;
  }

  function renderPage(){
    const lesson = currentLesson;
    const pageIndex = currentPage;
    const page = lesson.pages[pageIndex];
    const isLastPage = pageIndex === lesson.pages.length - 1;
    const isFirstPage = pageIndex === 0;

    let bodyHtml = "";

    if(pageIndex === 0){
      const factsHtml = page.quickFacts.map(function(f){ return "<li>" + escapeHtml(f) + "</li>"; }).join("");
      const typesHtml = page.types.map(function(t){
        const exHtml = t.examples.map(function(ex){ return escapeHtml(ex); }).join(" · ");
        return (
          '<div class="nb-type">' +
            '<span class="arrow">→</span>' +
            '<div class="body">' +
              '<div class="name">' + escapeHtml(t.name) + '</div>' +
              '<div class="def">' + escapeHtml(t.def) + "</div>" +
              '<div class="ex">' + exHtml + "</div>" +
            "</div>" +
          "</div>"
        );
      }).join("");

      bodyHtml =
        '<span class="nb-level">SEVİYE ' + escapeHtml(lesson.level) + '</span>' +
        '<h2 class="nb-term-box">' + escapeHtml(lesson.term) + "</h2>" +
        '<ul class="nb-facts">' + factsHtml + "</ul>" +
        '<div class="nb-def">' + escapeHtml(page.definition) + "</div>" +
        '<div class="nb-types-label">' + escapeHtml(page.typesLabel) + "</div>" +
        typesHtml;
    } else {
      const mistakesHtml = page.commonMistakes.map(function(m){ return "<li>" + escapeHtml(m) + "</li>"; }).join("");
      const moreExHtml = page.moreExamples.map(function(e){ return "<li>" + escapeHtml(e) + "</li>"; }).join("");

      bodyHtml =
        '<span class="nb-level">SEVİYE ' + escapeHtml(lesson.level) + '</span>' +
        '<h2 class="nb-term-box small">' + escapeHtml(lesson.term) + "</h2>" +
        '<div class="nb-subheading">' + escapeHtml(page.heading) + "</div>" +
        '<div class="nb-block-label">Sık Yapılan Hatalar</div>' +
        '<ul class="nb-mistakes">' + mistakesHtml + "</ul>" +
        '<div class="nb-block-label">Ek Örnekler</div>' +
        '<ul class="nb-more-examples">' + moreExHtml + "</ul>" +
        '<div class="nb-tip"><span class="nb-tip-label">İpucu</span>' + escapeHtml(page.tip) + "</div>";
    }

    let practiceHtml = "";
    if(isLastPage){
      practiceHtml =
        '<div class="nb-practice">' +
          '<span class="label">Alıştırma</span>' +
          '<div class="q">' + escapeHtml(lesson.practice.question) + "</div>" +
          '<button class="nb-hint-btn">💡 İpucu göster</button>' +
          '<div class="nb-hint">' + escapeHtml(lesson.practice.hint) + "</div>" +
          '<button id="startLessonQuizBtn" class="quiz-next-btn" style="margin-top:12px;">Alıştırmaya Başla</button>' +
        "</div>";
    }

    const dotsHtml = lesson.pages.map(function(_, i){
      return '<span class="dot' + (i === pageIndex ? " active" : "") + '"></span>';
    }).join("");

    const pagerHtml =
      '<div class="nb-pager">' +
        '<button id="nbPrev" class="nb-pager-btn"' + (isFirstPage ? ' disabled' : '') + '>← Önceki</button>' +
        '<span class="nb-pager-dots">' + dotsHtml + '</span>' +
        '<button id="nbNext" class="nb-pager-btn"' + (isLastPage ? ' disabled' : '') + '>Sonraki →</button>' +
      "</div>";

    notebookEl.innerHTML =
      '<div class="notebook-inner">' +
        '<button class="nb-close" aria-label="Kapat">✕</button>' +
        bodyHtml +
        practiceHtml +
        pagerHtml +
      "</div>";

    notebookEl.scrollTop = 0;

    // Event listeners — tek seferlik, element yeniden oluşturulduğu için güvenli
    notebookEl.querySelector(".nb-close").addEventListener("click", closeLesson);

    const prevBtn = notebookEl.querySelector("#nbPrev");
    const nextBtn = notebookEl.querySelector("#nbNext");
    if(prevBtn && !isFirstPage){
      prevBtn.addEventListener("click", function(){ currentPage--; renderPage(); });
    }
    if(nextBtn && !isLastPage){
      nextBtn.addEventListener("click", function(){ currentPage++; renderPage(); });
    }

    const hintBtn = notebookEl.querySelector(".nb-hint-btn");
    if(hintBtn){
      hintBtn.addEventListener("click", function(){
        notebookEl.querySelector(".nb-hint").classList.toggle("shown");
      });
    }

    const startQuizBtn = notebookEl.querySelector("#startLessonQuizBtn");
    if(startQuizBtn){
      startQuizBtn.addEventListener("click", function(){
        startQuiz(buildQuizForLesson(lesson));
      });
    }
  }

  function renderAll(){
    renderTabs();
    renderViewSwitch();
    renderChips();
    renderList();
    renderHeroNote();
    renderStreak();
  }

  // ---------- Quiz runtime ----------
  let quizState = null;

  function startQuiz(questions){
    currentLesson = null;
    quizState = { questions: questions, index: 0, answers: [], answered: false };
    overlayEl.classList.add("open");
    document.body.style.overflow = "hidden";
    renderQuizQuestion();
  }

  function closeQuiz(){
    overlayEl.classList.remove("open");
    document.body.style.overflow = "";
    quizState = null;
    renderList();
  }

  function renderQuizQuestion(){
    const qs = quizState.questions;
    const i = quizState.index;
    if(i >= qs.length){
      finishQuiz();
      return;
    }
    const q = qs[i];
    quizState.answered = false;

    let bodyHtml =
      '<div class="quiz-progress">Soru ' + (i + 1) + " / " + qs.length + " · " + escapeHtml(q.lessonTerm) + "</div>" +
      '<div class="quiz-question">' + escapeHtml(q.question) + "</div>";

    if(q.type === "mcq"){
      bodyHtml += '<div class="quiz-options" role="radiogroup" aria-label="Seçenekler">' +
        q.options.map(function(opt, idx){
          return '<button class="quiz-option" data-idx="' + idx + '" role="radio" aria-checked="false" tabindex="0">' + escapeHtml(opt) + '</button>';
        }).join("") +
        "</div>";
    } else if(q.type === "tf"){
      bodyHtml += '<div class="quiz-tf" role="radiogroup" aria-label="Doğru/Yanlış">' +
        '<button data-val="true" role="radio" aria-checked="false" tabindex="0">Doğru</button>' +
        '<button data-val="false" role="radio" aria-checked="false" tabindex="0">Yanlış</button>' +
        "</div>";
    } else if(q.type === "self"){
      bodyHtml +=
        '<button id="quizRevealBtn" class="nb-hint-btn">Cevabı Göster</button>' +
        '<div id="quizReveal" class="quiz-self-reveal">' + escapeHtml(q.hint) + "</div>" +
        '<div id="quizSelfButtons" class="quiz-self-buttons">' +
          '<button data-val="true" tabindex="0">✓ Doğru bildim</button>' +
          '<button data-val="false" tabindex="0">✗ Yanlış bildim</button>' +
        "</div>";
    }

    bodyHtml += '<button id="quizNextBtn" class="quiz-next-btn" disabled>Sonraki Soru →</button>';

    notebookEl.innerHTML =
      '<div class="notebook-inner">' +
        '<button class="nb-close" aria-label="Kapat">✕</button>' +
        bodyHtml +
      "</div>";

    notebookEl.scrollTop = 0;
    notebookEl.querySelector(".nb-close").addEventListener("click", closeQuiz);

    const nextBtn = document.getElementById("quizNextBtn");

    function commitAnswer(correct){
      if(quizState.answered) return;
      quizState.answered = true;
      quizState.answers.push({ lessonId: q.lessonId, correct: correct });
      nextBtn.disabled = false;
      nextBtn.textContent = (quizState.index < qs.length - 1) ? "Sonraki Soru →" : "Sonuçları Gör";
    }

    if(q.type === "mcq"){
      const optButtons = notebookEl.querySelectorAll(".quiz-option");
      optButtons.forEach(function(btn){
        btn.addEventListener("click", function(){
          if(quizState.answered) return;
          const chosen = q.options[parseInt(btn.dataset.idx, 10)];
          const isCorrect = chosen === q.answer;
          optButtons.forEach(function(b){
            const val = q.options[parseInt(b.dataset.idx, 10)];
            if(val === q.answer){
              b.classList.add("correct");
              b.setAttribute("aria-checked", "true");
            } else if(b === btn){
              b.classList.add("wrong");
            }
            b.disabled = true;
          });
          commitAnswer(isCorrect);
        });
      });
    } else if(q.type === "tf"){
      const tfButtons = notebookEl.querySelectorAll("#quizTF button");
      tfButtons.forEach(function(btn){
        btn.addEventListener("click", function(){
          if(quizState.answered) return;
          const val = btn.dataset.val === "true";
          const isCorrect = val === q.answer;
          tfButtons.forEach(function(b){
            const bVal = b.dataset.val === "true";
            if(bVal === q.answer){
              b.classList.add("correct");
              b.setAttribute("aria-checked", "true");
            } else if(b === btn){
              b.classList.add("wrong");
            }
            b.disabled = true;
          });
          commitAnswer(isCorrect);
        });
      });
    } else if(q.type === "self"){
      const revealBtn = document.getElementById("quizRevealBtn");
      revealBtn.addEventListener("click", function(){
        document.getElementById("quizReveal").classList.add("shown");
        document.getElementById("quizSelfButtons").classList.add("shown");
      });
      const selfButtons = notebookEl.querySelectorAll("#quizSelfButtons button");
      selfButtons.forEach(function(btn){
        btn.addEventListener("click", function(){
          if(quizState.answered) return;
          commitAnswer(btn.dataset.val === "true");
          selfButtons.forEach(function(b){ b.style.opacity = b === btn ? 1 : 0.4; });
        });
      });
    }

    nextBtn.addEventListener("click", function(){
      if(!quizState.answered) return;
      quizState.index++;
      renderQuizQuestion();
    });
  }

  function finishQuiz(){
    const answers = quizState.answers;
    const total = answers.length;
    const correct = answers.filter(function(a){ return a.correct; }).length;

    // Streak'i sadece quiz tamamlandığında güncelle
    updateStreak();

    const byLesson = {};
    answers.forEach(function(a){
      if(!byLesson[a.lessonId]) byLesson[a.lessonId] = { correct: 0, total: 0 };
      byLesson[a.lessonId].total++;
      if(a.correct) byLesson[a.lessonId].correct++;
    });
    Object.keys(byLesson).forEach(function(lessonId){
      recordLessonResult(lessonId, byLesson[lessonId].correct, byLesson[lessonId].total);
    });

    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    let msg;
    if(pct === 100) msg = "Mükemmel! Hepsi doğru. 🎉";
    else if(pct >= 70) msg = "Çok iyi gidiyorsun!";
    else if(pct >= 40) msg = "Fena değil, tekrar etmeye devam!";
    else msg = "Bu konuları tekrar gözden geçirmek iyi olabilir.";

    const finishedQuestions = quizState.questions;

    notebookEl.innerHTML =
      '<div class="notebook-inner">' +
        '<button class="nb-close" aria-label="Kapat">✕</button>' +
        '<div class="quiz-result">' +
          '<div class="score">' + correct + "/" + total + '</div>' +
          '<div class="msg">' + msg + "</div>" +
          '<button id="quizRetryBtn" class="retry-btn">↻ Tekrar Dene</button>' +
          '<button id="quizCloseBtn" class="close-btn">Kapat</button>' +
        "</div>" +
      "</div>";

    notebookEl.querySelector(".nb-close").addEventListener("click", closeQuiz);
    document.getElementById("quizCloseBtn").addEventListener("click", closeQuiz);
    document.getElementById("quizRetryBtn").addEventListener("click", function(){
      startQuiz(finishedQuestions);
    });
  }

  overlayEl.addEventListener("click", function(e){
    if(e.target === overlayEl){
      if(quizState) closeQuiz();
      else closeLesson();
    }
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape"){
      if(quizState) closeQuiz();
      else closeLesson();
    }
  });

  renderAll();

  // ---------- PWA: service worker + install prompt ----------
  if("serviceWorker" in navigator){
    window.addEventListener("load", function(){
      navigator.serviceWorker.register("sw.js").catch(function(err){
        console.warn("Service worker kaydı başarısız:", err);
      });
    });
  }

  let deferredPrompt = null;
  const installBar = document.getElementById("installBar");
  const installBtn = document.getElementById("installBtn");

  window.addEventListener("beforeinstallprompt", function(e){
    e.preventDefault();
    deferredPrompt = e;
    installBar.classList.add("show");
  });

  if(installBtn){
    installBtn.addEventListener("click", function(){
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function(){
        deferredPrompt = null;
        installBar.classList.remove("show");
      });
    });
  }

  window.addEventListener("appinstalled", function(){
    installBar.classList.remove("show");
  });
})();
