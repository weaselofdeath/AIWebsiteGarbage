let currentRoot = "";

// INITIALIZATION
async function init() {
    initNetwork(); // Setup Vis.js
    
    try {
        // Cache-busting for the new CSV structure
        const response = await fetch(`dm_rooms.csv?t=${Date.now()}`);
        if (response.ok) {
            const text = await response.text();
            loadData(text);
            return;
        } else {
            throw new Error("File not found");
        }
    } catch (e) {
        console.log("Auto-load failed.", e);
        document.getElementById('loading').querySelector('div').textContent = "Load Failed";
        document.getElementById('errorDetails').innerHTML = `Could not load <b>dm_rooms.csv</b>.<br>Ensure file exists and use a local server.`;
    }
}

function loadData(csvText) {
    parseData(csvText);
    renderRoomList();
    document.getElementById('loading').classList.remove('active');
    // REMOVED AUTO-LOAD LOGIC
}

function refreshCurrentView() {
    if(currentRoot) transitionToRoom(currentRoot);
}

// THE MAIN LOGIC
async function transitionToRoom(name) {
    currentRoot = name;
    
    // Hide Empty State Message
    const emptyMsg = document.getElementById('emptyStateMessage');
    if (emptyMsg) emptyMsg.style.display = 'none';

    // --- SIDEBAR HIGHLIGHT & FOLDER EXPANSION ---
    // 1. Update Global Folder State (Persistence)
    if (window.expandFolderForRoom) {
        expandFolderForRoom(name);
    }

    // 2. Reset all active states
    const allItems = document.querySelectorAll('.room-item');
    allItems.forEach(el => el.classList.remove('active'));

    // 3. Find the active item
    const activeItem = Array.from(allItems).find(el => el.dataset.name === name);
    
    if (activeItem) {
        activeItem.classList.add('active');
        
        // 4. Auto-expand parent folder (Visual Update)
        const folderList = activeItem.closest('.folder-items');
        if (folderList) {
            const folderHeader = folderList.previousElementSibling;
            
            // CHECK: Only expand if NOT already expanded
            if (folderHeader && !folderHeader.classList.contains('expanded')) {
                // Open it visually
                folderHeader.classList.add('expanded');
                folderList.style.maxHeight = folderList.scrollHeight + "px";
                
                // Delay scroll to allow animation to finish
                setTimeout(() => {
                    activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 300);
            } else {
                // Already open? Scroll immediately (No delay)
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    // 1. Preload Images
    await preloadImagesForTree(name);
    
    // 2. Update Legend
    updateLegend(name);
    
    const networkDiv = document.getElementById('network');
    
    // 3. Fade Out
    networkDiv.style.opacity = 0;
    await new Promise(r => setTimeout(r, 100)); // Short fade

    // 4. Lock Layout for Calculation
    network.setOptions({ 
        layout: { hierarchical: { enabled: true } },
        edges: { smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.5 } }
    });

    // 5. Build & Diff
    const newGraph = buildGraphData(name);
    const currentIds = nodesDS.getIds();
    const newIds = newGraph.nodes.map(n => n.id);
    
    nodesDS.remove(currentIds.filter(id => !newIds.includes(id)));
    nodesDS.update(newGraph.nodes);
    edgesDS.clear();
    edgesDS.add(newGraph.edges);

    // 6. Fit & Fade In
    setTimeout(() => {
        network.fit({ animation: false });
        networkDiv.style.opacity = 1;
        
        // 7. Unlock for free movement
        setTimeout(() => {
            network.setOptions({ 
                layout: { hierarchical: { enabled: false } },
                edges: { smooth: { type: 'continuous', forceDirection: 'none' } }
            });
        }, 600);
    }, 50);
}

window.onload = init;