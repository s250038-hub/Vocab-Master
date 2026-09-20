function switchWordGameMode(mode) {
    ['tetris', 'blocky', 'scrabble', 'bee', 'wordle'].forEach(m => {
        const btn = document.getElementById('tab-btn-' + m);
        const sub = document.getElementById('subview-' + m);
        if (btn) {
            btn.className = "flex-1 py-2 px-2.5 rounded-lg text-gray-600 hover:text-gray-900 transition flex items-center justify-center gap-1 whitespace-nowrap";
        }
        if (sub) sub.classList.add('hidden');
    });

    const activeBtn = document.getElementById('tab-btn-' + mode);
    const activeSub = document.getElementById('subview-' + mode);
    if (activeBtn) {
        activeBtn.className = "flex-1 py-2 px-2.5 rounded-lg bg-white shadow-sm text-purple-600 transition font-bold flex items-center justify-center gap-1 whitespace-nowrap";
    }
    if (activeSub) activeSub.classList.remove('hidden');
}

/* ==========================================================================
   GAMEMODE 1: VOCABTETRIS (13x13 Grid Tetris Word Clear)
   ========================================================================== */
let tetrisGrid = Array(13).fill(null).map(() => Array(13).fill(null));
let tetrisScore = 0;
let tetrisDiscoveredWords = new Set();
let tetrisMinWordLen = 2;
let tetrisCurrentPiece = null;
let tetrisNextPiece = null;
let tetrisTimer = null;

const TETRIS_SHAPES = [
    [[1]], // 1x1
    [[1, 1]], // 1x2
    [[1, 1, 1]], // 1x3
    [[1, 1, 1, 1]], // 1x4
    [[1, 1], [1, 1]], // 2x2
    [[0, 1, 0], [1, 1, 1]], // T
    [[1, 0], [1, 0], [1, 1]], // L
    [[0, 1], [0, 1], [1, 1]]  // Reverse-L
];

function returnToTetrisSetup() {
    if (tetrisTimer) clearInterval(tetrisTimer);
    document.getElementById('tetris-active').classList.add('hidden');
    document.getElementById('tetris-setup').classList.remove('hidden');
}

function startTetrisGame() {
    const overlay = document.getElementById('tetris-gameover-overlay');
    overlay.classList.add('hidden');
    overlay.style.display = '';

    document.getElementById('tetris-setup').classList.add('hidden');
    document.getElementById('tetris-active').classList.remove('hidden');

    tetrisGrid = Array(13).fill(null).map(() => Array(13).fill(null));
    tetrisScore = 0;
    tetrisDiscoveredWords.clear();
    
    updateTetrisUI();
    tetrisNextPiece = generateRandomTetrisPiece();
    spawnTetrisPiece();

    if (tetrisTimer) clearInterval(tetrisTimer);
    tetrisTimer = setInterval(dropTetrisTick, 1000);
}

function getRandomLetter() {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    return alphabet[Math.floor(Math.random() * alphabet.length)];
}

function generateRandomTetrisPiece() {
    const shape = TETRIS_SHAPES[Math.floor(Math.random() * TETRIS_SHAPES.length)];
    const matrix = shape.map(row => row.map(cell => cell ? getRandomLetter() : null));
    return { matrix, x: 5, y: 0 };
}

function spawnTetrisPiece() {
    tetrisCurrentPiece = tetrisNextPiece;
    tetrisNextPiece = generateRandomTetrisPiece();
    renderNextPiecePreview();

    if (!canPlaceTetrisPiece(tetrisCurrentPiece.matrix, tetrisCurrentPiece.x, tetrisCurrentPiece.y)) {
        endTetrisGame();
    } else {
        renderTetrisBoard();
    }
}

function canPlaceTetrisPiece(matrix, px, py) {
    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
            if (matrix[r][c] !== null) {
                const gx = px + c;
                const gy = py + r;
                if (gx < 0 || gx >= 13 || gy >= 13) return false;
                if (gy >= 0 && tetrisGrid[gy][gx] !== null) return false;
            }
        }
    }
    return true;
}

