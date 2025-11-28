let network = null;
let nodesDS = new vis.DataSet();
let edgesDS = new vis.DataSet();

// --- SVG NODE GENERATOR ---
function createNodeSVG(label, ingredients, isGhost = false) {
    const width = 400; 
    const padding = 15;
    const lineHeight = 24;
    
    const counts = {};
    (ingredients || []).forEach(i => counts[i] = (counts[i] || 0) + 1);
    const uniqueIngs = Object.keys(counts);
    
    // Calculate Dynamic Height
    // Base height needs to fit icon (80px) + padding (30px) = 110px min
    // Ingredient list adds height.
    // 4 items * 24px = 96px list height.
    // Title area = ~30px.
    
    let listHeight = uniqueIngs.length * lineHeight;
    if (uniqueIngs.length === 0) listHeight = 25; 
    
    // Smart Height Calculation
    // We ensure the card is tall enough for EITHER the icon OR the list
    const contentHeight = Math.max(80, listHeight + 35); 
    const totalHeight = contentHeight + (padding * 2);
    const iconSize = contentHeight;

    // Styles
    const opacity = isGhost ? 0.6 : 1.0;
    const strokeDash = isGhost ? 'stroke-dasharray="6,4"' : '';
    const bgColor = isGhost ? '#2A2A2B' : '#373738';
    const borderColor = isGhost ? '#666' : '#555';
    const safeLabel = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    const mainImg = imageCache[label] || roomImages[label] || "";

    let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" style="opacity: ${opacity}">
        <style>
            .title { font-family: 'Segoe UI', Arial; font-weight: bold; font-size: 16px; fill: #90EE90; text-anchor: start; }
            .text-base { font-family: 'Segoe UI', Arial; font-size: 13px; fill: #FFC080; alignment-baseline: middle; }
            .text-room { font-family: 'Segoe UI', Arial; font-size: 13px; fill: #A9B7C6; alignment-baseline: middle; }
            .text-meta { font-family: 'Segoe UI', Arial; font-size: 12px; fill: #777; font-style: italic; }
            .bg { fill: ${bgColor}; stroke: ${borderColor}; stroke-width: 1px; }
            .icon-bg { fill: #222; stroke: #444; stroke-width: 1px; }
        </style>
        
        <rect x="0" y="0" width="${width}" height="${totalHeight}" rx="8" ry="8" class="bg" ${strokeDash} />
        
        <rect x="${padding}" y="${padding}" width="${contentHeight}" height="${contentHeight}" rx="4" ry="4" class="icon-bg" />
        ${mainImg ? `<image x="${padding}" y="${padding}" width="${contentHeight}" height="${contentHeight}" href="${mainImg}" preserveAspectRatio="xMidYMid slice"/>` : ''}

        <text x="${padding + iconSize + 15}" y="${padding + 20}" class="title">${safeLabel}</text>
        
        <line x1="${padding + iconSize + 15}" y1="${padding + 30}" x2="${width - padding}" y2="${padding + 30}" stroke="#555" stroke-width="1" />
    `;

    // Ingredients List
    let yPos = padding + 50;
    let xPos = padding + iconSize + 15;
    
    if (uniqueIngs.length === 0) {
        const text = isGhost ? "Builds This" : "Base Material";
        svg += `<text x="${xPos}" y="${yPos}" class="text-meta">${text}</text>`;
    } else {
        // Iterate ALL ingredients (no slice limit now)
        uniqueIngs.forEach(ing => {
            const isBase = isBaseItem(ing);
            const count = counts[ing];
            const text = count > 1 ? `${ing} x${count}` : ing;
            const cssClass = isBase ? "text-base" : "text-room";
            const ingImg = imageCache[ing] || roomImages[ing];

            // Mini Icon
            if (ingImg) {
                svg += `<image x="${xPos}" y="${yPos - 12}" width="20" height="20" href="${ingImg}" preserveAspectRatio="xMidYMid slice" />`;
            } else {
                svg += `<rect x="${xPos}" y="${yPos - 12}" width="20" height="20" fill="#444" rx="2" />`;
            }
            
            svg += `<text x="${xPos + 28}" y="${yPos}" class="${cssClass}">${text}</text>`;
            yPos += lineHeight;
        });
    }
    svg += `</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// --- VIS.JS INIT ---
function initNetwork() {
    const container = document.getElementById('network');
    const data = { nodes: nodesDS, edges: edgesDS };
    const options = {
        layout: {
            hierarchical: {
                enabled: true,
                direction: 'LR',
                sortMethod: 'directed',
                levelSeparation: 380, 
                nodeSpacing: 160, // INCREASED spacing for taller nodes
                treeSpacing: 180,
                blockShifting: true,
                edgeMinimization: true,
                parentCentralization: true,
                shakeTowards: 'roots'
            }
        },
        physics: { enabled: false }, 
        edges: {
            width: 2,
            color: { color: 'rgba(169, 183, 198, 0.15)', highlight: '#90EE90' },
            arrows: { to: { enabled: true, scaleFactor: 1 } },
            smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.5 },
            selectionWidth: 3,
            hoverWidth: 3
        },
        interaction: { dragNodes: true, zoomView: true, dragView: true, hover: true }
    };
    network = new vis.Network(container, data, options);
    
    // --- EVENTS ---
    network.on("click", function(params) {
        hideContextMenu();
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const nodeData = nodesDS.get(nodeId);
            if (nodeData && nodeData.isGhost) transitionToRoom(nodeId);
        }
    });

    network.on("doubleClick", function(params) {
         if (params.nodes.length > 0) transitionToRoom(params.nodes[0]);
    });
    
    network.on("hoverNode", function (params) {
        if (!document.getElementById('contextMenu').classList.contains('visible')) {
            container.style.cursor = 'pointer';
            showPreview(params.node);
        }
    });
    
    network.on("blurNode", function () {
        container.style.cursor = 'default';
        hidePreview();
    });

    network.on("oncontext", function (params) {
        params.event.preventDefault();
        const nodeId = this.getNodeAt(params.pointer.DOM);
        if (nodeId) {
            contextNodeId = nodeId;
            network.selectNodes([nodeId]);
            showContextMenu(params.pointer.DOM.x, params.pointer.DOM.y);
        } else {
            hideContextMenu();
        }
    });
}

// --- GRAPH BUILDER ---
function buildGraphData(rootName) {
    const nodesMap = new Map();
    const edgesArr = [];
    const visited = new Set();
    const queue = [rootName];
    const showBase = document.getElementById('toggleBaseNodes').checked;

    // A. Left Side
    while(queue.length > 0) {
        const curr = queue.shift();
        if(visited.has(curr)) continue;
        visited.add(curr);

        const ingredients = recipes[curr] || [];
        
        nodesMap.set(curr, {
            id: curr,
            image: createNodeSVG(curr, ingredients, false),
            shape: 'image',
            isGhost: false
        });

        ingredients.forEach(child => {
            if (isBaseItem(child) && !showBase) return;
            edgesArr.push({ from: child, to: curr });
            if(!visited.has(child)) queue.push(child);
        });
    }

    // B. Right Side
    (usedIn[rootName]||[]).forEach(prod => {
        if (nodesMap.has(prod)) return; 
        const prodIngs = recipes[prod] || [];
        nodesMap.set(prod, {
            id: prod,
            image: createNodeSVG(prod, prodIngs, true),
            shape: 'image',
            physics: false,
            isGhost: true
        });
        edgesArr.push({ from: rootName, to: prod, color: { color: '#666', opacity: 0.2 }, dashes: true, arrows: 'to' });
    });

    return { nodes: Array.from(nodesMap.values()), edges: edgesArr };
}