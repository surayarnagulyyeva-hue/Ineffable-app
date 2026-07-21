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

    if(data.lastDate === today) return data.streak; // bugün zaten sayıldı

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toDateString();

    let streak;
    if(data.lastDate === yStr) streak = data.streak + 1; // seri devam ediyor
    else streak = 1; // ara verilmiş, yeniden başla

    saveStreakData({ streak: streak, lastDate: today });
    return streak;
  }

  // ---------- Quiz generation (built from existing lesson data) ----------
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
      question: "Aşağıdakilerden hangisi '" + target.name + "' türüne bir örnektir?",
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
      question: "'" + types[idxA].name + "' şu şekilde kurulur/anlatılır: " + defUsed,
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
    return GRAMMAR_DATA[state.lang];
  }

  function renderTabs(){
    tabsEl.innerHTML = "";
    ["en","ru"].forEach(function(langKey){
      const data = GRAMMAR_DATA[langKey];
      const btn = document.createElement("button");
      btn.className = "tab-btn" + (state.lang === langKey ? " active" : "");
      btn.dataset.lang = langKey;
      btn.innerHTML = '<span class="dot"></span>' + data.label + " Grameri";
      btn.addEventListener("click", function(){
        state.lang = langKey;
        state.category = "all";
        renderAll();
      });
      tabsEl.appendChild(btn);
    });
  }

  function renderViewSwitch(){
    const btns = viewSwitchEl.querySelectorAll(".view-btn");
    btns.forEach(function(btn){
      btn.classList.toggle("active", btn.dataset.view === state.view);
      btn.onclick = function(){
        state.view = btn.dataset.view;
        state.category = "all";
        renderAll();
      };
    });
  }

  function renderChips(){
    chipsEl.innerHTML = "";
    const data = currentLangData();

    const allChip = document.createElement("button");
    allChip.className = "chip" + (state.category === "all" ? " active" : "");
    allChip.innerHTML = '<span class="mark">*</span> Tümü';
    allChip.addEventListener("click", function(){
      state.category = "all";
      renderAll();
    });
    chipsEl.appendChild(allChip);

    data.categories.forEach(function(cat){
      const chip = document.createElement("button");
      chip.className = "chip" + (state.category === cat.id ? " active" : "");
      chip.innerHTML = '<span class="mark">' + cat.mark + "</span>" + cat.label;
      chip.addEventListener("click", function(){
        state.category = cat.id;
        renderAll();
      });
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
    return '<span class="progress-badge ' + cls + '">' + icon + prog.best + "/" + prog.total + "</span>";
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
          header.innerHTML = '<span class="mark">' + catInfo.mark + "</span>" + catInfo.label;
          listEl.appendChild(header);
        }
      }

      const card = document.createElement("button");
      card.className = "lesson-card";
      card.innerHTML =
        '<span class="lc-left">' +
          '<span class="lc-term">' + lesson.term + "</span>" +
          '<span class="lc-def">' + lesson.pages[0].definition + "</span>" +
        "</span>" +
        '<span style="display:flex;align-items:center;">' +
          '<span class="level-badge">' + lesson.level + "</span>" +
          progressBadgeHtml(lesson.id) +
        "</span>";
      card.addEventListener("click", function(){ openLesson(lesson); });
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
      '<button class="pd-mix-btn" id="pdMixBtn" ' + (lessons.length === 0 ? "disabled" : "") + '>🔀 Karışık Pratik Başlat (' + Math.min(8, lessons.length) + ' ders)</button>';

    const mixBtn = document.getElementById("pdMixBtn");
    if(mixBtn){
      mixBtn.addEventListener("click", function(){
        const qs = buildMixedQuiz(lessons);
        startQuiz(qs);
      });
    }
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
        '<span class="pr-term">' + lesson.term + "</span>" +
        '<span style="display:flex;align-items:center;gap:8px;">' +
          progressBadgeHtml(lesson.id) +
          '<button class="pr-btn">Başlat</button>' +
        "</span>";
      row.querySelector(".pr-btn").addEventListener("click", function(){
        startQuiz(buildQuizForLesson(lesson));
      });
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
      const factsHtml = page.quickFacts.map(function(f){ return "<li>" + f + "</li>"; }).join("");
      const typesHtml = page.types.map(function(t){
        const exHtml = t.examples.join(" &middot; ");
        return (
          '<div class="nb-type">' +
            '<span class="arrow">&rarr;</span>' +
            '<span class="body">' +
              '<span class="name">' + t.name + "</span>" +
              '<div class="def">' + t.def + "</div>" +
              '<div class="ex">' + exHtml + "</div>" +
            "</span>" +
          "</div>"
        );
      }).join("");

      bodyHtml =
        '<span class="nb-level">SEVİYE ' + lesson.level + "</span>" +
        '<div class="nb-term-box">' + lesson.term + "</div>" +
        '<ul class="nb-facts">' + factsHtml + "</ul>" +
        '<div class="nb-def">' + page.definition + "</div>" +
        '<div class="nb-types-label">' + page.typesLabel + "</div>" +
        typesHtml;
    } else {
      const mistakesHtml = page.commonMistakes.map(function(m){ return "<li>" + m + "</li>"; }).join("");
      const moreExHtml = page.moreExamples.map(function(e){ return "<li>" + e + "</li>"; }).join("");

      bodyHtml =
        '<span class="nb-level">SEVİYE ' + lesson.level + "</span>" +
        '<div class="nb-term-box small">' + lesson.term + "</div>" +
        '<div class="nb-subheading">' + page.heading + "</div>" +
        '<div class="nb-block-label">Sık Yapılan Hatalar</div>' +
        '<ul class="nb-mistakes">' + mistakesHtml + "</ul>" +
        '<div class="nb-block-label">Ek Örnekler</div>' +
        '<ul class="nb-more-examples">' + moreExHtml + "</ul>" +
        '<div class="nb-tip"><span class="nb-tip-label">İpucu</span>' + page.tip + "</div>";
    }

    let practiceHtml = "";
    if(isLastPage){
      practiceHtml =
        '<div class="nb-practice">' +
          '<span class="label">Alıştırma</span>' +
          '<div class="q">' + lesson.practice.question + "</div>" +
          '<button class="nb-hint-btn">İpucunu göster</button>' +
          '<div class="nb-hint">' + lesson.practice.hint + "</div>" +
        "</div>" +
        '<button class="quiz-next-btn" id="startLessonQuizBtn" style="margin-top:10px;">📝 Bu Dersi Test Et</button>';
    }

    const pagerHtml =
      '<div class="nb-pager">' +
        '<button class="nb-pager-btn" id="nbPrev" ' + (isFirstPage ? "disabled" : "") + '>&larr; Önceki</button>' +
        '<span class="nb-pager-dots">' +
          lesson.pages.map(function(_, i){ return '<span class="dot' + (i === pageIndex ? " active" : "") + '"></span>'; }).join("") +
        "</span>" +
        '<button class="nb-pager-btn" id="nbNext" ' + (isLastPage ? "disabled" : "") + '>Sonraki &rarr;</button>' +
      "</div>";

    notebookEl.innerHTML =
      '<div class="notebook-inner">' +
        '<button class="nb-close" aria-label="Kapat">&times;</button>' +
        bodyHtml +
        practiceHtml +
        pagerHtml +
      "</div>";

    notebookEl.scrollTop = 0;

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
      '<div class="quiz-progress">Soru ' + (i + 1) + " / " + qs.length + " · " + q.lessonTerm + "</div>" +
      '<div class="quiz-question">' + q.question + "</div>";

    if(q.type === "mcq"){
      bodyHtml += '<div class="quiz-options" id="quizOptions">' +
        q.options.map(function(opt, idx){
          return '<button class="quiz-option" data-idx="' + idx + '">' + opt + "</button>";
        }).join("") +
      "</div>";
    } else if(q.type === "tf"){
      bodyHtml += '<div class="quiz-tf" id="quizTF">' +
        '<button data-val="true">Doğru</button>' +
        '<button data-val="false">Yanlış</button>' +
      "</div>";
    } else if(q.type === "self"){
      bodyHtml +=
        '<button class="nb-hint-btn" id="quizRevealBtn">Cevabı Gör</button>' +
        '<div class="quiz-self-reveal" id="quizReveal">' + q.hint + "</div>" +
        '<div class="quiz-self-buttons" id="quizSelfButtons">' +
          '<button data-val="true">Bildim ✓</button>' +
          '<button data-val="false">Bilemedim ✗</button>' +
        "</div>";
    }

    bodyHtml += '<button class="quiz-next-btn" id="quizNextBtn" disabled>' + (i === qs.length - 1 ? "Bitir" : "Sonraki →") + "</button>";

    notebookEl.innerHTML =
      '<div class="notebook-inner">' +
        '<button class="nb-close" aria-label="Kapat">&times;</button>' +
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
            if(val === q.answer) b.classList.add("correct");
            else if(b === btn) b.classList.add("wrong");
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
            if(bVal === q.answer) b.classList.add("correct");
            else if(b === btn) b.classList.add("wrong");
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
        '<button class="nb-close" aria-label="Kapat">&times;</button>' +
        '<div class="quiz-result">' +
          '<div class="score">' + correct + "/" + total + "</div>" +
          '<div class="msg">' + msg + "</div>" +
          '<button class="retry-btn" id="quizRetryBtn">🔁 Tekrar Dene</button>' +
          '<button class="close-btn" id="quizCloseBtn">Kapat</button>' +
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

  updateStreak();
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