function renderTetrisBoard() {
    const board = document.getElementById('tetris-board');
    board.innerHTML = '';

    for (let r = 0; r < 13; r++) {
        for (let c = 0; c < 13; c++) {
            const cell = document.createElement('div');
            cell.className = 'tetris-cell';

            let char = tetrisGrid[r][c];
            if (tetrisCurrentPiece) {
                const pr = r - tetrisCurrentPiece.y;
                const pc = c - tetrisCurrentPiece.x;
                if (pr >= 0 && pr < tetrisCurrentPiece.matrix.length && pc >= 0 && pc < tetrisCurrentPiece.matrix[0].length) {
                    if (tetrisCurrentPiece.matrix[pr][pc] !== null) {
                        char = tetrisCurrentPiece.matrix[pr][pc];
                        cell.classList.add('falling');
                    }
                }
            }

            if (char !== null) {
                cell.innerText = char;
                if (!cell.classList.contains('falling')) cell.classList.add('filled');
            }
            board.appendChild(cell);
        }
    }
}

function renderNextPiecePreview() {
    const preview = document.getElementById('tetris-next-preview');
    if (!preview || !tetrisNextPiece) return;
    const rows = tetrisNextPiece.matrix.length;
    const cols = tetrisNextPiece.matrix[0].length;
    preview.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    preview.innerHTML = '';

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const el = document.createElement('div');
            el.className = "w-3 h-3 rounded-[1px] flex items-center justify-center text-[7px] font-bold text-white uppercase";
            if (tetrisNextPiece.matrix[r][c]) {
                el.className += " bg-purple-500";
                el.innerText = tetrisNextPiece.matrix[r][c];
            } else {
                el.className += " bg-transparent";
            }
            preview.appendChild(el);
        }
    }
}

function moveTetrisLeft() {
    if (canPlaceTetrisPiece(tetrisCurrentPiece.matrix, tetrisCurrentPiece.x - 1, tetrisCurrentPiece.y)) {
        tetrisCurrentPiece.x--;
        renderTetrisBoard();
    }
}

function moveTetrisRight() {
    if (canPlaceTetrisPiece(tetrisCurrentPiece.matrix, tetrisCurrentPiece.x + 1, tetrisCurrentPiece.y)) {
        tetrisCurrentPiece.x++;
        renderTetrisBoard();
    }
}

function rotateTetrisPiece() {
    const matrix = tetrisCurrentPiece.matrix;
    const rows = matrix.length;
    const cols = matrix[0].length;
    const rotated = Array(cols).fill(null).map(() => Array(rows).fill(null));

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            rotated[c][rows - 1 - r] = matrix[r][c];
        }
    }

    if (canPlaceTetrisPiece(rotated, tetrisCurrentPiece.x, tetrisCurrentPiece.y)) {
        tetrisCurrentPiece.matrix = rotated;
        renderTetrisBoard();
    }
}

function dropTetrisSoft() {
    dropTetrisTick();
}

function dropTetrisHard() {
    while (canPlaceTetrisPiece(tetrisCurrentPiece.matrix, tetrisCurrentPiece.x, tetrisCurrentPiece.y + 1)) {
        tetrisCurrentPiece.y++;
    }
    dropTetrisTick();
}

function dropTetrisTick() {
    if (!tetrisCurrentPiece) return;

    if (canPlaceTetrisPiece(tetrisCurrentPiece.matrix, tetrisCurrentPiece.x, tetrisCurrentPiece.y + 1)) {
        tetrisCurrentPiece.y++;
        renderTetrisBoard();
    } else {
        lockTetrisPiece();
        checkAndClearTetrisWords();
        spawnTetrisPiece();
    }
}

function lockTetrisPiece() {
    const m = tetrisCurrentPiece.matrix;
    for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
            if (m[r][c] !== null) {
                const gx = tetrisCurrentPiece.x + c;
                const gy = tetrisCurrentPiece.y + r;
                if (gy >= 0 && gy < 13 && gx >= 0 && gx < 13) {
                    tetrisGrid[gy][gx] = m[r][c];
                }
            }
        }
    }
}

