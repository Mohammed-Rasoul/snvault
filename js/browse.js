(function () {
  "use strict";
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

      var label = correctKeys.join(", ");
      if (isCommunity) label += " (Community voted)";
      btn.textContent = label;
      btn.disabled = true;
    });
  });
})();
