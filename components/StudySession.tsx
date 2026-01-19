
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WordData, PronunciationFeedback } from '../types';
import { 
    X, RotateCw, CheckCircle, Brain, Volume2, VolumeX, Mic, MicOff, RefreshCw, Keyboard, ListChecks, Layers 
} from 'lucide-react';
import { checkPronunciation } from '../services/geminiService';

interface StudySessionProps {
  words: WordData[];
  onComplete: () => void;
  onUpdateWord: (word: WordData) => void;
}

type StudyMode = 'flashcard' | 'typing' | 'quiz';

const SRS_INTERVALS = [1, 3, 7, 14, 30, 90, 180];

export const StudySession: React.FC<StudySessionProps> = ({ words, onComplete, onUpdateWord }) => {
  const [queue, setQueue] = useState<WordData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode | null>(null);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, forgotten: 0 });
  const [autoRead, setAutoRead] = useState<boolean>(() => localStorage.getItem('vocab_auto_read') === 'true');

  const [userInput, setUserInput] = useState('');
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const typingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (words.length > 0) setQueue(words); }, [words]);
  const currentWord = queue[currentIndex];

  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  const generateQuizOptions = useCallback((correctWord: string) => {
    if (!words || words.length < 2) return [correctWord];
    const distractors = words.filter(w => w.word !== correctWord).sort(() => Math.random() - 0.5).slice(0, 3).map(w => w.word);
    return [...distractors, correctWord].sort(() => Math.random() - 0.5);
  }, [words]);

  const handleRate = useCallback((rating: 'fail' | 'hard' | 'good' | 'easy') => {
    if (!currentWord) return;
    let newLevel = currentWord.srs_level || 0;
    switch (rating) {
      case 'fail': newLevel = 0; setSessionStats(prev => ({ ...prev, forgotten: prev.forgotten + 1 })); break;
      case 'hard': newLevel = Math.max(0, newLevel); break;
      case 'good': newLevel = Math.min(newLevel + 1, SRS_INTERVALS.length - 1); break;
      case 'easy': newLevel = Math.min(newLevel + 2, SRS_INTERVALS.length - 1); break;
    }
    const days = SRS_INTERVALS[newLevel];
    const nextReviewDate = Date.now() + (days * 24 * 60 * 60 * 1000);
    onUpdateWord({ ...currentWord, srs_level: newLevel, next_review: nextReviewDate });
    setSessionStats(prev => ({ ...prev, reviewed: prev.reviewed + 1 }));
    if (currentIndex < queue.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 200); 
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentWord, currentIndex, queue.length, onUpdateWord]);

  const handleFlip = useCallback(() => {
    if (isRecording || studyMode !== 'flashcard') return; 
    setIsFlipped(!isFlipped);
  }, [isRecording, studyMode, isFlipped]);

  const handleCheckTyping = useCallback((e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!userInput.trim()) return;
      const correct = userInput.trim().toLowerCase() === currentWord.word.toLowerCase();
      setIsCorrectAnswer(correct);
      setIsAnswered(true);
      if (correct) speak(currentWord.word);
  }, [userInput, currentWord, speak]);

  const handleSelectQuiz = useCallback((option: string) => {
      if (isAnswered) return;
      const correct = option === currentWord.word;
      setIsCorrectAnswer(correct);
      setIsAnswered(true);
      if (correct) speak(currentWord.word);
  }, [isAnswered, currentWord, speak]);

  useEffect(() => {
    if (currentWord) {
        if (autoRead && studyMode === 'flashcard' && !isFlipped) speak(currentWord.word);
        if (studyMode === 'quiz') setQuizOptions(generateQuizOptions(currentWord.word));
        setUserInput('');
        setIsAnswered(false);
        setIsCorrectAnswer(null);
        if (studyMode === 'typing') setTimeout(() => typingInputRef.current?.focus(), 50);
    }
  }, [currentIndex, currentWord, studyMode, autoRead, isFlipped, speak, generateQuizOptions]);

  const toggleAutoRead = () => {
    const newState = !autoRead;
    setAutoRead(newState);
    localStorage.setItem('vocab_auto_read', String(newState));
    if (newState && currentWord) speak(currentWord.word);
  };

  if (!studyMode && queue.length > 0) {
    return (
        <div className="fixed inset-0 z-[110] bg-gray-950 flex flex-col items-center justify-center p-4">
             <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl max-w-lg w-full text-center shadow-2xl">
                <div className="bg-emerald-500/10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"><Layers size={40} className="text-emerald-500" /></div>
                <h2 className="text-3xl font-bold text-white mb-2">Cài đặt buổi học</h2>
                <p className="text-gray-400 mb-8">Chọn cách ôn tập {queue.length} từ vựng hôm nay.</p>
                <div className="grid grid-cols-1 gap-4 mb-8">
                    <button onClick={() => setStudyMode('flashcard')} className="flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl transition-all">
                        <div className="bg-emerald-500/20 p-3 rounded-xl text-emerald-500"><RotateCw size={24} /></div>
                        <div className="text-left"><div className="font-bold text-white">Thẻ ghi nhớ</div><div className="text-xs text-gray-500">Tự đánh giá</div></div>
                    </button>
                    <button onClick={() => setStudyMode('typing')} className="flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl transition-all">
                        <div className="bg-blue-500/20 p-3 rounded-xl text-blue-500"><Keyboard size={24} /></div>
                        <div className="text-left"><div className="font-bold text-white">Gõ từ vựng</div><div className="text-xs text-gray-500">Thử thách chính xác</div></div>
                    </button>
                    <button onClick={() => setStudyMode('quiz')} className="flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl transition-all">
                        <div className="bg-purple-500/20 p-3 rounded-xl text-purple-500"><ListChecks size={24} /></div>
                        <div className="text-left"><div className="font-bold text-white">Trắc nghiệm</div><div className="text-xs text-gray-500">Chọn 1 trong 4</div></div>
                    </button>
                </div>
                <button onClick={onComplete} className="text-gray-500 hover:text-white text-sm font-medium">Hủy bỏ [Esc]</button>
             </div>
        </div>
    );
  }

  if (queue.length === 0 || currentIndex >= queue.length) {
    return (
      <div className="fixed inset-0 z-[110] bg-gray-950 flex flex-col items-center justify-center p-4">
         <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl max-w-md w-full text-center">
            <div className="bg-emerald-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={40} className="text-emerald-500" /></div>
            <h2 className="text-2xl font-bold text-white mb-2">Hoàn thành!</h2>
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-800 p-4 rounded-xl"><div className="text-2xl font-bold text-white">{sessionStats.reviewed}</div><div className="text-[10px] text-gray-500 uppercase">Đã học</div></div>
                <div className="bg-gray-800 p-4 rounded-xl"><div className="text-2xl font-bold text-red-400">{sessionStats.forgotten}</div><div className="text-[10px] text-gray-500 uppercase">Cần xem lại</div></div>
            </div>
            <button onClick={onComplete} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-medium w-full">Trở về [Esc]</button>
         </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] bg-gray-950 flex flex-col p-4 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6 max-w-2xl mx-auto w-full">
        <div className="text-gray-500 font-mono text-xs">{currentIndex + 1} / {queue.length}</div>
        <button onClick={onComplete} className="p-2 bg-gray-900 rounded-full text-gray-500 hover:text-white border border-gray-800"><X size={20} /></button>
      </div>

      <div className="flex-1 flex items-center justify-center w-full max-w-xl mx-auto">
          {studyMode === 'flashcard' && (
              <div className="relative w-full aspect-[4/5] cursor-pointer group transition-all duration-500" style={{ perspective: '1000px' }} onClick={handleFlip}>
                  <div className={`absolute inset-0 transition-all duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                      <div className="absolute inset-0 backface-hidden bg-gray-900 border-2 border-gray-800 rounded-3xl flex flex-col items-center justify-center p-8 text-center shadow-2xl">
                          <h2 className="text-5xl font-black text-white mb-4">{currentWord.word}</h2>
                          <button onClick={(e) => { e.stopPropagation(); speak(currentWord.word); }} className="p-4 bg-gray-800 rounded-full text-emerald-400 border border-gray-700"><Volume2 size={32} /></button>
                          <p className="absolute bottom-6 text-[10px] text-gray-600 uppercase tracking-widest font-black animate-pulse">Chạm để lật thẻ</p>
                      </div>
                      <div className="absolute inset-0 backface-hidden bg-gray-800 border-2 border-emerald-500/20 rounded-3xl flex flex-col p-8 text-center rotate-y-180 shadow-2xl">
                          <h3 className="text-3xl font-black text-emerald-400 mb-2">{currentWord.meaning_vi}</h3>
                          <p className="text-sm text-gray-400 italic mb-6">{currentWord.part_of_speech}</p>
                          <div className="bg-gray-950/50 p-4 rounded-xl border border-gray-700 text-left">
                              <p className="text-white font-bold text-sm mb-1 italic">"{currentWord.example_en}"</p>
                              <p className="text-gray-500 text-xs mt-2">💡 {currentWord.mnemonic}</p>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {studyMode === 'typing' && (
              <div className="w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl">
                  <h3 className="text-3xl font-black text-white text-center mb-8">{currentWord.meaning_vi}</h3>
                  <form onSubmit={handleCheckTyping} className="space-y-4">
                      <input 
                        ref={typingInputRef}
                        type="text" value={userInput} disabled={isAnswered} 
                        onChange={(e) => setUserInput(e.target.value)} 
                        className={`w-full bg-gray-950 text-2xl text-center font-black p-4 rounded-2xl border-2 outline-none transition-all ${isAnswered ? isCorrectAnswer ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400' : 'border-gray-800 focus:border-blue-500'}`}
                        placeholder="Gõ từ tiếng Anh..."
                      />
                      {isAnswered && <div className="text-center text-gray-400 font-bold">Đáp án: {currentWord.word}</div>}
                      {!isAnswered && <button type="submit" className="w-full bg-blue-600 py-4 rounded-2xl font-black text-white">KIỂM TRA</button>}
                  </form>
              </div>
          )}

          {studyMode === 'quiz' && (
              <div className="w-full bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl">
                  <h3 className="text-2xl font-black text-white text-center mb-8">{currentWord.meaning_vi}</h3>
                  <div className="grid grid-cols-1 gap-3">
                      {quizOptions.map((opt, i) => (
                          <button key={i} onClick={() => handleSelectQuiz(opt)} disabled={isAnswered} className={`w-full p-4 rounded-2xl border-2 font-bold text-left transition-all ${isAnswered ? opt === currentWord.word ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-gray-950 border-gray-800 text-gray-700' : 'bg-gray-950 border-gray-800 hover:border-gray-600 text-gray-300'}`}>
                             {opt}
                          </button>
                      ))}
                  </div>
              </div>
          )}
      </div>

      <div className={`mt-8 max-w-md mx-auto w-full grid grid-cols-4 gap-2 transition-all duration-300 ${(isFlipped || isAnswered) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button onClick={() => handleRate('fail')} className="bg-red-900/20 border border-red-900/40 text-red-400 py-3 rounded-xl font-black text-[10px] uppercase">Quên</button>
          <button onClick={() => handleRate('hard')} className="bg-orange-900/20 border border-orange-900/40 text-orange-400 py-3 rounded-xl font-black text-[10px] uppercase">Khó</button>
          <button onClick={() => handleRate('good')} className="bg-blue-900/20 border border-blue-900/40 text-blue-400 py-3 rounded-xl font-black text-[10px] uppercase">Nhớ</button>
          <button onClick={() => handleRate('easy')} className="bg-emerald-900/20 border border-emerald-900/40 text-emerald-400 py-3 rounded-xl font-black text-[10px] uppercase">Dễ</button>
      </div>

      <style>{`
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
};