function checkAndClearTetrisWords() {
    let clearedCells = Array(13).fill(null).map(() => Array(13).fill(false));
    let wordsFound = [];

    // Horizontal check
    for (let r = 0; r < 13; r++) {
        let str = "";
        let indices = [];
        for (let c = 0; c <= 13; c++) {
            const char = c < 13 ? tetrisGrid[r][c] : null;
            if (char) {
                str += char;
                indices.push(c);
            } else {
                if (str.length >= tetrisMinWordLen) {
                    for (let len = str.length; len >= tetrisMinWordLen; len--) {
                        for (let start = 0; start <= str.length - len; start++) {
                            const sub = str.substr(start, len);
                            if (csw24Set.has(sub.toLowerCase())) {
                                wordsFound.push(sub.toLowerCase());
                                for (let k = start; k < start + len; k++) clearedCells[r][indices[k]] = true;
                            }
                        }
                    }
                }
                str = "";
                indices = [];
            }
        }
    }

    // Vertical check
    for (let c = 0; c < 13; c++) {
        let str = "";
        let indices = [];
        for (let r = 0; r <= 13; r++) {
            const char = r < 13 ? tetrisGrid[r][c] : null;
            if (char) {
                str += char;
                indices.push(r);
            } else {
                if (str.length >= tetrisMinWordLen) {
                    for (let len = str.length; len >= tetrisMinWordLen; len--) {
                        for (let start = 0; start <= str.length - len; start++) {
                            const sub = str.substr(start, len);
                            if (csw24Set.has(sub.toLowerCase())) {
                                wordsFound.push(sub.toLowerCase());
                                for (let k = start; k < start + len; k++) clearedCells[indices[k]][c] = true;
                            }
                        }
                    }
                }
                str = "";
                indices = [];
            }
        }
    }

    if (wordsFound.length > 0) {
        wordsFound.forEach(w => {
            tetrisDiscoveredWords.add(w.toLowerCase());
            tetrisScore += w.length * 10;
        });

        for (let r = 0; r < 13; r++) {
            for (let c = 0; c < 13; c++) {
                if (clearedCells[r][c]) tetrisGrid[r][c] = null;
            }
        }

        applyCascadeGravity();
        updateTetrisUI();
    }
}

function applyCascadeGravity() {
    for (let c = 0; c < 13; c++) {
        for (let r = 12; r >= 0; r--) {
            if (tetrisGrid[r][c] === null) {
                for (let k = r - 1; k >= 0; k--) {
                    if (tetrisGrid[k][c] !== null) {
                        tetrisGrid[r][c] = tetrisGrid[k][c];
                        tetrisGrid[k][c] = null;
                        break;
                    }
                }
            }
        }
    }
}

function updateTetrisUI() {
    document.getElementById('tetris-score-display').innerText = tetrisScore;
    document.getElementById('tetris-words-count-display').innerText = tetrisDiscoveredWords.size;
    document.getElementById('tetris-found-count').innerText = tetrisDiscoveredWords.size;

    const list = document.getElementById('tetris-found-list');
    if (tetrisDiscoveredWords.size === 0) {
        list.innerHTML = `<p class="text-xs text-gray-400 italic">No words formed yet.</p>`;
    } else {
        list.innerHTML = Array.from(tetrisDiscoveredWords).map(w => `
            <button onclick="showWordDetailModal('${w}')" class="bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold px-2.5 py-1 rounded-lg border border-purple-200 transition">
                ${w.toLowerCase()}
            </button>
        `).join('');
    }
}

function toggleTetrisFoundList() {
    const list = document.getElementById('tetris-found-list');
    const btn = document.getElementById('tetris-toggle-list-btn');
    list.classList.toggle('hidden');
    btn.innerText = list.classList.contains('hidden') ? 'Show List' : 'Hide List';
}

function endTetrisGame() {
    if (tetrisTimer) clearInterval(tetrisTimer);
    const overlay = document.getElementById('tetris-gameover-overlay');
    document.getElementById('tetris-final-score').innerText = tetrisScore;
    document.getElementById('tetris-final-words').innerText = tetrisDiscoveredWords.size;
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
}

