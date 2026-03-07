(function () {
  "use strict";

  const app = document.getElementById("quiz-app");
  if (!app) return;

  const examSlug = app.dataset.exam;
  let examData = null;
  let quizQuestions = [];
  let currentIndex = 0;
  let selectedKeys = [];
  let results = [];
  let submitted = false;

  // Fisher-Yates shuffle
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === "className") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    });
    if (children) {
      if (typeof children === "string") e.textContent = children;
      else if (Array.isArray(children)) children.forEach(c => { if (c) e.appendChild(c); });
      else e.appendChild(children);
    }
    return e;
  }

  function elHTML(tag, attrs, html) {
    const e = el(tag, attrs);
    e.innerHTML = html;
    return e;
  }

  async function loadExam() {
    const resp = await fetch("data/" + examSlug + ".json");
    if (!resp.ok) throw new Error("Failed to load exam data");
    examData = await resp.json();
    renderConfig();
  }

  function renderConfig() {
    app.innerHTML = "";
    let chosenCount = 25;
    const total = examData.questions.length;

    const counts = [10, 25, 50].filter(n => n <= total);
    counts.push(total);

    const container = el("div", { className: "quiz-config" }, [
      el("h1", null, "Quiz: " + examData.exam),
      el("p", { className: "quiz-subtitle" }, total + " questions available"),
      el("p", { className: "quiz-label" }, "How many questions?"),
    ]);

    const btnRow = el("div", { className: "quiz-count-options" });
    counts.forEach(n => {
      const label = n === total ? "All (" + total + ")" : String(n);
      const btn = el("button", {
        className: "quiz-count-btn" + (n === chosenCount || (chosenCount > total && n === total) ? " selected" : ""),
        onClick: () => {
          chosenCount = n;
          btnRow.querySelectorAll(".quiz-count-btn").forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
        }
      }, label);
      btnRow.appendChild(btn);
    });

    // Auto-select first if 25 is larger than total
    if (chosenCount > total) chosenCount = counts[0];

    container.appendChild(btnRow);

    const startBtn = el("button", {
      className: "quiz-start-btn",
      onClick: () => startQuiz(chosenCount)
    }, "Start Quiz");
    container.appendChild(startBtn);

    app.appendChild(container);
  }

  function startQuiz(count) {
    quizQuestions = shuffle(examData.questions).slice(0, count);
    currentIndex = 0;
    selectedKeys = [];
    results = [];
    submitted = false;
    renderQuestion();
  }

  function renderQuestion() {
    app.innerHTML = "";
    const q = quizQuestions[currentIndex];
    const total = quizQuestions.length;
    const isMulti = q.answer.length > 1;
    selectedKeys = [];
    submitted = false;

    // Progress
    const pct = Math.round((currentIndex / total) * 100);
    const progress = el("div", { className: "quiz-progress" }, [
      el("div", { className: "quiz-progress-text" }, "Question " + (currentIndex + 1) + " of " + total),
      el("div", { className: "quiz-progress-bar" }, [
        el("div", { className: "quiz-progress-fill", style: "width:" + pct + "%" })
      ])
    ]);

    // Question card
    const card = el("div", { className: "quiz-question" });
    card.appendChild(el("h2", null, "Question " + q.id));
    card.appendChild(elHTML("p", { className: "quiz-stem" }, escapeAndFormat(q.stem)));

    if (isMulti) {
      card.appendChild(el("p", { className: "quiz-hint" }, "(Choose " + q.answer.length + ")"));
    }

    const optionsDiv = el("div", { className: "quiz-options" });
    q.options.forEach(opt => {
      const btn = el("button", {
        className: "quiz-option",
        onClick: () => toggleOption(btn, opt.key, isMulti)
      }, [
        el("span", { className: "option-key" }, opt.key + "."),
        document.createTextNode(" " + opt.text)
      ]);
      optionsDiv.appendChild(btn);
    });
    card.appendChild(optionsDiv);

    // Feedback area (hidden until submit)
    const feedbackEl = el("div", { className: "quiz-feedback", id: "quiz-feedback" });
    feedbackEl.style.display = "none";
    card.appendChild(feedbackEl);

    // Actions
    const actions = el("div", { className: "quiz-actions" });
    const submitBtn = el("button", {
      className: "quiz-btn",
      id: "submit-btn",
      onClick: () => submitAnswer(q)
    }, "Submit Answer");
    actions.appendChild(submitBtn);

    const nextBtn = el("button", {
      className: "quiz-btn",
      id: "next-btn",
      style: "display:none",
      onClick: nextQuestion
    }, currentIndex < total - 1 ? "Next Question" : "See Results");
    actions.appendChild(nextBtn);

    card.appendChild(actions);

    app.appendChild(progress);
    app.appendChild(card);
  }

  function escapeAndFormat(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  }

  function toggleOption(btn, key, isMulti) {
    if (submitted) return;
    if (isMulti) {
      btn.classList.toggle("selected");
      if (selectedKeys.includes(key)) {
        selectedKeys = selectedKeys.filter(k => k !== key);
      } else {
        selectedKeys.push(key);
      }
    } else {
      // Single select: deselect others
      btn.parentElement.querySelectorAll(".quiz-option").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedKeys = [key];
    }
  }

  function submitAnswer(q) {
    if (selectedKeys.length === 0 || submitted) return;
    submitted = true;

    const correct = q.answer.slice().sort().join("");
    const chosen = selectedKeys.slice().sort().join("");
    const isCorrect = correct === chosen;

    results.push({
      question: q,
      chosen: selectedKeys.slice(),
      correct: isCorrect
    });

    // Mark options
    const optionBtns = app.querySelectorAll(".quiz-option");
    optionBtns.forEach(btn => {
      btn.classList.add("disabled");
      const key = btn.querySelector(".option-key").textContent.replace(".", "");
      if (q.answer.includes(key)) {
        btn.classList.add("correct");
      }
      if (selectedKeys.includes(key) && !q.answer.includes(key)) {
        btn.classList.add("incorrect");
      }
    });

    // Show feedback
    const fb = document.getElementById("quiz-feedback");
    if (isCorrect) {
      fb.className = "quiz-feedback correct";
      fb.textContent = "Correct!";
    } else {
      fb.className = "quiz-feedback incorrect";
      fb.textContent = "Incorrect \u2014 the answer is " + q.answer.join(", ");
    }
    fb.style.display = "block";

    // Toggle buttons
    document.getElementById("submit-btn").style.display = "none";
    document.getElementById("next-btn").style.display = "inline-block";

    // Explain with AI button (only if explanation exists)
    if (q.explanation) {
      const card = app.querySelector(".quiz-question");
      const actions = card.querySelector(".quiz-actions");
      const explainBtn = el("button", {
        className: "explain-btn",
        onClick: () => {
          explainBtn.disabled = true;
          const box = card.querySelector(".ai-explanation");
          let processed = escapeHtmlSafe(q.explanation);
          if (q.source_url) {
            processed += '<br><a href="' + q.source_url + '" target="_blank" rel="noopener">ServiceNow Docs Reference</a>';
          }
          box.removeAttribute("hidden");
          box.classList.add("typing");
          typewrite(box, processed, () => box.classList.remove("typing"));
        }
      }, "Explain with AI");
      actions.appendChild(explainBtn);

      const explainBox = el("div", { className: "ai-explanation" });
      explainBox.setAttribute("hidden", "");
      card.appendChild(explainBox);
    }
  }

  function nextQuestion() {
    currentIndex++;
    if (currentIndex >= quizQuestions.length) {
      renderResults();
    } else {
      renderQuestion();
    }
  }

  function renderResults() {
    app.innerHTML = "";
    const correctCount = results.filter(r => r.correct).length;
    const total = results.length;
    const pct = Math.round((correctCount / total) * 100);

    const container = el("div", { className: "quiz-results" });
    container.appendChild(el("h1", null, "Results"));
    container.appendChild(el("p", { className: "quiz-score" },
      correctCount + "/" + total + " correct (" + pct + "%)"
    ));

    // Action buttons
    const missedCount = results.filter(r => !r.correct).length;
    const actions = el("div", { className: "quiz-actions", style: "margin-bottom:1.5rem" });

    if (missedCount > 0) {
      actions.appendChild(el("button", {
        className: "quiz-btn",
        onClick: retryMissed
      }, "Retry Missed (" + missedCount + ")"));
    }

    actions.appendChild(el("button", {
      className: "quiz-btn secondary",
      onClick: renderConfig
    }, "New Quiz"));

    container.appendChild(actions);

    // All questions review
    results.forEach((r, i) => {
      const card = el("div", { className: "quiz-result-card" + (r.correct ? "" : " wrong") });

      const header = el("div", { className: "result-header" }, [
        el("h3", null, "Question " + r.question.id),
        el("span", { className: "result-icon" }, r.correct ? "\u2713" : "\u2717")
      ]);
      card.appendChild(header);

      card.appendChild(elHTML("p", { className: "result-stem" }, escapeAndFormat(r.question.stem)));

      const answersDiv = el("div", { className: "result-answers" });
      answersDiv.appendChild(elHTML("div", { className: "your-answer" },
        "Your answer: " + (r.chosen.length > 0 ? r.chosen.join(", ") : "none")
      ));
      answersDiv.appendChild(elHTML("div", { className: "correct-answer" },
        "Correct answer: " + r.question.answer.join(", ")
      ));
      card.appendChild(answersDiv);

      container.appendChild(card);
    });

    app.appendChild(container);
  }

  function retryMissed() {
    const missed = results.filter(r => !r.correct).map(r => r.question);
    quizQuestions = shuffle(missed);
    currentIndex = 0;
    selectedKeys = [];
    results = [];
    submitted = false;
    renderQuestion();
  }

  function escapeHtmlSafe(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function typewrite(el, html, onDone) {
    const segments = [];
    let i = 0;
    while (i < html.length) {
      if (html[i] === "<") {
        const end = html.indexOf(">", i);
        if (end !== -1) { segments.push({ type: "tag", value: html.slice(i, end + 1) }); i = end + 1; continue; }
      }
      if (html[i] === "&") {
        const semi = html.indexOf(";", i);
        if (semi !== -1 && semi - i < 10) { segments.push({ type: "text", value: html.slice(i, semi + 1) }); i = semi + 1; continue; }
      }
      segments.push({ type: "text", value: html[i] });
      i++;
    }
    let output = "";
    let idx = 0;
    function step() {
      if (idx >= segments.length) { el.innerHTML = output; if (onDone) onDone(); return; }
      const seg = segments[idx++];
      output += seg.value;
      if (seg.type === "tag") { step(); }
      else { el.innerHTML = output; setTimeout(step, 12); }
    }
    step();
  }

  // Init
  loadExam().catch(err => {
    app.innerHTML = '<p style="color:#d73a49;">Failed to load exam data: ' + err.message + '</p>';
  });
})();
