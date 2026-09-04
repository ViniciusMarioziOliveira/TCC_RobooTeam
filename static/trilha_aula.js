const lessonShell = document.querySelector(".lesson-shell");
const questions = [...document.querySelectorAll(".quiz-question")];
const quizProgress = document.querySelector("#quiz-progress");
const finishButton = document.querySelector("#finish-button");
const quiz = JSON.parse(lessonShell.dataset.quiz);
const answeredCorrectly = new Set();
const selectedAnswers = Array(questions.length).fill(null);


questions.forEach((question, questionIndex) => {
  question.querySelectorAll(".quiz-option").forEach((option) => {
    option.addEventListener("click", () => {
      question.querySelectorAll(".quiz-option").forEach((currentOption) => currentOption.classList.remove("selected", "incorrect", "correct"));
      option.classList.add("selected");
      const feedback = question.querySelector(".quiz-feedback");
      const selectedAnswer = Number(option.dataset.option);
      selectedAnswers[questionIndex] = selectedAnswer;

      if (selectedAnswer === quiz[questionIndex].answer) {
        option.classList.add("correct");
        feedback.textContent = "Resposta correta.";
        feedback.className = "quiz-feedback correct-text";
        answeredCorrectly.add(questionIndex);
      } else {
        option.classList.add("incorrect");
        feedback.textContent = "Ainda não. Revise esta parte e tente novamente.";
        feedback.className = "quiz-feedback incorrect-text";
        answeredCorrectly.delete(questionIndex);
      }

      quizProgress.textContent = `${answeredCorrectly.size} de ${questions.length} perguntas corretas`;
      finishButton.disabled = answeredCorrectly.size !== questions.length;
    });
  });
});

finishButton.addEventListener("click", async () => {
  if (answeredCorrectly.size !== questions.length) return;

  const token = localStorage.getItem("robooteam-token") || sessionStorage.getItem("robooteam-token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  finishButton.disabled = true;
  finishButton.textContent = "Salvando progresso...";

  try {
    const response = await fetch(lessonShell.dataset.completeUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ respostas: selectedAnswers }),
    });
    const result = await response.json();

    if (response.status === 401 || response.status === 403) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok) {
      quizProgress.textContent = result.error || "Não foi possível concluir a etapa.";
      quizProgress.classList.add("incorrect-text");
      finishButton.disabled = false;
      finishButton.textContent = "Tentar concluir novamente";
      return;
    }

    quizProgress.textContent = "Etapa concluída! Progresso salvo.";
    quizProgress.classList.remove("incorrect-text");
    quizProgress.classList.add("correct-text");
    finishButton.textContent = "Concluído";
    setTimeout(() => {
      window.location.href = lessonShell.dataset.returnUrl;
    }, 650);
  } catch {
    quizProgress.textContent = "Não foi possível conectar ao servidor.";
    quizProgress.classList.add("incorrect-text");
    finishButton.disabled = false;
    finishButton.textContent = "Tentar concluir novamente";
  }
});
