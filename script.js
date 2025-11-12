// ===== State =====
let selectedQuestions = [];
let userAnswers = [];
let timer;
let timeRemaining = 0;

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  const topicGroups = {
    "Green Associate Core": [
      "LEED Process & Certification (LP)",
      "Integrative Strategies (IS)",
      "Project Surroundings & Public Outreach (PS)",
      "Synergies & Trade-offs (ST)",
      "Standards, Codes & Regulations (SC)",
      "Occupant Comfort & Education (OC)",
      "Performance Metrics & Reporting (PM)"
    ],
    "LEED AP BD+C Credits": [
      "Location & Transportation (LT)",
      "Sustainable Sites (SS)",
      "Water Efficiency (WE)",
      "Energy & Atmosphere (EA)",
      "Materials & Resources (MR)",
      "Indoor Environmental Quality (EQ)",
      "Innovation (IN)",
      "Regional Priority (RP)"
    ]
  };

  const container = document.getElementById("topicContainer");
  for (const [group, list] of Object.entries(topicGroups)) {
    const heading = document.createElement("h4");
    heading.textContent = group;
    container.appendChild(heading);
    list.forEach(t => {
      const c = document.createElement("input");
      c.type = "checkbox"; c.value = t; c.id = "topic_" + t;
      const label = document.createElement("label");
      label.htmlFor = c.id; label.textContent = " " + t;
      container.appendChild(c); container.appendChild(label);
      container.appendChild(document.createElement("br"));
    });
  }


  // Auto-time scaling
  document.getElementById("numQuestions").addEventListener("input", e => {
    const num = parseInt(e.target.value);
    const newTime = Math.round(num * 1.2);
    document.getElementById("timeLimit").value = newTime;
  });

  // Download config.json
  document.getElementById("downloadConfigBtn").addEventListener("click", () => {
    const numQuestions = parseInt(document.getElementById("numQuestions").value);
    const timeLimit = parseInt(document.getElementById("timeLimit").value);
    const selectedTopics = [...document.querySelectorAll("#topicContainer input:checked")].map(el => el.value);
    const config = { num_questions: numQuestions, time_limit: timeLimit, topics: selectedTopics };
    const blob = new Blob([JSON.stringify(config, null, 2)], {type:"application/json"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "config.json";
    link.click();
  });

  // Start Exam (now driven entirely by questions.json)
document.getElementById("startExamBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("questionFile");
  if (!fileInput.files[0]) return alert("Upload a questions.json file first!");

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);

      // Expect structure { exam: {...}, questions: [...] }
      if (!data.questions || !data.exam) {
        alert("Invalid format. The file must contain 'exam' and 'questions' sections.");
        return;
      }

      const { num_questions, time_limit } = data.exam;
      selectedQuestions = data.questions.slice(0, num_questions);
      startExamWithParams(selectedQuestions, time_limit);
    } catch (err) {
      alert("Invalid questions.json: " + err.message);
    }
  };
  reader.readAsText(fileInput.files[0]);
});

function startExamWithParams(questions, timeLimit) {
  clearInterval(timer);
  document.getElementById("setup").style.display = "none";
  document.getElementById("exam").style.display = "block";

  loadExam(questions);
  startTimer(timeLimit * 60);
}


  // Submit Exam
  document.getElementById("submitBtn").addEventListener("click", gradeExam);

  // Restart
  document.getElementById("restartBtn").addEventListener("click", () => location.reload());

  // Download results.json
  document.getElementById("downloadResultsBtn").addEventListener("click", downloadResults);

  // Base64 helper
  document.getElementById("helperDownloadBtn").addEventListener("click", () => {
    const input = document.getElementById("b64Helper").value.trim();
    if (!input) return alert("Paste Base64 first!");
    const clean = input.replace(/-----BEGIN.*?-----/gi, "")
                       .replace(/-----END.*?-----/gi, "")
                       .replace(/\s+/g, "");
    try {
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      let text = new TextDecoder("utf-8").decode(bytes);
      text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
      JSON.parse(text);
      const blob = new Blob([text], {type:"application/json"});
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "questions.json";
      link.click();
      URL.revokeObjectURL(link.href);
      alert("✅ questions.json downloaded!");
    } catch (err) {
      alert("Decoding failed: " + err.message);
    }
  });
});

// ===== Exam Flow =====
function startExam(questions) {
  // Reset
  userAnswers = [];
  clearInterval(timer);

  document.getElementById("setup").style.display = "none";
  document.getElementById("exam").style.display = "block";

  // Use requested count
  selectedQuestions = questions.slice(0, n);

  loadExam(selectedQuestions);
  startTimer(parseInt(document.getElementById("timeLimit").value) * 60);
}

function loadExam(questions) {
  const form = document.getElementById("examForm");
  form.innerHTML = "";
  questions.forEach((q, idx) => {
    const div = document.createElement("div");
    div.className = "exam-item";
    div.innerHTML = `<h3>${idx + 1}. ${q.question}</h3>`;
    q.options.forEach(opt => {
      const id = `q${idx}_${sanitizeId(opt)}`;
      const label = document.createElement("label");
      label.htmlFor = id;
      const input = document.createElement("input");
      input.type = "radio";
      input.id = id;
      input.name = "q" + idx;
      input.value = opt;
      label.appendChild(input);
      label.appendChild(document.createTextNode(" " + opt));
      div.appendChild(label);
      div.appendChild(document.createElement("br"));
    });
    form.appendChild(div);
    form.appendChild(document.createElement("hr"));
  });
}

// Avoid id collisions on options
function sanitizeId(text) {
  return text.replace(/[^a-zA-Z0-9_-]/g, "");
}

