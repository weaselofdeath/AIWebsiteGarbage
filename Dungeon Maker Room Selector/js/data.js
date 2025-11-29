// Global State
let recipes = {};
let usedIn = {};
let roomImages = {}; // Map: Name -> Image URL
let roomWiki = {};   // Map: Name -> Wiki URL
let roomTypes = {};  // Map: Name -> Type string
let imageCache = {}; // Map: Name -> Base64 Data URI
let allRoomNames = [];

function parseData(csvText) {
    recipes = {};
    usedIn = {};
    roomImages = {};
    roomWiki = {};
    roomTypes = {};
    allRoomNames = [];

    const lines = csvText.trim().split(/\r?\n/);
    let startIndex = 1; // Skip header

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if(!line) continue;
        
        // Handle splitting by comma (Basic split, assumes no commas in values)
        const parts = line.split(',').map(s => s.trim());
        const target = parts[0];
        if(!target) continue;

        if(!allRoomNames.includes(target)) allRoomNames.push(target);

        // 1. Wiki (Index 1)
        if (parts[1] && parts[1] !== "") {
            roomWiki[target] = parts[1];
        }

        // 2. Image (Index 2)
        if (parts[2] && parts[2] !== "") {
            roomImages[target] = parts[2];
        }

        // 3. Materials (Indices 3, 4, 5, 6)
        const mats = parts.slice(3, 7).filter(m => m !== "");
        recipes[target] = mats; 
        
        // 4. Type (Index 7)
        if (parts[7] && parts[7] !== "") {
            roomTypes[target] = parts[7];
        }

        // Reverse Lookup (Used In)
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
    // 1. Check CSV provided link
    if (roomWiki[name]) {
        return roomWiki[name];
    }
    
    // 2. Fallback to slug builder
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
        if(loading) {
            loading.querySelector('div').textContent = "Loading Images...";
            loading.classList.add('active');
        }
        await Promise.all(promises);
        if(loading) loading.classList.remove('active');
    }
}