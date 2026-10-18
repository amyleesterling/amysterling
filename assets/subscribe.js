// The "rare email" sign up, shared by the home page and the blog, sent to Buttondown.
// Put the Buttondown username here (the name in https://buttondown.com/<username>)
// to switch it on. Until then every form stays hidden, so nobody types an email
// into a form that goes nowhere.
const BUTTONDOWN_USER = "";

// Buttondown asks for a plain form post, not fetch: a subscriber may need to finish
// a CAPTCHA or fix a typo on its page. It opens in a new tab so this page stays put.
// Form shape from docs.buttondown.com/code/building-your-subscriber-base/1.html.
if (BUTTONDOWN_USER) {
  for (const form of document.querySelectorAll("form.subscribe")) {
    form.action = `https://buttondown.com/api/emails/embed-subscribe/${encodeURIComponent(BUTTONDOWN_USER)}`;
    form.method = "post";
    form.target = "_blank";
    const embed = document.createElement("input");
    embed.type = "hidden"; embed.name = "embed"; embed.value = "1";
    form.appendChild(embed);
    form.hidden = false;
    form.addEventListener("submit", () => {
      const msg = form.querySelector(".sub-msg");
      if (msg) msg.textContent = "Check the new tab, then your inbox to confirm.";
    });
  }
}
