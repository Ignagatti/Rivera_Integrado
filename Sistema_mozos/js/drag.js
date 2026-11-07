function makeDraggable(element, tables, mapaClub, saveStateFn) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    element.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        if (e.target.classList.contains('resizer')) return;
        e.preventDefault();
        pos3 = e.clientX; pos4 = e.clientY;
        document.onmouseup   = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
        pos3 = e.clientX;        pos4 = e.clientY;
        let newTop  = element.offsetTop  - pos2;
        let newLeft = element.offsetLeft - pos1;
        const mapRect = mapaClub.getBoundingClientRect();
        newLeft = Math.max(0, Math.min(newLeft, mapRect.width  - element.offsetWidth));
        newTop  = Math.max(0, Math.min(newTop,  mapRect.height - element.offsetHeight));
        element.style.top  = newTop  + 'px';
        element.style.left = newLeft + 'px';
    }

    function closeDragElement() {
        document.onmouseup   = null;
        document.onmousemove = null;
        const table = tables.find(t => t.id === element.id);
        if (table) {
            table.x = element.offsetLeft;
            table.y = element.offsetTop;
            saveStateFn();
        }
    }
}

function makeResizable(element, resizer, tables, saveStateFn, onResizeEndFn) {
    let origW = 0, origH = 0, origX = 0, origY = 0;

    resizer.addEventListener('mousedown', function(e) {
        e.preventDefault(); e.stopPropagation();
        origW = parseFloat(getComputedStyle(element).width);
        origH = parseFloat(getComputedStyle(element).height);
        origX = e.pageX; origY = e.pageY;
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup',   stopResize);
    });

    function resize(e) {
        const w = origW + (e.pageX - origX);
        const h = origH + (e.pageY - origY);
        if (w > 50) element.style.width  = w + 'px';
        if (h > 50) element.style.height = h + 'px';
    }

    function stopResize() {
        window.removeEventListener('mousemove', resize);
        window.removeEventListener('mouseup',   stopResize);
        const table = tables.find(t => t.id === element.id);
        if (table) {
            const nw = parseFloat(element.style.width);
            const nh = parseFloat(element.style.height);
            if (!isNaN(nw) && nw > 0) table.width  = nw;
            if (!isNaN(nh) && nh > 0) table.height = nh;
            saveStateFn();
            if (typeof onResizeEndFn === 'function') {
                onResizeEndFn(table);
            }
        }
    }
}
