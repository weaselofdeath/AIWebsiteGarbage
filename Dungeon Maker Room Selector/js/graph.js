let network = null;
let nodesDS = new vis.DataSet();
let edgesDS = new vis.DataSet();
let glowFrame = null; 

// Type Color Mapping
const typeColors = {
    'base': '#5f4b3a',
    'room': '#3a5f3a',
    'event': '#6a4c93',
    'trap': '#804000',
    'facility': '#205070',
    'battle': '#702020',
    'prison': '#404040',
    'altar': '#605020'
};

// Helper: Calculate dimensions logic
function getNodeDimensions(label, ingredients) {
    const width = 400; 
    const padding = 15;
    const lineHeight = 24;
    
    const counts = {};
    (ingredients || []).forEach(i => counts[i] = (counts[i] || 0) + 1);
    const uniqueIngs = Object.keys(counts);
    
    let listHeight = uniqueIngs.length * lineHeight;
    if (uniqueIngs.length === 0) listHeight = 25; 
    
    const contentHeight = Math.max(80, listHeight + 35); 
    const totalHeight = contentHeight + (padding * 2);
    
    return { width, height: totalHeight, contentHeight, iconSize: contentHeight };
}

// --- SVG NODE GENERATOR ---
function createNodeSVG(label, ingredients, isGhost = false, dimensions) {
    const { width, height, contentHeight, iconSize } = dimensions;
    const padding = 15;
    const lineHeight = 24;

    let typeKey = "room";
    if (roomTypes[label]) typeKey = roomTypes[label].toLowerCase();
    else if (isBaseItem(label)) typeKey = "base";
    const ribbonColor = typeColors[typeKey] || '#373738'; 

    const counts = {};
    (ingredients || []).forEach(i => counts[i] = (counts[i] || 0) + 1);
    const uniqueIngs = Object.keys(counts);

    const opacity = isGhost ? 0.6 : 1.0;
    const strokeDash = isGhost ? 'stroke-dasharray="6,4"' : '';
    const bgColor = isGhost ? '#2A2A2B' : '#373738';
    const borderColor = isGhost ? '#666' : '#555';
    const safeLabel = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    const mainImg = imageCache[label] || roomImages[label] || "";

    let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="opacity: ${opacity}">
        <style>
            .title { font-family: 'Segoe UI', Arial; font-weight: bold; font-size: 16px; fill: #90EE90; text-anchor: start; }
            .text-base { font-family: 'Segoe UI', Arial; font-size: 13px; fill: #FFC080; alignment-baseline: middle; }
            .text-room { font-family: 'Segoe UI', Arial; font-size: 13px; fill: #A9B7C6; alignment-baseline: middle; }
            .text-meta { font-family: 'Segoe UI', Arial; font-size: 12px; fill: #777; font-style: italic; }
            .bg { fill: ${bgColor}; stroke: ${borderColor}; stroke-width: 1px; }
            .icon-bg { fill: #222; stroke: #444; stroke-width: 1px; }
        </style>
        
        <rect x="0" y="0" width="${width}" height="${height}" rx="8" ry="8" class="bg" ${strokeDash} />
        <path d="M 0,8 Q 0,0 8,0 L 392,0 Q 400,0 400,8 L 400,12 L 0,12 Z" fill="${ribbonColor}" />
        
        <rect x="${padding}" y="${padding}" width="${contentHeight}" height="${contentHeight}" rx="4" ry="4" class="icon-bg" />
        ${mainImg ? `<image x="${padding}" y="${padding}" width="${contentHeight}" height="${contentHeight}" href="${mainImg}" preserveAspectRatio="xMidYMid slice"/>` : ''}

        <text x="${padding + iconSize + 15}" y="${padding + 20}" class="title">${safeLabel}</text>
        <line x1="${padding + iconSize + 15}" y1="${padding + 30}" x2="${width - padding}" y2="${padding + 30}" stroke="#555" stroke-width="1" />
    `;

    let yPos = padding + 50;
    let xPos = padding + iconSize + 15;
    
    if (uniqueIngs.length === 0) {
        let metaText = isGhost ? "Builds This" : "Base Material";
        if (typeKey === 'event') metaText = "Event / Unlock";
        svg += `<text x="${xPos}" y="${yPos}" class="text-meta">${metaText}</text>`;
    } else {
        uniqueIngs.forEach(ing => {
            const isBase = isBaseItem(ing);
            const count = counts[ing];
            const text = count > 1 ? `${ing} x${count}` : ing;
            const cssClass = isBase ? "text-base" : "text-room";
            const ingImg = imageCache[ing] || roomImages[ing];

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

function createSummarySVG(roomList) {
    const width = 400; 
    const padding = 15;
    const lineHeight = 24;
    const displayCount = Math.min(roomList.length, 6);
    const contentHeight = (displayCount + 1) * lineHeight + 20; 
    const totalHeight = contentHeight + (padding * 2) + 40;

    let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" style="opacity: 0.8">
        <style>
            .title { font-family: 'Segoe UI', Arial; font-weight: bold; font-size: 16px; fill: #d4d4d4; text-anchor: start; }
            .item { font-family: 'Segoe UI', Arial; font-size: 13px; fill: #A9B7C6; }
            .bg { fill: #2A2A2B; stroke: #666; stroke-width: 1px; stroke-dasharray: 6,4; }
            .ribbon { fill: #555; }
        </style>
        <rect x="0" y="0" width="${width}" height="${totalHeight}" rx="8" ry="8" class="bg" />
        <path d="M 0,8 Q 0,0 8,0 L 392,0 Q 400,0 400,8 L 400,12 L 0,12 Z" class="ribbon" />
        <text x="${padding}" y="${padding + 20}" class="title">Used In (${roomList.length} Rooms)</text>
        <line x1="${padding}" y1="${padding + 30}" x2="${width - padding}" y2="${padding + 30}" stroke="#555" stroke-width="1" />
    `;

    let yPos = padding + 55;
    for(let i=0; i<displayCount; i++) {
        svg += `<text x="${padding + 10}" y="${yPos}" class="item">• ${roomList[i]}</text>`;
        yPos += lineHeight;
    }
    if (roomList.length > displayCount) {
        svg += `<text x="${padding + 10}" y="${yPos}" class="item" style="font-style:italic">...and ${roomList.length - displayCount} more</text>`;
    }
    svg += `</svg>`;
    return { url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), height: totalHeight };
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
                levelSeparation: 220, 
                nodeSpacing: 100,
                treeSpacing: 110,
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
    
    // --- GLOW ANIMATION LOOP ---
    network.on("beforeDrawing", function(ctx) {
        if (!currentRoot) return;
        if (!nodesDS.get(currentRoot)) return;

        // Get exact visual bounds from Vis.js (Handles scaling automatically)
        const box = network.getBoundingBox(currentRoot);
        const x = (box.left + box.right) / 2;
        const y = (box.top + box.bottom) / 2;
        const w = box.right - box.left;
        const h = box.bottom - box.top;

        // Color
        let typeKey = "room";
        if (roomTypes[currentRoot]) typeKey = roomTypes[currentRoot].toLowerCase();
        else if (isBaseItem(currentRoot)) typeKey = "base";
        const colorHex = typeColors[typeKey] || '#90EE90';
        
        // VISIBILITY TUNING:
        const blurSize = 25; 
        const alpha = 0.8; 

        // Draw Rounded Rect Glow
        ctx.save();
        ctx.translate(x, y);
        
        const rx = -w / 2;
        const ry = -h / 2;

        ctx.beginPath();
        // EXACT SIZE: Draw exactly at node border
        if (ctx.roundRect) {
            ctx.roundRect(rx, ry, w, h, 2);
        } else {
            ctx.rect(rx, ry, w, h); 
        }
        ctx.closePath();

        // Glow Effects
        ctx.shadowColor = colorHex; // Use pure hex for max brightness
        ctx.shadowBlur = blurSize;
        ctx.fillStyle = "rgba(0,0,0,0)"; // No fill, just shadow
        
        // Stroke for border glow
        ctx.strokeStyle = `rgba(${hexToRgb(colorHex)}, ${alpha})`;
        ctx.lineWidth = 15;
        
        ctx.stroke();
        ctx.restore();
    });

    function triggerGlow() {
        if (currentRoot) {
            network.redraw();
            glowFrame = requestAnimationFrame(triggerGlow);
        }
    }
    
    triggerGlow();

    // Helper: Hex to RGB
    function hexToRgb(hex) {
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function(m, r, g, b) { return r + r + g + g + b + b; });
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "144, 238, 144";
    }

    // --- EVENTS ---
    network.on("click", function(params) {
        hideContextMenu();
        try {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                showPreview(nodeId, true); 
            } else {
                clearSelection();
            }
        } catch (e) {
            console.error("Click handler error:", e);
        }
    });

    network.on("doubleClick", function(params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const nodeData = nodesDS.get(nodeId);
            if (!nodeData.isSummary) {
                transitionToRoom(nodeId);
            }
        }
    });
    
    network.on("hoverNode", function (params) {
        if (!document.getElementById('contextMenu').classList.contains('visible')) {
            container.style.cursor = 'pointer';
            showPreview(params.node, false);
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
        const dim = getNodeDimensions(curr, ingredients);
        
        nodesMap.set(curr, {
            id: curr,
            image: createNodeSVG(curr, ingredients, false, dim),
            shape: 'image',
            isGhost: false,
            isSummary: false,
            customHeight: dim.height
        });

        ingredients.forEach(child => {
            if (isBaseItem(child) && !showBase) return;
            edgesArr.push({ from: child, to: curr });
            if(!visited.has(child)) queue.push(child);
        });
    }

    // B. Right Side
    const usedInList = usedIn[rootName] || [];
    
    if (usedInList.length > 6) {
        const summaryId = `summary_${rootName}`;
        const summaryData = createSummarySVG(usedInList);
        nodesMap.set(summaryId, {
            id: summaryId,
            image: summaryData.url,
            shape: 'image',
            physics: false,
            isGhost: true,
            isSummary: true,
            summaryList: usedInList,
            customHeight: summaryData.height
        });
        edgesArr.push({ from: rootName, to: summaryId, color: { color: '#666', opacity: 0.2 }, dashes: true, arrows: 'to' });
        
    } else {
        usedInList.forEach(prod => {
            if (nodesMap.has(prod)) return; 
            const prodIngs = recipes[prod] || [];
            const dim = getNodeDimensions(prod, prodIngs);
            
            nodesMap.set(prod, {
                id: prod,
                image: createNodeSVG(prod, prodIngs, true, dim),
                shape: 'image',
                physics: false,
                isGhost: true,
                isSummary: false,
                customHeight: dim.height
            });
            edgesArr.push({ from: rootName, to: prod, color: { color: '#666', opacity: 0.2 }, dashes: true, arrows: 'to' });
        });
    }

    return { nodes: Array.from(nodesMap.values()), edges: edgesArr };
}