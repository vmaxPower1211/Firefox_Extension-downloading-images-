const state = {
    downloadQueue: [],
    completedDownloads: 0,
    totalDownloads: 0,
    downloadIDs: new Set(),
    failedDownloads: new Map(),
    maxRetries: 3,
    successfulDownloads: new Set(),
    activeTabId: null
};

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

function addRandomParameter(url) {
    const randomNum = Math.floor(Math.random() * 100000) + 1;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}bp=xar&ver=${randomNum}`;
}

function downloadImage(imageInfo) {
    if (
        state.successfulDownloads.has(imageInfo.url) || 
        state.downloadQueue.some(item => item.url === imageInfo.url)
    ) {
        console.log(`Skipping duplicate download: ${imageInfo.url}`);
        return Promise.resolve(); // Skip download if already handled
    }
    const urlWithParams = addRandomParameter(imageInfo.url);
    return browser.downloads.download({
        url: urlWithParams,
        filename: imageInfo.filename,
        saveAs: false,
        conflictAction: "uniquify"
    });
}


async function processQueue() {
    const uniqueQueue = state.downloadQueue.filter(
        (item, index, self) => self.findIndex(i => i.url === item.url) === index
    );
    state.downloadQueue = uniqueQueue; // De-duplicate the queue

    while (state.downloadQueue.length > 0) {
        const imageInfo = state.downloadQueue.shift();
        try {
            const downloadId = await downloadImage(imageInfo);
            if (downloadId) state.downloadIDs.add(downloadId); // Only add if download succeeds
        } catch (error) {
            console.error(`Error downloading ${imageInfo.url}:`, error);
            handleFailedDownload(imageInfo);
        }
    }
}



async function updateProgress() {
    const message = {
        action: "updateProgress",
        completed: state.completedDownloads,
        total: state.totalDownloads,
        failed: state.failedDownloads.size
    };
    
    try {
        await browser.runtime.sendMessage(message);
    } catch (error) {
        console.log("Could not send progress to popup, it might be closed");
    }
}

function resetState() {
    state.downloadQueue = [];
    state.completedDownloads = 0;
    state.totalDownloads = 0;
    state.downloadIDs.clear();
    state.failedDownloads.clear();
    state.successfulDownloads.clear();
}

let originalImageList = [];



browser.runtime.onMessage.addListener((message, sender) => {
    if (message.action === "downloadImages") {
        originalImageList = message.imageData;
        state.downloadQueue = [...message.imageData];
        state.totalDownloads = message.imageData.length;
        state.completedDownloads = 0;
        state.activeTabId = sender.tab ? sender.tab.id : null;
        processQueue();
    } 
    
});

browser.downloads.onChanged.addListener(async (delta) => {
    if (delta.state && delta.state.current === "complete" && state.downloadIDs.has(delta.id)) {
        try {
            const downloads = await browser.downloads.search({id: delta.id});
            if (downloads.length > 0) {
                state.successfulDownloads.add(downloads[0].url);
            }
        } catch (error) {
            console.error("Error searching download:", error);
        }
        
        state.completedDownloads++;
        await updateProgress();
        
        
    }
});