// The "rare email" sign up, shared by the home page and the blog.
// Paste the Google Apps Script web app /exec URL here to switch it on.
// Until then every form stays hidden, so nobody types an email into a form that goes nowhere.
const SUBSCRIBE_URL = "";

if (SUBSCRIBE_URL) {
  for (const form of document.querySelectorAll("form.subscribe")) {
    const msg = form.querySelector(".sub-msg");
    form.hidden = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (form.website.value) return; // honeypot
      const email = form.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "That email doesn't look right."; return; }
      msg.textContent = "Signing you up…";
      try {
        await fetch(SUBSCRIBE_URL, { method: "POST", mode: "no-cors", body: new URLSearchParams({ email, source: location.pathname }) });
        form.reset();
        msg.textContent = "Thanks for signing up. Have a fantastic day.";
      } catch {
        msg.textContent = "That didn't go through. Try again in a minute.";
      }
    });
  }
}