/* ==========================================================================
   GAMEMODE 2: VOCABLOCKY (9x9 Grid Block Placement)
   ========================================================================== */
let blockyGrid = Array(9).fill(null).map(() => Array(9).fill(null));
let blockyScore = 0;
let blockyDiscoveredWords = new Set();
let blockyMinWordLen = 3;
let blockyPieces = [];

function returnToBlockySetup() {
    document.getElementById('blocky-active').classList.add('hidden');
    document.getElementById('blocky-setup').classList.remove('hidden');
}

function startBlockyGame() {
    const overlay = document.getElementById('blocky-gameover-overlay');
    overlay.classList.add('hidden');
    overlay.style.display = '';

    document.getElementById('blocky-setup').classList.add('hidden');
    document.getElementById('blocky-active').classList.remove('hidden');

    blockyGrid = Array(9).fill(null).map(() => Array(9).fill(null));
    blockyScore = 0;
    blockyDiscoveredWords.clear();

    renderBlockyBoard();
    spawnBlockyPieces();
    updateBlockyUI();
}

function renderBlockyBoard() {
    const board = document.getElementById('blocky-board');
    board.innerHTML = '';

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'blocky-cell';
            if (blockyGrid[r][c]) {
                cell.classList.add('filled');
                cell.innerText = blockyGrid[r][c];
            }
            board.appendChild(cell);
        }
    }
}

function spawnBlockyPieces() {
    const container = document.getElementById('blocky-pieces');
    container.innerHTML = '';
    blockyPieces = [];

    const SHAPES = [
        [[1]], [[1, 1]], [[1], [1]], [[1, 1, 1]], [[1, 1], [1, 1]]
    ];

    for (let i = 0; i < 3; i++) {
        const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        const matrix = shape.map(row => row.map(c => c ? getRandomLetter() : null));
        blockyPieces.push(matrix);

        const pieceEl = document.createElement('div');
        pieceEl.className = "bg-white p-2 rounded-lg border border-gray-300 shadow hover:shadow-md cursor-pointer flex flex-col gap-1 items-center justify-center";
        pieceEl.onclick = () => placeBlockyPieceClick(i);

        matrix.forEach(row => {
            const rowEl = document.createElement('div');
            rowEl.className = "flex gap-1";
            row.forEach(cell => {
                const cEl = document.createElement('div');
                cEl.className = "w-6 h-6 bg-blue-600 text-white rounded text-xs font-bold flex items-center justify-center uppercase";
                cEl.innerText = cell;
                rowEl.appendChild(cEl);
            });
            pieceEl.appendChild(rowEl);
        });
        container.appendChild(pieceEl);
    }
}

function placeBlockyPieceClick(pieceIndex) {
    const matrix = blockyPieces[pieceIndex];
    if (!matrix) return;

    for (let r = 0; r <= 9 - matrix.length; r++) {
        for (let c = 0; c <= 9 - matrix[0].length; c++) {
            let canPlace = true;
            for (let pr = 0; pr < matrix.length; pr++) {
                for (let pc = 0; pc < matrix[0].length; pc++) {
                    if (blockyGrid[r + pr][c + pc] !== null) canPlace = false;
                }
            }

            if (canPlace) {
                for (let pr = 0; pr < matrix.length; pr++) {
                    for (let pc = 0; pc < matrix[0].length; pc++) {
                        blockyGrid[r + pr][c + pc] = matrix[pr][pc];
                    }
                }
                blockyPieces[pieceIndex] = null;
                renderBlockyBoard();
                checkBlockyWords();

                if (blockyPieces.every(p => p === null)) spawnBlockyPieces();
                return;
            }
        }
    }
    alert("No empty space on board fits this piece!");
}

