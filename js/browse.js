(function () {
  "use strict";

  // Show Answer buttons
  document.querySelectorAll(".reveal-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var card = btn.closest(".question-card");
      var correctKeys = card.dataset.answer.split(",");
      var isCommunity = card.dataset.community === "true";

      card.querySelectorAll(".answer-option").forEach(function (opt) {
        if (correctKeys.includes(opt.dataset.key)) {
          opt.classList.add("correct");
        }
      });

      var label = correctKeys
        .filter(function (k) {
          return k;
        })
        .join(", ");
      if (!label) {
        var hasAnswerImg = card.querySelectorAll(".answer-image").length > 0;
        label = hasAnswerImg ? "See answer image below" : "See explanation";
      } else if (isCommunity) {
        label += " (Community voted)";
      }
      btn.textContent = label;
      btn.disabled = true;

      // Reveal answer images
      card.querySelectorAll(".answer-image").forEach(function (img) {
        img.removeAttribute("hidden");
      });
    });
  });

  // Explain with AI buttons
  document
    .querySelectorAll(".explain-btn:not([disabled])")
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest(".question-card");
        var explanation = card.dataset.explanation;
        var sourceUrl = card.dataset.sourceUrl || "";
        var box = card.querySelector(".ai-explanation");
        if (!explanation || !box) return;

        var processed = escapeHtml(explanation);
        if (sourceUrl) {
          processed +=
            '<br><a href="' +
            sourceUrl +
            '" target="_blank" rel="noopener">ServiceNow Docs Reference</a>';
        }

        btn.disabled = true;
        box.removeAttribute("hidden");
        box.classList.add("typing");

        typewrite(box, processed, function () {
          box.classList.remove("typing");
        });
      });
    });

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function typewrite(el, html, onDone) {
    // Parse HTML into segments: {type: "tag", value: "<a ...>"} or {type: "text", value: "H"}
    var segments = [];
    var i = 0;
    while (i < html.length) {
      if (html[i] === "<") {
        var end = html.indexOf(">", i);
        if (end !== -1) {
          segments.push({ type: "tag", value: html.slice(i, end + 1) });
          i = end + 1;
          continue;
        }
      }
      // Handle HTML entities like &amp; as single units
      if (html[i] === "&") {
        var semi = html.indexOf(";", i);
        if (semi !== -1 && semi - i < 10) {
          segments.push({ type: "text", value: html.slice(i, semi + 1) });
          i = semi + 1;
          continue;
        }
      }
      segments.push({ type: "text", value: html[i] });
      i++;
    }

    var output = "";
    var idx = 0;
    var speed = 12;

    function step() {
      if (idx >= segments.length) {
        el.innerHTML = output;
        if (onDone) onDone();
        return;
      }
      var seg = segments[idx++];
      output += seg.value;
      if (seg.type === "tag") {
        // Render tags instantly, continue to next segment without delay
        step();
      } else {
        el.innerHTML = output;
        setTimeout(step, speed);
      }
    }

    step();
  }
})();
