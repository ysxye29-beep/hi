
import { GoogleGenAI, Type } from "@google/genai";
import { WordData, SentenceData, PronunciationFeedback } from "../types";

const wordCache = new Map<string, WordData>();
const sentenceCache = new Map<string, SentenceData>();

const wordSchema = {
  type: Type.OBJECT,
  properties: {
    word: { type: Type.STRING, description: "The English word analyzed" },
    meaning_vi: { type: Type.STRING, description: "Main Vietnamese meaning" },
    definition_en: { type: Type.STRING, description: "Short English definition" },
    ipa: { type: Type.STRING },
    syllables: { type: Type.STRING },
    spelling_tip: { type: Type.STRING },
    part_of_speech: { type: Type.STRING },
    example_en: { type: Type.STRING },
    example_vi: { type: Type.STRING },
    example_b2_en: { type: Type.STRING },
    example_b2_vi: { type: Type.STRING },
    root_word: { type: Type.STRING },
    mnemonic: { type: Type.STRING },
    synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
    antonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
    word_family: { type: Type.ARRAY, items: { type: Type.STRING } },
    collocations: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["word", "meaning_vi", "definition_en", "ipa", "example_en", "example_vi", "root_word", "mnemonic", "synonyms", "antonyms"],
};

const sentenceSchema = {
  type: Type.OBJECT,
  properties: {
    sentence: { type: Type.STRING },
    meaning_vi: { type: Type.STRING },
    grammar_breakdown: { type: Type.STRING },
    usage_context: { type: Type.STRING },
    naturalness_score: { type: Type.NUMBER },
    similar_sentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          en: { type: Type.STRING },
          vi: { type: Type.STRING }
        }
      }
    }
  },
  required: ["sentence", "meaning_vi", "grammar_breakdown", "usage_context", "naturalness_score", "similar_sentences"]
};

export const lookupWord = async (input: string): Promise<WordData> => {
  const normalized = input.trim().toLowerCase();
  if (wordCache.has(normalized)) return wordCache.get(normalized)!;

  // Luôn tạo instance mới ngay trước khi gọi để đảm bảo lấy đúng API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", 
    contents: `Analyze this word: "${normalized}"`,
    config: {
      systemInstruction: "You are an expert bilingual dictionary. Provide JSON only. Distinguish synonyms (matching meaning) and antonyms (opposite meaning) clearly.",
      responseMimeType: "application/json",
      responseSchema: wordSchema,
    },
  });
  
  const result = JSON.parse(response.text) as WordData;
  wordCache.set(normalized, result);
  return result;
};

export const lookupSentence = async (input: string): Promise<SentenceData> => {
  const normalized = input.trim();
  if (sentenceCache.has(normalized)) return sentenceCache.get(normalized)!;

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", 
    contents: `Analyze: "${normalized}"`,
    config: {
      systemInstruction: "Analyze sentence and provide naturalness. JSON only.",
      responseMimeType: "application/json",
      responseSchema: sentenceSchema,
    },
  });
  
  const result = JSON.parse(response.text) as SentenceData;
  sentenceCache.set(normalized, result);
  return result;
};

export const checkPronunciation = async (target: string, base64Audio: string, mimeType: string): Promise<PronunciationFeedback> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Audio, mimeType: mimeType } },
        { text: `Feedback on pronunciation for: "${target}"` }
      ]
    },
    config: {
      systemInstruction: "Bilingual pronunciation coach. Be concise. JSON only.",
      responseMimeType: "application/json",
    }
  });
  return JSON.parse(response.text) as PronunciationFeedback;
};