function checkBlockyWords() {
    let cleared = Array(9).fill(null).map(() => Array(9).fill(false));

    // Horizontal
    for (let r = 0; r < 9; r++) {
        let str = "", idxs = [];
        for (let c = 0; c <= 9; c++) {
            const char = c < 9 ? blockyGrid[r][c] : null;
            if (char) { str += char; idxs.push(c); }
            else {
                if (str.length >= blockyMinWordLen && csw24Set.has(str.toLowerCase())) {
                    blockyDiscoveredWords.add(str.toLowerCase());
                    blockyScore += str.length * 10;
                    idxs.forEach(cIdx => cleared[r][cIdx] = true);
                }
                str = ""; idxs = [];
            }
        }
    }

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (cleared[r][c]) blockyGrid[r][c] = null;
        }
    }
    renderBlockyBoard();
    updateBlockyUI();
}

function updateBlockyUI() {
    document.getElementById('blocky-score-display').innerText = blockyScore;
    document.getElementById('words-count-display').innerText = blockyDiscoveredWords.size;
    document.getElementById('blocky-found-count').innerText = blockyDiscoveredWords.size;

    const list = document.getElementById('blocky-found-list');
    if (blockyDiscoveredWords.size === 0) {
        list.innerHTML = `<p class="text-xs text-gray-400 italic">No words formed yet.</p>`;
    } else {
        list.innerHTML = Array.from(blockyDiscoveredWords).map(w => `
            <button onclick="showWordDetailModal('${w}')" class="bg-blue-100 hover:bg-blue-200 text-blue-900 text-xs font-bold px-2.5 py-1 rounded-lg border border-blue-200 transition">
                ${w.toLowerCase()}
            </button>
        `).join('');
    }
}

function toggleBlockyFoundList() {
    const list = document.getElementById('blocky-found-list');
    const btn = document.getElementById('blocky-toggle-list-btn');
    list.classList.toggle('hidden');
    btn.innerText = list.classList.contains('hidden') ? 'Show List' : 'Hide List';
}

/* ==========================================================================
   GAMEMODE 3: ENDLESS SCRABBLE
   ========================================================================== */
let scrabbleBoard = Array(9).fill(null).map(() => Array(9).fill(null));
let scrabbleRack = [];
let scrabbleScore = 0;
let scrabbleDiscoveredWords = new Set();
let scrabbleSelectedRackIdx = null;

function returnToScrabbleSetup() {
    document.getElementById('scrabble-active').classList.add('hidden');
    document.getElementById('scrabble-setup').classList.remove('hidden');
}

function startScrabbleGame() {
    document.getElementById('scrabble-setup').classList.add('hidden');
    document.getElementById('scrabble-active').classList.remove('hidden');

    scrabbleBoard = Array(9).fill(null).map(() => Array(9).fill(null));
    scrabbleScore = 0;
    scrabbleDiscoveredWords.clear();
    refillScrabbleRack();

    renderScrabbleBoard();
    renderScrabbleRack();
    updateScrabbleUI();
}

function refillScrabbleRack() {
    while (scrabbleRack.length < 7) {
        scrabbleRack.push(getRandomLetter());
    }
}

function renderScrabbleBoard() {
    const board = document.getElementById('scrabble-board');
    board.innerHTML = '';

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'scrabble-cell';

            if (r === 4 && c === 4) cell.classList.add('star');
            else if ((r === 0 || r === 8) && (c === 0 || c === 8)) cell.classList.add('tw');
            else if ((r === 2 || r === 6) && (c === 2 || c === 6)) cell.classList.add('dw');

            if (scrabbleBoard[r][c]) {
                cell.classList.add('placed');
                cell.innerText = scrabbleBoard[r][c];
            } else {
                cell.onclick = () => placeScrabbleTileOnBoard(r, c);
            }
            board.appendChild(cell);
        }
    }
}

function renderScrabbleRack() {
    const rackEl = document.getElementById('scrabble-rack');
    rackEl.innerHTML = '';
    scrabbleRack.forEach((char, i) => {
        const tile = document.createElement('button');
        tile.className = `w-9 h-9 rounded-lg font-bold text-sm uppercase transition border-2 ${scrabbleSelectedRackIdx === i ? 'bg-amber-400 border-amber-600 shadow-md scale-105' : 'bg-amber-100 border-amber-300 hover:bg-amber-200'}`;
        tile.innerText = char;
        tile.onclick = () => { scrabbleSelectedRackIdx = i; renderScrabbleRack(); };
        rackEl.appendChild(tile);
    });
}

