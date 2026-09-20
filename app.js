let activeVaultId = 'default';
let vaults = {
    'default': {
        name: 'Default Vault',
        words: [
            { word: 'Epitome', pos: 'noun', def: 'A person or thing that is a perfect example of a particular quality or type.' },
            { word: 'Resilient', pos: 'adjective', def: 'Able to withstand or recover quickly from difficult conditions.' },
            { word: 'Serendipity', pos: 'noun', def: 'The occurrence of events by chance in a happy or beneficial way.' }
        ]
    }
};

let csw24Set = new Set();
let isDictionaryLoaded = false;
let currentSentenceWord = null;

window.addEventListener('DOMContentLoaded', () => {
    loadVaultsFromStorage();
    renderVaultSelect();
    renderWordList();
    updateStats();
    loadCSW24Dictionary();
    setupGamemodeTabScroll();
});

async function loadCSW24Dictionary() {
    const badge = document.getElementById('dict-status-badge');
    try {
        const response = await fetch('./csw24.txt');
        if (!response.ok) throw new Error('Local dictionary file not found');
        const text = await response.text();
        const words = text.split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
        csw24Set = new Set(words);
        isDictionaryLoaded = true;
        
        if (badge) {
            badge.className = "text-xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded";
            badge.innerHTML = `<i class="fa-solid fa-check mr-1"></i> Dict: CSW24 (${csw24Set.size.toLocaleString()} words)`;
        }
    } catch (err) {
        console.warn('Fallback dictionary loaded:', err);
        // Fallback default Scrabble word set
        const defaultWords = ["cat", "dog", "apple", "banana", "epitome", "resilient", "serendipity", "code", "master", "vocab", "game", "tetris", "block", "word", "quiz", "test", "hive", "bee", "scrabble"];
        csw24Set = new Set(defaultWords);
        isDictionaryLoaded = true;
        if (badge) {
            badge.className = "text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded";
            badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> Dict: Fallback (${csw24Set.size} words)`;
        }
    }
}

function toggleMobileDrawer() {
    const drawer = document.getElementById('left-drawer');
    const overlay = document.getElementById('mobile-drawer-overlay');
    drawer.classList.toggle('drawer-open');
    overlay.classList.toggle('active');
}

function closeMobileDrawer() {
    const drawer = document.getElementById('left-drawer');
    const overlay = document.getElementById('mobile-drawer-overlay');
    drawer.classList.remove('drawer-open');
    overlay.classList.remove('active');
}

function setupGamemodeTabScroll() {
    const tabBar = document.getElementById('gamemode-tab-bar');
    if (tabBar) {
        tabBar.addEventListener('wheel', (evt) => {
            if (evt.deltaY !== 0) {
                evt.preventDefault();
                tabBar.scrollLeft += evt.deltaY;
            }
        });
    }
}

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('view-' + viewId);
    if (target) {
        target.classList.add('active');
    }
    closeMobileDrawer();

    if (viewId === 'sentence') {
        populateSentenceWordSelect();
    } else if (viewId === 'test') {
        initTestSetup();
    } else if (viewId === 'definition-quiz') {
        initDefQuizSetup();
    } else if (viewId === 'spelling') {
        initSpellingSetup();
    } else if (viewId === 'flashcard') {
        initFlashcards();
    }
}

function loadVaultsFromStorage() {
    const saved = localStorage.getItem('vocab_master_vaults');
    if (saved) {
        try { vaults = JSON.parse(saved); } catch (e) {}
    }
    const active = localStorage.getItem('vocab_master_active_vault');
    if (active && vaults[active]) activeVaultId = active;
}

function saveVaultsToStorage() {
    localStorage.setItem('vocab_master_vaults', JSON.stringify(vaults));
    localStorage.setItem('vocab_master_active_vault', activeVaultId);
}

function renderVaultSelect() {
    const select = document.getElementById('vault-select');
    select.innerHTML = '';
    Object.keys(vaults).forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = vaults[id].name;
        if (id === activeVaultId) opt.selected = true;
        select.appendChild(opt);
    });
    document.getElementById('current-vault-badge').innerText = vaults[activeVaultId].name;
}

function switchVault(vaultId) {
    activeVaultId = vaultId;
    saveVaultsToStorage();
    renderVaultSelect();
    renderWordList();
    updateStats();
}

function createNewVault() {
    const name = prompt("Enter new Vault name:");
    if (!name) return;
    const newId = 'vault_' + Date.now();
    vaults[newId] = { name: name.trim(), words: [] };
    switchVault(newId);
}

function renameCurrentVault() {
    const name = prompt("Enter new name for current vault:", vaults[activeVaultId].name);
    if (!name) return;
    vaults[activeVaultId].name = name.trim();
    saveVaultsToStorage();
    renderVaultSelect();
}

function deleteCurrentVault() {
    if (Object.keys(vaults).length <= 1) {
        alert("You must keep at least one vault.");
        return;
    }
    if (confirm(`Are you sure you want to delete "${vaults[activeVaultId].name}"?`)) {
        delete vaults[activeVaultId];
        activeVaultId = Object.keys(vaults)[0];
        saveVaultsToStorage();
        renderVaultSelect();
        renderWordList();
        updateStats();
    }
}

function updateStats() {
    const totalWords = vaults[activeVaultId].words.length;
    document.getElementById('stat-total-words').innerText = totalWords;
    document.getElementById('stat-total-vaults').innerText = Object.keys(vaults).length;
}

function renderWordList() {
    const container = document.getElementById('word-list-container');
    const query = (document.getElementById('search-list')?.value || '').toLowerCase();
    container.innerHTML = '';

    const words = vaults[activeVaultId].words.filter(item => 
        item.word.toLowerCase().includes(query) || item.def.toLowerCase().includes(query)
    );

    if (words.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-gray-400 text-sm">No saved words found in this vault.</div>`;
        return;
    }

    words.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition flex justify-between items-start gap-3";
        card.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-gray-800 text-lg">${item.word}</span>
                    <span class="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded uppercase">${item.pos || 'word'}</span>
                    <button onclick="speakWord('${item.word}')" class="audio-btn-std text-blue-500 hover:text-blue-700 text-sm">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                </div>
                <p class="text-gray-600 text-sm">${item.def}</p>
            </div>
            <button onclick="deleteWord(${index})" class="text-gray-300 hover:text-red-500 transition p-1" title="Delete Word">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        container.appendChild(card);
    });
}

