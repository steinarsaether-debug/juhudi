// ─── Web Speech API wrapper ───────────────────────────────────────────────────
// Provides live speech-to-text transcription in the browser.
// Uses the native SpeechRecognition API — zero cost, zero audio upload.
//
// Supported:  Chrome (desktop + Android), Edge, Samsung Browser
// Unsupported: iOS Safari, Firefox (falls back gracefully to text-only mode)
//
// Language codes used:
//   en-KE  →  English (Kenya)
//   sw-KE  →  Swahili (Kenya)

import { useState, useRef, useCallback, useEffect } from 'react';

// Minimal type declarations for the Web Speech API (not in TS DOM lib by default)
/* eslint-disable @typescript-eslint/no-explicit-any */
declare class SpeechRecognitionAPI extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onstart:  ((this: SpeechRecognitionAPI, ev: Event) => void) | null;
  onend:    ((this: SpeechRecognitionAPI, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionAPI, ev: SpeechRecognitionResultEvent) => void) | null;
  onerror:  ((this: SpeechRecognitionAPI, ev: SpeechRecognitionErrorEvt) => void) | null;
  start(): void;
  stop(): void;
}
interface SpeechRecognitionResultEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvt extends Event {
  error: string;
}
declare global {
  interface Window {
    SpeechRecognition:       new () => SpeechRecognitionAPI;
    webkitSpeechRecognition: new () => SpeechRecognitionAPI;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface UseSpeechRecognitionReturn {
  isSupported:    boolean;  // false on iOS/Firefox — shows text-only fallback
  isListening:    boolean;
  interimText:    string;   // Real-time partial transcript (not yet final)
  startListening: (lang: 'en-KE' | 'sw-KE') => void;
  stopListening:  () => void;
  resetTranscript:() => void;
}

export function useSpeechRecognition(
  onFinalTranscript: (text: string) => void,
): UseSpeechRecognitionReturn {
  const SpeechRecognitionAPI =
    typeof window !== 'undefined'
      ? (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null)
      : null;

  const isSupported = !!SpeechRecognitionAPI;

  const recognitionRef   = useRef<SpeechRecognitionAPI | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const finalBufferRef = useRef('');  // Accumulates final transcript chunks

  // Stop and clean up on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText('');
  }, []);

  const startListening = useCallback((lang: 'en-KE' | 'sw-KE') => {
    if (!SpeechRecognitionAPI) return;

    // Stop any existing session first
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    finalBufferRef.current = '';
    setInterimText('');

    const recognition = new SpeechRecognitionAPI();
    recognition.lang            = lang;
    recognition.interimResults  = true;   // Show partial results as user speaks
    recognition.maxAlternatives = 1;
    recognition.continuous      = true;   // Keep listening until explicitly stopped

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalBufferRef.current += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
      const finalText = finalBufferRef.current.trim();
      if (finalText) {
        onFinalTranscript(finalText);
      }
      finalBufferRef.current = '';
      recognitionRef.current = null;
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvt) => {
      // Ignore no-speech errors; stop on permission denied
      if (event.error === 'no-speech') return;
      console.warn('SpeechRecognition error:', event.error);
      stopListening();
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognitionAPI, onFinalTranscript, stopListening]);

  const resetTranscript = useCallback(() => {
    finalBufferRef.current = '';
    setInterimText('');
  }, []);

  return { isSupported, isListening, interimText, startListening, stopListening, resetTranscript };
}
