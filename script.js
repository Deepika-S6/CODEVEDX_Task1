const STORAGE_KEY = "quizforge-data";

const seedData = {
  currentUser: null,
  users: [
    {
      id: "user-demo",
      name: "Demo Teacher",
      email: "demo@quizforge.local",
      password: "demo123"
    }
  ],
  quizzes: [
    {
      id: "quiz-space",
      title: "Space Starter",
      category: "Science",
      description: "A quick warm-up quiz about planets and space facts.",
      author: "Demo Teacher",
      createdAt: "2026-06-26T00:00:00.000Z",
      questions: [
        {
          text: "Which planet is known as the Red Planet?",
          options: ["Earth", "Mars", "Jupiter", "Venus"],
          correctIndex: 1
        },
        {
          text: "What is the center of our solar system?",
          options: ["The Moon", "The Sun", "Mars", "Saturn"],
          correctIndex: 1
        },
        {
          text: "Which planet has the most visible ring system?",
          options: ["Mercury", "Saturn", "Neptune", "Earth"],
          correctIndex: 1
        }
      ]
    },
    {
      id: "quiz-web",
      title: "Web Basics",
      category: "Technology",
      description: "Check your HTML, CSS, and JavaScript fundamentals.",
      author: "Demo Teacher",
      createdAt: "2026-06-26T00:00:00.000Z",
      questions: [
        {
          text: "Which language controls the structure of a web page?",
          options: ["HTML", "CSS", "SQL", "Python"],
          correctIndex: 0
        },
        {
          text: "Which CSS property changes text color?",
          options: ["font-style", "color", "display", "text-wrap"],
          correctIndex: 1
        }
      ]
    }
  ]
};

let state = loadState();
let activeQuiz = null;
let activeQuestionIndex = 0;
let selectedAnswers = [];
let toastTimer = null;

const views = {
  home: document.querySelector("#homeView"),
  auth: document.querySelector("#authView"),
  create: document.querySelector("#createView"),
  browse: document.querySelector("#browseView"),
  take: document.querySelector("#takeView"),
  results: document.querySelector("#resultsView")
};