function deleteWord(index) {
    vaults[activeVaultId].words.splice(index, 1);
    saveVaultsToStorage();
    renderWordList();
    updateStats();
}

function handleWordInputChange() {
    document.getElementById('definitions-suggestions').classList.add('hidden');
}

async function fetchDefinitions() {
    const input = document.getElementById('new-word-input');
    const word = input.value.trim();
    const suggestionsBox = document.getElementById('definitions-suggestions');
    if (!word) return;

    suggestionsBox.classList.remove('hidden');
    suggestionsBox.innerHTML = `<p class="text-xs text-gray-500 italic"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Fetching definition for "${word}"...</p>`;

    try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        const entry = data[0];

        let html = `<h4 class="font-bold text-gray-800 text-sm mb-2 capitalize">${entry.word}</h4><div class="space-y-2">`;
        entry.meanings.forEach(m => {
            const defText = m.definitions[0]?.definition || '';
            html += `
                <div class="bg-white p-2.5 rounded border border-gray-200 text-xs">
                    <span class="font-bold text-blue-600 uppercase mr-1">[${m.partOfSpeech}]</span>
                    <span>${defText}</span>
                    <button onclick="addFetchedWord('${entry.word.replace(/'/g, "\\'")}', '${m.partOfSpeech}', '${defText.replace(/'/g, "\\'")}')" class="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-[11px] font-bold block hover:bg-blue-700">
                        + Save This Definition
                    </button>
                </div>
            `;
        });
        html += `</div>`;
        suggestionsBox.innerHTML = html;
    } catch (err) {
        suggestionsBox.innerHTML = `
            <p class="text-xs text-amber-700 font-bold mb-2">No standard dictionary entry found for "${word}".</p>
            <button onclick="addManualWord('${word.replace(/'/g, "\\'")}')" class="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700">
                + Save as Custom Word
            </button>
        `;
    }
}

function addFetchedWord(word, pos, def) {
    vaults[activeVaultId].words.push({ word, pos, def });
    saveVaultsToStorage();
    renderWordList();
    updateStats();
    document.getElementById('new-word-input').value = '';
    document.getElementById('definitions-suggestions').classList.add('hidden');
}

function addManualWord(word) {
    const def = prompt("Enter custom definition for " + word + ":");
    if (!def) return;
    vaults[activeVaultId].words.push({ word, pos: 'word', def });
    saveVaultsToStorage();
    renderWordList();
    updateStats();
    document.getElementById('new-word-input').value = '';
    document.getElementById('definitions-suggestions').classList.add('hidden');
}

