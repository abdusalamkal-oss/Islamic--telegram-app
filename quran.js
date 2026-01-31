// ==================== CONFIGURATION ====================
const FREE_QURAN_API = "https://api.alquran.cloud/v1";
const RECITER = "ar.alafasy";
let tg = window.Telegram.WebApp;
let audioPlayer = new Audio();
let currentSurahIndex = 0;
let isPlaying = false;
let surahCache = {};
let allSurahs = [];

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async function() {
    tg.expand();
    tg.setHeaderColor('#1a5fb4');
    tg.setBackgroundColor('#ffffff');
    tg.ready();
    
    document.getElementById('loading').style.display = 'block';
    document.getElementById('loadingText').textContent = 'Loading Quran data...';
    
    try {
        await loadAllSurahs();
        buildSurahNavigation();
        await loadSurah(0);
        setupAudioPlayer();
        setupEventListeners();
        
        document.getElementById('loading').style.display = 'none';
        tg.showAlert('🕌 Quran App Loaded! All 114 Surahs Available');
    } catch (error) {
        document.getElementById('loadingText').textContent = 'Error loading Quran. Please refresh.';
        console.error('Initialization error:', error);
    }
});
// ==================== API FUNCTIONS ====================

async function loadAllSurahs() {
    try {
        const response = await fetch(`${FREE_QURAN_API}/surah`);
        const data = await response.json();
        
        if (data.code === 200) {
            allSurahs = data.data;
            console.log('Loaded', allSurahs.length, 'surahs');
        } else {
            throw new Error('Failed to load surahs');
        }
    } catch (error) {
        console.error('Error loading surahs:', error);
        allSurahs = getStaticSurahData();
    }
}

async function loadSurah(surahIndex) {
    const surah = allSurahs[surahIndex];
    if (!surah) return;
    
    currentSurahIndex = surahIndex;
    
    document.getElementById('loading').style.display = 'block';
    document.getElementById('loadingText').textContent = `Loading ${surah.englishName}...`;
    document.getElementById('quranText').style.display = 'none';
    
    try {
        updateSurahInfo(surah);
        
        if (surahCache[surah.number]) {
            const cached = surahCache[surah.number];
            document.getElementById('quranText').textContent = cached.text;
            loadAudio(cached.audioUrl, surah);
        } else {
            await fetchSurahData(surah);
        }
        
        updateNavigationActiveState(surahIndex);
        
        setTimeout(() => {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('quranText').style.display = 'block';
        }, 300);
        
    } catch (error) {
        console.error('Error loading surah:', error);
        document.getElementById('loadingText').textContent = 'Error loading. Trying again...';
        loadFallbackSurah(surah);
    }
}

async function fetchSurahData(surah) {
    try {
        const textResponse = await fetch(
            `${FREE_QURAN_API}/surah/${surah.number}/${RECITER}`
        );
        const textData = await textResponse.json();
        
        if (textData.code === 200) {
            let fullText = '';
            textData.data.ayahs.forEach((ayah, index) => {
                fullText += `${ayah.text} (${index + 1}) `;
            });
            
            document.getElementById('quranText').textContent = fullText;
            
            const audioUrl = `https://cdn.islamic.network/quran/audio/128/${RECITER}/${surah.number}.mp3`;
            
            surahCache[surah.number] = {
                text: fullText,
                audioUrl: audioUrl,
                timestamp: Date.now()
            };
            
            loadAudio(audioUrl, surah);
            
        } else {
            throw new Error('Failed to fetch surah text');
        }
    } catch (error) {
        throw error;
    }
}// ==================== AUDIO FUNCTIONS ====================

function loadAudio(audioUrl, surah) {
    if (!audioPlayer.paused) {
        audioPlayer.pause();
    }
    
    audioPlayer.src = audioUrl;
    audioPlayer.load();
    
    document.getElementById('audioTitle').textContent = surah.englishName;
    document.getElementById('audioSurah').textContent = 
        `Surah ${surah.number} • ${surah.numberOfAyahs} Ayahs`;
    
    if (isPlaying) {
        setTimeout(() => {
            audioPlayer.play().catch(e => {
                console.log('Auto-play prevented');
                updatePlayButton(false);
            });
        }, 500);
    }
    
    tg.sendData(`surah_loaded:${surah.number}:${surah.englishName}`);
}

function setupAudioPlayer() {
    document.getElementById('progressBar').addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        audioPlayer.currentTime = pos * audioPlayer.duration;
    });
    
    audioPlayer.addEventListener('timeupdate', function() {
        const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        document.getElementById('progress').style.width = `${progress}%`;
        
        document.getElementById('currentTime').textContent = 
            formatTime(audioPlayer.currentTime);
        document.getElementById('duration').textContent = 
            formatTime(audioPlayer.duration);
    });
    
    audioPlayer.addEventListener('play', function() {
        isPlaying = true;
        updatePlayButton(false);
    });
    
    audioPlayer.addEventListener('pause', function() {
        isPlaying = false;
        updatePlayButton(true);
    });
    
    audioPlayer.addEventListener('ended', function() {
        if (currentSurahIndex < allSurahs.length - 1) {
            document.getElementById('nextBtn').click();
        }
    });
    
    document.getElementById('volumeSlider').addEventListener('input', function(e) {
        audioPlayer.volume = e.target.value / 100;
        updateVolumeIcon(e.target.value);
    });
    
    audioPlayer.volume = 0.7;
}

