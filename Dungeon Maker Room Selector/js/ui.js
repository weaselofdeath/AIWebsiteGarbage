// Global State for UI
let selectedNodeId = null;
let folderStates = {}; 

function getRoomTypeCategory(name) {
    let type = "Room";
    if (isBaseItem(name)) type = "Base";
    if (roomTypes[name]) type = roomTypes[name];
    return type.charAt(0).toUpperCase() + type.slice(1);
}

function expandFolderForRoom(name) {
    const type = getRoomTypeCategory(name);
    folderStates[type] = true;
}

// --- SIDEBAR ---
function renderRoomList() {
    const list = document.getElementById('roomList');
    list.innerHTML = "";
    
    const groups = {};
    allRoomNames.forEach(name => {
        const type = getRoomTypeCategory(name);
        if (!groups[type]) groups[type] = [];
        groups[type].push(name);
    });
    
    const sortedKeys = Object.keys(groups).sort();

    sortedKeys.forEach(type => {
        const folderLi = document.createElement('li');
        folderLi.className = "folder-container";
        
        const header = document.createElement('div');
        header.className = "folder-header"; 
        
        header.onclick = () => {
             const isNowExpanded = header.classList.toggle('expanded');
             folderStates[type] = isNowExpanded; 

             const content = header.nextElementSibling;
             if (isNowExpanded) {
                 content.style.maxHeight = content.scrollHeight + "px";
             } else {
                 content.style.maxHeight = "0";
             }
        };

        const count = groups[type].length;
        header.innerHTML = `
            <span class="folder-arrow">▶</span> 
            <span class="folder-title">${type}</span> 
            <span class="folder-count">${count}</span>
        `;
        folderLi.appendChild(header);

        const itemsUl = document.createElement('ul');
        itemsUl.className = "folder-items";
        
        groups[type].forEach(name => {
            const itemLi = createRoomItem(name);
            itemsUl.appendChild(itemLi);
        });
        
        folderLi.appendChild(itemsUl);
        list.appendChild(folderLi);
    });
}

function filterRooms() {
    const term = document.getElementById('searchBox').value.toLowerCase();
    const folders = document.querySelectorAll('.folder-container');
    
    folders.forEach(folder => {
        const items = folder.querySelectorAll('.room-item');
        let hasVisible = false;

        items.forEach(item => {
            const name = item.dataset.name.toLowerCase();
            if (name.includes(term)) {
                item.classList.remove('hidden');
                hasVisible = true;
            } else {
                item.classList.add('hidden');
            }
        });

        const header = folder.querySelector('.folder-header');
        const list = folder.querySelector('.folder-items');

        if (term === "") {
            folder.classList.remove('hidden');
            header.classList.remove('search-expanded'); 
            
            if (header.classList.contains('expanded')) {
                list.style.maxHeight = list.scrollHeight + "px";
            } else {
                list.style.maxHeight = "0";
            }
        } else {
            if (hasVisible) {
                folder.classList.remove('hidden');
                header.classList.add('search-expanded'); 
                list.style.maxHeight = list.scrollHeight + "px"; 
            } else {
                folder.classList.add('hidden');
            }
        }
    });
}

function createRoomItem(name) {
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
    
    const badge = document.createElement('div');
    let typeText = isBase ? "Base" : "Room";
    let typeClass = isBase ? "badge-base" : "badge-room";
    
    if (roomTypes[name]) {
        typeText = roomTypes[name];
        typeClass = `badge-${typeText.toLowerCase().replace(/_/g, '-')}`; 
    }

    badge.className = `room-type-badge ${typeClass}`;
    badge.textContent = typeText;
    
    li.appendChild(badge);
    li.appendChild(nameSpan);
    
    return li;
}

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
function showPreview(nodeId, isSticky = false) {
    if (selectedNodeId && !isSticky && selectedNodeId !== nodeId) return;
    if (isSticky) selectedNodeId = nodeId;

    const nodeData = nodesDS.get(nodeId);
    if(!nodeData) return;
    
    const previewDiv = document.getElementById('nodePreview');
    
    // BUILD HEADER
    const closeBtn = `<button class="preview-close-btn" onclick="clearSelection()">×</button>`;
    const headerHtml = `
        <div class="preview-header">
            Node Details
            ${closeBtn}
        </div>`;

    // CASE A: SUMMARY NODE
    if (nodeData.isSummary) {
        // ENABLE FULL HEIGHT
        previewDiv.classList.add('summary-mode');

        const list = nodeData.summaryList || [];
        let listItems = "";
        list.forEach(name => {
            const safeName = name.replace(/'/g, "\\'"); 
            listItems += `
                <div class="preview-summary-item" onclick="transitionToRoom('${safeName}')">
                    <span>${name}</span> <span>➔</span>
                </div>`;
        });

        previewDiv.innerHTML = `
            ${headerHtml}
            <div class="preview-body">
                <div class="preview-details">
                    <div class="preview-title">Used In (${list.length} Rooms)</div>
                    <div class="preview-summary-list">${listItems}</div>
                </div>
            </div>
        `;
        previewDiv.classList.add('visible');
        return;
    }

    // CASE B: NORMAL NODE (Compact Height)
    previewDiv.classList.remove('summary-mode');

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

    // BUTTONS
    let buttonsHtml = "";
    if (isSticky) {
        const safeId = nodeId.replace(/'/g, "\\'");
        buttonsHtml = `
            <div class="preview-actions">
                <button class="preview-btn" data-tooltip="Go To Node" onclick="performAction('goto', '${safeId}')">🚀</button>
                <button class="preview-btn" data-tooltip="Open Wiki Page" onclick="performAction('wiki', '${safeId}')">📖</button>
                <button class="preview-btn" data-tooltip="Center Camera" onclick="performAction('focus', '${safeId}')">🔍</button>
                <button class="preview-btn" data-tooltip="Copy Name" onclick="performAction('copy', '${safeId}')">📋</button>
            </div>
        `;
    }

    previewDiv.innerHTML = `
        ${headerHtml}
        <div class="preview-body">
            ${imgSrc ? `<img src="${imgSrc}" class="preview-icon">` : '<div class="preview-icon"></div>'}
            <div class="preview-details">
                <div class="preview-title">${nodeId}</div>
                ${matHtml}
            </div>
        </div>
        ${buttonsHtml}
    `;

    previewDiv.classList.add('visible');
}

function hidePreview() {
    if (selectedNodeId) return;
    document.getElementById('nodePreview').classList.remove('visible');
}

function clearSelection() {
    selectedNodeId = null;
    hidePreview();
}

function performAction(action, targetId) {
    if (action === 'goto') transitionToRoom(targetId);
    else if (action === 'focus') network.focus(targetId, { scale: 1.2, animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
    else if (action === 'copy') navigator.clipboard.writeText(targetId);
    else if (action === 'wiki') window.open(getWikiLink(targetId), '_blank');
}

// --- CONTEXT MENU (Legacy Support) ---
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
    performAction(action, contextNodeId);
    hideContextMenu();
}