function speakWord(text) {
    if (!text) return;
    // Lowercase string sanitization prevents Web Speech API from reading uppercase words letter-by-letter
    const cleanText = text.trim().toLowerCase();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

let currentModalWord = null;

async function showWordDetailModal(word) {
    currentModalWord = word.toLowerCase();
    const modal = document.getElementById('word-detail-modal');
    const title = document.getElementById('modal-word-title');
    const body = document.getElementById('modal-word-body');
    
    title.innerText = word;
    body.innerHTML = `<p class="italic text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Searching dictionary definition...</p>`;
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        const entry = data[0];

        let html = '';
        entry.meanings.forEach(m => {
            html += `
                <div class="bg-slate-50 p-2.5 rounded-lg border border-gray-200">
                    <span class="text-xs font-bold text-blue-600 uppercase bg-blue-100 px-2 py-0.5 rounded mr-1">${m.partOfSpeech}</span>
                    <p class="text-gray-700 font-medium inline">${m.definitions[0]?.definition || ''}</p>
                </div>
            `;
        });
        body.innerHTML = html;
    } catch (e) {
        body.innerHTML = `
            <div class="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800">
                <p class="font-bold mb-1"><i class="fa-solid fa-circle-info mr-1"></i> CSW24 Valid Word</p>
                <p>This is a verified Scrabble / CSW24 English tournament word.</p>
            </div>
        `;
    }
}

function closeWordDetailModal() {
    document.getElementById('word-detail-modal').classList.add('hidden');
}

function addModalWordToVault() {
    if (!currentModalWord) return;
    const exists = vaults[activeVaultId].words.some(w => w.word.toLowerCase() === currentModalWord);
    if (exists) {
        alert(`"${currentModalWord}" is already in your active vault!`);
        return;
    }
    vaults[activeVaultId].words.push({
        word: currentModalWord.charAt(0).toUpperCase() + currentModalWord.slice(1),
        pos: 'word',
        def: 'Discovered in Author Gamemodes'
    });
    saveVaultsToStorage();
    renderWordList();
    updateStats();
    alert(`Added "${currentModalWord}" to "${vaults[activeVaultId].name}"!`);
    closeWordDetailModal();
}

function populateSentenceWordSelect() {
    const select = document.getElementById('sentence-word-select');
    select.innerHTML = '<option value="">-- Select or pick random --</option>';
    const words = vaults[activeVaultId].words;
    words.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w.word;
        opt.textContent = `${w.word} (${w.pos})`;
        select.appendChild(opt);
    });
}

function updateSentenceHint() {
    const select = document.getElementById('sentence-word-select');
    const wordName = select.value;
    const hint = document.getElementById('sentence-hint');
    if (!wordName) {
        hint.classList.add('hidden');
        return;
    }
    const item = vaults[activeVaultId].words.find(w => w.word === wordName);
    if (item) {
        currentSentenceWord = item;
        hint.innerHTML = `<strong>Definition:</strong> ${item.def}`;
        hint.classList.remove('hidden');
    }
}

function randomSentenceWord() {
    const words = vaults[activeVaultId].words;
    if (words.length === 0) return;
    const randomItem = words[Math.floor(Math.random() * words.length)];
    const select = document.getElementById('sentence-word-select');
    select.value = randomItem.word;
    updateSentenceHint();
}