function placeScrabbleTileOnBoard(r, c) {
    if (scrabbleSelectedRackIdx === null) return;
    const letter = scrabbleRack[scrabbleSelectedRackIdx];
    scrabbleBoard[r][c] = letter;
    scrabbleRack.splice(scrabbleSelectedRackIdx, 1);
    scrabbleSelectedRackIdx = null;

    renderScrabbleBoard();
    renderScrabbleRack();
}

function submitScrabbleWord() {
    refillScrabbleRack();
    renderScrabbleRack();
    scrabbleScore += 15;
    updateScrabbleUI();
}

function clearScrabbleCurrentMove() {
    refillScrabbleRack();
    renderScrabbleRack();
}

function shuffleScrabbleRack() {
    scrabbleRack.sort(() => Math.random() - 0.5);
    renderScrabbleRack();
}

function updateScrabbleUI() {
    document.getElementById('scrabble-score-display').innerText = scrabbleScore;
    document.getElementById('scrabble-words-count-display').innerText = scrabbleDiscoveredWords.size;
    document.getElementById('scrabble-found-count').innerText = scrabbleDiscoveredWords.size;
}

function toggleScrabbleFoundList() {
    const list = document.getElementById('scrabble-found-list');
    const btn = document.getElementById('scrabble-toggle-list-btn');
    list.classList.toggle('hidden');
    btn.innerText = list.classList.contains('hidden') ? 'Show List' : 'Hide List';
}

/* ==========================================================================
   GAMEMODE 4: SPELLING BEE
   ========================================================================== */
let beeModeLettersCount = 7;
let beeCenterLetter = 'a';
let beeOuterLetters = [];
let beeInput = "";
let beeScore = 0;
let beeTargetWords = [];
let beeDiscoveredWords = new Set();

function returnToBeeSetup() {
    document.getElementById('bee-active').classList.add('hidden');
    document.getElementById('bee-setup').classList.remove('hidden');
}

function startBeeGame() {
    document.getElementById('bee-setup').classList.add('hidden');
    document.getElementById('bee-active').classList.remove('hidden');

    beeCenterLetter = getRandomLetter();
    beeOuterLetters = [];
    while (beeOuterLetters.length < beeModeLettersCount - 1) {
        const l = getRandomLetter();
        if (l !== beeCenterLetter && !beeOuterLetters.includes(l)) beeOuterLetters.push(l);
    }

    beeInput = "";
    beeScore = 0;
    beeDiscoveredWords.clear();

    findBeeTargetWords();
    renderBeeHoneycomb();
    updateBeeUI();
}

function findBeeTargetWords() {
    const allowed = new Set([beeCenterLetter, ...beeOuterLetters]);
    beeTargetWords = [];

    csw24Set.forEach(w => {
        if (w.length >= 4 && w.includes(beeCenterLetter)) {
            let valid = true;
            for (let char of w) {
                if (!allowed.has(char)) { valid = false; break; }
            }
            if (valid) beeTargetWords.push(w);
        }
    });

    if (beeTargetWords.length > 120) {
        beeTargetWords = beeTargetWords.slice(0, 120);
    }
}

function renderBeeHoneycomb() {
    const container = document.getElementById('bee-honeycomb');
    container.innerHTML = '';

    const centerBtn = document.createElement('button');
    centerBtn.className = "w-12 h-12 rounded-xl bg-amber-400 text-slate-900 font-extrabold text-lg shadow-md uppercase active:scale-95 transition";
    centerBtn.innerText = beeCenterLetter;
    centerBtn.onclick = () => addBeeLetter(beeCenterLetter);
    container.appendChild(centerBtn);

    beeOuterLetters.forEach(l => {
        const btn = document.createElement('button');
        btn.className = "w-12 h-12 rounded-xl bg-slate-200 text-slate-800 font-bold text-lg shadow-sm uppercase hover:bg-slate-300 active:scale-95 transition";
        btn.innerText = l;
        btn.onclick = () => addBeeLetter(l);
        container.appendChild(btn);
    });
}