// ===== Timer (with static thresholds you asked for earlier) =====
function startTimer(seconds) {
  timeRemaining = seconds;
  updateTimer();
  clearInterval(timer);
  timer = setInterval(() => {
    timeRemaining--;
    updateTimer();
    if (timeRemaining <= 0) {
      clearInterval(timer);
      gradeExam();
    }
  }, 1000);
}

function updateTimer() {
  const el = document.getElementById("timer");
  const m = Math.floor(timeRemaining / 60);
  const s = timeRemaining % 60;
  el.textContent = `Time Left: ${m}:${s.toString().padStart(2, "0")}`;

  // Static thresholds
  if (timeRemaining > 600) {            // >10 min
    el.style.background = "#2ecc71";   // green
    el.style.animation = "none";
  } else if (timeRemaining > 300) {     // 5–10 min
    el.style.background = "#f1c40f";   // yellow
    el.style.animation = "none";
  } else if (timeRemaining > 120) {     // 2–5 min
    el.style.background = "#e67e22";   // orange
    el.style.animation = "none";
  } else {                              // <2 min
    el.style.background = "#e74c3c";   // red
    el.style.animation = "flashRed 1s infinite";
  }
}

// ===== Grading & Results =====
function gradeExam() {
  clearInterval(timer);

  // Collect user answers
  const form = document.getElementById("examForm");
  const fd = new FormData(form);
  userAnswers = selectedQuestions.map((_, idx) => fd.get("q" + idx) || null);

  // Tally
  let correct = 0;
  const breakdown = {};
  const perQuestion = [];

  selectedQuestions.forEach((q, idx) => {
    const ua = userAnswers[idx];
    const isCorrect = ua === q.answer;
    if (isCorrect) correct++;

    if (!breakdown[q.topic]) breakdown[q.topic] = { correct: 0, total: 0 };
    breakdown[q.topic].total++;
    if (isCorrect) breakdown[q.topic].correct++;

    perQuestion.push({
      index: idx + 1,
      topic: q.topic,
      question: q.question,
      user_answer: ua,
      correct_answer: q.answer,
      is_correct: isCorrect
    });
  });

  const scorePct = ((correct / selectedQuestions.length) * 100).toFixed(1);

  // Swap views
  document.getElementById("exam").style.display = "none";
  document.getElementById("result").style.display = "block";

  // Summary
  document.getElementById("score").textContent =
    `Overall Score: ${scorePct}% (${correct}/${selectedQuestions.length})`;

  // Category table
  const table = document.createElement("table");
  table.className = "results-table";
  table.innerHTML = `
    <tr><th>Category</th><th>Correct</th><th>Total</th><th>Accuracy</th></tr>
  `;
  for (const [topic, stats] of Object.entries(breakdown)) {
    const acc = ((stats.correct / stats.total) * 100).toFixed(1);
    table.innerHTML += `<tr><td>${topic}</td><td>${stats.correct}</td><td>${stats.total}</td><td>${acc}%</td></tr>`;
  }
  const breakdownDiv = document.getElementById("breakdown");
  breakdownDiv.innerHTML = "";
  breakdownDiv.appendChild(table);

  // Review list (every question)
  renderReview(perQuestion);

  // Prepare results.json payload for Download button
  window.__latestResults__ = {
    overall_score_percent: Number(scorePct),
    total_correct: correct,
    total_questions: selectedQuestions.length,
    category_breakdown: breakdown,
    questions: perQuestion,
    timestamp: new Date().toISOString()
  };
}

function renderReview(perQuestion) {
  const review = document.getElementById("review");
  review.innerHTML = "";

  perQuestion.forEach((item, idx) => {
    const q = selectedQuestions[idx]; // access original options
    const ua = item.user_answer;
    const ca = item.correct_answer;

    const div = document.createElement("div");
    div.className = "review-item " + (item.is_correct ? "correct" : "incorrect");

    // Header & meta
    div.innerHTML = `
      <div class="review-q">${item.index}. ${item.question}</div>
      <div class="review-meta">
        <b>Topic:</b> ${item.topic}
        <span class="badge ${item.is_correct ? "badge-correct" : "badge-incorrect"}">
          ${item.is_correct ? "Correct" : "Incorrect"}
        </span>
      </div>
    `;

    // All choices with highlighting
    const list = document.createElement("div");
    list.className = "choice-list";

    q.options.forEach(opt => {
      const row = document.createElement("div");
      row.className = "choice";

      // Always mark the correct answer green
      if (opt === ca) row.classList.add("correct");

      // If user got it wrong, mark their pick red
      if (!item.is_correct && ua === opt) {
        row.classList.add("selected-wrong");
      }

      // Optional: visually tag the user’s selection (blue border if correct pick)
      if (ua === opt && item.is_correct) {
        row.classList.add("selected");
      }

      row.textContent = opt;
      // tiny helper label
      if (opt === ca) {
        const tag = document.createElement("small");
        tag.textContent = " (correct)";
        row.appendChild(tag);
      } else if (ua === opt) {
        const tag = document.createElement("small");
        tag.textContent = item.is_correct ? " (your choice)" : " (your choice — incorrect)";
        row.appendChild(tag);
      }
      list.appendChild(row);
    });

    // Your answer vs correct answer (kept for clarity)
    const your = document.createElement("div");
    your.innerHTML = `<div><b>Your answer:</b> ${ua ?? "<i>None selected</i>"}</div>
                      <div><b>Correct answer:</b> ${ca}</div>`;

    div.appendChild(list);
    div.appendChild(your);
    review.appendChild(div);
  });
}


function downloadResults() {
  const results = window.__latestResults__;
  if (!results) return alert("No results to download yet.");
  const blob = new Blob([JSON.stringify(results, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "results.json";
  a.click();
  URL.revokeObjectURL(a.href);
}