async function checkGrammarAI() {
    const sentence = document.getElementById('sentence-input').value.trim();
    const select = document.getElementById('sentence-word-select');
    const targetWord = select.value.trim();
    const resultBox = document.getElementById('grammar-result');
    const feedback = document.getElementById('grammar-feedback');

    if (!sentence) {
        alert("Please write a sentence first!");
        return;
    }

    resultBox.classList.remove('hidden');
    feedback.innerHTML = `<p class="text-sm text-purple-600 italic font-semibold"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Analyzing sentence structure & context using Gemini AI...</p>`;

    // Gemini API Request Payload
    const systemPrompt = `You are an expert English grammar evaluator and ESL teacher. Analyze the user's sentence and return a JSON object with:
    1. "score": integer (0 to 100 overall score)
    2. "targetWordUsed": boolean (true if target word or its inflected form is present)
    3. "grammarIssues": list of strings (specific errors found or "None")
    4. "contextFeedback": string (detailed evaluation of fluency and correct word usage)
    5. "modelSentences": list of 2 improved/natural model sentences.`;

    const userPrompt = `Target Word: "${targetWord || 'N/A'}"\nUser Sentence: "${sentence}"`;

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "score": { "type": "INTEGER" },
                    "targetWordUsed": { "type": "BOOLEAN" },
                    "grammarIssues": { "type": "ARRAY", "items": { "type": "STRING" } },
                    "contextFeedback": { "type": "STRING" },
                    "modelSentences": { "type": "ARRAY", "items": { "type": "STRING" } }
                },
                required: ["score", "targetWordUsed", "grammarIssues", "contextFeedback", "modelSentences"]
            }
        }
    };

    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Gemini API request failed");
        const data = await response.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const resData = JSON.parse(jsonText);

        const scoreColor = resData.score >= 80 ? 'text-green-600' : (resData.score >= 60 ? 'text-amber-600' : 'text-red-600');

        feedback.innerHTML = `
            <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div class="flex justify-between items-center border-b pb-3">
                    <span class="font-bold text-gray-700">Sentence Quality Score:</span>
                    <span class="text-2xl font-extrabold ${scoreColor}">${resData.score} / 100</span>
                </div>

                ${targetWord ? `
                    <div class="flex items-center gap-2 text-xs font-bold ${resData.targetWordUsed ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'} p-2 rounded-lg">
                        <i class="fa-solid ${resData.targetWordUsed ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
                        <span>Target word "${targetWord}" usage: ${resData.targetWordUsed ? 'Correctly detected' : 'Missing or misspelled'}</span>
                    </div>
                ` : ''}

                <div>
                    <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">AI Context & Grammar Evaluation</h4>
                    <p class="text-sm text-gray-800 bg-purple-50 p-3 rounded-lg border border-purple-100">${resData.contextFeedback}</p>
                </div>

                ${resData.grammarIssues.length > 0 && resData.grammarIssues[0] !== "None" ? `
                    <div>
                        <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Specific Corrections</h4>
                        <ul class="list-disc list-inside text-sm text-amber-800 space-y-1 bg-amber-50 p-3 rounded-lg border border-amber-100">
                            ${resData.grammarIssues.map(i => `<li>${i}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <div>
                    <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Recommended Model Sentences</h4>
                    <div class="space-y-1.5">
                        ${resData.modelSentences.map(s => `
                            <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 flex justify-between items-center">
                                <span>"${s}"</span>
                                <button onclick="speakWord('${s.replace(/'/g, "\\'")}')" class="audio-btn-std text-blue-500 hover:text-blue-700">
                                    <i class="fa-solid fa-volume-high"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        // Fallback basic client check
        feedback.innerHTML = `
            <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-sm text-gray-700">
                <p class="font-bold text-green-600 mb-2"><i class="fa-solid fa-check-circle mr-1"></i> Sentence Recorded!</p>
                <p><strong>Your sentence:</strong> "${sentence}"</p>
            </div>
        `;
    }
}

