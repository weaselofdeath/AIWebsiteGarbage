// --- SIDEBAR ---
function renderRoomList(filter = "") {
    const list = document.getElementById('roomList');
    list.innerHTML = "";
    const filtered = allRoomNames.filter(n => n.toLowerCase().includes(filter.toLowerCase()));
    
    filtered.forEach(name => {
        const isBase = isBaseItem(name);
        const li = document.createElement('li');
        li.className = "room-item";
        li.dataset.name = name;
        li.onclick = () => transitionToRoom(name);
        
        const imgUrl = roomImages[name];
        if (imgUrl) {
            const icon = document.createElement('img');
            icon.src = imgUrl;
            icon.className = "room-list-icon";
            li.appendChild(icon);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = "room-list-icon";
            li.appendChild(placeholder);
        }

        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        
        // BADGE LOGIC
        const badge = document.createElement('span');
        
        // Default Type
        let typeText = isBase ? "Base" : "Room";
        let typeClass = isBase ? "badge-base" : "badge-room";
        
        // Override from CSV "type" column if present
        if (roomTypes[name]) {
            typeText = roomTypes[name];
            // Normalize class name (e.g. "event" -> "badge-event")
            // We can style these specifically in CSS later
            typeClass = `badge-${typeText.toLowerCase().replace(/_/g, '-')}`; 
            
            // Fallback style if specific class doesn't exist? 
            // For now, let's just stick to a generic style or reuse existing if appropriate.
            // If it's an event, maybe purple?
            // For now I'll just apply the class. You might want to add .badge-event to CSS.
        }

        badge.className = `room-type-badge ${typeClass}`;
        badge.textContent = typeText;
        
        // Inline fallback style for new types (optional, to ensure they look okay immediately)
        if (roomTypes[name] === 'event') {
            badge.style.backgroundColor = '#6a4c93'; // Purple for events
            badge.style.color = '#e0c3fc';
        }

        li.appendChild(nameSpan);
        li.appendChild(badge);
        list.appendChild(li);
    });
}

function filterRooms() { renderRoomList(document.getElementById('searchBox').value); }

// --- LEGEND ---
function updateLegend(rootName) {
    const div = document.getElementById('legendContent');
    const counts = getBaseCountsRecursive(rootName);
    if (Object.keys(counts).length === 0) {
            div.innerHTML = `<span class="empty-state">No base materials required.</span>`;
            return;
    }
    let html = "";
    Object.keys(counts).sort().forEach(k => {
        html += `<div class="stat-item"><span>${k}</span> <span>x${counts[k]}</span></div>`;
    });
    div.innerHTML = html;
}

function getBaseCountsRecursive(node, visited = new Set()) {
    let total = {};
    if (isBaseItem(node)) { total[node] = 1; return total; }
    if (visited.has(node)) return {};
    visited.add(node);
    (recipes[node] || []).forEach(childName => {
        const childTotals = getBaseCountsRecursive(childName, new Set(visited));
        Object.keys(childTotals).forEach(base => {
            total[base] = (total[base] || 0) + childTotals[base];
        });
    });
    return total;
}

// --- PREVIEW WINDOW ---
function showPreview(nodeId) {
    const nodeData = nodesDS.get(nodeId);
    if(!nodeData) return;
    const previewDiv = document.getElementById('nodePreview');
    const contentDiv = document.getElementById('previewContent');
    const imgSrc = roomImages[nodeId] || "";
    
    const ingredients = recipes[nodeId] || [];
    let matHtml = "";
    if (ingredients.length === 0) {
        matHtml = `<div class="preview-mat base">Base Material</div>`;
    } else {
        const counts = {};
        ingredients.forEach(i => counts[i] = (counts[i] || 0) + 1);
        Object.keys(counts).forEach(mat => {
            const isBase = isBaseItem(mat);
            const count = counts[mat];
            const cls = isBase ? "preview-mat base" : "preview-mat";
            const matImg = roomImages[mat];
            matHtml += `
                <div class="${cls}">
                    ${matImg ? `<img src="${matImg}">` : ''}
                    ${mat} ${count > 1 ? 'x'+count : ''}
                </div>`;
        });
    }

    contentDiv.innerHTML = `
        <div class="preview-body">
            ${imgSrc ? `<img src="${imgSrc}" class="preview-icon">` : '<div class="preview-icon"></div>'}
            <div class="preview-details">
                <div class="preview-title">${nodeId}</div>
                ${matHtml}
            </div>
        </div>
    `;
    previewDiv.classList.add('visible');
}

function hidePreview() {
    document.getElementById('nodePreview').classList.remove('visible');
}

// --- CONTEXT MENU ---
function showContextMenu(x, y) {
    const menu = document.getElementById('contextMenu');
    const container = document.getElementById('mainContainer');
    const maxWidth = container.offsetWidth;
    const maxHeight = container.offsetHeight;
    let left = x;
    let top = y;
    if (x + 180 > maxWidth) left = x - 180;
    if (y + 160 > maxHeight) top = y - 160;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.classList.add('visible');
}

function hideContextMenu() {
    document.getElementById('contextMenu').classList.remove('visible');
    contextNodeId = null;
}

function handleContextAction(action) {
    if (!contextNodeId) return;
    const targetId = contextNodeId;
    hideContextMenu();
    if (action === 'goto') transitionToRoom(targetId);
    else if (action === 'focus') network.focus(targetId, { scale: 1.2, animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
    else if (action === 'copy') navigator.clipboard.writeText(targetId);
    else if (action === 'wiki') window.open(getWikiLink(targetId), '_blank');
}