
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Zap, LayoutGrid, Quote, X as ClearIcon } from 'lucide-react';
import { WordData, SentenceData } from './types';
import { lookupWord, lookupSentence } from './services/geminiService';
import { WordCard } from './components/WordCard';
import { SentenceCard } from './components/SentenceCard';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { FlashcardPage } from './components/FlashcardPage';
import { StudySession } from './components/StudySession';
import { DetailModal } from './components/DetailModal';

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'word' | 'sentence'>('word');
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [sentenceData, setSentenceData] = useState<SentenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubLoading, setIsSubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [currentView, setCurrentView] = useState<'search' | 'flashcards' | 'study'>('search');
  const [sheetsUrl, setSheetsUrl] = useState(() => localStorage.getItem('google_sheets_url') || '');
  const [selectedDetail, setSelectedDetail] = useState<WordData | SentenceData | null>(null);
  const latestQueryRef = useRef('');

  const [savedWords, setSavedWords] = useState<WordData[]>(() => {
    try { return JSON.parse(localStorage.getItem('flashcards') || '[]'); } catch { return []; }
  });

  const [savedSentences, setSavedSentences] = useState<SentenceData[]>(() => {
    try { return JSON.parse(localStorage.getItem('saved_sentences') || '[]'); } catch { return []; }
  });

  const [studyQueue, setStudyQueue] = useState<WordData[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const now = Date.now();
  const dueCount = useMemo(() => {
    const dWords = savedWords.filter(w => !w.next_review || w.next_review <= now).length;
    const dSentences = savedSentences.filter(s => !s.next_review || s.next_review <= now).length;
    return dWords + dSentences;
  }, [savedWords, savedSentences, now]);

  useEffect(() => { if (currentView === 'search') inputRef.current?.focus(); }, [currentView, searchMode]);

  useEffect(() => {
    if (currentView !== 'search' || query.trim().length < 2) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => handleSearch(), 400);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [query, searchMode, currentView]);

  useEffect(() => {
    localStorage.setItem('flashcards', JSON.stringify(savedWords));
    localStorage.setItem('saved_sentences', JSON.stringify(savedSentences));
    localStorage.setItem('google_sheets_url', sheetsUrl);
  }, [savedWords, savedSentences, sheetsUrl]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;
    latestQueryRef.current = cleanQuery;
    setLoading(true);
    setError(null);
    try {
      if (searchMode === 'word') {
        const result = await lookupWord(cleanQuery);
        if (latestQueryRef.current === cleanQuery) setWordData(result);
      } else {
        const result = await lookupSentence(cleanQuery);
        if (latestQueryRef.current === cleanQuery) setSentenceData(result);
      }
    } catch (err) {
      if (latestQueryRef.current === cleanQuery) setError("Không tìm thấy kết quả.");
    } finally {
      if (latestQueryRef.current === cleanQuery) setLoading(false);
    }
  };

  const isItemSaved = (item: WordData | SentenceData | null) => {
    if (!item) return false;
    return 'word' in item ? savedWords.some(w => w.word.toLowerCase() === item.word.toLowerCase()) : savedSentences.some(s => s.sentence === item.sentence);
  };

  const handleToggleSave = (item: WordData | SentenceData | null) => {
    if (!item) return;
    if ('word' in item) {
      if (isItemSaved(item)) setSavedWords(prev => prev.filter(w => w.word.toLowerCase() !== item.word.toLowerCase()));
      else setSavedWords(prev => [{ ...item, srs_level: 0, next_review: Date.now() }, ...prev]);
    } else {
      if (isItemSaved(item)) setSavedSentences(prev => prev.filter(s => s.sentence !== item.sentence));
      else setSavedSentences(prev => [{ ...item, srs_level: 0, next_review: Date.now() }, ...prev]);
    }
  };

  const handleQuickLookup = async (word: string) => {
    setIsSubLoading(true);
    try {
      const result = await lookupWord(word);
      setSelectedDetail(result);
    } catch (e) { console.error(e); } finally { setIsSubLoading(false); }
  };

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex flex-col font-sans overflow-hidden">
      <header className="py-2 px-3 border-b border-gray-800 bg-gray-900 shrink-0 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('search')}>
            <div className="bg-emerald-500 p-1.5 rounded-lg text-gray-950 shadow-lg shadow-emerald-500/10"><Zap size={18} strokeWidth={3} /></div>
            <h1 className="text-lg font-black tracking-tighter text-white">FlashVocab</h1>
          </div>
          <nav className="flex items-center gap-1">
             <button onClick={() => setCurrentView('search')} className={`p-2 rounded-lg transition-all ${currentView === 'search' ? 'text-emerald-400 bg-gray-800' : 'text-gray-500'}`}><Search size={20} /></button>
             <button onClick={() => setCurrentView('flashcards')} className={`relative p-2 rounded-lg transition-all ${currentView === 'flashcards' ? 'text-emerald-400 bg-gray-800' : 'text-gray-500'}`}>
                <LayoutGrid size={20} />
                {dueCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-gray-900"></span>}
             </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 container max-w-4xl mx-auto px-3 py-4 flex flex-col items-center overflow-y-auto custom-scrollbar">
        {currentView === 'search' && (
            <div className="w-full max-w-xl">
                <div className="flex bg-gray-900 p-1 rounded-xl border border-gray-800 mb-4 w-fit mx-auto shadow-xl">
                    <button onClick={() => setSearchMode('word')} className={`px-5 py-1.5 rounded-lg text-xs font-black transition-all ${searchMode === 'word' ? 'bg-emerald-500 text-gray-950' : 'text-gray-500'}`}>TỪ VỰNG</button>
                    <button onClick={() => setSearchMode('sentence')} className={`px-5 py-1.5 rounded-lg text-xs font-black transition-all ${searchMode === 'sentence' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>MẪU CÂU</button>
                </div>
                <div className="relative mb-6">
                    <form onSubmit={handleSearch}>
                      <input
                        ref={inputRef}
                        type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder={searchMode === 'word' ? "Nhập từ tiếng Anh hoặc Việt..." : "Nhập câu cần phân tích..."}
                        className="w-full bg-gray-900 text-white border border-gray-800 rounded-2xl py-3.5 pl-10 pr-12 focus:outline-none focus:border-emerald-500 transition-all shadow-2xl"
                      />
                    </form>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                    {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-600 hover:text-white"><ClearIcon size={16} /></button>}
                </div>
                {loading ? <LoadingSkeleton /> : error ? <div className="text-red-400 text-center text-sm font-bold bg-red-950/20 p-4 rounded-xl border border-red-900/30">{error}</div> : (
                  <>
                    {wordData && searchMode === 'word' && <WordCard data={wordData} isSaved={isItemSaved(wordData)} onToggleSave={() => handleToggleSave(wordData)} sheetsUrl={sheetsUrl} onLookup={handleQuickLookup} />}
                    {sentenceData && searchMode === 'sentence' && <SentenceCard data={sentenceData} isSaved={isItemSaved(sentenceData)} onToggleSave={() => handleToggleSave(sentenceData)} sheetsUrl={sheetsUrl} onLookup={handleQuickLookup} />}
                    {!wordData && !sentenceData && (
                      <div className="text-center text-gray-800 mt-20 opacity-20"><Quote size={40} className="mx-auto mb-4" /><h3 className="text-sm font-black uppercase tracking-widest">Tra cứu AI siêu tốc</h3></div>
                    )}
                  </>
                )}
            </div>
        )}

        {currentView === 'flashcards' && (
            <FlashcardPage 
              words={savedWords} 
              sentences={savedSentences} 
              onSelectWord={setSelectedDetail} 
              onSelectSentence={setSelectedDetail} 
              onRemoveWord={(s) => setSavedWords(prev => prev.filter(w => w.word !== s))} 
              onRemoveSentence={(s) => setSavedSentences(prev => prev.filter((item: SentenceData) => item.sentence !== s))} 
              onStartStudy={() => { setStudyQueue([...savedWords].sort(() => Math.random() - 0.5)); setCurrentView('study'); }} 
              onBackToSearch={() => setCurrentView('search')} 
              sheetsUrl={sheetsUrl} 
              onUpdateSheetsUrl={setSheetsUrl} 
            />
        )}
      </main>

      {selectedDetail && (
        <DetailModal item={selectedDetail} onClose={() => setSelectedDetail(null)} sheetsUrl={sheetsUrl} isSaved={isItemSaved(selectedDetail)} onToggleSave={() => handleToggleSave(selectedDetail)} onLookup={handleQuickLookup} isLoading={isSubLoading} />
      )}

      {currentView === 'study' && <StudySession words={studyQueue} onComplete={() => setCurrentView('flashcards')} onUpdateWord={(w) => setSavedWords(prev => prev.map(old => old.word === w.word ? w : old))} />}
    </div>
  );
};

export default App;
