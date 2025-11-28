// Global State
let recipes = {};
let usedIn = {};
let roomImages = {}; // Map: Name -> Image URL
let imageCache = {}; // Map: Name -> Base64 Data URI
let allRoomNames = [];

function parseData(csvText) {
    recipes = {};
    usedIn = {};
    roomImages = {};
    allRoomNames = [];

    const lines = csvText.trim().split(/\r?\n/);
    let startIndex = 1; 

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if(!line) continue;
        
        const parts = line.split(',').map(s => s.trim());
        const target = parts[0];
        if(!target) continue;

        if(!allRoomNames.includes(target)) allRoomNames.push(target);

        // Col 1 is IMG
        if (parts[1] && parts[1].trim() !== "") {
            roomImages[target] = parts[1].trim();
        }

        // Columns 2-5 are Materials
        const mats = parts.slice(2, 6).filter(m => m !== "");
        recipes[target] = mats; 
        
        mats.forEach(mat => {
            if (!usedIn[mat]) usedIn[mat] = [];
            if (!usedIn[mat].includes(target)) usedIn[mat].push(target);
            if (!allRoomNames.includes(mat)) allRoomNames.push(mat);
        });
    }
    allRoomNames.sort();
}

function isBaseItem(name) {
    return !recipes[name] || recipes[name].length === 0;
}

function getWikiLink(name) {
    const slug = name.replace(/ /g, '_');
    return `https://duma-eng.fandom.com/wiki/${slug}`;
}

async function preloadImagesForTree(rootName) {
    const toLoad = new Set();
    const collect = (n) => { if(roomImages[n] && !imageCache[n]) toLoad.add(n); };

    collect(rootName);
    
    const traverse = (n, visited) => {
        if(visited.has(n)) return;
        visited.add(n);
        collect(n);
        (recipes[n]||[]).forEach(child => traverse(child, visited));
    };
    traverse(rootName, new Set());

    (usedIn[rootName]||[]).forEach(g => collect(g));

    const promises = Array.from(toLoad).map(async (name) => {
        try {
            const url = roomImages[name];
            const resp = await fetch(url);
            const blob = await resp.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => { imageCache[name] = reader.result; resolve(); };
                reader.readAsDataURL(blob);
            });
        } catch (err) { }
    });

    if (promises.length > 0) {
        const loading = document.getElementById('loading');
        loading.querySelector('div').textContent = "Loading Images...";
        loading.classList.add('active');
        await Promise.all(promises);
        loading.classList.remove('active');
    }
}