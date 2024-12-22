let isScrolling = false;
let scrollingComplete = false;

function getSecondLastWord(url) {
    const parts = url.split("/").filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 2] : "unknown";
}

function getSecondLastWordFromQuery(url) {
    try {
        const lastPart = url.split("/").pop();
        const beforeQuery = lastPart.split("?")[0];
        const parts = beforeQuery.split("/").filter(Boolean);
        return parts.length > 0 ? parts[parts.length - 1] : "unknown";
    } catch (error) {
        console.error("Error extracting query word:", error);
        return "unknown";
    }
}

function extractImageData(url) {
    const secondLastWord = getSecondLastWord(url);
    const queryWord = getSecondLastWordFromQuery(url);
    
    const imageDiv = document.getElementById("divImage");
    if (!imageDiv) {
        console.error("Image div not found");
        return [];
    }
    
    const images = Array.from(imageDiv.getElementsByTagName("img"));
    return images.map((img, index) => {
        const pageNum = (index + 1).toString().padStart(3, "0");
        return {
            url: img.src,
            filename: `${secondLastWord}_${queryWord}_${pageNum}.jpg`
        };
    });
}

function areImagesLoaded() {
    const images = document.querySelectorAll('#divImage img');
    return Array.from(images).every(img => img.complete && img.naturalHeight !== 0);
}

function isScrolledToBottom() {
    return Math.abs(window.innerHeight + window.scrollY - document.documentElement.scrollHeight) < 10;
}

async function scrollPageUntilRendered() {
    if (isScrolling) return;
    
    isScrolling = true;
    let lastScrollPosition = -1;
    let stuckCounter = 0;
    let lastImagesCount = 0;
    let sameImageCountCounter = 0;
    
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            const currentScrollY = window.scrollY;
            const currentImagesCount = document.querySelectorAll('#divImage img').length;
            
            if (currentScrollY === lastScrollPosition) {
                stuckCounter++;
            } else {
                stuckCounter = 0;
                lastScrollPosition = currentScrollY;
            }
            
            if (currentImagesCount === lastImagesCount) {
                sameImageCountCounter++;
            } else {
                sameImageCountCounter = 0;
                lastImagesCount = currentImagesCount;
            }
            
            window.scrollBy(0, window.innerHeight);
            
            const isAtBottom = isScrolledToBottom();
            const allImagesLoaded = areImagesLoaded();
            const isStuck = stuckCounter >= 3;
            const noNewImages = sameImageCountCounter >= 5;
            
            if ((isAtBottom && allImagesLoaded) || (isStuck && noNewImages && allImagesLoaded)) {
                clearInterval(checkInterval);
                isScrolling = false;
                scrollingComplete = true;
                
                setTimeout(() => {
                    window.scrollTo(0, 0);
                    resolve();
                }, 2000);
            }
        }, 1000);
    });
}

async function startDownload() {
    if (!scrollingComplete) {
        console.log("Waiting for scrolling to complete...");
        return;
    }
    
    const imageData = extractImageData(window.location.href);
    if (imageData.length > 0) {
        try {
            await browser.runtime.sendMessage({
                action: "downloadImages",
                imageData: imageData
            });
        } catch (error) {
            console.error("Error sending download message:", error);
        }
    } else {
        console.error("No images found to download");
    }
}

browser.runtime.onMessage.addListener(async (message) => {
    if (message.action === "startScrolling") {
        scrollingComplete = false;
        await scrollPageUntilRendered();
        await startDownload();
    }
});