function addBeeLetter(l) {
    beeInput += l;
    document.getElementById('bee-input-display').innerText = beeInput;
}

function deleteBeeLetter() {
    beeInput = beeInput.slice(0, -1);
    document.getElementById('bee-input-display').innerText = beeInput;
}

function shuffleBeeLetters() {
    beeOuterLetters.sort(() => Math.random() - 0.5);
    renderBeeHoneycomb();
}

function submitBeeWord() {
    const word = beeInput.toLowerCase();
    beeInput = "";
    document.getElementById('bee-input-display').innerText = "";

    if (word.length < 4) { alert("Too short! Words must be 4+ letters."); return; }
    if (!word.includes(beeCenterLetter)) { alert(`Must contain central letter '${beeCenterLetter.toUpperCase()}'!`); return; }

    if (csw24Set.has(word)) {
        if (beeDiscoveredWords.has(word)) {
            alert("Already found!");
        } else {
            beeDiscoveredWords.add(word);
            beeScore += word.length === 4 ? 1 : word.length;
            updateBeeUI();
        }
    } else {
        alert("Not in CSW24 dictionary!");
    }
}

function updateBeeUI() {
    document.getElementById('bee-score-display').innerText = beeScore;
    document.getElementById('bee-progress-display').innerText = `${beeDiscoveredWords.size} / ${beeTargetWords.length}`;
    document.getElementById('bee-found-count').innerText = beeDiscoveredWords.size;

    const list = document.getElementById('bee-found-list');
    if (beeDiscoveredWords.size === 0) {
        list.innerHTML = `<p class="text-xs text-gray-400 italic">No words found yet.</p>`;
    } else {
        list.innerHTML = Array.from(beeDiscoveredWords).map(w => `
            <button onclick="showWordDetailModal('${w}')" class="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-lg border border-amber-200 transition">
                ${w.toLowerCase()}
            </button>
        `).join('');
    }
}

function toggleBeeFoundList() {
    const list = document.getElementById('bee-found-list');
    const btn = document.getElementById('bee-toggle-list-btn');
    list.classList.toggle('hidden');
    btn.innerText = list.classList.contains('hidden') ? 'Show List' : 'Hide List';
}

/* ==========================================================================
   GAMEMODE 5: WORDLE
   ========================================================================== */
let wordleWordLength = 5;
let wordleTargetWord = "apple";
let wordleAttempts = [];
let wordleCurrentGuess = "";
let wordleDiscoveredWords = new Set();

function returnToWordleSetup() {
    document.getElementById('wordle-active').classList.add('hidden');
    document.getElementById('wordle-setup').classList.remove('hidden');
}

function startWordleGame() {
    document.getElementById('wordle-setup').classList.add('hidden');
    document.getElementById('wordle-active').classList.remove('hidden');

    const filtered = Array.from(csw24Set).filter(w => w.length === wordleWordLength);
    wordleTargetWord = filtered[Math.floor(Math.random() * filtered.length)] || "apple";
    wordleAttempts = [];
    wordleCurrentGuess = "";

    renderWordleGrid();
    renderWordleKeyboard();
    updateWordleUI();

    window.removeEventListener('keydown', handleWordleKeyDown);
    window.addEventListener('keydown', handleWordleKeyDown);
}

function renderWordleGrid() {
    const grid = document.getElementById('wordle-grid');
    grid.style.gridTemplateColumns = `repeat(${wordleWordLength}, minmax(0, 1fr))`;
    grid.innerHTML = '';

    for (let r = 0; r < 6; r++) {
        const guess = wordleAttempts[r] || (r === wordleAttempts.length ? wordleCurrentGuess : "");
        for (let c = 0; c < wordleWordLength; c++) {
            const tile = document.createElement('div');
            tile.className = 'wordle-tile';
            const char = guess[c] || "";
            tile.innerText = char;

            if (r < wordleAttempts.length) {
                const targetChar = wordleTargetWord[c];
                if (char === targetChar) tile.classList.add('correct');
                else if (wordleTargetWord.includes(char)) tile.classList.add('present');
                else tile.classList.add('absent');
            }
            grid.appendChild(tile);
        }
    }
}