const questionBuilder = document.querySelector("#questionBuilder");
const quizList = document.querySelector("#quizList");
const quizSearch = document.querySelector("#quizSearch");
const accountNav = document.querySelector("#accountNav");
const sessionStatus = document.querySelector("#sessionStatus");
const sessionHint = document.querySelector("#sessionHint");
const heroQuizCount = document.querySelector("#heroQuizCount");
const toast = document.querySelector("#toast");

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return structuredClone(seedData);
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      currentUser: parsed.currentUser || null,
      users: Array.isArray(parsed.users) ? parsed.users : seedData.users,
      quizzes: Array.isArray(parsed.quizzes) && parsed.quizzes.length ? parsed.quizzes : seedData.quizzes
    };
  } catch (error) {
    return structuredClone(seedData);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function showView(name) {
  Object.entries(views).forEach(([key, view]) => {
    view.classList.toggle("active", key === name);
  });

  document.querySelectorAll("[data-view-link]").forEach((button) => {
    button.classList.toggle("active", button.dataset.viewLink === name);
  });

  if (name === "browse") {
    renderQuizList();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getCurrentUser() {
  return state.users.find((user) => user.id === state.currentUser) || null;
}

function updateSession() {
  const user = getCurrentUser();
  accountNav.textContent = user ? user.name : "Login";
  sessionStatus.textContent = user ? `Signed in as ${user.name}` : "Browsing as guest";
  sessionHint.textContent = user
    ? "Your new quizzes will be published with your account name."
    : "Login to personalize quiz creation and keep your author name.";
  heroQuizCount.textContent = `${state.quizzes.length} available`;
}

function addQuestionBlock(question = null) {
  const index = questionBuilder.children.length;
  const block = document.createElement("section");
  block.className = "question-block";
  block.innerHTML = `
    <header>
      <h3>Question ${index + 1}</h3>
      <button class="remove-question" type="button" aria-label="Remove question">X</button>
    </header>
    <label>
      Question text
      <input type="text" class="question-text" value="${escapeAttribute(question?.text || "")}" required>
    </label>
    <div class="options-wrap">
      ${[0, 1, 2, 3].map((optionIndex) => `
        <label class="option-row">
          <input type="radio" name="correct-${Date.now()}-${index}" value="${optionIndex}" ${optionIndex === (question?.correctIndex ?? 0) ? "checked" : ""}>
          <input type="text" class="option-text" value="${escapeAttribute(question?.options?.[optionIndex] || "")}" placeholder="Option ${optionIndex + 1}" required>
        </label>
      `).join("")}
    </div>
  `;

  block.querySelector(".remove-question").addEventListener("click", () => {
    if (questionBuilder.children.length === 1) {
      showToast("A quiz needs at least one question.");
      return;
    }

    block.remove();
    renumberQuestions();
  });

  questionBuilder.appendChild(block);
}

function renumberQuestions() {
  [...questionBuilder.children].forEach((block, index) => {
    block.querySelector("h3").textContent = `Question ${index + 1}`;
  });
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function collectQuestions() {
  return [...questionBuilder.children].map((block) => {
    const text = block.querySelector(".question-text").value.trim();
    const options = [...block.querySelectorAll(".option-text")].map((input) => input.value.trim());
    const correctIndex = Number(block.querySelector("input[type='radio']:checked").value);

    return { text, options, correctIndex };
  });
}

function resetQuizForm() {
  document.querySelector("#quizForm").reset();
  questionBuilder.innerHTML = "";
  addQuestionBlock();
}

function renderQuizList() {
  const term = quizSearch.value.trim().toLowerCase();
  const quizzes = state.quizzes.filter((quiz) => {
    const haystack = `${quiz.title} ${quiz.category} ${quiz.description} ${quiz.author}`.toLowerCase();
    return haystack.includes(term);
  });

  quizList.innerHTML = "";

  if (!quizzes.length) {
    quizList.innerHTML = `<div class="empty-state">No quizzes match your search yet.</div>`;
    return;
  }

  quizzes.forEach((quiz) => {
    const card = document.createElement("article");
    card.className = "quiz-card";
    card.innerHTML = `
      <div>
        <p class="eyebrow">${escapeHtml(quiz.category)}</p>
        <h3>${escapeHtml(quiz.title)}</h3>
        <p>${escapeHtml(quiz.description || "No description provided.")}</p>
        <div class="quiz-meta">
          <span>${quiz.questions.length} questions</span>
          <span>By ${escapeHtml(quiz.author)}</span>
        </div>
      </div>
      <button class="button primary" type="button">Start Quiz</button>
    `;

    card.querySelector("button").addEventListener("click", () => startQuiz(quiz.id));
    quizList.appendChild(card);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function startQuiz(quizId) {
  activeQuiz = state.quizzes.find((quiz) => quiz.id === quizId);

  if (!activeQuiz) {
    showToast("Quiz not found.");
    return;
  }

  activeQuestionIndex = 0;
  selectedAnswers = Array(activeQuiz.questions.length).fill(null);
  renderActiveQuestion();
  showView("take");
}

function renderActiveQuestion() {
  const question = activeQuiz.questions[activeQuestionIndex];
  const progress = ((activeQuestionIndex + 1) / activeQuiz.questions.length) * 100;

  document.querySelector("#takeMeta").textContent = activeQuiz.title;
  document.querySelector("#takeTitle").textContent = question.text;
  document.querySelector("#questionProgress").textContent = `${activeQuestionIndex + 1} / ${activeQuiz.questions.length}`;
  document.querySelector("#progressBar").style.width = `${progress}%`;

  const answerOptions = document.querySelector("#answerOptions");
  answerOptions.innerHTML = "";

  question.options.forEach((option, index) => {
    const label = document.createElement("label");
    label.className = "option-label";
    label.innerHTML = `
      <input type="radio" name="active-answer" value="${index}" ${selectedAnswers[activeQuestionIndex] === index ? "checked" : ""}>
      <span>${escapeHtml(option)}</span>
    `;
    label.querySelector("input").addEventListener("change", () => {
      selectedAnswers[activeQuestionIndex] = index;
    });
    answerOptions.appendChild(label);
  });

  document.querySelector("#prevQuestionButton").disabled = activeQuestionIndex === 0;
  document.querySelector("#nextQuestionButton").textContent =
    activeQuestionIndex === activeQuiz.questions.length - 1 ? "Finish Quiz" : "Next";
}

function goToNextQuestion() {
  if (selectedAnswers[activeQuestionIndex] === null) {
    showToast("Choose an answer before continuing.");
    return;
  }

  if (activeQuestionIndex === activeQuiz.questions.length - 1) {
    renderResults();
    showView("results");
    return;
  }

  activeQuestionIndex += 1;
  renderActiveQuestion();
}

function renderResults() {
  const correctCount = activeQuiz.questions.reduce((total, question, index) => {
    return total + (question.correctIndex === selectedAnswers[index] ? 1 : 0);
  }, 0);
  const percent = Math.round((correctCount / activeQuiz.questions.length) * 100);

  document.querySelector("#scoreValue").textContent = `${percent}%`;
  document.querySelector("#scoreDetails").textContent = `${correctCount} of ${activeQuiz.questions.length} correct`;

  const review = document.querySelector("#answerReview");
  review.innerHTML = "";

  activeQuiz.questions.forEach((question, index) => {
    const isCorrect = question.correctIndex === selectedAnswers[index];
    const item = document.createElement("article");
    item.className = `review-item ${isCorrect ? "correct" : "incorrect"}`;
    item.innerHTML = `
      <strong>${index + 1}. ${escapeHtml(question.text)}</strong>
      <p>Your answer: ${escapeHtml(question.options[selectedAnswers[index]] || "No answer")}</p>
      <p>Correct answer: ${escapeHtml(question.options[question.correctIndex])}</p>
    `;
    review.appendChild(item);
  });
}

document.querySelectorAll("[data-view-link]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.viewLink));
});

document.querySelector("#registerForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const name = document.querySelector("#registerName").value.trim();
  const email = document.querySelector("#registerEmail").value.trim().toLowerCase();
  const password = document.querySelector("#registerPassword").value;

  if (state.users.some((user) => user.email === email)) {
    showToast("An account with this email already exists.");
    return;
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    password
  };

  state.users.push(user);
  state.currentUser = user.id;
  saveState();
  updateSession();
  event.target.reset();
  showToast(`Welcome, ${name}.`);
  showView("create");
});

document.querySelector("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const email = document.querySelector("#loginEmail").value.trim().toLowerCase();
  const password = document.querySelector("#loginPassword").value;
  const user = state.users.find((item) => item.email === email && item.password === password);

  if (!user) {
    showToast("Email or password is incorrect.");
    return;
  }

  state.currentUser = user.id;
  saveState();
  updateSession();
  event.target.reset();
  showToast(`Logged in as ${user.name}.`);
  showView("browse");
});

document.querySelector("#logoutButton").addEventListener("click", () => {
  state.currentUser = null;
  saveState();
  updateSession();
  showToast("Logged out.");
  showView("home");
});

document.querySelector("#addQuestionButton").addEventListener("click", () => addQuestionBlock());

document.querySelector("#quizForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const questions = collectQuestions();
  const hasEmptyQuestion = questions.some((question) => {
    return !question.text || question.options.some((option) => !option);
  });

  if (hasEmptyQuestion) {
    showToast("Complete every question and option before publishing.");
    return;
  }

  const user = getCurrentUser();
  const quiz = {
    id: crypto.randomUUID(),
    title: document.querySelector("#quizTitle").value.trim(),
    category: document.querySelector("#quizCategory").value.trim(),
    description: document.querySelector("#quizDescription").value.trim(),
    author: user ? user.name : "Guest Creator",
    createdAt: new Date().toISOString(),
    questions
  };

  state.quizzes.unshift(quiz);
  saveState();
  updateSession();
  resetQuizForm();
  showToast("Quiz published.");
  showView("browse");
});

quizSearch.addEventListener("input", renderQuizList);

document.querySelector("#prevQuestionButton").addEventListener("click", () => {
  if (activeQuestionIndex > 0) {
    activeQuestionIndex -= 1;
    renderActiveQuestion();
  }
});

document.querySelector("#nextQuestionButton").addEventListener("click", goToNextQuestion);

resetQuizForm();
updateSession();
renderQuizList();
