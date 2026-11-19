'use strict';
(() => {
  let round, previous = [], lastWin = '', lastOver = '', observer, fitGrid = null, fitQueued = false;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Shrink a too-long word (club, league, player name) instead of splitting it.
  // Measured against the fixed-size board box (.head / .cell): the wrappers in
  // between are content-sized flex items, so overflow only shows at that level.
  const fit = (el, min) => {
    el.classList.remove('nx-fit-wrap'); el.style.removeProperty('font-size');
    const box = el.closest('.head, .cell'); if (!box) return;
    const bs = getComputedStyle(box), avail = box.clientWidth - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight);
    // Width of the rendered text itself (widest line), not of its block box,
    // converted back to layout pixels in case the board is mid-transform.
    const range = document.createRange();
    const tooWide = () => { range.selectNodeContents(el); const scale = box.getBoundingClientRect().width / (box.offsetWidth || 1) || 1; return range.getBoundingClientRect().width / scale > avail + 1; };
    let size = parseFloat(getComputedStyle(el).fontSize);
    // `important`: other XOX style layers pin these font sizes with !important.
    while (tooWide() && size > min) { size -= 0.5; el.style.setProperty('font-size', size + 'px', 'important'); }
    if (tooWide()) el.classList.add('nx-fit-wrap');
  };
  const fitAll = grid => { if (!grid?.isConnected) return; grid.querySelectorAll('.headText').forEach(el => fit(el, 9)); grid.querySelectorAll('.cellName').forEach(el => fit(el, 9)); };
  const queueFit = () => { if (fitQueued) return; fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fitAll(fitGrid); }); };
  addEventListener('resize', queueFit, { passive: true });
  document.fonts?.ready?.then(queueFit);
  document.fonts?.addEventListener?.('loadingdone', queueFit);
  // When a match ends, bring the result card above the bottom navigation.
  const revealResult = () => {
    const card = document.querySelector('.winTitle')?.closest('.card');
    if (!card) return;
    const footer = document.getElementById('nx-arcade-footer')?.getBoundingClientRect();
    const box = card.getBoundingClientRect(), limit = footer ? footer.top : innerHeight;
    if (box.top < 0 || box.bottom > limit) card.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
  };
  let gridObserver, gridResize;
  window.NX_XOX_BOARD = (grid, game, winning) => {
    observer?.disconnect();
    fitGrid = grid;
    queueFit();
    // Header decorations (icons, flags) are added after this call; refit when the board changes.
    gridObserver?.disconnect(); gridResize?.disconnect();
    gridObserver = new MutationObserver(queueFit);
    gridObserver.observe(grid, { childList: true, subtree: true });
    // ...and when the board gets its real size (entrance layout, web font swap).
    gridResize = new ResizeObserver(queueFit); gridResize.observe(grid);
    const key = game.matchRound || JSON.stringify(game.challenge);
    if (round !== key) { round = key; previous = []; lastWin = ''; }
    const cells = [...grid.querySelectorAll('.cell')];
    cells.forEach((cell, i) => {
      const claim = game.board[i];
      const signature = claim ? `${claim.mark}:${claim.playerId || claim.player}` : '';
      if (signature && signature !== previous[i]) cell.classList.add('claim-enter');
      previous[i] = signature;
    });
    const overKey = game.over ? `${key}:${game.winner || 'draw'}` : '';
    if (overKey && overKey !== lastOver) setTimeout(revealResult, winning ? 1250 : 350);
    lastOver = overKey;
    const winKey = winning ? `${game.winner}:${winning.join(',')}` : '';
    if (!winKey) { lastWin = ''; return; }
    winning.forEach(i => cells[i].classList.add('winning-cell', ...(lastWin !== winKey ? ['win-glow'] : [])));
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', `win-stroke ${game.winner.toLowerCase()}${lastWin !== winKey ? ' win-enter' : ''}`);
    svg.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('pathLength', '1');
    svg.appendChild(line); grid.appendChild(svg);
    const place = () => {
      if (!grid.isConnected) { observer?.disconnect(); return; }
      const base = grid.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`);
      [winning[0], winning[2]].forEach((i, end) => {
        const rect = cells[i].getBoundingClientRect();
        line.setAttribute(`x${end + 1}`, rect.left + rect.width / 2 - base.left);
        line.setAttribute(`y${end + 1}`, rect.top + rect.height / 2 - base.top);
      });
    };
    place();
    observer = new ResizeObserver(place); observer.observe(grid);
    lastWin = winKey;
  };
})();
