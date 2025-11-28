let currentRoot = "";

// INITIALIZATION
async function init() {
    initNetwork(); // Setup Vis.js
    
    try {
        const response = await fetch('dm_rooms.csv');
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
    
    if (allRoomNames.length > 0) {
        const defaultRoom = allRoomNames.includes("Death Wave") ? "Death Wave" : allRoomNames[0];
        transitionToRoom(defaultRoom);
    }
}

function refreshCurrentView() {
    if(currentRoot) transitionToRoom(currentRoot);
}

// THE MAIN LOGIC
async function transitionToRoom(name) {
    currentRoot = name;
    
    // Sidebar highlight
    document.querySelectorAll('.room-item').forEach(el => {
        el.classList.remove('active');
        if(el.dataset.name === name) {
            el.classList.add('active');
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });

    // 1. Preload Images
    await preloadImagesForTree(name);
    
    // 2. Update Legend
    updateLegend(name);
    
    const networkDiv = document.getElementById('network');
    
    // 3. Fade Out
    networkDiv.style.opacity = 0;
    await new Promise(r => setTimeout(r, 100)); // Short fade

    // 4. Lock Layout for Calculation
    network.setOptions({ layout: { hierarchical: { enabled: true } } });

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
            network.setOptions({ layout: { hierarchical: { enabled: false } } });
        }, 600);
    }, 50);
}

window.onload = init;