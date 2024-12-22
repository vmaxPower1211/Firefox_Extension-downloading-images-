document.addEventListener("DOMContentLoaded", () => {
    const startButton = document.getElementById("startButton");
    const progressContainer = document.getElementById("progressContainer");
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");
    const statusMessage = document.getElementById("statusMessage");

    startButton.addEventListener("click", () => {
        progressContainer.style.display = "block";
        // Button.style.display = "none";
        statusMessage.textContent = "Scrolling page to load images...";
        
        browser.tabs.query({ active: true, currentWindow: true })
            .then(tabs => {
                if (tabs[0]) {
                    return browser.tabs.sendMessage(tabs[0].id, { action: "startScrolling" });
                }
            })
            .catch(error => {
                console.error("Error starting scrolling:", error);
                statusMessage.textContent = "Error: Could not start scrolling";
            });
    });

    

    browser.runtime.onMessage.addListener((message) => {
        if (message.action === "updateProgress") {
            const { completed, total, failed } = message;
            const percentage = Math.floor((completed / total) * 100);
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `${completed}/${total}... ${percentage}%`;
            
            if (failed > 0) {
                statusMessage.textContent = `Failed downloads: ${failed}`;
            }

            
        } 
    });
});