// ==================== UI FUNCTIONS ====================

function updateSurahInfo(surah) {
    document.getElementById('surahArabic').textContent = surah.name;
    document.getElementById('surahName').textContent = 
        `${surah.englishName} (${surah.englishNameTranslation})`;
    document.getElementById('surahNumber').textContent = surah.number;
    document.getElementById('ayahCount').textContent = surah.numberOfAyahs;
    document.getElementById('surahType').textContent = surah.revelationType;
}

function buildSurahNavigation() {
    const navContainer = document.getElementById('surahNav');
    navContainer.innerHTML = '';
    
    allSurahs.forEach((surah, index) => {
        const btn = document.createElement('button');
        btn.className = 'surah-nav-btn';
        if (index === 0) btn.classList.add('active');
        
        btn.innerHTML = `
            <div class="surah-number">${surah.number}</div>
            <div class="surah-arabic-small">${surah.name}</div>
        `;
        
        btn.addEventListener('click', async () => {
            await loadSurah(index);
        });
        
        navContainer.appendChild(btn);
    });// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    document.getElementById('playPauseBtn').addEventListener('click', function() {
        if (audioPlayer.paused) {
            audioPlayer.play();
        } else {
            audioPlayer.pause();
        }
    });
    
    document.getElementById('prevBtn').addEventListener('click', function() {
        if (currentSurahIndex > 0) {
            loadSurah(currentSurahIndex - 1);
        }
    });
    
    document.getElementById('nextBtn').addEventListener('click', function() {
        if (currentSurahIndex < allSurahs.length - 1) {
            loadSurah(currentSurahIndex + 1);
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            document.getElementById('playPauseBtn').click();
        } else if (e.code === 'ArrowLeft') {
            document.getElementById('prevBtn').click();
        } else if (e.code === 'ArrowRight') {
            document.getElementById('nextBtn').click();
        }
    });
}

function updateNavigationActiveState(activeIndex) {
    document.querySelectorAll('.surah-nav-btn').forEach((btn, index) => {
        if (index === activeIndex) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function updatePlayButton(isPlaying) {
    const icon = document.getElementById('playIcon');
    const coverIcon = document.getElementById('coverIcon');
    
    if (isPlaying) {
        icon.className = 'fas fa-play';
        coverIcon.className = 'fas fa-play';
    } else {
        icon.className = 'fas fa-pause';
        coverIcon.className = 'fas fa-pause';
    }
}

function updateVolumeIcon(volume) {
    const icon = document.getElementById('volumeIcon');
    if (volume == 0) {
        icon.className = 'fas fa-volume-mute';
    } else if (volume < 50) {
        icon.className = 'fas fa-volume-down';
    } else {
        icon.className = 'fas fa-volume-up';
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
// ==================== FALLBACK FUNCTIONS ====================

function loadFallbackSurah(surah) {
    updateSurahInfo(surah);
    
    document.getElementById('quranText').textContent = 
        `Surah ${surah.englishName} - ${surah.numberOfAyahs} ayahs.\n\n` +
        `Full text loading failed. Please check your internet connection.`;
    
    const audioUrl = `https://cdn.islamic.network/quran/audio/128/${RECITER}/${surah.number}.mp3`;
    loadAudio(audioUrl, surah);
    
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('quranText').style.display = 'block';
    }, 300);
}

function getStaticSurahData() {
    return [
        {number: 1, name: "الفاتحة", englishName: "Al-Fatihah", 
         englishNameTranslation: "The Opening", numberOfAyahs: 7, revelationType: "Makki"},
        {number: 2, name: "البقرة", englishName: "Al-Baqarah", 
         englishNameTranslation: "The Cow", numberOfAyahs: 286, revelationType: "Madani"},
        {number: 3, name: "آل عمران", englishName: "Ali 'Imran", 
         englishNameTranslation: "Family of Imran", numberOfAyahs: 200, revelationType: "Madani"},
        {number: 4, name: "النساء", englishName: "An-Nisa", 
         englishNameTranslation: "The Women", numberOfAyahs: 176, revelationType: "Madani"},
        {number: 5, name: "المائدة", englishName: "Al-Ma'idah", 
         englishNameTranslation: "The Table Spread", numberOfAyahs: 120, revelationType: "Madani"}
    ];
}

// ==================== CLEANUP ====================

window.addEventListener('beforeunload', () => {
    if (!audioPlayer.paused) {
        audioPlayer.pause();
    }
});
}
}

