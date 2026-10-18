// The "rare email" sign up, shared by the home page and the blog, sent to Buttondown.
// Put the Buttondown username here (the name in https://buttondown.com/<username>)
// to switch it on. Until then every form stays hidden, so nobody types an email
// into a form that goes nowhere.
const BUTTONDOWN_USER = "amysterling";

// Buttondown asks for a plain form post, not fetch: a subscriber may need to finish
// a CAPTCHA or fix a typo on its page. Its response refuses to load in a frame
// (X-Frame-Options: DENY), so it opens in a small window, Buttondown's own recipe,
// and this page thanks the reader in place. If the window is blocked, a new tab.
// Form shape from docs.buttondown.com/code/building-your-subscriber-base/1.html.
if (BUTTONDOWN_USER) {
  for (const form of document.querySelectorAll("form.subscribe")) {
    form.action = `https://buttondown.com/api/emails/embed-subscribe/${encodeURIComponent(BUTTONDOWN_USER)}`;
    form.method = "post";
    const embed = document.createElement("input");
    embed.type = "hidden"; embed.name = "embed"; embed.value = "1";
    form.appendChild(embed);
    form.hidden = false;
    form.addEventListener("submit", () => {
      const w = 520, h = 560;
      const left = Math.max(0, (screen.availWidth - w) / 2), top = Math.max(0, (screen.availHeight - h) / 3);
      const pop = window.open("", "buttondown-subscribe", `width=${w},height=${h},left=${left},top=${top}`);
      form.target = pop ? "buttondown-subscribe" : "_blank";
      // let the post go out, then swap the form for a thank you
      setTimeout(() => {
        form.classList.add("done");
        const msg = form.querySelector(".sub-msg");
        if (msg) msg.innerHTML = "<strong>You're in.</strong> Thanks for signing up. A small Buttondown window confirms it, and you can close it. Have a fantastic day.";
      }, 50);
    });
  }
}
