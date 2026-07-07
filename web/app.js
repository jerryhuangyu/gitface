const pageRoutes = new Set([
  "overview",
  "profiles",
  "apply",
  "rules",
  "automation",
  "architecture",
]);

function pageFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");
  return pageRoutes.has(page) ? page : "overview";
}

function setActivePage(page) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.page === page);
  });
}

function loadInitialPage() {
  const page = pageFromLocation();
  const content = document.querySelector("#content");

  setActivePage(page);

  if (window.htmx && content) {
    window.htmx.ajax("GET", `./pages/${page}.html`, {
      target: "#content",
      swap: "innerHTML transition:true",
    });
    return;
  }

  if (content) {
    fetch(`./pages/${page}.html`)
      .then((response) => response.text())
      .then((html) => {
        content.innerHTML = html;
      });
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest(".copy-button");
  if (!button) return;

  const originalText = button.textContent;
  const text = button.dataset.copy;

  try {
    await copyText(text);
    button.textContent = "Copied";
    button.classList.add("is-copied");
    window.setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove("is-copied");
    }, 1200);
  } catch {
    button.textContent = "Failed";
    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1200);
  }
});

document.body.addEventListener("htmx:beforeRequest", (event) => {
  if (event.detail.target?.id === "content") {
    event.detail.target.classList.add("is-swapping");
  }
});

document.body.addEventListener("htmx:afterSwap", (event) => {
  if (event.detail.target?.id !== "content") return;

  const marker = event.detail.target.querySelector("[data-page-title]");
  const page = marker?.dataset.pageTitle ?? pageFromLocation();
  setActivePage(page);
  event.detail.target.classList.remove("is-swapping");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("popstate", () => {
  const page = pageFromLocation();
  setActivePage(page);
  if (window.htmx) {
    window.htmx.ajax("GET", `./pages/${page}.html`, {
      target: "#content",
      swap: "innerHTML transition:true",
    });
  }
});

window.addEventListener("DOMContentLoaded", loadInitialPage);
