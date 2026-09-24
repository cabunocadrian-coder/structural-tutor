const problemInput = document.getElementById("problem");
const solveBtn = document.getElementById("solveBtn");
const loading = document.getElementById("loading");
const resultCard = document.getElementById("resultCard");
const result = document.getElementById("result");
const examples = document.querySelectorAll(".example");
const aiBadge = document.querySelector(".ai-badge");

async function solveProblem() {
  const problem = problemInput.value.trim();

  if (!problem) {
    resultCard.classList.remove("hidden");

    result.innerHTML = `
      <div class="solution-error">
        <strong>No problem entered</strong>
        <p>Please enter a structural engineering problem first.</p>
      </div>
    `;

    return;
  }

  loading.classList.remove("hidden");
  resultCard.classList.add("hidden");
  solveBtn.disabled = true;

  try {
    const response = await fetch("/api/solve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        problem
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to solve the problem."
      );
    }

    /* =========================
       UPDATE SOURCE BADGE
    ========================= */

    if (aiBadge) {
      if (data.source === "deterministic") {
        aiBadge.textContent = "VERIFIED";
        aiBadge.classList.add("verified-badge");
      } else {
        aiBadge.textContent = "QVAC LOCAL";
        aiBadge.classList.remove("verified-badge");
      }
    }

    result.innerHTML = formatSolution(
      data.answer || ""
    );

    resultCard.classList.remove("hidden");

    resultCard.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {
    resultCard.classList.remove("hidden");

    if (aiBadge) {
      aiBadge.textContent = "ERROR";
      aiBadge.classList.remove("verified-badge");
    }

    result.innerHTML = `
      <div class="solution-error">
        <strong>Unable to solve</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  } finally {
    loading.classList.add("hidden");
    solveBtn.disabled = false;
  }
}

/* =========================
   FORMAT SOLUTION
========================= */

function formatSolution(text) {
  if (!text || typeof text !== "string") {
    return `
      <div class="solution-error">
        <strong>No solution returned.</strong>
      </div>
    `;
  }

  const sections = [
    "GIVEN:",
    "FORMULA:",
    "SOLUTION:",
    "ANSWER:",
    "CONCEPT:"
  ];

  let html = escapeHtml(text);

  sections.forEach((section) => {
    html = html.replace(
      new RegExp(section, "g"),
      `|||${section}|||`
    );
  });

  const parts = html
    .split("|||")
    .filter((part) => part.trim() !== "");

  let output = "";

  for (let i = 0; i < parts.length; i += 2) {
    const heading = parts[i]?.trim();
    const content = parts[i + 1]?.trim();

    if (!heading || !content) {
      continue;
    }

    let className = "solution-section";

    if (heading === "ANSWER:") {
      className = "solution-section answer-section";
    }

    if (heading === "FORMULA:") {
      className = "solution-section formula-section";
    }

    output += `
      <div class="${className}">
        <div class="solution-heading">
          ${heading.replace(":", "")}
        </div>

        <div class="solution-content">
          ${content.replace(/\n/g, "<br>")}
        </div>
      </div>
    `;
  }

  if (!output) {
    return `
      <div class="solution-section">
        <div class="solution-content">
          ${html.replace(/\n/g, "<br>")}
        </div>
      </div>
    `;
  }

  return output;
}

/* =========================
   HTML SAFETY
========================= */

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================
   SOLVE BUTTON
========================= */

solveBtn.addEventListener(
  "click",
  solveProblem
);

/* =========================
   EXAMPLE BUTTONS
========================= */

examples.forEach((example) => {
  example.addEventListener(
    "click",
    async () => {
      problemInput.value =
        example.dataset.problem;

      await solveProblem();
    }
  );
});

/* =========================
   CTRL + ENTER
========================= */

problemInput.addEventListener(
  "keydown",
  (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter"
    ) {
      solveProblem();
    }
  }
);