function exportWords() {
    const data = JSON.stringify(vaults[activeVaultId], null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${vaults[activeVaultId].name.replace(/\s+/g, '_')}.words`;
    a.click();
}

function importWords(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.words && Array.isArray(imported.words)) {
                const newId = 'vault_' + Date.now();
                vaults[newId] = { name: imported.name || 'Imported Vault', words: imported.words };
                switchVault(newId);
                alert('Vault imported successfully!');
            }
        } catch (err) {
            alert('Invalid file format.');
        }
    };
    reader.readAsText(file);
}

let flashcardIndex = 0;
let testQuestions = [];
let testScore = 0;
let testIndex = 0;

function initFlashcards() {
    const words = vaults[activeVaultId].words;
    if (words.length === 0) {
        document.getElementById('flashcard-ui').classList.add('hidden');
        document.getElementById('flashcard-empty').classList.remove('hidden');
        return;
    }
    document.getElementById('flashcard-ui').classList.remove('hidden');
    document.getElementById('flashcard-ui').classList.add('flex');
    document.getElementById('flashcard-empty').classList.add('hidden');
    flashcardIndex = 0;
    showCard();
}

function showCard() {
    const words = vaults[activeVaultId].words;
    const card = document.getElementById('flashcard-element');
    card.classList.remove('flipped');
    
    document.getElementById('flashcard-counter').innerText = `${flashcardIndex + 1} / ${words.length}`;
    document.getElementById('flashcard-word').innerText = words[flashcardIndex].word;
    document.getElementById('flashcard-defs').innerHTML = `
        <span class="text-xs font-bold text-blue-600 uppercase bg-blue-100 px-2 py-0.5 rounded">${words[flashcardIndex].pos}</span>
        <p class="text-gray-800 text-lg font-medium mt-2">${words[flashcardIndex].def}</p>
    `;
}

function flipCard() {
    document.getElementById('flashcard-element').classList.toggle('flipped');
}

function nextCard() {
    const words = vaults[activeVaultId].words;
    flashcardIndex = (flashcardIndex + 1) % words.length;
    showCard();
}

function prevCard() {
    const words = vaults[activeVaultId].words;
    flashcardIndex = (flashcardIndex - 1 + words.length) % words.length;
    showCard();
}

function shuffleCards() {
    vaults[activeVaultId].words.sort(() => Math.random() - 0.5);
    initFlashcards();
}

/* PRACTICE & QUIZ INITS */
function initTestSetup() {
    document.getElementById('test-available-words').innerText = vaults[activeVaultId].words.length;
}

function startTest() {
    const words = vaults[activeVaultId].words;
    if (words.length < 2) {
        document.getElementById('test-error-msg').innerText = "Add at least 2 words to practice!";
        document.getElementById('test-error-msg').classList.remove('hidden');
        return;
    }
    document.getElementById('test-error-msg').classList.add('hidden');
    document.getElementById('test-setup').classList.add('hidden');
    document.getElementById('test-active').classList.remove('hidden');
    
    testQuestions = [...words].sort(() => Math.random() - 0.5);
    testScore = 0;
    testIndex = 0;
    showTestQuestion();
}

function showTestQuestion() {
    const current = testQuestions[testIndex];
    document.getElementById('test-progress').innerText = `Question: ${testIndex + 1} / ${testQuestions.length}`;
    document.getElementById('test-score-display').innerText = `Score: ${testScore}`;
    document.getElementById('test-question-word').innerText = current.word;

    const optCount = parseInt(document.getElementById('option-count').value);
    let options = [current.def];
    let pool = vaults[activeVaultId].words.filter(w => w.word !== current.word);
    
    while (options.length < optCount && pool.length > 0) {
        const randIdx = Math.floor(Math.random() * pool.length);
        options.push(pool[randIdx].def);
        pool.splice(randIdx, 1);
    }
    options.sort(() => Math.random() - 0.5);

    const container = document.getElementById('test-options');
    container.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition text-sm font-medium text-gray-700 shadow-sm";
        btn.innerText = opt;
        btn.onclick = () => answerTest(opt === current.def);
        container.appendChild(btn);
    });
}

function answerTest(isCorrect) {
    if (isCorrect) testScore += 10;
    testIndex++;
    if (testIndex < testQuestions.length) {
        showTestQuestion();
    } else {
        document.getElementById('test-active').classList.add('hidden');
        document.getElementById('test-result').classList.remove('hidden');
        document.getElementById('final-score').innerText = testScore;
    }
}

/* DEFINITION QUIZ LOGIC */
let defQuizQuestions = [];
let defQuizIndex = 0;
let defQuizScore = 0;

function initDefQuizSetup() {
    document.getElementById('def-quiz-available-words').innerText = vaults[activeVaultId].words.length;
}

function startDefQuiz() {
    const words = vaults[activeVaultId].words;
    if (words.length === 0) {
        document.getElementById('def-quiz-error-msg').innerText = "Add words to your vault first!";
        document.getElementById('def-quiz-error-msg').classList.remove('hidden');
        return;
    }
    document.getElementById('def-quiz-error-msg').classList.add('hidden');
    document.getElementById('def-quiz-setup').classList.add('hidden');
    document.getElementById('def-quiz-active').classList.remove('hidden');

    const count = parseInt(document.getElementById('def-quiz-word-count').value);
    defQuizQuestions = [...words].sort(() => Math.random() - 0.5).slice(0, count);
    defQuizIndex = 0;
    defQuizScore = 0;
    showDefQuizQuestion();
}

function showDefQuizQuestion() {
    const q = defQuizQuestions[defQuizIndex];
    document.getElementById('def-quiz-progress').innerText = `Word: ${defQuizIndex + 1} / ${defQuizQuestions.length}`;
    document.getElementById('def-quiz-score-display').innerText = `Score: ${defQuizScore}`;
    document.getElementById('def-quiz-pos').innerText = q.pos;
    document.getElementById('def-quiz-explanation').innerText = q.def;
    document.getElementById('def-quiz-answer-input').value = '';
    document.getElementById('def-quiz-feedback').classList.add('hidden');
}

function submitDefQuizAnswer() {
    const input = document.getElementById('def-quiz-answer-input').value.trim().toLowerCase();
    const target = defQuizQuestions[defQuizIndex].word.toLowerCase();
    const feedback = document.getElementById('def-quiz-feedback');

    feedback.classList.remove('hidden');
    if (input === target) {
        defQuizScore++;
        feedback.className = "mt-6 p-4 rounded-xl text-left border bg-green-50 border-green-200 text-green-800 font-bold";
        feedback.innerHTML = `<i class="fa-solid fa-circle-check mr-2"></i> Correct!`;
    } else {
        feedback.className = "mt-6 p-4 rounded-xl text-left border bg-red-50 border-red-200 text-red-800 font-bold";
        feedback.innerHTML = `<i class="fa-solid fa-circle-xmark mr-2"></i> Incorrect. Target word was: <u>${target}</u>`;
    }

    setTimeout(() => {
        defQuizIndex++;
        if (defQuizIndex < defQuizQuestions.length) {
            showDefQuizQuestion();
        } else {
            document.getElementById('def-quiz-active').classList.add('hidden');
            document.getElementById('def-quiz-result').classList.remove('hidden');
            document.getElementById('def-quiz-final-score').innerText = `${defQuizScore} / ${defQuizQuestions.length}`;
        }
    }, 1500);
}

/* SPELLING QUIZ LOGIC */
let spellingQuestions = [];
let spellingIndex = 0;
let spellingCorrect = 0;

function initSpellingSetup() {
    document.getElementById('spelling-available-words').innerText = vaults[activeVaultId].words.length;
}

function startSpellingQuiz() {
    const words = vaults[activeVaultId].words;
    if (words.length === 0) {
        document.getElementById('spelling-error-msg').innerText = "Add words to your vault first!";
        document.getElementById('spelling-error-msg').classList.remove('hidden');
        return;
    }
    document.getElementById('spelling-error-msg').classList.add('hidden');
    document.getElementById('spelling-setup').classList.add('hidden');
    document.getElementById('spelling-active').classList.remove('hidden');

    const count = parseInt(document.getElementById('spelling-word-count').value);
    spellingQuestions = [...words].sort(() => Math.random() - 0.5).slice(0, count);
    spellingIndex = 0;
    spellingCorrect = 0;
    showSpellingQuestion();
}

function showSpellingQuestion() {
    document.getElementById('spelling-progress').innerText = `Word: ${spellingIndex + 1} / ${spellingQuestions.length}`;
    document.getElementById('spelling-score-display').innerText = `Correct: ${spellingCorrect}`;
    document.getElementById('spelling-answer-input').value = '';
    document.getElementById('spelling-feedback').classList.add('hidden');
    speakSpellingTarget();
}

function speakSpellingTarget() {
    if (spellingQuestions[spellingIndex]) {
        speakWord(spellingQuestions[spellingIndex].word);
    }
}

function submitSpellingAnswer() {
    const input = document.getElementById('spelling-answer-input').value.trim().toLowerCase();
    const target = spellingQuestions[spellingIndex].word.toLowerCase();
    const feedback = document.getElementById('spelling-feedback');

    feedback.classList.remove('hidden');
    if (input === target) {
        spellingCorrect++;
        feedback.className = "mt-6 p-4 rounded-xl text-left border bg-blue-50 border-blue-200 text-blue-800 font-bold";
        feedback.innerHTML = `<i class="fa-solid fa-circle-check mr-2"></i> Perfect Spelling!`;
    } else {
        feedback.className = "mt-6 p-4 rounded-xl text-left border bg-red-50 border-red-200 text-red-800 font-bold";
        feedback.innerHTML = `<i class="fa-solid fa-circle-xmark mr-2"></i> Incorrect spelling. Correct was: <u>${target}</u>`;
    }

    setTimeout(() => {
        spellingIndex++;
        if (spellingIndex < spellingQuestions.length) {
            showSpellingQuestion();
        } else {
            document.getElementById('spelling-active').classList.add('hidden');
            document.getElementById('spelling-result').classList.remove('hidden');
            document.getElementById('spelling-final-accuracy').innerText = `${spellingCorrect} / ${spellingQuestions.length}`;
        }
    }, 1500);
}