function renderWordleKeyboard() {
    const kb = document.getElementById('wordle-keyboard');
    kb.innerHTML = '';

    const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
    rows.forEach((rowStr, idx) => {
        const rowEl = document.createElement('div');
        rowEl.className = "flex justify-center gap-1";

        if (idx === 2) {
            const enterBtn = document.createElement('button');
            enterBtn.className = "bg-slate-300 text-xs font-bold px-2.5 py-3 rounded uppercase";
            enterBtn.innerText = "Enter";
            enterBtn.onclick = submitWordleGuess;
            rowEl.appendChild(enterBtn);
        }

        for (let char of rowStr) {
            const btn = document.createElement('button');
            btn.className = "w-8 h-10 bg-slate-200 rounded font-bold text-sm uppercase flex items-center justify-center hover:bg-slate-300 transition";
            btn.innerText = char;
            btn.onclick = () => addWordleChar(char);
            rowEl.appendChild(btn);
        }

        if (idx === 2) {
            const delBtn = document.createElement('button');
            delBtn.className = "bg-slate-300 text-xs font-bold px-2.5 py-3 rounded uppercase";
            delBtn.innerText = "Del";
            delBtn.onclick = deleteWordleChar;
            rowEl.appendChild(delBtn);
        }

        kb.appendChild(rowEl);
    });
}

function addWordleChar(c) {
    if (wordleCurrentGuess.length < wordleWordLength) {
        wordleCurrentGuess += c;
        renderWordleGrid();
    }
}

function deleteWordleChar() {
    wordleCurrentGuess = wordleCurrentGuess.slice(0, -1);
    renderWordleGrid();
}

function submitWordleGuess() {
    if (wordleCurrentGuess.length !== wordleWordLength) {
        alert(`Word must be ${wordleWordLength} letters long!`);
        return;
    }
    if (!csw24Set.has(wordleCurrentGuess.toLowerCase())) {
        alert("Not in CSW24 dictionary!");
        return;
    }

    wordleAttempts.push(wordleCurrentGuess.toLowerCase());
    if (wordleCurrentGuess.toLowerCase() === wordleTargetWord.toLowerCase()) {
        wordleDiscoveredWords.add(wordleTargetWord.toLowerCase());
        renderWordleGrid();
        updateWordleUI();
        alert(`Congratulations! You solved the word "${wordleTargetWord.toUpperCase()}"!`);
        return;
    }

    wordleCurrentGuess = "";
    renderWordleGrid();
    updateWordleUI();

    if (wordleAttempts.length >= 6) {
        alert(`Game Over! The target word was "${wordleTargetWord.toUpperCase()}".`);
    }
}

function handleWordleKeyDown(e) {
    if (document.getElementById('subview-wordle').classList.contains('hidden')) return;
    if (e.key === 'Enter') submitWordleGuess();
    else if (e.key === 'Backspace') deleteWordleChar();
    else if (/^[a-zA-Z]$/.test(e.key)) addWordleChar(e.key.toLowerCase());
}

function updateWordleUI() {
    document.getElementById('wordle-attempts-display').innerText = `${wordleAttempts.length} / 6`;
    document.getElementById('wordle-found-count').innerText = wordleDiscoveredWords.size;

    const list = document.getElementById('wordle-found-list');
    if (wordleDiscoveredWords.size === 0) {
        list.innerHTML = `<p class="text-xs text-gray-400 italic">No target solved yet.</p>`;
    } else {
        list.innerHTML = Array.from(wordleDiscoveredWords).map(w => `
            <button onclick="showWordDetailModal('${w}')" class="bg-green-100 hover:bg-green-200 text-green-900 text-xs font-bold px-2.5 py-1 rounded-lg border border-green-200 transition">
                ${w.toLowerCase()}
            </button>
        `).join('');
    }
}

function toggleWordleFoundList() {
    const list = document.getElementById('wordle-found-list');
    const btn = document.getElementById('wordle-toggle-list-btn');
    list.classList.toggle('hidden');
    btn.innerText = list.classList.contains('hidden') ? 'Show List' : 'Hide List';
}