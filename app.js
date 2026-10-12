let vaults = {};
        let activeVaultId = "default";
        let vocabList = [];
        let editingWordId = null;

        const SCRABBLE_POINTS = {
            'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1,
            'J': 8, 'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1,
            'S': 1, 'T': 1, 'U': 1, 'V': 4, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10
        };

        const CSW24_DICTIONARY = new Set([
            "AA","AB","AD","AE","AG","AH","AI","AL","AM","AN","AO","AR","AS","AT","AW","AX","AY","BA","BE","BI","BO","BY","DA","DE","DO","ED","EF","EH","EL","EM","EN","ER","ES","ET","EX","FA","FE","FO","GO","HA","HE","HI","HO","ID","IF","IN","IS","IT","JO","KA","LA","LI","LO","MA","ME","MI","MM","MO","MU","MY","NA","NE","NO","NU","OD","OE","OF","OH","OI","OK","OM","ON","OP","OR","OS","OW","OX","OY","PA","PE","PI","PO","RE","SH","SI","SO","TA","TE","TI","TO","UH","UM","UN","UP","US","UT","WE","WO","XI","XU","YA","YE","YO","ZA"
        ]);

        function speakWord(text, lang = 'en-US') {
            if (!('speechSynthesis' in window)) {
                showToast("Your browser does not support text-to-speech.", true);
                return;
            }
            if (!text || text.trim() === '') return;

            window.speechSynthesis.cancel();
            const cleanText = text.trim().toLowerCase();
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = lang;
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }

        window.onload = () => {
            loadData();
            renderVaultSelect();
            updateStats();
            renderWordList();
            updateSentenceSelect();
            loadFullScrabbleDictionary();

            // Horizontal wheel scrolling for gamemodes tab bar on desktop
            const tabBar = document.getElementById('gamemode-tab-bar');
            if (tabBar) {
                tabBar.addEventListener('wheel', (evt) => {
                    if (evt.deltaY !== 0) {
                        evt.preventDefault();
                        tabBar.scrollLeft += evt.deltaY;
                    }
                }, { passive: false });
            }
        };

        async function loadFullScrabbleDictionary() {
            const badge = document.getElementById('dict-status-badge');
            if (badge) badge.innerHTML = `<i class="fa-solid fa-spin fa-circle-notch mr-1"></i> Dict: Loading...`;

            const urls = [
                './csw24.txt',
                'https://raw.githubusercontent.com/scrabblewords/scrabblewords/main/words/csw21.txt',
                'https://cdn.jsdelivr.net/gh/raun/Scrabble@master/words.txt'
            ];

            let loadSuccess = false;

            for (const url of urls) {
                try {
                    const res = await fetch(url);
                    if (res.ok) {
                        const text = await res.text();
                        const words = text.split(/\r?\n/);
                        words.forEach(w => {
                            const clean = w.trim().toUpperCase().replace(/[^A-Z]/g, '');
                            if (clean.length >= 2) {
                                CSW24_DICTIONARY.add(clean);
                            }
                        });
                        
                        const countStr = CSW24_DICTIONARY.size.toLocaleString();
                        if (badge) {
                            badge.innerHTML = `<i class="fa-solid fa-check text-green-600 mr-1"></i> Dict: CSW24 (${countStr} words)`;
                            badge.className = "text-xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded font-mono";
                        }
                        
                        if (document.getElementById('blocky-active') && !document.getElementById('blocky-active').classList.contains('hidden')) {
                            checkAndClearWords();
                        }
                        
                        loadSuccess = true;
                        break;
                    }
                } catch (err) {
                    console.warn(`Source ${url} failed, trying next...`);
                }
            }

            if (!loadSuccess && badge) {
                const countStr = CSW24_DICTIONARY.size.toLocaleString();
                badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> Dict: Fallback (${countStr} words)`;
                badge.className = "text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded font-mono";
                showToast("Failed to load full CSW24 dictionary. Using limited basic words.", true);
            }
        }

        function switchView(viewId) {
            const targetView = document.getElementById(`view-${viewId}`);
            if (targetView && targetView.classList.contains('active')) {
                return;
            }

            document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
            if (targetView) targetView.classList.add('active');
            
            if (viewId === 'flashcard') initFlashcards();
            if (viewId === 'test') {
                document.getElementById('test-available-words').innerText = vocabList.length;
                document.getElementById('option-count').max = Math.min(6, Math.max(2, vocabList.length));
            }
            if (viewId === 'definition-quiz') {
                document.getElementById('def-quiz-available-words').innerText = vocabList.length;
                const range = document.getElementById('def-quiz-word-count');
                range.max = Math.max(1, vocabList.length);
                range.value = Math.min(5, Math.max(1, vocabList.length));
                document.getElementById('def-quiz-count-display').innerText = range.value;
            }
            if (viewId === 'spelling') {
                document.getElementById('spelling-available-words').innerText = vocabList.length;
                const range = document.getElementById('spelling-word-count');
                range.max = Math.max(1, vocabList.length);
                range.value = Math.min(5, Math.max(1, vocabList.length));
                document.getElementById('spelling-count-display').innerText = range.value;
            }
            if (viewId === 'sentence') updateSentenceSelect();
        }

        function switchWordGameMode(mode) {
            document.getElementById('subview-tetris').classList.toggle('hidden', mode !== 'tetris');
            document.getElementById('subview-blocky').classList.toggle('hidden', mode !== 'blocky');
            document.getElementById('subview-scrabble').classList.toggle('hidden', mode !== 'scrabble');
            document.getElementById('subview-bee').classList.toggle('hidden', mode !== 'bee');
            document.getElementById('subview-wordle').classList.toggle('hidden', mode !== 'wordle');

            const tBtn = document.getElementById('tab-btn-tetris');
            const bBtn = document.getElementById('tab-btn-blocky');
            const sBtn = document.getElementById('tab-btn-scrabble');
            const beeBtn = document.getElementById('tab-btn-bee');
            const wBtn = document.getElementById('tab-btn-wordle');

            const inactiveCls = "flex-1 py-2 px-2.5 rounded-lg text-gray-600 hover:text-gray-900 transition flex items-center justify-center gap-1 whitespace-nowrap";

            tBtn.className = mode === 'tetris' ? "flex-1 py-2 px-2.5 rounded-lg bg-white shadow-sm text-purple-600 transition flex items-center justify-center gap-1 whitespace-nowrap" : inactiveCls;
            bBtn.className = mode === 'blocky' ? "flex-1 py-2 px-2.5 rounded-lg bg-white shadow-sm text-blue-600 transition flex items-center justify-center gap-1 whitespace-nowrap" : inactiveCls;
            sBtn.className = mode === 'scrabble' ? "flex-1 py-2 px-2.5 rounded-lg bg-white shadow-sm text-amber-600 transition flex items-center justify-center gap-1 whitespace-nowrap" : inactiveCls;
            beeBtn.className = mode === 'bee' ? "flex-1 py-2 px-2.5 rounded-lg bg-white shadow-sm text-amber-600 font-bold transition flex items-center justify-center gap-1 whitespace-nowrap" : inactiveCls;
            wBtn.className = mode === 'wordle' ? "flex-1 py-2 px-2.5 rounded-lg bg-white shadow-sm text-green-600 font-bold transition flex items-center justify-center gap-1 whitespace-nowrap" : inactiveCls;
        }

        function saveData() {
            if (vaults[activeVaultId]) {
                vaults[activeVaultId].words = vocabList;
            }
            localStorage.setItem('vocabMasterVaults', JSON.stringify(vaults));
            localStorage.setItem('vocabMasterActiveVault', activeVaultId);
            updateStats();
            updateSentenceSelect();
        }

        function loadData() {
            const savedVaults = localStorage.getItem('vocabMasterVaults');
            const savedActiveVault = localStorage.getItem('vocabMasterActiveVault');

            if (savedVaults) {
                vaults = JSON.parse(savedVaults);
            } else {
                const oldData = localStorage.getItem('vocabMasterData');
                let initialWords = [];
                if (oldData) {
                    try { initialWords = JSON.parse(oldData); } catch(e) {}
                }
                vaults = {
                    "default": {
                        name: "Main Vault",
                        words: initialWords
                    }
                };
            }

            if (savedActiveVault && vaults[savedActiveVault]) {
                activeVaultId = savedActiveVault;
            } else {
                activeVaultId = Object.keys(vaults)[0] || "default";
            }

            vocabList = vaults[activeVaultId] ? vaults[activeVaultId].words : [];
        }

        function renderVaultSelect() {
            const select = document.getElementById('vault-select');
            select.innerHTML = Object.keys(vaults).map(id => `
                <option value="${id}" ${id === activeVaultId ? 'selected' : ''}>${vaults[id].name}</option>
            `).join('');

            const badge = document.getElementById('current-vault-badge');
            if (badge && vaults[activeVaultId]) {
                badge.innerText = vaults[activeVaultId].name;
            }
        }

        function switchVault(vaultId) {
            if (!vaults[vaultId]) return;
            activeVaultId = vaultId;
            vocabList = vaults[activeVaultId].words || [];
            localStorage.setItem('vocabMasterActiveVault', activeVaultId);
            
            editingWordId = null;
            renderVaultSelect();
            updateStats();
            renderWordList();
            updateSentenceSelect();
            showToast(`Switched to "${vaults[activeVaultId].name}"`);
        }

        function createNewVault() {
            const name = prompt("Enter a name for the new Vocabulary Vault:", "My New Vault");
            if (!name || !name.trim()) return;

            const newId = 'vault_' + Date.now();
            vaults[newId] = {
                name: name.trim(),
                words: []
            };

            saveData();
            switchVault(newId);
        }

        function renameCurrentVault() {
            const currentName = vaults[activeVaultId].name;
            const newName = prompt("Enter a new name for this vault:", currentName);
            if (!newName || !newName.trim() || newName.trim() === currentName) return;

            vaults[activeVaultId].name = newName.trim();
            saveData();
            renderVaultSelect();
            showToast("Vault renamed successfully!");
        }

        function deleteCurrentVault() {
            const vaultKeys = Object.keys(vaults);
            if (vaultKeys.length <= 1) {
                showToast("You must keep at least one vault!", true);
                return;
            }

            const currentName = vaults[activeVaultId].name;
            delete vaults[activeVaultId];
            const nextVaultId = Object.keys(vaults)[0];
            switchVault(nextVaultId);
            saveData();
            showToast(`Vault "${currentName}" deleted.`);
        }

        function updateStats() {
            document.getElementById('stat-total-words').innerText = vocabList.length;
            document.getElementById('stat-total-vaults').innerText = Object.keys(vaults).length;
        }

        function showToast(msg, isError = false) {
            const toast = document.getElementById('toast');
            toast.innerText = msg;
            toast.style.backgroundColor = isError ? '#ef4444' : '#1e293b';
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(-5px)';
            setTimeout(() => { 
                toast.style.opacity = '0'; 
                toast.style.transform = 'translateX(-50%) translateY(0)';
            }, 3000);
        }

        let tempDefinitions = [];
        let currentFetchingWord = "";

        function handleWordInputChange() {
            const word = document.getElementById('new-word-input').value.trim();
            const suggestContainer = document.getElementById('definitions-suggestions');
            
            if (word.length > 0) {
                if (currentFetchingWord !== word) {
                    currentFetchingWord = word;
                    tempDefinitions = [];
                }
                suggestContainer.classList.remove('hidden');
                renderDefinitionSuggestions('Manual Entry');
            } else {
                suggestContainer.classList.add('hidden');
            }
        }

        async function fetchDefinitions() {
            const input = document.getElementById('new-word-input');
            const word = input.value.trim().toLowerCase();
            const suggestContainer = document.getElementById('definitions-suggestions');
            const fetchBtn = document.getElementById('fetch-btn');

            if (!word) {
                showToast("Please enter a word!", true);
                return;
            }
            if (vocabList.some(v => v.word.toLowerCase() === word)) {
                showToast("This word is already in your vault!", true);
                return;
            }

            suggestContainer.classList.remove('hidden');
            suggestContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i> Checking spelling & searching dictionaries...</p>';
            fetchBtn.disabled = true;
            fetchBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

            try {
                const spellCheckRes = await fetch('https://api.languagetool.org/v2/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ text: word, language: 'en-US' })
                });

                if (spellCheckRes.ok) {
                    const spellData = await spellCheckRes.json();
                    if (spellData.matches.length > 0 && spellData.matches[0].replacements.length > 0) {
                        const suggestions = spellData.matches[0].replacements.slice(0, 4);
                        renderSpellingSuggestions(word, suggestions);
                        fetchBtn.disabled = false;
                        fetchBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Get Suggestions';
                        return;
                    }
                }
            } catch (err) {
                console.warn("Spell check service unavailable, proceeding directly to dictionary lookup...");
            }

            await lookupDefinitions(word);

            fetchBtn.disabled = false;
            fetchBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Get Suggestions';
        }

        async function lookupDefinitions(word) {
            const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
            const wikiUrl = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;

            try {
                const result = await Promise.any([
                    fetch(dictUrl).then(async res => {
                        if (!res.ok) throw new Error('FreeDict API failed');
                        const data = await res.json();
                        let defs = [];
                        data[0].meanings.forEach(meaning => {
                            const pos = meaning.partOfSpeech;
                            meaning.definitions.slice(0, 3).forEach(def => {
                                defs.push({ pos: pos, def: def.definition, selected: false });
                            });
                        });
                        if (defs.length === 0) throw new Error('FreeDict has no definitions');
                        return { word: data[0].word, defs: defs, source: 'Free Dictionary' };
                    }),
                    fetch(wikiUrl).then(async res => {
                        if (!res.ok) throw new Error('Wiki API failed');
                        const data = await res.json();
                        let defs = [];
                        if (!data.en || data.en.length === 0) throw new Error('Wiki has no English definitions');
                        data.en.forEach(meaning => {
                            const pos = meaning.partOfSpeech;
                            meaning.definitions.slice(0, 3).forEach(defObj => {
                                let cleanDef = defObj.definition
                                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                    .replace(/<[^>]*>?/gm, '')
                                    .trim();

                                if (cleanDef.length > 0) {
                                    defs.push({ pos: pos, def: cleanDef, selected: false });
                                }
                            });
                        });
                        if (defs.length === 0) throw new Error('Wiki has no definitions');
                        return { word: word, defs: defs, source: 'Wiktionary' };
                    })
                ]);

                tempDefinitions = result.defs;
                currentFetchingWord = result.word;
                renderDefinitionSuggestions(result.source);

            } catch (error) {
                console.error("All dictionary APIs failed to respond:", error);
                tempDefinitions = [];
                currentFetchingWord = word;
                renderDefinitionSuggestions('Manual Entry (API failed)');
            }
        }

        function renderSpellingSuggestions(originalWord, suggestions) {
            const container = document.getElementById('definitions-suggestions');
            let html = `
                <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p class="text-xs text-amber-800 font-bold mb-2">
                        <i class="fa-solid fa-triangle-exclamation mr-1"></i> Did you mean one of these?
                    </p>
                    <div class="flex flex-wrap gap-2 mb-3">
            `;

            suggestions.forEach(item => {
                html += `
                    <button onclick="applySpellingCorrection('${item.value.replace(/'/g, "\\'")}')" class="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-md text-xs font-semibold transition">
                        ${item.value}
                    </button>
                `;
            });

            html += `
                    </div>
                    <p class="text-xs text-gray-500">
                        Or click <button onclick="lookupDefinitions('${originalWord.replace(/'/g, "\\'")}')" class="text-blue-600 underline font-medium">Continue with "${originalWord}"</button> anyway.
                    </p>
                </div>
            `;

            container.innerHTML = html;
        }

        function applySpellingCorrection(correctedWord) {
            document.getElementById('new-word-input').value = correctedWord;
            lookupDefinitions(correctedWord);
        }

        function renderDefinitionSuggestions(sourceName) {
            const container = document.getElementById('definitions-suggestions');
            let html = `
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-bold text-gray-700 break-words max-w-[70%]">Definitions for "${currentFetchingWord.toLowerCase()}":</h4>
                    <span class="text-xs text-gray-400 flex-shrink-0">Source: ${sourceName}</span>
                </div>
            `;

            if (tempDefinitions.length > 0) {
                html += `<div class="space-y-2 max-h-48 overflow-y-auto pr-2 mb-3">`;
                tempDefinitions.forEach((def, index) => {
                    html += `
                        <label class="flex items-start space-x-3 p-2 hover:bg-gray-100 rounded cursor-pointer border border-transparent hover:border-gray-200">
                            <input type="checkbox" class="mt-1 form-checkbox text-blue-600 rounded flex-shrink-0" onchange="toggleDefSelection(${index})" ${def.selected ? 'checked' : ''}>
                            <div class="break-words min-w-0">
                                <span class="text-xs font-bold text-blue-600 uppercase bg-blue-100 px-1 rounded mr-1">${def.pos}</span>
                                <span class="text-sm text-gray-700">${def.def}</span>
                            </div>
                        </label>
                    `;
                });
                html += `</div>`;
            } else {
                html += `<p class="text-xs text-gray-500 mb-2 italic">No online suggestions loaded. You can type your custom definition below.</p>`;
            }

            html += `
                <div class="pt-2 border-t border-gray-200 mt-2">
                    <label class="block text-xs font-bold text-gray-600 mb-1"><i class="fa-solid fa-pen"></i> Add Custom Meaning / Note:</label>
                    <div class="flex gap-2">
                        <select id="custom-pos" class="text-xs border border-gray-300 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                            <option value="noun">noun</option>
                            <option value="verb">verb</option>
                            <option value="adj">adj</option>
                            <option value="adv">adv</option>
                            <option value="phrase">phrase</option>
                            <option value="other">other</option>
                        </select>
                        <input type="text" id="custom-def-input" placeholder="Type custom meaning or translation..." class="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 min-w-0" oninput="checkSaveButtonState()">
                    </div>
                </div>

                <button id="add-word-btn" onclick="saveNewWord()" class="w-full mt-3 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition font-bold disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                    Save Word to Vault
                </button>
            `;
            container.innerHTML = html;
            checkSaveButtonState();
        }

        function toggleDefSelection(index) {
            tempDefinitions[index].selected = !tempDefinitions[index].selected;
            checkSaveButtonState();
        }

        function checkSaveButtonState() {
            const btn = document.getElementById('add-word-btn');
            if (!btn) return;
            const hasSelected = tempDefinitions.some(d => d.selected);
            const customInput = document.getElementById('custom-def-input');
            const hasCustomText = customInput && customInput.value.trim().length > 0;
            
            btn.disabled = !(hasSelected || hasCustomText);
        }

        function saveNewWord() {
            let selectedDefs = tempDefinitions.filter(d => d.selected).map(d => ({ pos: d.pos, def: d.def }));
            
            const customDefInput = document.getElementById('custom-def-input');
            const customPosInput = document.getElementById('custom-pos');
            
            if (customDefInput && customDefInput.value.trim().length > 0) {
                selectedDefs.push({
                    pos: customPosInput.value,
                    def: customDefInput.value.trim()
                });
            }

            if (selectedDefs.length === 0) return;

            const finalWord = (currentFetchingWord || document.getElementById('new-word-input').value.trim()).toLowerCase();

            if (vocabList.some(v => v.word.toLowerCase() === finalWord)) {
                showToast("This word is already in your vault!", true);
                return;
            }

            vocabList.unshift({
                id: Date.now().toString(),
                word: finalWord,
                definitions: selectedDefs,
                addedAt: Date.now()
            });

            saveData();
            
            document.getElementById('new-word-input').value = '';
            document.getElementById('definitions-suggestions').classList.add('hidden');
            tempDefinitions = [];
            currentFetchingWord = '';
            
            showToast("Successfully added to your vault!");
            renderWordList();
        }

        function renderWordList() {
            const container = document.getElementById('word-list-container');
            const searchQ = document.getElementById('search-list').value.toLowerCase();
            
            const filtered = vocabList.filter(v => v.word.toLowerCase().includes(searchQ));
            
            if (filtered.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-400 py-4">No matching words found</p>';
                return;
            }

            container.innerHTML = filtered.map(item => {
                const lowerWord = item.word.toLowerCase();
                if (editingWordId === item.id) {
                    return `
                        <div class="bg-blue-50/60 p-4 rounded-xl shadow-sm border border-blue-200">
                            <div class="flex justify-between items-center mb-3">
                                <h4 class="font-bold text-lg text-blue-900 break-words min-w-0">${lowerWord}</h4>
                                <span class="text-xs bg-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded">Editing Definitions</span>
                            </div>
                            
                            <div id="edit-defs-container-${item.id}" class="space-y-2 mb-3">
                                ${item.definitions.map((d, index) => `
                                    <div class="flex gap-2 items-center edit-def-row">
                                        <select class="edit-pos-select text-xs border border-gray-300 rounded-lg px-2 py-1 outline-none bg-white font-semibold text-gray-700">
                                            <option value="noun" ${d.pos === 'noun' ? 'selected' : ''}>noun</option>
                                            <option value="verb" ${d.pos === 'verb' ? 'selected' : ''}>verb</option>
                                            <option value="adj" ${d.pos === 'adj' ? 'selected' : ''}>adj</option>
                                            <option value="adv" ${d.pos === 'adv' ? 'selected' : ''}>adv</option>
                                            <option value="phrase" ${d.pos === 'phrase' ? 'selected' : ''}>phrase</option>
                                            <option value="other" ${['noun','verb','adj','adv','phrase'].includes(d.pos) ? '' : 'selected'}>other</option>
                                        </select>
                                        <input type="text" value="${d.def.replace(/"/g, '&quot;')}" class="edit-def-text flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500">
                                        <button onclick="removeEditDefRow(this)" class="text-red-400 hover:text-red-600 text-sm p-1" title="Remove definition">
                                            <i class="fa-solid fa-circle-minus"></i>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>

                            <button onclick="addEditDefRow('${item.id}')" class="text-xs text-blue-600 hover:text-blue-800 font-semibold mb-4 flex items-center gap-1">
                                <i class="fa-solid fa-plus-circle"></i> Add Meaning Option
                            </button>

                            <div class="flex gap-2 justify-end">
                                <button onclick="cancelEditingWord()" class="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-semibold transition">
                                    Cancel
                                </button>
                                <button onclick="saveWordDefinitions('${item.id}')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition">
                                    <i class="fa-solid fa-check"></i> Save Changes
                                </button>
                            </div>
                        </div>
                    `;
                }

                return `
                    <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-start group gap-3">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <h4 class="font-bold text-lg text-gray-800 break-words min-w-0">${lowerWord}</h4>
                                <button onclick="event.preventDefault(); event.stopPropagation(); speakWord('${lowerWord.replace(/'/g, "\\'")}')" class="audio-btn-std text-blue-500 hover:text-blue-700 hover:bg-blue-50 text-base transition" title="Speak Word">
                                    <i class="fa-solid fa-volume-high"></i>
                                </button>
                            </div>
                            <ul class="text-sm text-gray-600 mt-1 space-y-1">
                                ${item.definitions.slice(0, 3).map(d => `<li class="break-words"><span class="text-xs text-blue-500 italic mr-1 flex-shrink-0">${d.pos}.</span>${d.def}</li>`).join('')}
                                ${item.definitions.length > 3 ? `<li class="text-xs text-gray-400">+ ${item.definitions.length - 3} more...</li>` : ''}
                            </ul>
                        </div>
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                            <button onclick="startEditingWord('${item.id}')" class="text-gray-400 hover:text-blue-600 p-2" title="Edit meanings">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="deleteWord('${item.id}')" class="text-red-400 hover:text-red-600 p-2" title="Delete word">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function startEditingWord(id) {
            editingWordId = id;
            renderWordList();
        }

        function cancelEditingWord() {
            editingWordId = null;
            renderWordList();
        }

        function addEditDefRow(id) {
            const container = document.getElementById(`edit-defs-container-${id}`);
            if (!container) return;
            
            const newRow = document.createElement('div');
            newRow.className = "flex gap-2 items-center edit-def-row";
            newRow.innerHTML = `
                <select class="edit-pos-select text-xs border border-gray-300 rounded-lg px-2 py-1 outline-none bg-white font-semibold text-gray-700">
                    <option value="noun">noun</option>
                    <option value="verb">verb</option>
                    <option value="adj">adj</option>
                    <option value="adv">adv</option>
                    <option value="phrase">phrase</option>
                    <option value="other">other</option>
                </select>
                <input type="text" placeholder="Enter meaning..." class="edit-def-text flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500">
                <button onclick="removeEditDefRow(this)" class="text-red-400 hover:text-red-600 text-sm p-1" title="Remove definition">
                    <i class="fa-solid fa-circle-minus"></i>
                </button>
            `;
            container.appendChild(newRow);
        }

        function removeEditDefRow(btn) {
            const row = btn.closest('.edit-def-row');
            if (row) row.remove();
        }

        function saveWordDefinitions(id) {
            const container = document.getElementById(`edit-defs-container-${id}`);
            if (!container) return;

            const rows = container.querySelectorAll('.edit-def-row');
            let updatedDefs = [];

            rows.forEach(row => {
                const pos = row.querySelector('.edit-pos-select').value;
                const defText = row.querySelector('.edit-def-text').value.trim();
                if (defText.length > 0) {
                    updatedDefs.push({ pos: pos, def: defText });
                }
            });

            if (updatedDefs.length === 0) {
                showToast("A word must have at least one definition!", true);
                return;
            }

            const targetWord = vocabList.find(v => v.id === id);
            if (targetWord) {
                targetWord.definitions = updatedDefs;
                saveData();
                editingWordId = null;
                renderWordList();
                showToast("Meaning updated successfully!");
            }
        }

        function deleteWord(id) {
            vocabList = vocabList.filter(v => v.id !== id);
            if (editingWordId === id) editingWordId = null;
            saveData();
            renderWordList();
            showToast("Word removed from vault.");
        }

        async function exportWords() {
            if (vocabList.length === 0) {
                showToast("Vault is empty, cannot export", true);
                return;
            }
            const dataStr = JSON.stringify(vocabList, null, 2);
            const vaultName = vaults[activeVaultId].name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            
            try {
                if (window.showSaveFilePicker) {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: `VocabMaster_${vaultName}_${new Date().toISOString().slice(0,10)}.words`,
                        types: [{ description: 'Words File', accept: {'text/plain': ['.words', '.txt']} }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(dataStr);
                    await writable.close();
                    showToast("Export successful!");
                } else {
                    fallbackDownload(dataStr, vaultName);
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error(err);
                    fallbackDownload(dataStr, vaultName);
                }
            }
        }

        function fallbackDownload(dataStr, vaultName = "vault") {
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `VocabMaster_${vaultName}_${new Date().toISOString().slice(0,10)}.words`;
            a.click();
            URL.revokeObjectURL(url);
            showToast("Download triggered! Please check your downloads folder.");
        }

        function importWords(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (Array.isArray(importedData)) {
                        let addedCount = 0;
                        importedData.forEach(newItem => {
                            const lower = newItem.word.toLowerCase();
                            if (!vocabList.some(v => v.word.toLowerCase() === lower)) {
                                newItem.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                                newItem.word = lower;
                                vocabList.push(newItem);
                                addedCount++;
                            }
                        });
                        saveData();
                        renderWordList();
                        showToast(`Successfully imported ${addedCount} new words!`);
                    }
                } catch (err) {
                    showToast("File format error!", true);
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        }

        let modalCurrentWordObj = null;

        async function showWordDetailModal(word) {
            const modal = document.getElementById('word-detail-modal');
            const titleEl = document.getElementById('modal-word-title');
            const speakBtn = document.getElementById('modal-speak-btn');
            const contentEl = document.getElementById('modal-word-content');
            const addBtn = document.getElementById('modal-add-vault-btn');

            const lowerWord = word.trim().toLowerCase();
            titleEl.innerText = lowerWord;
            speakBtn.onclick = () => speakWord(lowerWord);
            contentEl.innerHTML = `<p class="text-center text-gray-500 py-6"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading word definition...</p>`;

            modal.classList.remove('hidden');
            modal.classList.add('flex');

            const existingInVault = vocabList.find(v => v.word.toLowerCase() === lowerWord);
            
            let wordDefs = [];
            
            if (existingInVault) {
                wordDefs = existingInVault.definitions;
                modalCurrentWordObj = existingInVault;
            } else {
                const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lowerWord)}`;
                const wikiUrl = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(lowerWord)}`;

                try {
                    const result = await Promise.any([
                        fetch(dictUrl).then(async res => {
                            if (!res.ok) throw new Error('FreeDict failed');
                            const data = await res.json();
                            let defs = [];
                            data[0].meanings.forEach(m => {
                                m.definitions.slice(0, 2).forEach(d => {
                                    defs.push({ pos: m.partOfSpeech, def: d.definition });
                                });
                            });
                            if (defs.length === 0) throw new Error('No defs');
                            return defs;
                        }),
                        fetch(wikiUrl).then(async res => {
                            if (!res.ok) throw new Error('Wiki failed');
                            const data = await res.json();
                            let defs = [];
                            if (!data.en || data.en.length === 0) throw new Error('No wiki defs');
                            data.en.forEach(m => {
                                m.definitions.slice(0, 2).forEach(d => {
                                    let cleanDef = d.definition
                                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                        .replace(/<[^>]*>?/gm, '')
                                        .trim();
                                    if (cleanDef.length > 0) defs.push({ pos: m.partOfSpeech, def: cleanDef });
                                });
                            });
                            if (defs.length === 0) throw new Error('No defs');
                            return defs;
                        })
                    ]);
                    wordDefs = result;
                } catch(e) {
                    console.warn("Modal dictionary fetch failed:", e);
                }

                if (wordDefs.length === 0) {
                    wordDefs = [{ pos: "word", def: "Valid dictionary word." }];
                }

                modalCurrentWordObj = {
                    id: Date.now().toString(),
                    word: lowerWord,
                    definitions: wordDefs,
                    addedAt: Date.now()
                };
            }

            contentEl.innerHTML = `
                <div class="space-y-3">
                    ${wordDefs.map(d => `
                        <div class="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                            <span class="text-xs font-bold text-blue-600 uppercase bg-blue-100 px-2 py-0.5 rounded mr-1">${d.pos}</span>
                            <p class="text-sm text-gray-800 mt-1">${d.def}</p>
                        </div>
                    `).join('')}
                </div>
            `;

            if (existingInVault) {
                addBtn.disabled = true;
                addBtn.className = "px-4 py-2 bg-green-100 text-green-700 text-xs font-bold rounded-xl flex items-center gap-1 cursor-default";
                addBtn.innerHTML = `<i class="fa-solid fa-check"></i> Already in Vault`;
            } else {
                addBtn.disabled = false;
                addBtn.className = "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer";
                addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Add to Current Vault`;
                addBtn.onclick = () => addModalWordToVault();
            }
        }

        function addModalWordToVault() {
            if (!modalCurrentWordObj) return;

            if (vocabList.some(v => v.word.toLowerCase() === modalCurrentWordObj.word.toLowerCase())) {
                showToast("Word is already in your vault!");
                return;
            }

            vocabList.unshift(modalCurrentWordObj);
            saveData();
            renderWordList();
            showToast(`Added "${modalCurrentWordObj.word.toLowerCase()}" to vault!`);

            const addBtn = document.getElementById('modal-add-vault-btn');
            addBtn.disabled = true;
            addBtn.className = "px-4 py-2 bg-green-100 text-green-700 text-xs font-bold rounded-xl flex items-center gap-1 cursor-default";
            addBtn.innerHTML = `<i class="fa-solid fa-check"></i> Added to Vault`;
        }

        function closeWordModal() {
            const modal = document.getElementById('word-detail-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        let flashcardList = [];
        let currentCardIndex = 0;

        function initFlashcards() {
            if (vocabList.length === 0) {
                document.getElementById('flashcard-ui').classList.add('hidden');
                document.getElementById('flashcard-empty').classList.remove('hidden');
                return;
            }
            document.getElementById('flashcard-empty').classList.add('hidden');
            document.getElementById('flashcard-ui').classList.remove('hidden');
            document.getElementById('flashcard-ui').classList.add('flex');
            
            flashcardList = [...vocabList];
            currentCardIndex = 0;
            updateFlashcardView();
        }

        function updateFlashcardView() {
            const card = flashcardList[currentCardIndex];
            document.getElementById('flashcard-counter').innerText = `${currentCardIndex + 1} / ${flashcardList.length}`;
            document.getElementById('flashcard-word').innerText = card.word.toLowerCase();
            
            const defsHtml = card.definitions.map(d => `
                <div class="mb-2 pb-2 border-b border-gray-100 last:border-0 flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                        <span class="text-xs font-bold text-blue-500 uppercase">${d.pos}</span>
                        <p class="text-sm text-gray-700 break-words">${d.def}</p>
                    </div>
                    <button onclick="event.preventDefault(); event.stopPropagation(); speakWord('${d.def.replace(/'/g, "\\'")}')" class="audio-btn-std text-blue-500 hover:text-blue-700 hover:bg-blue-100 text-sm transition" title="Read definition">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                </div>
            `).join('');
            document.getElementById('flashcard-defs').innerHTML = defsHtml;
            document.getElementById('flashcard-element').classList.remove('is-flipped');
        }

        function flipCard() {
            document.getElementById('flashcard-element').classList.toggle('is-flipped');
        }

        function nextCard() {
            if (currentCardIndex < flashcardList.length - 1) {
                currentCardIndex++;
                updateFlashcardView();
            }
        }

        function prevCard() {
            if (currentCardIndex > 0) {
                currentCardIndex--;
                updateFlashcardView();
            }
        }

        function shuffleCards() {
            flashcardList.sort(() => Math.random() - 0.5);
            currentCardIndex = 0;
            updateFlashcardView();
            showToast("Cards shuffled!");
        }

        let testQuestions = [];
        let currentTestIndex = 0;
        let testScore = 0;

        function startTest() {
            const optionCount = parseInt(document.getElementById('option-count').value);
            if (vocabList.length < 2) {
                const err = document.getElementById('test-error-msg');
                err.innerText = "You need at least 2 words in your vault to start practice!";
                err.classList.remove('hidden');
                return;
            }
            
            const actualOptions = Math.min(optionCount, vocabList.length);
            document.getElementById('test-setup').classList.add('hidden');
            document.getElementById('test-result').classList.add('hidden');
            document.getElementById('test-active').classList.remove('hidden');

            testQuestions = [...vocabList].sort(() => Math.random() - 0.5);
            currentTestIndex = 0;
            testScore = 0;
            
            renderTestQuestion(actualOptions);
        }

        function renderTestQuestion(optionCount) {
            if (currentTestIndex >= testQuestions.length) {
                endTest();
                return;
            }

            const currentTarget = testQuestions[currentTestIndex];
            document.getElementById('test-progress').innerText = `Question: ${currentTestIndex + 1} / ${testQuestions.length}`;
            document.getElementById('test-score-display').innerText = `Score: ${testScore}`;
            document.getElementById('test-question-word').innerText = currentTarget.word.toLowerCase();

            const correctDef = currentTarget.definitions[Math.floor(Math.random() * currentTarget.definitions.length)].def;
            
            let wrongDefs = [];
            let otherWords = vocabList.filter(v => v.id !== currentTarget.id).sort(() => Math.random() - 0.5);
            for (let i = 0; i < optionCount - 1; i++) {
                if (otherWords[i]) {
                    wrongDefs.push(otherWords[i].definitions[0].def);
                }
            }

            let options = [{ text: correctDef, isCorrect: true }, ...wrongDefs.map(d => ({ text: d, isCorrect: false }))];
            options.sort(() => Math.random() - 0.5);

            const optionsContainer = document.getElementById('test-options');
            optionsContainer.innerHTML = '';
            
            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = "w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition text-sm text-gray-700 shadow-sm break-words";
                btn.innerText = opt.text;
                btn.onclick = () => handleTestAnswer(btn, opt.isCorrect, optionCount);
                optionsContainer.appendChild(btn);
            });
        }

        function handleTestAnswer(btnElement, isCorrect, optionCount) {
            const buttons = document.getElementById('test-options').querySelectorAll('button');
            buttons.forEach(b => b.disabled = true);

            if (isCorrect) {
                btnElement.classList.replace('border-gray-200', 'border-green-500');
                btnElement.classList.replace('bg-white', 'bg-green-100');
                btnElement.classList.remove('hover:bg-blue-50');
                testScore += 10;
            } else {
                btnElement.classList.replace('border-gray-200', 'border-red-500');
                btnElement.classList.replace('bg-white', 'bg-red-100');
                btnElement.classList.remove('hover:bg-blue-50');
                
                buttons.forEach(b => {
                    if (b.onclick.toString().includes('true')) {
                         b.classList.replace('border-gray-200', 'border-green-500');
                         b.classList.add('bg-green-50');
                    }
                });
            }
            document.getElementById('test-score-display').innerText = `Score: ${testScore}`;

            setTimeout(() => {
                currentTestIndex++;
                renderTestQuestion(optionCount);
            }, 1200);
        }

        function endTest() {
            document.getElementById('test-active').classList.add('hidden');
            document.getElementById('test-result').classList.remove('hidden');
            document.getElementById('final-score').innerText = testScore;
        }

        let defQuizQuestions = [];
        let currentDefQuizIndex = 0;
        let defQuizCorrectCount = 0;

        function startDefQuiz() {
            const count = parseInt(document.getElementById('def-quiz-word-count').value);
            if (vocabList.length === 0) {
                const err = document.getElementById('def-quiz-error-msg');
                err.innerText = "You need at least 1 word in your vault to start the quiz!";
                err.classList.remove('hidden');
                return;
            }

            document.getElementById('def-quiz-setup').classList.add('hidden');
            document.getElementById('def-quiz-result').classList.add('hidden');
            document.getElementById('def-quiz-active').classList.remove('hidden');

            defQuizQuestions = [...vocabList].sort(() => Math.random() - 0.5).slice(0, count);
            currentDefQuizIndex = 0;
            defQuizCorrectCount = 0;

            renderDefQuizQuestion();
        }

        function renderDefQuizQuestion() {
            if (currentDefQuizIndex >= defQuizQuestions.length) {
                endDefQuiz();
                return;
            }

            const currentTarget = defQuizQuestions[currentDefQuizIndex];
            document.getElementById('def-quiz-progress').innerText = `Word: ${currentDefQuizIndex + 1} / ${defQuizQuestions.length}`;
            document.getElementById('def-quiz-score-display').innerText = `Score: ${defQuizCorrectCount}`;

            const randomDefObj = currentTarget.definitions[Math.floor(Math.random() * currentTarget.definitions.length)];
            document.getElementById('def-quiz-pos').innerText = randomDefObj.pos;
            document.getElementById('def-quiz-explanation').innerText = randomDefObj.def;

            const input = document.getElementById('def-quiz-answer-input');
            input.value = '';
            input.disabled = false;
            
            const submitBtn = document.getElementById('def-quiz-submit-btn');
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');

            const feedback = document.getElementById('def-quiz-feedback');
            feedback.classList.add('hidden');

            input.focus();
        }

        function submitDefQuizAnswer() {
            const input = document.getElementById('def-quiz-answer-input');
            const userAns = input.value.trim().toLowerCase();
            const targetObj = defQuizQuestions[currentDefQuizIndex];
            const correctWord = targetObj.word.trim().toLowerCase();

            if (!userAns) return;

            input.disabled = true;
            const submitBtn = document.getElementById('def-quiz-submit-btn');
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

            const feedback = document.getElementById('def-quiz-feedback');
            feedback.classList.remove('hidden');

            const isCorrect = userAns === correctWord;
            if (isCorrect) {
                defQuizCorrectCount++;
                feedback.className = "mt-6 p-4 rounded-xl border bg-green-50 border-green-200 text-green-800 text-sm";
                feedback.innerHTML = `
                    <p class="font-bold text-base mb-1"><i class="fa-solid fa-circle-check text-green-600 mr-2"></i> Correct!</p>
                    <p>Word: <span class="font-bold font-mono text-green-900">${targetObj.word.toLowerCase()}</span></p>
                `;
            } else {
                feedback.className = "mt-6 p-4 rounded-xl border bg-red-50 border-red-200 text-red-800 text-sm";
                feedback.innerHTML = `
                    <p class="font-bold text-base mb-1"><i class="fa-solid fa-circle-xmark text-red-600 mr-2"></i> Incorrect</p>
                    <p class="mb-1">You typed: <span class="line-through font-mono">${input.value.trim().toLowerCase()}</span></p>
                    <p>Correct Word: <span class="font-bold text-green-700 font-mono">${targetObj.word.toLowerCase()}</span></p>
                `;
            }

            document.getElementById('def-quiz-score-display').innerText = `Score: ${defQuizCorrectCount}`;

            setTimeout(() => {
                currentDefQuizIndex++;
                renderDefQuizQuestion();
            }, 2000);
        }

        function endDefQuiz() {
            document.getElementById('def-quiz-active').classList.add('hidden');
            document.getElementById('def-quiz-result').classList.remove('hidden');
            document.getElementById('def-quiz-final-score').innerText = `${defQuizCorrectCount} / ${defQuizQuestions.length}`;
        }

        let spellingQuestions = [];
        let currentSpellingIndex = 0;
        let spellingCorrectCount = 0;

        function startSpellingQuiz() {
            const count = parseInt(document.getElementById('spelling-word-count').value);
            if (vocabList.length === 0) {
                const err = document.getElementById('spelling-error-msg');
                err.innerText = "You need at least 1 word in your vault to start the spelling quiz!";
                err.classList.remove('hidden');
                return;
            }

            document.getElementById('spelling-setup').classList.add('hidden');
            document.getElementById('spelling-result').classList.add('hidden');
            document.getElementById('spelling-active').classList.remove('hidden');

            spellingQuestions = [...vocabList].sort(() => Math.random() - 0.5).slice(0, count);
            currentSpellingIndex = 0;
            spellingCorrectCount = 0;

            renderSpellingQuestion();
        }

        function renderSpellingQuestion() {
            if (currentSpellingIndex >= spellingQuestions.length) {
                endSpellingQuiz();
                return;
            }

            const currentTarget = spellingQuestions[currentSpellingIndex];
            document.getElementById('spelling-progress').innerText = `Word: ${currentSpellingIndex + 1} / ${spellingQuestions.length}`;
            document.getElementById('spelling-score-display').innerText = `Correct: ${spellingCorrectCount}`;

            const input = document.getElementById('spelling-answer-input');
            input.value = '';
            input.disabled = false;
            
            const submitBtn = document.getElementById('spelling-submit-btn');
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');

            const feedback = document.getElementById('spelling-feedback');
            feedback.classList.add('hidden');

            speakSpellingTarget();
            input.focus();
        }

        function speakSpellingTarget() {
            if (spellingQuestions[currentSpellingIndex]) {
                speakWord(spellingQuestions[currentSpellingIndex].word);
            }
        }

        function submitSpellingAnswer() {
            const input = document.getElementById('spelling-answer-input');
            const userAns = input.value.trim().toLowerCase();
            const targetObj = spellingQuestions[currentSpellingIndex];
            const correctWord = targetObj.word.trim().toLowerCase();

            if (!userAns) return;

            input.disabled = true;
            const submitBtn = document.getElementById('spelling-submit-btn');
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

            const feedback = document.getElementById('spelling-feedback');
            feedback.classList.remove('hidden');

            const isCorrect = userAns === correctWord;
            if (isCorrect) {
                spellingCorrectCount++;
                feedback.className = "mt-6 p-4 rounded-xl border bg-green-50 border-green-200 text-green-800 text-sm";
                feedback.innerHTML = `
                    <p class="font-bold text-base mb-1"><i class="fa-solid fa-circle-check text-green-600 mr-2"></i> Correct!</p>
                    <p>Spelling: <span class="font-bold font-mono">${targetObj.word.toLowerCase()}</span></p>
                `;
            } else {
                feedback.className = "mt-6 p-4 rounded-xl border bg-red-50 border-red-200 text-red-800 text-sm";
                feedback.innerHTML = `
                    <p class="font-bold text-base mb-1"><i class="fa-solid fa-circle-xmark text-red-600 mr-2"></i> Incorrect</p>
                    <p class="mb-1">You typed: <span class="line-through font-mono">${input.value.trim().toLowerCase()}</span></p>
                    <p>Correct Spelling: <span class="font-bold text-green-700 font-mono">${targetObj.word.toLowerCase()}</span></p>
                `;
            }

            document.getElementById('spelling-score-display').innerText = `Correct: ${spellingCorrectCount}`;

            setTimeout(() => {
                currentSpellingIndex++;
                renderSpellingQuestion();
            }, 2000);
        }

        function endSpellingQuiz() {
            document.getElementById('spelling-active').classList.add('hidden');
            document.getElementById('spelling-result').classList.remove('hidden');
            document.getElementById('spelling-final-accuracy').innerText = `${spellingCorrectCount} / ${spellingQuestions.length}`;
        }

        let tetrisGrid = Array(13).fill(null).map(() => Array(13).fill(null));
        let tetrisScore = 0;
        let tetrisWordsCount = 0;
        let tetrisMinWordLen = 2;
        let tetrisFoundWords = new Set();
        let tetrisTimer = null;
        let tetrisActivePiece = null;
        let tetrisNextPiece = null;
        let tetrisIsGameOver = false;

        const TETRIS_SHAPES = [
            [[1]],
            [[1, 1]],
            [[1, 1, 1]],
            [[1, 1, 1, 1]],
            [[1, 1], [1, 1]],
            [[1, 1, 1], [0, 1, 0]],
            [[1, 0], [1, 0], [1, 1]],
            [[0, 1], [0, 1], [1, 1]]
        ];

        const ALPHABET_WEIGHTED = "AAAAAEEEEIIIIOOOOOUUUUBBCDDFGHJKLMNNPQRRSSTTTTVWXYZ";

        function getRandomLetter() {
            return ALPHABET_WEIGHTED.charAt(Math.floor(Math.random() * ALPHABET_WEIGHTED.length));
        }

        function generateTetrisPiece() {
            const shape = TETRIS_SHAPES[Math.floor(Math.random() * TETRIS_SHAPES.length)];
            const letters = shape.map(row => row.map(val => val ? getRandomLetter() : null));
            return { shape, letters };
        }

        function returnToTetrisSetup() {
            if (tetrisTimer) clearInterval(tetrisTimer);
            const overlay = document.getElementById('tetris-gameover-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.style.display = '';
            }
            document.getElementById('tetris-active').classList.add('hidden');
            document.getElementById('tetris-setup').classList.remove('hidden');
        }

        function startTetrisGame() {
            if (tetrisTimer) clearInterval(tetrisTimer);
            
            const overlay = document.getElementById('tetris-gameover-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.style.display = '';
            }

            tetrisGrid = Array(13).fill(null).map(() => Array(13).fill(null));
            tetrisScore = 0;
            tetrisWordsCount = 0;
            tetrisFoundWords.clear();
            tetrisIsGameOver = false;

            document.getElementById('tetris-score-display').innerText = '0';
            document.getElementById('tetris-words-count-display').innerText = '0';

            document.getElementById('tetris-setup').classList.add('hidden');
            document.getElementById('tetris-active').classList.remove('hidden');

            tetrisNextPiece = generateTetrisPiece();
            spawnTetrisPiece();
            renderTetrisGrid();
            renderTetrisFoundList();

            tetrisTimer = setInterval(tickTetris, 750);

            window.removeEventListener('keydown', handleTetrisKeydown);
            window.addEventListener('keydown', handleTetrisKeydown);
        }

        function spawnTetrisPiece() {
            const newPiece = tetrisNextPiece || generateTetrisPiece();
            tetrisNextPiece = generateTetrisPiece();
            renderTetrisNextPreview();

            const startC = Math.floor((13 - newPiece.shape[0].length) / 2);
            tetrisActivePiece = {
                shape: newPiece.shape,
                letters: newPiece.letters,
                r: 0,
                c: startC
            };

            if (!canPlaceTetrisPiece(tetrisActivePiece.shape, tetrisActivePiece.r, tetrisActivePiece.c)) {
                triggerTetrisGameOver();
            }
        }

        function renderTetrisNextPreview() {
            const container = document.getElementById('tetris-next-preview');
            if (!tetrisNextPiece) return;
            const shape = tetrisNextPiece.shape;
            const letters = tetrisNextPiece.letters;
            
            container.style.gridTemplateColumns = `repeat(${shape[0].length}, 12px)`;
            container.innerHTML = '';

            shape.forEach((row, r) => {
                row.forEach((val, c) => {
                    const cell = document.createElement('div');
                    cell.className = "w-3 h-3 text-[8px] font-extrabold flex items-center justify-center rounded-sm " +
                        (val ? "bg-purple-500 text-white" : "bg-transparent");
                    if (val) cell.innerText = letters[r][c];
                    container.appendChild(cell);
                });
            });
        }

        function canPlaceTetrisPiece(shape, startR, startC) {
            for (let r = 0; r < shape.length; r++) {
                for (let c = 0; c < shape[0].length; c++) {
                    if (shape[r][c] === 1) {
                        const targetR = startR + r;
                        const targetC = startC + c;

                        if (targetR < 0 || targetR >= 13 || targetC < 0 || targetC >= 13) {
                            return false;
                        }
                        if (tetrisGrid[targetR][targetC] !== null) {
                            return false;
                        }
                    }
                }
            }
            return true;
        }

        function renderTetrisGrid() {
            const board = document.getElementById('tetris-board');
            board.innerHTML = '';

            let activeMap = new Map();
            if (tetrisActivePiece) {
                for (let pr = 0; pr < tetrisActivePiece.shape.length; pr++) {
                    for (let pc = 0; pc < tetrisActivePiece.shape[0].length; pc++) {
                        if (tetrisActivePiece.shape[pr][pc] === 1) {
                            const r = tetrisActivePiece.r + pr;
                            const c = tetrisActivePiece.c + pc;
                            activeMap.set(`${r},${c}`, tetrisActivePiece.letters[pr][pc]);
                        }
                    }
                }
            }

            for (let r = 0; r < 13; r++) {
                for (let c = 0; c < 13; c++) {
                    const cell = document.createElement('div');
                    const isActive = activeMap.has(`${r},${c}`);
                    const cellVal = isActive ? activeMap.get(`${r},${c}`) : tetrisGrid[r][c];

                    cell.className = `tetris-cell ${isActive ? 'falling-active' : (cellVal ? 'filled' : '')}`;
                    cell.id = `tcell-${r}-${c}`;
                    cell.innerText = cellVal ? cellVal : '';

                    board.appendChild(cell);
                }
            }
        }

        function tickTetris() {
            if (tetrisIsGameOver || !tetrisActivePiece) return;

            if (canPlaceTetrisPiece(tetrisActivePiece.shape, tetrisActivePiece.r + 1, tetrisActivePiece.c)) {
                tetrisActivePiece.r++;
                renderTetrisGrid();
            } else {
                lockTetrisPiece();
            }
        }

        function lockTetrisPiece() {
            if (!tetrisActivePiece) return;

            for (let pr = 0; pr < tetrisActivePiece.shape.length; pr++) {
                for (let pc = 0; pc < tetrisActivePiece.shape[0].length; pc++) {
                    if (tetrisActivePiece.shape[pr][pc] === 1) {
                        const r = tetrisActivePiece.r + pr;
                        const c = tetrisActivePiece.c + pc;
                        if (r >= 0 && r < 13 && c >= 0 && c < 13) {
                            tetrisGrid[r][c] = tetrisActivePiece.letters[pr][pc];
                        }
                    }
                }
            }

            tetrisActivePiece = null;
            renderTetrisGrid();

            checkAndClearTetrisWords();

            if (!tetrisIsGameOver) {
                spawnTetrisPiece();
                renderTetrisGrid();
            }
        }

        function moveTetrisLeft() {
            if (tetrisIsGameOver || !tetrisActivePiece) return;
            if (canPlaceTetrisPiece(tetrisActivePiece.shape, tetrisActivePiece.r, tetrisActivePiece.c - 1)) {
                tetrisActivePiece.c--;
                renderTetrisGrid();
            }
        }

        function moveTetrisRight() {
            if (tetrisIsGameOver || !tetrisActivePiece) return;
            if (canPlaceTetrisPiece(tetrisActivePiece.shape, tetrisActivePiece.r, tetrisActivePiece.c + 1)) {
                tetrisActivePiece.c++;
                renderTetrisGrid();
            }
        }

        function dropTetrisSoft() {
            if (tetrisIsGameOver || !tetrisActivePiece) return;
            tickTetris();
        }

        function dropTetrisHard() {
            if (tetrisIsGameOver || !tetrisActivePiece) return;
            while (canPlaceTetrisPiece(tetrisActivePiece.shape, tetrisActivePiece.r + 1, tetrisActivePiece.c)) {
                tetrisActivePiece.r++;
            }
            lockTetrisPiece();
        }

        function rotateTetrisPiece() {
            if (tetrisIsGameOver || !tetrisActivePiece) return;

            const oldShape = tetrisActivePiece.shape;
            const oldLetters = tetrisActivePiece.letters;
            const rows = oldShape.length;
            const cols = oldShape[0].length;

            let newShape = Array(cols).fill(null).map(() => Array(rows).fill(0));
            let newLetters = Array(cols).fill(null).map(() => Array(rows).fill(null));

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    newShape[c][rows - 1 - r] = oldShape[r][c];
                    newLetters[c][rows - 1 - r] = oldLetters[r][c];
                }
            }

            if (canPlaceTetrisPiece(newShape, tetrisActivePiece.r, tetrisActivePiece.c)) {
                tetrisActivePiece.shape = newShape;
                tetrisActivePiece.letters = newLetters;
                renderTetrisGrid();
            }
        }

        function handleTetrisKeydown(e) {
            const activeView = document.getElementById('subview-tetris');
            if (!activeView || activeView.classList.contains('hidden')) return;

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }

            if (e.key === 'ArrowLeft') moveTetrisLeft();
            else if (e.key === 'ArrowRight') moveTetrisRight();
            else if (e.key === 'ArrowUp') rotateTetrisPiece();
            else if (e.key === 'ArrowDown') dropTetrisSoft();
            else if (e.key === ' ') dropTetrisHard();
        }

        function checkAndClearTetrisWords() {
            let matchedCells = new Set();
            let matchedWordsList = [];

            for (let r = 0; r < 13; r++) {
                let c = 0;
                while (c < 13) {
                    if (tetrisGrid[r][c] !== null) {
                        let letterSeq = "";
                        let coords = [];
                        
                        while (c < 13 && tetrisGrid[r][c] !== null) {
                            letterSeq += tetrisGrid[r][c];
                            coords.push({ r, c });
                            c++;
                        }

                        findTetrisWordsInSequence(letterSeq, coords, matchedCells, matchedWordsList);
                    } else {
                        c++;
                    }
                }
            }

            for (let c = 0; c < 13; c++) {
                let r = 0;
                while (r < 13) {
                    if (tetrisGrid[r][c] !== null) {
                        let letterSeq = "";
                        let coords = [];

                        while (r < 13 && tetrisGrid[r][c] !== null) {
                            letterSeq += tetrisGrid[r][c];
                            coords.push({ r, c });
                            r++;
                        }

                        findTetrisWordsInSequence(letterSeq, coords, matchedCells, matchedWordsList);
                    } else {
                        r++;
                    }
                }
            }

            if (matchedCells.size > 0) {
                const clearedCount = matchedCells.size;
                const gainedPts = clearedCount * 15 + matchedWordsList.length * 10;

                tetrisScore += gainedPts;
                tetrisWordsCount += matchedWordsList.length;

                matchedWordsList.forEach(w => tetrisFoundWords.add(w.toLowerCase()));

                document.getElementById('tetris-score-display').innerText = tetrisScore;
                document.getElementById('tetris-words-count-display').innerText = tetrisWordsCount;
                renderTetrisFoundList();

                matchedCells.forEach(key => {
                    const [r, c] = key.split(',').map(Number);
                    const cellEl = document.getElementById(`tcell-${r}-${c}`);
                    if (cellEl) cellEl.classList.add('clearing');
                });

                const wordsStr = matchedWordsList.map(w => w.toLowerCase()).join(', ');
                showToast(`Cleared "${wordsStr}"! (+${gainedPts} pts)`);

                setTimeout(() => {
                    matchedCells.forEach(key => {
                        const [r, c] = key.split(',').map(Number);
                        tetrisGrid[r][c] = null;
                    });

                    applyTetrisGravity();
                    renderTetrisGrid();

                    checkAndClearTetrisWords();
                }, 400);
            }
        }

        function findTetrisWordsInSequence(seq, coords, matchedCells, matchedWordsList) {
            const len = seq.length;
            if (len < tetrisMinWordLen) return;

            for (let i = 0; i < len; i++) {
                for (let j = i + tetrisMinWordLen; j <= len; j++) {
                    const subStr = seq.substring(i, j);
                    if (CSW24_DICTIONARY.has(subStr)) {
                        for (let k = i; k < j; k++) {
                            matchedCells.add(`${coords[k].r},${coords[k].c}`);
                        }
                        if (!matchedWordsList.includes(subStr)) {
                            matchedWordsList.push(subStr);
                        }
                    }
                }
            }
        }

        function applyTetrisGravity() {
            for (let c = 0; c < 13; c++) {
                let emptyRow = 12;
                for (let r = 12; r >= 0; r--) {
                    if (tetrisGrid[r][c] !== null) {
                        if (r !== emptyRow) {
                            tetrisGrid[emptyRow][c] = tetrisGrid[r][c];
                            tetrisGrid[r][c] = null;
                        }
                        emptyRow--;
                    }
                }
            }
        }

        function triggerTetrisGameOver() {
            tetrisIsGameOver = true;
            if (tetrisTimer) clearInterval(tetrisTimer);

            document.getElementById('tetris-final-score').innerText = tetrisScore;
            document.getElementById('tetris-final-words').innerText = tetrisWordsCount;
            const overlay = document.getElementById('tetris-gameover-overlay');
            overlay.classList.remove('hidden');
            overlay.style.display = 'flex';
        }

        function hideTetrisOverlayAndInspect() {
            const overlay = document.getElementById('tetris-gameover-overlay');
            overlay.classList.add('hidden');
            overlay.style.display = '';
            toggleTetrisFoundList();
        }

        function renderTetrisFoundList() {
            const container = document.getElementById('tetris-found-list');
            const countEl = document.getElementById('tetris-found-count');
            countEl.innerText = tetrisFoundWords.size;

            if (tetrisFoundWords.size === 0) {
                container.innerHTML = `<p class="text-xs text-gray-400 italic">No words formed yet. Start dropping pieces!</p>`;
                return;
            }

            const sorted = Array.from(tetrisFoundWords).sort();
            container.innerHTML = sorted.map(w => `
                <button onclick="showWordDetailModal('${w.toLowerCase()}')" class="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold px-2 py-1 rounded-md border border-purple-200 transition flex items-center gap-1">
                    <i class="fa-solid fa-book-open text-[10px]"></i> ${w.toLowerCase()}
                </button>
            `).join('');
        }

        function toggleTetrisFoundList() {
            const list = document.getElementById('tetris-found-list');
            const btn = document.getElementById('tetris-toggle-list-btn');
            if (list.classList.contains('hidden')) {
                list.classList.remove('hidden');
                btn.innerText = 'Hide List';
            } else {
                list.classList.add('hidden');
                btn.innerText = 'Show List';
            }
        }

        let blockyGrid = Array(9).fill(null).map(() => Array(9).fill(null));
        let blockyScore = 0;
        let blocksPlacedCount = 0;
        let totalWordsFormed = 0;
        let activePieces = [null, null, null];
        let selectedPieceIndex = null;
        let blockyFoundWords = new Set();
        let blockyMinWordLen = 3;

        const VOCAB_SHAPES = [
            [[1]],
            [[1, 1]],
            [[1], [1]],
            [[1, 1, 1]],
            [[1], [1], [1]],
            [[1, 1, 1, 1]],
            [[1], [1], [1], [1]],
            [[1, 1], [1, 1]],
            [[1, 1, 1], [1, 1, 1], [1, 1, 1]]
        ];

        function returnToBlockySetup() {
            const overlay = document.getElementById('blocky-gameover-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.style.display = '';
            }
            document.getElementById('blocky-active').classList.add('hidden');
            document.getElementById('blocky-setup').classList.remove('hidden');
        }

        function startBlockyGame() {
            const overlay = document.getElementById('blocky-gameover-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.style.display = '';
            }

            blockyGrid = Array(9).fill(null).map(() => Array(9).fill(null));
            blockyScore = 0;
            blocksPlacedCount = 0;
            totalWordsFormed = 0;
            selectedPieceIndex = null;
            blockyFoundWords.clear();

            document.getElementById('blocky-score-display').innerText = '0';
            document.getElementById('words-count-display').innerText = '0';
            document.getElementById('placed-counter-text').innerText = 'Placed: 0';

            document.getElementById('blocky-setup').classList.add('hidden');
            document.getElementById('blocky-active').classList.remove('hidden');

            renderBlockyGrid();
            renderBlockyFoundList();
            spawnBlockyPieces();
        }

        function renderBlockyGrid() {
            const board = document.getElementById('blocky-board');
            board.innerHTML = '';
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    const cell = document.createElement('div');
                    const isAltZone = (Math.floor(r / 3) + Math.floor(c / 3)) % 2 === 1;
                    const cellVal = blockyGrid[r][c];
                    
                    cell.className = `blocky-cell ${isAltZone ? 'sub-grid-alt' : ''} ${cellVal ? 'filled' : ''}`;
                    cell.id = `bcell-${r}-${c}`;
                    cell.dataset.r = r;
                    cell.dataset.c = c;
                    cell.innerText = cellVal ? cellVal : '';
                    
                    cell.onclick = () => handleCellClick(r, c);
                    cell.ondragover = (e) => handleDragOver(e, r, c);
                    cell.ondragleave = () => clearBoardHover();
                    cell.ondrop = (e) => handleDrop(e, r, c);
                    
                    board.appendChild(cell);
                }
            }
        }

        function spawnBlockyPieces() {
            selectedPieceIndex = null;

            activePieces = VOCAB_SHAPES.slice().sort(() => Math.random() - 0.5).slice(0, 3).map(shape => {
                const letters = shape.map(row => row.map(val => val ? getRandomLetter() : null));
                return { shape, letters };
            });

            renderPiecePreviews();
            checkBlockyGameOver();
        }

        function renderPiecePreviews() {
            const container = document.getElementById('blocky-pieces');
            container.innerHTML = '';

            activePieces.forEach((piece, index) => {
                const wrapper = document.createElement('div');
                wrapper.className = `piece-preview ${selectedPieceIndex === index ? 'selected-piece' : ''}`;
                
                if (!piece) {
                    wrapper.style.visibility = 'hidden';
                    container.appendChild(wrapper);
                    return;
                }

                const shape = piece.shape;
                const letters = piece.letters;

                wrapper.draggable = true;
                wrapper.style.gridTemplateColumns = `repeat(${shape[0].length}, 20px)`;
                
                shape.forEach((row, r) => {
                    row.forEach((val, c) => {
                        const cell = document.createElement('div');
                        cell.className = `piece-cell ${val ? 'active' : ''}`;
                        if (val) {
                            cell.innerText = letters[r][c];
                        }
                        wrapper.appendChild(cell);
                    });
                });

                wrapper.onclick = () => {
                    selectedPieceIndex = selectedPieceIndex === index ? null : index;
                    renderPiecePreviews();
                };

                wrapper.ondragstart = (e) => {
                    selectedPieceIndex = index;
                    e.dataTransfer.setData('text/plain', index);
                };

                container.appendChild(wrapper);
            });
        }

        function canPlacePiece(shape, startR, startC) {
            const rows = shape.length;
            const cols = shape[0].length;
            if (startR + rows > 9 || startC + cols > 9) return false;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (shape[r][c] === 1 && blockyGrid[startR + r][startC + c] !== null) {
                        return false;
                    }
                }
            }
            return true;
        }

        function handleDragOver(e, r, c) {
            e.preventDefault();
            if (selectedPieceIndex === null || !activePieces[selectedPieceIndex]) return;
            
            clearBoardHover();
            const piece = activePieces[selectedPieceIndex];
            const isValid = canPlacePiece(piece.shape, r, c);

            for (let pr = 0; pr < piece.shape.length; pr++) {
                for (let pc = 0; pc < piece.shape[0].length; pc++) {
                    if (piece.shape[pr][pc] === 1 && r + pr < 9 && c + pc < 9) {
                        const targetCell = document.getElementById(`bcell-${r + pr}-${c + pc}`);
                        if (targetCell) {
                            targetCell.classList.add(isValid ? 'hover-valid' : 'hover-invalid');
                        }
                    }
                }
            }
        }

        function clearBoardHover() {
            document.querySelectorAll('.blocky-cell').forEach(el => el.classList.remove('hover-valid', 'hover-invalid'));
        }

        function handleDrop(e, r, c) {
            e.preventDefault();
            clearBoardHover();
            if (selectedPieceIndex !== null && activePieces[selectedPieceIndex]) {
                placePiece(selectedPieceIndex, r, c);
            }
        }

        function handleCellClick(r, c) {
            if (selectedPieceIndex !== null && activePieces[selectedPieceIndex]) {
                placePiece(selectedPieceIndex, r, c);
            }
        }

        function placePiece(index, r, c) {
            const piece = activePieces[index];
            if (!piece || !canPlacePiece(piece.shape, r, c)) return;

            for (let pr = 0; pr < piece.shape.length; pr++) {
                for (let pc = 0; pc < piece.shape[0].length; pc++) {
                    if (piece.shape[pr][pc] === 1) {
                        blockyGrid[r + pr][c + pc] = piece.letters[pr][pc];
                    }
                }
            }

            activePieces[index] = null;
            selectedPieceIndex = null;
            blocksPlacedCount++;

            document.getElementById('placed-counter-text').innerText = `Placed: ${blocksPlacedCount}`;

            renderBlockyGrid();
            renderPiecePreviews();

            checkAndClearWords();

            if (activePieces.every(p => p === null)) {
                spawnBlockyPieces();
            } else {
                checkBlockyGameOver();
            }
        }

        function checkAndClearWords() {
            let matchedCells = new Set();
            let matchedWordsList = [];
            let subWordsCount = 0;

            for (let r = 0; r < 9; r++) {
                let c = 0;
                while (c < 9) {
                    if (blockyGrid[r][c] !== null) {
                        let letterSeq = "";
                        let coords = [];
                        
                        while (c < 9 && blockyGrid[r][c] !== null) {
                            letterSeq += blockyGrid[r][c];
                            coords.push({ r, c });
                            c++;
                        }

                        findWordsInSequence(letterSeq, coords, CSW24_DICTIONARY, matchedCells, matchedWordsList, () => subWordsCount++);
                    } else {
                        c++;
                    }
                }
            }

            for (let c = 0; c < 9; c++) {
                let r = 0;
                while (r < 9) {
                    if (blockyGrid[r][c] !== null) {
                        let letterSeq = "";
                        let coords = [];

                        while (r < 9 && blockyGrid[r][c] !== null) {
                            letterSeq += blockyGrid[r][c];
                            coords.push({ r, c });
                            r++;
                        }

                        findWordsInSequence(letterSeq, coords, CSW24_DICTIONARY, matchedCells, matchedWordsList, () => subWordsCount++);
                    } else {
                        r++;
                    }
                }
            }

            if (matchedCells.size > 0) {
                const clearedBlockCount = matchedCells.size;
                const pointsFromBlocks = clearedBlockCount * 10;
                const pointsFromSubwords = subWordsCount * 10;
                const totalGained = pointsFromBlocks + pointsFromSubwords;

                blockyScore += totalGained;
                totalWordsFormed += matchedWordsList.length;

                matchedWordsList.forEach(w => blockyFoundWords.add(w.toLowerCase()));

                document.getElementById('blocky-score-display').innerText = blockyScore;
                document.getElementById('words-count-display').innerText = totalWordsFormed;
                renderBlockyFoundList();

                matchedCells.forEach(key => {
                    const [r, c] = key.split(',').map(Number);
                    const cellEl = document.getElementById(`bcell-${r}-${c}`);
                    if (cellEl) cellEl.classList.add('clearing');
                });

                const wordsStr = matchedWordsList.map(w => w.toLowerCase()).join(', ');
                showToast(`Cleared "${wordsStr}"! (+${totalGained} pts)`);

                setTimeout(() => {
                    matchedCells.forEach(key => {
                        const [r, c] = key.split(',').map(Number);
                        blockyGrid[r][c] = null;
                    });
                    renderBlockyGrid();
                    checkBlockyGameOver();
                }, 450);
            }
        }

        function findWordsInSequence(seq, coords, dictionary, matchedCells, matchedWordsList, addSubWordCallback) {
            const len = seq.length;
            if (len < 2) return;

            for (let i = 0; i < len; i++) {
                for (let j = i + 2; j <= len; j++) {
                    const subStr = seq.substring(i, j);
                    if (dictionary.has(subStr)) {
                        if (subStr.length >= blockyMinWordLen) {
                            for (let k = i; k < j; k++) {
                                matchedCells.add(`${coords[k].r},${coords[k].c}`);
                            }
                            if (!matchedWordsList.includes(subStr)) {
                                matchedWordsList.push(subStr);
                            }
                        } else if (subStr.length >= 2 && blockyMinWordLen === 3 && subStr.length < 3) {
                            addSubWordCallback();
                        }
                    }
                }
            }
        }

        function checkBlockyGameOver() {
            const available = activePieces.filter(p => p !== null);
            if (available.length === 0) return;

            let canMove = false;
            for (let piece of available) {
                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        if (canPlacePiece(piece.shape, r, c)) {
                            canMove = true;
                            break;
                        }
                    }
                    if (canMove) break;
                }
                if (canMove) break;
            }

            if (!canMove) {
                document.getElementById('blocky-final-score').innerText = blockyScore;
                document.getElementById('blocky-final-words').innerText = totalWordsFormed;
                const overlay = document.getElementById('blocky-gameover-overlay');
                overlay.classList.remove('hidden');
                overlay.style.display = 'flex';
            }
        }

        function hideBlockyOverlayAndInspect() {
            const overlay = document.getElementById('blocky-gameover-overlay');
            overlay.classList.add('hidden');
            overlay.style.display = '';
            toggleBlockyFoundList();
        }

        function renderBlockyFoundList() {
            const container = document.getElementById('blocky-found-list');
            const countEl = document.getElementById('blocky-found-count');
            countEl.innerText = blockyFoundWords.size;

            if (blockyFoundWords.size === 0) {
                container.innerHTML = `<p class="text-xs text-gray-400 italic">No words formed yet. Start placing blocks!</p>`;
                return;
            }

            const sorted = Array.from(blockyFoundWords).sort();
            container.innerHTML = sorted.map(w => `
                <button onclick="showWordDetailModal('${w.toLowerCase()}')" class="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-2 py-1 rounded-md border border-blue-200 transition flex items-center gap-1">
                    <i class="fa-solid fa-book-open text-[10px]"></i> ${w.toLowerCase()}
                </button>
            `).join('');
        }

        function toggleBlockyFoundList() {
            const list = document.getElementById('blocky-found-list');
            const btn = document.getElementById('blocky-toggle-list-btn');
            if (list.classList.contains('hidden')) {
                list.classList.remove('hidden');
                btn.innerText = 'Hide List';
            } else {
                list.classList.add('hidden');
                btn.innerText = 'Show List';
            }
        }

        let scrabbleBoardGrid = Array(9).fill(null).map(() => Array(9).fill(null));
        let scrabbleScore = 0;
        let scrabbleWordsCount = 0;
        let playerRack = [];
        let selectedRackIndex = null;
        let tempPlacedTiles = [];
        let scrabbleFoundWords = new Set();

        const SCRABBLE_BONUSES = {
            "0,0": "TW", "0,8": "TW", "8,0": "TW", "8,8": "TW",
            "1,1": "DW", "1,7": "DW", "7,1": "DW", "7,7": "DW",
            "2,2": "DL", "2,6": "DL", "6,2": "DL", "6,6": "DL",
            "3,3": "TL", "3,5": "TL", "5,3": "TL", "5,5": "TL",
            "4,4": "★"
        };

        function returnToScrabbleSetup() {
            document.getElementById('scrabble-active').classList.add('hidden');
            document.getElementById('scrabble-setup').classList.remove('hidden');
        }

        function startScrabbleGame() {
            scrabbleBoardGrid = Array(9).fill(null).map(() => Array(9).fill(null));
            scrabbleScore = 0;
            scrabbleWordsCount = 0;
            playerRack = [];
            selectedRackIndex = null;
            tempPlacedTiles = [];
            scrabbleFoundWords.clear();

            document.getElementById('scrabble-score-display').innerText = '0';
            document.getElementById('scrabble-words-count').innerText = '0';

            document.getElementById('scrabble-setup').classList.add('hidden');
            document.getElementById('scrabble-active').classList.remove('hidden');

            refillScrabbleRack();
            renderScrabbleBoard();
            renderScrabbleRack();
            renderScrabbleFoundList();
        }

        function refillScrabbleRack() {
            while (playerRack.length < 7) {
                playerRack.push(getRandomLetter());
            }
        }

        function renderScrabbleBoard() {
            const board = document.getElementById('scrabble-board');
            board.innerHTML = '';

            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    const cell = document.createElement('div');
                    const key = `${r},${c}`;
                    const bonus = SCRABBLE_BONUSES[key];
                    const gridVal = scrabbleBoardGrid[r][c];
                    const tempTile = tempPlacedTiles.find(t => t.r === r && t.c === c);

                    let classNames = "scrabble-cell";
                    if (gridVal && gridVal.locked) {
                        classNames += " filled";
                    } else if (tempTile) {
                        classNames += " temp-filled";
                    } else if (bonus) {
                        if (bonus === "TW") classNames += " cell-tw";
                        else if (bonus === "DW") classNames += " cell-dw";
                        else if (bonus === "TL") classNames += " cell-tl";
                        else if (bonus === "DL") classNames += " cell-dl";
                        else if (bonus === "★") classNames += " cell-star";
                    } else if ((Math.floor(r / 3) + Math.floor(c / 3)) % 2 === 1) {
                        classNames += " sub-grid-alt";
                    }

                    cell.className = classNames;
                    cell.onclick = () => handleScrabbleCellClick(r, c);

                    if (gridVal && gridVal.locked) {
                        cell.innerText = gridVal.letter;
                        cell.innerHTML += `<span class="scrabble-tile-points">${SCRABBLE_POINTS[gridVal.letter] || 1}</span>`;
                    } else if (tempTile) {
                        cell.innerText = tempTile.letter;
                        cell.innerHTML += `<span class="scrabble-tile-points">${SCRABBLE_POINTS[tempTile.letter] || 1}</span>`;
                    } else if (bonus) {
                        cell.innerText = bonus;
                    }

                    board.appendChild(cell);
                }
            }
        }

        function renderScrabbleRack() {
            const rackEl = document.getElementById('scrabble-rack');
            rackEl.innerHTML = '';

            playerRack.forEach((letter, index) => {
                const tile = document.createElement('div');
                tile.className = `scrabble-rack-tile ${selectedRackIndex === index ? 'selected' : ''}`;
                tile.innerText = letter;
                tile.innerHTML += `<span class="scrabble-tile-points">${SCRABBLE_POINTS[letter] || 1}</span>`;

                tile.onclick = () => {
                    selectedRackIndex = selectedRackIndex === index ? null : index;
                    renderScrabbleRack();
                };

                rackEl.appendChild(tile);
            });
        }

        function handleScrabbleCellClick(r, c) {
            const existingTempIndex = tempPlacedTiles.findIndex(t => t.r === r && t.c === c);

            if (existingTempIndex !== -1) {
                const tile = tempPlacedTiles.splice(existingTempIndex, 1)[0];
                playerRack.push(tile.letter);
                selectedRackIndex = null;
                renderScrabbleBoard();
                renderScrabbleRack();
                return;
            }

            if (selectedRackIndex !== null && playerRack[selectedRackIndex]) {
                if (scrabbleBoardGrid[r][c] !== null) {
                    showToast("Cell already occupied!", true);
                    return;
                }

                const letter = playerRack.splice(selectedRackIndex, 1)[0];
                tempPlacedTiles.push({ r, c, letter });
                selectedRackIndex = null;

                renderScrabbleBoard();
                renderScrabbleRack();
            }
        }

        function recallScrabbleTiles() {
            tempPlacedTiles.forEach(t => playerRack.push(t.letter));
            tempPlacedTiles = [];
            selectedRackIndex = null;
            renderScrabbleBoard();
            renderScrabbleRack();
        }

        function swapScrabbleRack() {
            recallScrabbleTiles();
            playerRack = [];
            refillScrabbleRack();
            renderScrabbleRack();
            showToast("Rack swapped with 7 new random tiles!");
        }

        function submitScrabbleTurn() {
            if (tempPlacedTiles.length === 0) {
                showToast("Place at least one tile onto the board!", true);
                return;
            }

            const sameRow = tempPlacedTiles.every(t => t.r === tempPlacedTiles[0].r);
            const sameCol = tempPlacedTiles.every(t => t.c === tempPlacedTiles[0].c);

            if (!sameRow && !sameCol) {
                showToast("All placed tiles must be in a single straight row or column!", true);
                return;
            }

            let isBoardEmpty = scrabbleBoardGrid.every(row => row.every(cell => cell === null));
            if (isBoardEmpty) {
                const touchesCenter = tempPlacedTiles.some(t => t.r === 4 && t.c === 4);
                if (!touchesCenter) {
                    showToast("The first word must cover the center star (★)!", true);
                    return;
                }
            } else {
                let connectsToExisting = false;
                tempPlacedTiles.forEach(t => {
                    const neighbors = [
                        {r: t.r-1, c: t.c}, {r: t.r+1, c: t.c},
                        {r: t.r, c: t.c-1}, {r: t.r, c: t.c+1}
                    ];
                    neighbors.forEach(n => {
                        if (n.r>=0 && n.r<9 && n.c>=0 && n.c<9 && scrabbleBoardGrid[n.r][n.c] && scrabbleBoardGrid[n.r][n.c].locked) {
                            connectsToExisting = true;
                        }
                    });
                });
                if (!connectsToExisting) {
                    showToast("New word must connect to existing tiles on the board!", true);
                    return;
                }
            }

            let fullBoard = scrabbleBoardGrid.map(row => row ? row.map(cell => cell ? cell.letter : null) : Array(9).fill(null));
            tempPlacedTiles.forEach(t => fullBoard[t.r][t.c] = t.letter);

            let formedWords = [];
            let totalTurnScore = 0;

            let checkedH = new Set();
            tempPlacedTiles.forEach(t => {
                let cStart = t.c;
                while (cStart > 0 && fullBoard[t.r][cStart - 1] !== null) cStart--;
                let cEnd = t.c;
                while (cEnd < 8 && fullBoard[t.r][cEnd + 1] !== null) cEnd++;

                if (cEnd - cStart >= 1) {
                    let key = `${t.r},${cStart}-${cEnd}`;
                    if (!checkedH.has(key)) {
                        checkedH.add(key);
                        let word = "";
                        let wordScore = 0;
                        let wordMultiplier = 1;

                        for (let c = cStart; c <= cEnd; c++) {
                            let letter = fullBoard[t.r][c];
                            word += letter;
                            let basePoints = SCRABBLE_POINTS[letter] || 1;
                            
                            let isNew = tempPlacedTiles.some(pt => pt.r === t.r && pt.c === c);
                            if (isNew) {
                                let bonus = SCRABBLE_BONUSES[`${t.r},${c}`];
                                if (bonus === "DL") basePoints *= 2;
                                else if (bonus === "TL") basePoints *= 3;
                                else if (bonus === "DW") wordMultiplier *= 2;
                                else if (bonus === "TW") wordMultiplier *= 3;
                                else if (bonus === "★") wordMultiplier *= 2;
                            }
                            wordScore += basePoints;
                        }

                        formedWords.push({ word, score: wordScore * wordMultiplier });
                    }
                }
            });

            let checkedV = new Set();
            tempPlacedTiles.forEach(t => {
                let rStart = t.r;
                while (rStart > 0 && fullBoard[rStart - 1][t.c] !== null) rStart--;
                let rEnd = t.r;
                while (rEnd < 8 && fullBoard[rEnd + 1][t.c] !== null) rEnd++;

                if (rEnd - rStart >= 1) {
                    let key = `${rStart}-${rEnd},${t.c}`;
                    if (!checkedV.has(key)) {
                        checkedV.add(key);
                        let word = "";
                        let wordScore = 0;
                        let wordMultiplier = 1;

                        for (let r = rStart; r <= rEnd; r++) {
                            let letter = fullBoard[r][t.c];
                            word += letter;
                            let basePoints = SCRABBLE_POINTS[letter] || 1;

                            let isNew = tempPlacedTiles.some(pt => pt.r === r && pt.c === t.c);
                            if (isNew) {
                                let bonus = SCRABBLE_BONUSES[`${r},${t.c}`];
                                if (bonus === "DL") basePoints *= 2;
                                else if (bonus === "TL") basePoints *= 3;
                                else if (bonus === "DW") wordMultiplier *= 2;
                                else if (bonus === "TW") wordMultiplier *= 3;
                                else if (bonus === "★") wordMultiplier *= 2;
                            }
                            wordScore += basePoints;
                        }

                        formedWords.push({ word, score: wordScore * wordMultiplier });
                    }
                }
            });

            if (formedWords.length === 0) {
                showToast("Tiles must form a valid word!", true);
                return;
            }

            let invalidWord = formedWords.find(w => !CSW24_DICTIONARY.has(w.word));
            if (invalidWord) {
                showToast(`"${invalidWord.word.toLowerCase()}" is not a valid word!`, true);
                return;
            }

            tempPlacedTiles.forEach(t => {
                scrabbleBoardGrid[t.r][t.c] = { letter: t.letter, locked: true };
            });

            formedWords.forEach(w => {
                totalTurnScore += w.score;
                scrabbleFoundWords.add(w.word.toLowerCase());
            });

            scrabbleScore += totalTurnScore;
            scrabbleWordsCount += formedWords.length;

            document.getElementById('scrabble-score-display').innerText = scrabbleScore;
            document.getElementById('scrabble-words-count').innerText = scrabbleWordsCount;
            renderScrabbleFoundList();

            const wordsPlayedStr = formedWords.map(w => `${w.word.toLowerCase()} (+${w.score}pts)`).join(', ');
            showToast(`Played: ${wordsPlayedStr}`);

            tempPlacedTiles = [];
            refillScrabbleRack();

            renderScrabbleBoard();
            renderScrabbleRack();
        }

        function renderScrabbleFoundList() {
            const container = document.getElementById('scrabble-found-list');
            const countEl = document.getElementById('scrabble-found-count');
            countEl.innerText = scrabbleFoundWords.size;

            if (scrabbleFoundWords.size === 0) {
                container.innerHTML = `<p class="text-xs text-gray-400 italic">No words played yet. Start spelling on board!</p>`;
                return;
            }

            const sorted = Array.from(scrabbleFoundWords).sort();
            container.innerHTML = sorted.map(w => `
                <button onclick="showWordDetailModal('${w.toLowerCase()}')" class="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold px-2 py-1 rounded-md border border-amber-200 transition flex items-center gap-1">
                    <i class="fa-solid fa-book-open text-[10px]"></i> ${w.toLowerCase()}
                </button>
            `).join('');
        }

        function toggleScrabbleFoundList() {
            const list = document.getElementById('scrabble-found-list');
            const btn = document.getElementById('scrabble-toggle-list-btn');
            if (list.classList.contains('hidden')) {
                list.classList.remove('hidden');
                btn.innerText = 'Hide List';
            } else {
                list.classList.add('hidden');
                btn.innerText = 'Show List';
            }
        }

        let beeLetterCount = 7;
        let beeCenterLetter = '';
        let beeOuterLetters = [];
        let beePossibleWords = new Map();
        let beeFoundWords = new Set();
        let beeScore = 0;
        let beeCurrentInput = '';

        const SAMPLE_PANGRAMS_7 = ["DICTION", "PLAYING", "WORKING", "TEACHER", "MONSTER", "SURFACE", "PACKAGE", "BLANKET"];
        const SAMPLE_PANGRAMS_10 = ["COMPLEXITY", "BACKGROUND", "IMPORTANCE", "BLACKSMITH", "ATMOSPHERE", "OVERMATCH"];

        function returnToBeeSetup() {
            document.getElementById('bee-active').classList.add('hidden');
            document.getElementById('bee-setup').classList.remove('hidden');
        }

        function startBeeGame(letterCount = 7) {
            beeLetterCount = letterCount;
            beeScore = 0;
            beeFoundWords.clear();
            beeCurrentInput = '';

            document.getElementById('bee-setup').classList.add('hidden');
            document.getElementById('bee-active').classList.remove('hidden');

            generateBeePuzzle();
            renderBeeGame();

            window.removeEventListener('keydown', handleBeeKeyboard);
            window.addEventListener('keydown', handleBeeKeyboard);
        }

        function generateBeePuzzle() {
            let candidatePangrams = [];

            CSW24_DICTIONARY.forEach(word => {
                const uniqueChars = new Set(word);
                if (uniqueChars.size === beeLetterCount && word.length >= beeLetterCount) {
                    candidatePangrams.push(word);
                }
            });

            if (candidatePangrams.length === 0) {
                candidatePangrams = beeLetterCount === 7 ? SAMPLE_PANGRAMS_7 : SAMPLE_PANGRAMS_10;
            }

            let bestLetterSet = null;
            let bestCenter = '';
            let bestPossibleWords = new Map();

            const shuffledCandidates = candidatePangrams.sort(() => Math.random() - 0.5);

            for (let baseWord of shuffledCandidates.slice(0, 30)) {
                const uniqueLetters = Array.from(new Set(baseWord.split('')));
                if (uniqueLetters.length !== beeLetterCount) continue;

                const shuffledLetters = uniqueLetters.sort(() => Math.random() - 0.5);

                for (let centerCandidate of shuffledLetters) {
                    let possible = new Map();
                    const validCharSet = new Set(uniqueLetters);

                    CSW24_DICTIONARY.forEach(word => {
                        if (word.length >= 4 && word.includes(centerCandidate)) {
                            let isValid = true;
                            for (let ch of word) {
                                if (!validCharSet.has(ch)) {
                                    isValid = false;
                                    break;
                                }
                            }
                            if (isValid) {
                                const isPangram = uniqueLetters.every(c => word.includes(c));
                                let pts = word.length === 4 ? 1 : word.length;
                                if (isPangram) pts += (beeLetterCount === 7 ? 7 : 20);
                                possible.set(word, { pts, isPangram });
                            }
                        }
                    });

                    if (possible.size >= (beeLetterCount === 7 ? 5 : 3)) {
                        bestLetterSet = uniqueLetters;
                        bestCenter = centerCandidate;
                        bestPossibleWords = possible;
                        break;
                    }
                }
                if (bestLetterSet) break;
            }

            if (!bestLetterSet) {
                const fallbackWord = beeLetterCount === 7 ? "WORKING" : "COMPLEXITY";
                bestLetterSet = Array.from(new Set(fallbackWord.split('')));
                bestCenter = bestLetterSet[0];
                bestPossibleWords = new Map();
                bestPossibleWords.set(fallbackWord, { pts: fallbackWord.length + (beeLetterCount === 7 ? 7 : 20), isPangram: true });
            }

            beeCenterLetter = bestCenter;
            beeOuterLetters = bestLetterSet.filter(c => c !== bestCenter);
            beePossibleWords = bestPossibleWords;
        }

        function renderBeeGame() {
            document.getElementById('bee-score-display').innerText = beeScore;
            updateBeeProgress();
            renderBeeHoneycomb();
            updateBeeInputDisplay();
            renderBeeFoundList();
        }

        function updateBeeProgress() {
            const totalWords = beePossibleWords.size;
            const foundWords = beeFoundWords.size;
            const pct = totalWords > 0 ? Math.floor((foundWords / totalWords) * 100) : 0;

            document.getElementById('bee-progress-text').innerText = `${foundWords} / ${totalWords} (${pct}%)`;
            document.getElementById('bee-progress-detail').innerText = `${foundWords} / ${totalWords} words found (${pct}%)`;
            document.getElementById('bee-progress-bar').style.width = `${pct}%`;
            document.getElementById('bee-found-count').innerText = foundWords;
        }

        function renderBeeHoneycomb() {
            const container = document.getElementById('bee-honeycomb');
            container.innerHTML = '';

            const centerTile = document.createElement('div');
            centerTile.className = 'bee-tile center-tile';
            centerTile.innerText = beeCenterLetter;
            centerTile.onclick = () => appendBeeLetter(beeCenterLetter);

            const outerTilesHtml = beeOuterLetters.map(letter => {
                const tile = document.createElement('div');
                tile.className = 'bee-tile';
                tile.innerText = letter;
                tile.onclick = () => appendBeeLetter(letter);
                return tile;
            });

            outerTilesHtml.forEach((tile, i) => {
                if (i === Math.floor(outerTilesHtml.length / 2)) {
                    container.appendChild(centerTile);
                }
                container.appendChild(tile);
            });

            if (outerTilesHtml.length <= 6) {
                if (!container.contains(centerTile)) container.appendChild(centerTile);
            }
        }

        function appendBeeLetter(letter) {
            beeCurrentInput += letter;
            updateBeeInputDisplay();
        }

        function deleteBeeLetter() {
            if (beeCurrentInput.length > 0) {
                beeCurrentInput = beeCurrentInput.slice(0, -1);
                updateBeeInputDisplay();
            }
        }

        function shuffleBeeLetters() {
            beeOuterLetters.sort(() => Math.random() - 0.5);
            renderBeeHoneycomb();
        }

        function updateBeeInputDisplay() {
            const display = document.getElementById('bee-input-display');
            if (!beeCurrentInput) {
                display.innerHTML = `<span class="text-gray-300 text-lg italic">Type or tap letters...</span>`;
                return;
            }

            let html = '';
            for (let ch of beeCurrentInput) {
                if (ch === beeCenterLetter) {
                    html += `<span class="text-amber-600 font-black">${ch.toLowerCase()}</span>`;
                } else {
                    html += `<span class="text-gray-800">${ch.toLowerCase()}</span>`;
                }
            }
            display.innerHTML = html;
        }

        function submitBeeWord() {
            const word = beeCurrentInput.trim().toUpperCase();
            if (!word) return;

            if (word.length < 4) {
                showToast("Word too short (minimum 4 letters)", true);
                beeCurrentInput = '';
                updateBeeInputDisplay();
                return;
            }

            if (!word.includes(beeCenterLetter)) {
                showToast(`Must contain center letter '${beeCenterLetter.toLowerCase()}'`, true);
                beeCurrentInput = '';
                updateBeeInputDisplay();
                return;
            }

            if (beeFoundWords.has(word.toLowerCase())) {
                showToast(`Already found "${word.toLowerCase()}"!`, true);
                beeCurrentInput = '';
                updateBeeInputDisplay();
                return;
            }

            if (beePossibleWords.has(word)) {
                const wordInfo = beePossibleWords.get(word);
                beeFoundWords.add(word.toLowerCase());
                beeScore += wordInfo.pts;

                document.getElementById('bee-score-display').innerText = beeScore;
                updateBeeProgress();
                renderBeeFoundList();

                if (wordInfo.isPangram) {
                    showToast(`PANGRAM! "${word.toLowerCase()}" (+${wordInfo.pts} pts)`);
                } else {
                    showToast(`Nice! "${word.toLowerCase()}" (+${wordInfo.pts} pts)`);
                }
            } else {
                showToast(`"${word.toLowerCase()}" is not a valid word for these letters`, true);
            }

            beeCurrentInput = '';
            updateBeeInputDisplay();
        }

        function handleBeeKeyboard(e) {
            const beeActive = document.getElementById('subview-bee');
            if (!beeActive || beeActive.classList.contains('hidden')) return;

            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            const key = e.key.toUpperCase();
            if (key === 'BACKSPACE') {
                deleteBeeLetter();
            } else if (key === 'ENTER') {
                submitBeeWord();
            } else if (key.length === 1 && key >= 'A' && key <= 'Z') {
                if (key === beeCenterLetter || beeOuterLetters.includes(key)) {
                    appendBeeLetter(key);
                }
            }
        }

        function renderBeeFoundList() {
            const container = document.getElementById('bee-found-list');
            if (beeFoundWords.size === 0) {
                container.innerHTML = `<p class="text-xs text-gray-400 italic">No words found yet. Start spelling!</p>`;
                return;
            }

            const sorted = Array.from(beeFoundWords).sort();
            container.innerHTML = sorted.map(w => {
                const upperWord = w.toUpperCase();
                const info = beePossibleWords.get(upperWord);
                const isPangram = info ? info.isPangram : false;
                const pts = info ? info.pts : 1;

                return `
                    <button onclick="showWordDetailModal('${w.toLowerCase()}')" class="text-xs ${isPangram ? 'bg-amber-500 text-white font-bold' : 'bg-gray-100 text-gray-800'} px-2 py-1 rounded-md border flex items-center gap-1 transition hover:opacity-80">
                        <i class="fa-solid fa-book-open text-[10px]"></i> ${w.toLowerCase()} <span class="opacity-75 font-mono text-[10px]">(+${pts})</span>
                    </button>
                `;
            }).join('');
        }

        function toggleBeeFoundList() {
            const list = document.getElementById('bee-found-list');
            const btn = document.getElementById('bee-toggle-list-btn');
            if (list.classList.contains('hidden')) {
                list.classList.remove('hidden');
                btn.innerText = 'Hide List';
            } else {
                list.classList.add('hidden');
                btn.innerText = 'Show List';
            }
        }

        let wordleWordLength = 5;
        let wordleTargetWord = '';
        let wordleGuesses = [];
        let wordleCurrentGuess = '';
        let wordleIsGameOver = false;
        let wordleKeyboardColors = {};
        let wordleWins = 0;
        let wordleScore = 0;
        let wordleFoundWords = new Set();

        const WORDLE_KEYBOARD_LAYOUT = [
            ['Q','W','E','R','T','Y','U','I','O','P'],
            ['A','S','D','F','G','H','J','K','L'],
            ['ENTER','Z','X','C','V','B','N','M','DELETE']
        ];

        function returnToWordleSetup() {
            const overlay = document.getElementById('wordle-gameover-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.style.display = '';
            }
            document.getElementById('wordle-active').classList.add('hidden');
            document.getElementById('wordle-setup').classList.remove('hidden');
        }

        function startWordleGame(length = 5) {
            wordleWordLength = length;
            wordleGuesses = [];
            wordleCurrentGuess = '';
            wordleIsGameOver = false;
            wordleKeyboardColors = {};

            const overlay = document.getElementById('wordle-gameover-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.style.display = '';
            }

            document.getElementById('wordle-setup').classList.add('hidden');
            document.getElementById('wordle-active').classList.remove('hidden');
            document.getElementById('wordle-mode-badge').innerText = `${wordleWordLength}-Letter Wordle`;

            const candidateWords = [];
            CSW24_DICTIONARY.forEach(w => {
                if (w.length === wordleWordLength) {
                    candidateWords.push(w);
                }
            });

            if (candidateWords.length === 0) {
                showToast("Dictionary not loaded yet!", true);
                return;
            }

            wordleTargetWord = candidateWords[Math.floor(Math.random() * candidateWords.length)];

            renderWordleGrid();
            renderWordleKeyboard();
            renderWordleFoundList();

            window.removeEventListener('keydown', handleWordleKeydown);
            window.addEventListener('keydown', handleWordleKeydown);
        }

        function renderWordleGrid() {
            const gridContainer = document.getElementById('wordle-grid');
            gridContainer.innerHTML = '';

            for (let r = 0; r < 6; r++) {
                const row = document.createElement('div');
                row.className = 'wordle-row';

                let rowLetters = [];
                let rowEvaluations = [];

                if (r < wordleGuesses.length) {
                    rowLetters = wordleGuesses[r].split('');
                    rowEvaluations = evaluateWordleGuess(wordleGuesses[r], wordleTargetWord);
                } else if (r === wordleGuesses.length) {
                    rowLetters = wordleCurrentGuess.split('');
                }

                for (let c = 0; c < wordleWordLength; c++) {
                    const cell = document.createElement('div');
                    let classNames = 'wordle-cell';

                    if (r < wordleGuesses.length) {
                        const evalResult = rowEvaluations[c];
                        classNames += ` ${evalResult}`;
                    } else if (r === wordleGuesses.length && rowLetters[c]) {
                        classNames += ' filled-input';
                    }

                    cell.className = classNames;
                    cell.innerText = rowLetters[c] || '';
                    row.appendChild(cell);
                }

                gridContainer.appendChild(row);
            }
        }

        function evaluateWordleGuess(guess, target) {
            const result = Array(guess.length).fill('absent');
            const targetChars = target.split('');
            const guessChars = guess.split('');

            for (let i = 0; i < guess.length; i++) {
                if (guessChars[i] === targetChars[i]) {
                    result[i] = 'correct';
                    targetChars[i] = null;
                }
            }

            for (let i = 0; i < guess.length; i++) {
                if (result[i] !== 'correct') {
                    const idx = targetChars.indexOf(guessChars[i]);
                    if (idx !== -1) {
                        result[i] = 'present';
                        targetChars[idx] = null;
                    }
                }
            }

            return result;
        }

        function renderWordleKeyboard() {
            const kbContainer = document.getElementById('wordle-keyboard');
            kbContainer.innerHTML = '';

            WORDLE_KEYBOARD_LAYOUT.forEach(rowKeys => {
                const rowEl = document.createElement('div');
                rowEl.className = 'wordle-key-row';

                rowKeys.forEach(key => {
                    const keyBtn = document.createElement('div');
                    let classNames = 'wordle-key';

                    if (key === 'ENTER' || key === 'DELETE') {
                        classNames += ' wide';
                    }

                    if (wordleKeyboardColors[key]) {
                        classNames += ` key-${wordleKeyboardColors[key]}`;
                    }

                    keyBtn.className = classNames;
                    keyBtn.innerText = key === 'DELETE' ? 'DEL' : key;
                    keyBtn.onclick = () => handleWordleVirtualKeyPress(key);

                    rowEl.appendChild(keyBtn);
                });

                kbContainer.appendChild(rowEl);
            });
        }

        function handleWordleVirtualKeyPress(key) {
            if (key === 'DELETE') {
                deleteWordleLetter();
            } else if (key === 'ENTER') {
                submitWordleGuess();
            } else {
                typeWordleLetter(key);
            }
        }

        function typeWordleLetter(letter) {
            if (wordleIsGameOver || wordleCurrentGuess.length >= wordleWordLength) return;
            wordleCurrentGuess += letter.toUpperCase();
            renderWordleGrid();
        }

        function deleteWordleLetter() {
            if (wordleIsGameOver || wordleCurrentGuess.length === 0) return;
            wordleCurrentGuess = wordleCurrentGuess.slice(0, -1);
            renderWordleGrid();
        }

        function submitWordleGuess() {
            if (wordleIsGameOver) return;

            if (wordleCurrentGuess.length !== wordleWordLength) {
                showToast(`Word must be ${wordleWordLength} letters long!`, true);
                return;
            }

            if (!CSW24_DICTIONARY.has(wordleCurrentGuess)) {
                showToast(`"${wordleCurrentGuess.toLowerCase()}" is not in dictionary!`, true);
                return;
            }

            const evaluations = evaluateWordleGuess(wordleCurrentGuess, wordleTargetWord);

            wordleCurrentGuess.split('').forEach((ch, i) => {
                const evalType = evaluations[i];
                const currentStatus = wordleKeyboardColors[ch];

                if (evalType === 'correct') {
                    wordleKeyboardColors[ch] = 'correct';
                } else if (evalType === 'present' && currentStatus !== 'correct') {
                    wordleKeyboardColors[ch] = 'present';
                } else if (evalType === 'absent' && !currentStatus) {
                    wordleKeyboardColors[ch] = 'absent';
                }
            });

            wordleGuesses.push(wordleCurrentGuess);
            const guessedWord = wordleCurrentGuess;
            wordleCurrentGuess = '';

            renderWordleGrid();
            renderWordleKeyboard();

            if (guessedWord === wordleTargetWord) {
                wordleIsGameOver = true;
                wordleWins++;
                const bonusPoints = (7 - wordleGuesses.length) * 20;
                wordleScore += bonusPoints;

                wordleFoundWords.add(wordleTargetWord.toLowerCase());

                document.getElementById('wordle-wins-display').innerText = wordleWins;
                document.getElementById('wordle-score-display').innerText = wordleScore;
                renderWordleFoundList();

                setTimeout(() => {
                    showWordleGameOverOverlay(true, `Guessed "${wordleTargetWord.toLowerCase()}" in ${wordleGuesses.length} tries! (+${bonusPoints} pts)`);
                }, 400);

            } else if (wordleGuesses.length >= 6) {
                wordleIsGameOver = true;
                setTimeout(() => {
                    showWordleGameOverOverlay(false, `The secret word was "${wordleTargetWord.toLowerCase()}".`);
                }, 400);
            }
        }

        function handleWordleKeydown(e) {
            const activeView = document.getElementById('subview-wordle');
            if (!activeView || activeView.classList.contains('hidden')) return;

            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            const key = e.key.toUpperCase();

            if (key === 'ENTER') {
                e.preventDefault();
                submitWordleGuess();
            } else if (key === 'BACKSPACE') {
                e.preventDefault();
                deleteWordleLetter();
            } else if (key.length === 1 && key >= 'A' && key <= 'Z') {
                e.preventDefault();
                typeWordleLetter(key);
            }
        }

        function showWordleGameOverOverlay(isWin, message) {
            const overlay = document.getElementById('wordle-gameover-overlay');
            const iconEl = document.getElementById('wordle-gameover-icon');
            const titleEl = document.getElementById('wordle-gameover-title');
            const msgEl = document.getElementById('wordle-gameover-msg');

            if (isWin) {
                iconEl.className = "text-6xl mb-3 fa-solid fa-trophy text-yellow-400 animate-bounce";
                titleEl.innerText = "Guileless Genius!";
            } else {
                iconEl.className = "text-6xl mb-3 fa-solid fa-face-frown text-slate-400 animate-bounce";
                titleEl.innerText = "Out of Guesses!";
            }

            msgEl.innerText = message;

            overlay.classList.remove('hidden');
            overlay.style.display = 'flex';
        }

        function renderWordleFoundList() {
            const container = document.getElementById('wordle-found-list');
            const countEl = document.getElementById('wordle-found-count');
            countEl.innerText = wordleFoundWords.size;

            if (wordleFoundWords.size === 0) {
                container.innerHTML = `<p class="text-xs text-gray-400 italic">No secret words guessed yet. Start playing!</p>`;
                return;
            }

            const sorted = Array.from(wordleFoundWords).sort();
            container.innerHTML = sorted.map(w => `
                <button onclick="showWordDetailModal('${w.toLowerCase()}')" class="text-xs bg-green-50 hover:bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-md border border-green-200 transition flex items-center gap-1">
                    <i class="fa-solid fa-book-open text-[10px]"></i> ${w.toLowerCase()}
                </button>
            `).join('');
        }

        function toggleWordleFoundList() {
            const list = document.getElementById('wordle-found-list');
            const btn = document.getElementById('wordle-toggle-list-btn');
            if (list.classList.contains('hidden')) {
                list.classList.remove('hidden');
                btn.innerText = 'Hide List';
            } else {
                list.classList.add('hidden');
                btn.innerText = 'Show List';
            }
        }

        function updateSentenceSelect() {
            const select = document.getElementById('sentence-word-select');
            select.innerHTML = '<option value="">-- Select or pick random --</option>' + 
                vocabList.map(v => `<option value="${v.id}">${v.word.toLowerCase()}</option>`).join('');
        }

        function randomSentenceWord() {
            if (vocabList.length === 0) {
                showToast("Vault is empty!", true);
                return;
            }
            const randomIndex = Math.floor(Math.random() * vocabList.length);
            const wordObj = vocabList[randomIndex];
            document.getElementById('sentence-word-select').value = wordObj.id;
            updateSentenceHint();
        }

        function updateSentenceHint() {
            const select = document.getElementById('sentence-word-select');
            const hintDiv = document.getElementById('sentence-hint');
            if (!select.value) {
                hintDiv.classList.add('hidden');
                onSentenceInputChange();
                return;
            }
            
            const wordObj = vocabList.find(v => v.id === select.value);
            if (wordObj) {
                const posStr = wordObj.definitions[0] ? wordObj.definitions[0].pos : 'word';
                const defStr = wordObj.definitions[0] ? wordObj.definitions[0].def : '';
                const variants = generateTargetWordVariants(wordObj.word.toLowerCase());
                
                hintDiv.innerHTML = `
                    <div class="flex items-center justify-between font-bold text-blue-900 mb-1">
                        <span><i class="fa-solid fa-lightbulb text-yellow-500 mr-1"></i> Target: <strong class="text-blue-600 font-serif text-base">${wordObj.word.toLowerCase()}</strong> (${posStr})</span>
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono">${variants.length} Recognized Forms</span>
                    </div>
                    <p class="text-xs text-gray-700 mb-2">${defStr}</p>
                    <div class="text-[11px] text-gray-500 bg-white/70 p-1.5 rounded border border-blue-100">
                        <strong>Accepted inflections:</strong> ${variants.slice(0, 8).join(', ')}${variants.length > 8 ? '...' : ''}
                    </div>
                `;
                hintDiv.classList.remove('hidden');
            }
            onSentenceInputChange();
        }

        function generateTargetWordVariants(baseWord) {
            const word = baseWord.toLowerCase().trim();
            const set = new Set([word]);

            if (!word) return [];

            if (word.endsWith('y') && word.length > 2 && !'aeiou'.includes(word[word.length - 2])) {
                const stem = word.slice(0, -1);
                set.add(stem + 'ies');
                set.add(stem + 'ied');
                set.add(stem + 'ying');
            } else if (word.endsWith('e')) {
                const stem = word.slice(0, -1);
                set.add(word + 's');
                set.add(word + 'd');
                set.add(stem + 'ing');
                set.add(stem + 'er');
                set.add(stem + 'est');
            } else {
                set.add(word + 's');
                set.add(word + 'es');
                set.add(word + 'ed');
                set.add(word + 'ing');
                set.add(word + 'er');
                set.add(word + 'est');
            }

            if (word.endsWith('ing') && word.length > 4) set.add(word.slice(0, -3));
            if (word.endsWith('ed') && word.length > 3) set.add(word.slice(0, -2));
            if (word.endsWith('es') && word.length > 3) set.add(word.slice(0, -2));
            if (word.endsWith('s') && word.length > 2) set.add(word.slice(0, -1));

            return Array.from(set);
        }

        function onSentenceInputChange() {
            const text = document.getElementById('sentence-input').value;
            const words = text.trim() ? text.trim().split(/\s+/) : [];
            document.getElementById('sentence-word-counter').innerText = `${words.length} ${words.length === 1 ? 'word' : 'words'}`;

            const hasCapital = /^[A-Z]/.test(text.trim());
            const hasPunctuation = /[.!?]$/.test(text.trim());
            const hasMinLength = words.length >= 4;

            const select = document.getElementById('sentence-word-select');
            let hasTargetWord = false;
            if (select.value) {
                const wordObj = vocabList.find(v => v.id === select.value);
                if (wordObj) {
                    const variants = generateTargetWordVariants(wordObj.word);
                    const cleanTokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
                    hasTargetWord = cleanTokens.some(token => variants.includes(token));
                }
            }

            updatePillState('pill-capital', hasCapital, 'Capital Initial');
            updatePillState('pill-punctuation', hasPunctuation, 'Terminal Mark');
            updatePillState('pill-length', hasMinLength, 'Min 4 Words');
            updatePillState('pill-target', hasTargetWord, select.value ? 'Target Word Found' : 'Select Target Word');
        }

        function updatePillState(pillId, isValid, labelText) {
            const pill = document.getElementById(pillId);
            if (!pill) return;

            if (isValid) {
                pill.className = "text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-800 border border-green-300 transition flex items-center gap-1";
                pill.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${labelText}`;
            } else {
                pill.className = "text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200 transition flex items-center gap-1";
                pill.innerHTML = `<i class="fa-solid fa-circle text-[8px]"></i> ${labelText}`;
            }
        }

        async function checkGrammarIntelligent() {
            const text = document.getElementById('sentence-input').value.trim();
            const resultDiv = document.getElementById('grammar-result');
            const feedbackDiv = document.getElementById('grammar-feedback');
            const btn = document.getElementById('check-grammar-btn');

            if (!text) {
                showToast("Please enter a sentence!", true);
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Analyzing Sentence Structure...';

            const select = document.getElementById('sentence-word-select');
            let targetScore = 0;
            let targetFeedbackHtml = '';
            let targetWordObj = select.value ? vocabList.find(v => v.id === select.value) : null;

            if (targetWordObj) {
                const targetWordStr = targetWordObj.word.toLowerCase();
                const variants = generateTargetWordVariants(targetWordStr);
                const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
                const matchedVariant = tokens.find(tok => variants.includes(tok));

                if (matchedVariant) {
                    targetScore = 30;
                    targetFeedbackHtml = `
                        <div class="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 flex items-center justify-between">
                            <span><i class="fa-solid fa-bullseye text-green-600 mr-1.5"></i> Target Word Match: Recognized <strong>"${matchedVariant}"</strong> (form of "${targetWordStr}") in sentence!</span>
                            <span class="font-bold font-mono text-green-700 bg-green-100 px-2 py-0.5 rounded">+30 pts</span>
                        </div>`;
                } else {
                    targetScore = 0;
                    targetFeedbackHtml = `
                        <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                            <span><i class="fa-solid fa-triangle-exclamation text-amber-600 mr-1.5"></i> Missing Target Word: Neither "${targetWordStr}" nor its derived forms were found.</span>
                            <span class="font-bold font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded">+0 pts</span>
                        </div>`;
                }
            } else {
                targetScore = 15;
                targetFeedbackHtml = `
                    <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center justify-between">
                        <span><i class="fa-solid fa-info-circle text-blue-600 mr-1.5"></i> No Target Word Selected (Default Practice Mode)</span>
                        <span class="font-bold font-mono text-blue-700 bg-blue-100 px-2 py-0.5 rounded">+15 pts</span>
                    </div>`;
            }

            let formatScore = 0;
            const startsWithCap = /^[A-Z]/.test(text);
            const endsWithPunct = /[.!?]$/.test(text);
            if (startsWithCap) formatScore += 10;
            if (endsWithPunct) formatScore += 10;

            const wordsList = text.split(/\s+/).filter(Boolean);
            const wordCount = wordsList.length;
            const uniqueWordCount = new Set(wordsList.map(w => w.toLowerCase())).size;
            let richnessScore = 0;

            if (wordCount >= 4) richnessScore += 8;
            if (wordCount >= 8) richnessScore += 6;
            if (uniqueWordCount / (wordCount || 1) >= 0.7) richnessScore += 6;
            richnessScore = Math.min(20, richnessScore);

            let grammarScore = 30;
            let ltMatches = [];

            try {
                const response = await fetch('https://api.languagetool.org/v2/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        text: text,
                        language: 'en-US'
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    ltMatches = data.matches || [];
                    grammarScore = Math.max(0, 30 - (ltMatches.length * 10));
                }
            } catch (err) {
                console.warn("LanguageTool API failed, falling back to local rule evaluation.", err);
            }

            const totalScore = Math.min(100, targetScore + formatScore + grammarScore + richnessScore);
            let grade = 'F';
            let gradeColor = 'text-red-400 bg-red-400/20';

            if (totalScore >= 90) { grade = 'S (Perfect)'; gradeColor = 'text-emerald-400 bg-emerald-400/20'; }
            else if (totalScore >= 80) { grade = 'A (Excellent)'; gradeColor = 'text-green-400 bg-green-400/20'; }
            else if (totalScore >= 70) { grade = 'B (Good)'; gradeColor = 'text-blue-400 bg-blue-400/20'; }
            else if (totalScore >= 50) { grade = 'C (Fair)'; gradeColor = 'text-amber-400 bg-amber-400/20'; }

            document.getElementById('overall-score-badge').innerText = `${totalScore} / 100`;
            const gradeTag = document.getElementById('overall-grade-tag');
            gradeTag.innerText = `Grade: ${grade}`;
            gradeTag.className = `text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${gradeColor}`;

            document.getElementById('score-target-val').innerText = `${targetScore} / 30`;
            document.getElementById('score-format-val').innerText = `${formatScore} / 20`;
            document.getElementById('score-grammar-val').innerText = `${grammarScore} / 30`;
            document.getElementById('score-richness-val').innerText = `${richnessScore} / 20`;

            let feedbackHtml = targetFeedbackHtml;

            if (ltMatches.length === 0) {
                feedbackHtml += `
                    <div class="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 flex items-center gap-3">
                        <i class="fa-solid fa-circle-check text-2xl text-green-600"></i>
                        <div>
                            <p class="font-bold text-sm">Grammar Engine Passed!</p>
                            <p class="text-xs text-green-700">No spelling or grammatical issues detected by the rule analyzer.</p>
                        </div>
                    </div>`;
            } else {
                feedbackHtml += `<div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p class="text-xs font-bold text-red-600 mb-2 uppercase tracking-wider">Spelling & Grammar Suggestions (${ltMatches.length}):</p>`;
                ltMatches.forEach(match => {
                    const errorWord = text.substring(match.offset, match.offset + match.length);
                    const suggestions = match.replacements.slice(0, 3).map(r => `<span class="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-mono font-bold mr-1">${r.value}</span>`).join('');
                    
                    feedbackHtml += `
                        <div class="p-3 bg-red-50/80 border border-red-200 rounded-lg mb-2 text-xs">
                            <p class="text-gray-800 mb-1">
                                <span class="line-through text-red-600 font-bold mr-1">${errorWord}</span> 
                                <i class="fa-solid fa-arrow-right text-gray-400 mx-1"></i> 
                                ${suggestions || '<span class="text-gray-400 italic">(No replacement available)</span>'}
                            </p>
                            <p class="text-red-700 font-medium">${match.message}</p>
                        </div>`;
                });
                feedbackHtml += `</div>`;
            }

            feedbackDiv.innerHTML = feedbackHtml;
            resultDiv.classList.remove('hidden');

            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Run Intelligent Grammar & Quality Check';
        }