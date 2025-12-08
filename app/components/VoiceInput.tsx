"use client";
import { useState, useEffect, useRef } from "react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onQuery?: (query: string) => void;
  placeholder?: string;
}

export default function VoiceInput({ onTranscript, onQuery, placeholder = "Click microphone to speak..." }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if Web Speech API is supported
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setIsSupported(true);

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "pl-PL"; // Polish language

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPiece;
          } else {
            interimTranscript += transcriptPiece;
          }
        }

        const currentTranscript = finalTranscript || interimTranscript;
        setTranscript(currentTranscript);
        
        if (finalTranscript) {
          onTranscript(finalTranscript);
          processVoiceCommand(finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscript]);

  const processVoiceCommand = (text: string) => {
    const lowerText = text.toLowerCase();
    
    // Parse voice command to database query format
    // Examples: "warszawa gdynia", "kraków katowice"
    const patterns = [
      /([a-ząćęłńóśźż]+)\s+([a-ząćęłńóśźż]+)/i,  // "Warszawa Gdynia"
      /([a-ząćęłńóśźż]+)\s+->\s+([a-ząćęłńóśźż]+)/i,  // "Warszawa -> Gdynia"
    ];

    let from = "";
    let to = "";

    for (const pattern of patterns) {
      const match = lowerText.match(pattern);
      if (match) {
        from = match[1].trim();
        to = match[2].trim();
        break;
      }
    }

    if (from && to) {
      const query = `${from} -> ${to}`;
      if (onQuery) {
        onQuery(query);
      }
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  if (!isSupported) {
    return (
      <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#dc2626", borderRadius: 8, fontSize: 14 }}>
        Voice recognition is not supported in your browser. Please use Chrome or Edge.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={toggleListening}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "transparent",
            color: isListening ? "#dc2626" : "#5f6368",
            border: "2px solid #dadce0",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            transition: "all 0.2s",
            boxShadow: isListening ? "0 0 0 4px rgba(220, 38, 38, 0.1)" : "none",
          }}
          title={isListening ? "Stop listening" : "Start voice input"}
          onMouseEnter={(e) => {
            if (!isListening) e.currentTarget.style.background = "#f8f9fa";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>
        <div style={{ flex: 1, minHeight: 48, display: "flex", alignItems: "center" }}>
          {transcript ? (
            <div style={{ fontSize: 16, color: "#0f172a" }}>{transcript}</div>
          ) : (
            <div style={{ fontSize: 14, color: "#94a3b8" }}>{placeholder}</div>
          )}
        </div>
      </div>
      {isListening && (
        <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 500 }}>
          Listening... Speak now
        </div>
      )}
    </div>
  );
}
