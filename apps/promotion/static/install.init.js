document.addEventListener("DOMContentLoaded", function() {
  // Önce elementlerin var olup olmadığını kontrol et
  const copyElements = document.querySelectorAll(".copy");
  const retryButton = document.querySelector("button[name='btn_check_script']");
  const statusMessage = document.querySelector(".status-message");
  const statusIcon = document.querySelector(".status-icon");
  const csrfTokenElement = document.querySelector('input[name="csrfmiddlewaretoken"]');
  const domainInput = document.querySelector("input[name='domain']");

  // Clipboard'ı sadece gerekli elementler varsa başlat
  if (copyElements.length > 0) {
    const clipboard = new Clipboard(".copy", {
      target: (trigger) => {
        const nextElement = trigger.nextElementSibling;
        // Güvenlik kontrolü
        if (!nextElement) {
          console.error("Copy target not found");
          return document.createElement('div'); // Fallback
        }
        return nextElement;
      },
    });

    clipboard.on("success", (event) => {
      event.trigger.textContent = "copied!";
      setTimeout(() => {
        event.clearSelection();
        event.trigger.textContent = "copy";
      }, 2000);
    });
  }

  // Diğer elementlerin de var olduğundan emin ol
  if (!retryButton || !statusMessage || !statusIcon || !csrfTokenElement || !domainInput) {
    console.error("Required elements not found in DOM");
    return;
  }

  const csrfToken = csrfTokenElement.value;

  function checkInstall() {
    const url = domainInput.value;

    statusIcon.innerHTML = "<i class='bi bi-arrow-repeat'></i>";
    statusMessage.textContent = "Checking...";

    fetch("/promotion/check_install", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-CSRFToken": csrfToken,
      },
      body: new URLSearchParams({
        domain: url
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error("Oops, we were unable to automatically verify if the installation code is present on this page. That does not necessarily mean the code is not installed, it can also mean our software was unable to identify it. Please, check manually if the code is present. Visit your website > Right mouse click > View Page Source and then search for 'wheelluck'");
      }
      return response.json();
    })
    .then(data => {
      statusMessage.textContent = data.message;

      if (data.script_exists) {
        statusIcon.innerHTML = '<i class="bi bi-check-circle text-success"></i>';
      } else {
        statusIcon.innerHTML = '<i class="bi bi-exclamation-circle text-danger"></i>';
      }
    })
    .catch(error => {
      statusMessage.textContent = error.message;
      statusIcon.innerHTML = '<i class="bi bi-exclamation-circle text-danger"></i>';
    });
  }

  checkInstall();

  retryButton.addEventListener("click", function() {
    checkInstall();
  });
});

// helper function
function isPrismClass(preTag) {
  return preTag.className.substring(0, 8) === "language";
}

if (typeof window !== 'undefined') {
  window.isPrismClass = isPrismClass;
}

