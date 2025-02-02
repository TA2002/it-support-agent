import React, { useState, useRef, RefObject } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Loader, Mic, MicOff } from "lucide-react";
import Groq from "groq-sdk";

// Extend the window object to support SpeechRecognition in TypeScript
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// Define a type for our chat messages.
type ChatMessage = {
  role: "user" | "system";
  text: string;
  screenshot?: string;
};

function Home() {
  const videoRef: RefObject<HTMLVideoElement> = useRef(null);
  const [screenTrack, setScreenTrack] = useState<MediaStreamTrack | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcription, setTranscription] = useState<string>("");
  const [processingStage, setProcessingStage] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // New state for selecting LLM model and voice type
  // "openai" uses OpenAI's GPT-4o-mini, "groq" uses the current Groq llama model.
  const [selectedLLM, setSelectedLLM] = useState<string>("groq");
  // Updated the default voice to "Chris" and added the new voice options below.
  const [selectedVoice, setSelectedVoice] = useState<string>("iP95p4xoKVk53GoZ742B");

  // Refs for SpeechRecognition
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef<boolean>(true);

  // New refs for managing ElevenLabs streaming cancellation
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cancel any ongoing streaming (abort fetch and stop audio)
  const cancelStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.remove();
      audioRef.current = null;
    }
  };

  // **1️⃣ Start capturing the screen**
  const startCapture = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = screenStream.getVideoTracks()[0];
      setScreenTrack(track);
      if (videoRef.current) {
        videoRef.current.srcObject = screenStream;
      }
    } catch (error) {
      console.error("Error starting screen capture:", error);
      alert("Failed to start screen capture.");
    }
  };

  // **2️⃣ Stop screen capture**
  const stopCapture = () => {
    if (screenTrack) {
      screenTrack.stop();
    }
    setScreenTrack(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // **3️⃣ Take a screenshot and send to the selected LLM API**
  const takeScreenshotAndSendToLLM = async (spokenText: string) => {
    if (!videoRef.current || !videoRef.current.srcObject) {
      alert("No active screen stream to screenshot!");
      return;
    }

    setIsProcessing(true);
    setProcessingStage("Taking screenshot...");

    try {
      // Capture current video frame
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL("image/png");
      setScreenshot(base64Image);

      // Add a user message (with text and screenshot) to the chat history.
      setChatHistory((prev) => [
        ...prev,
        { role: "user", text: spokenText, screenshot: base64Image },
      ]);

      let assistantMessage = "";
      if (selectedLLM === "openai") {
        // **OpenAI GPT-4o-mini API Request**
        setProcessingStage("Hitting OpenAI API...");
        const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
        const payload = {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an IT Support Assistant dedicated to helping users—especially elders—with their computer issues. When answering, carefully review the screenshot and the user's question. Provide clear, step-by-step guidance in simple, friendly language. Keep your answer to no more than 3-4 sentences. Do not include any special characters, as your response will be converted to audio.",
            },
            { role: "user", content: [{ type: "text", text: `{This is what my screen shows right now: [attached image]. ${spokenText}}` }, { type: "image_url", image_url: { url: base64Image } }] },
          ],
          temperature: 1,
          max_tokens: 1024,
          top_p: 1,
        };

        const openaiResponse = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          payload,
          {
            headers: {
              "Authorization": `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
          }
        );
        assistantMessage = openaiResponse.data.choices[0].message.content;
      } else {
        // **Groq Vision (Llama) API Request**
        setProcessingStage("Hitting Groq API...");
        const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
        const client = new Groq({ apiKey: groqApiKey, dangerouslyAllowBrowser: true });
        const response = await client.chat.completions.create({
          model: "llama-3.2-90b-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  // `{This is what my screen shows right now: [attached image]. ${spokenText}}`
                  text: `You are an IT Support Assistant dedicated to helping users—especially elders—with their computer issues. When answering, carefully review the screenshot and the user's question. Provide clear, step-by-step guidance in simple, friendly language. Keep your answer to no more than 3-4 sentences. Do not include any special characters, as your response will be converted to audio. User question: This is what my screen shows right now: [attached image]. ${spokenText}`,
                },
                {
                  type: "image_url",
                  image_url: { url: base64Image },
                },
              ],
            },
          ],
          temperature: 1,
          max_completion_tokens: 1024,
          top_p: 1,
          stream: false,
        });
        assistantMessage = response?.choices?.[0]?.message?.content;
      }

      setAiResponse(assistantMessage ?? "No response");

      // Add system (assistant) message to chat history.
      setChatHistory((prev) => [
        ...prev,
        { role: "system", text: assistantMessage ?? "No response" },
      ]);

      // **4️⃣ Immediately Convert AI Response to Speech**
      setProcessingStage("Starting ElevenLabs TTS...");
      if (assistantMessage) {
        speakWithElevenLabs(assistantMessage);
      }
    } catch (error) {
      console.error("Error capturing or sending to LLM:", error);
      alert("Error during screenshot/LLM process.");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProcessingStage(""), 2000);
    }
  };

  // **5️⃣ Convert AI Response to Speech Using ElevenLabs**
  const speakWithElevenLabs = async (text: string) => {
    try {
      setProcessingStage("Starting ElevenLabs TTS...");
      const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
      const voiceId = selectedVoice; // use the selected voice type
      const modelId = "eleven_flash_v2_5";
      const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

      // Create an AbortController to cancel streaming if needed.
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenLabsApiKey,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.body) {
        throw new Error("No response body from ElevenLabs.");
      }

      setProcessingStage("Streaming ElevenLabs audio...");

      // Create an audio element for playback and save it to our ref.
      const audio = new Audio();
      audioRef.current = audio;
      // Optionally, you can uncomment the next line to display audio controls.
      // audio.controls = true;
      document.body.appendChild(audio);

      // Create a MediaSource and assign it to the audio element.
      const mediaSource = new MediaSource();
      audio.src = URL.createObjectURL(mediaSource);

      mediaSource.addEventListener("sourceopen", () => {
        const mimeCodec = "audio/mpeg";
        let sourceBuffer: SourceBuffer;
        try {
          sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
        } catch (e) {
          console.error("Error adding SourceBuffer:", e);
          return;
        }

        const reader = response.body!.getReader();
        const queue: Uint8Array[] = [];

        const appendNextChunk = () => {
          if (queue.length > 0 && !sourceBuffer.updating) {
            const chunk = queue.shift();
            if (chunk) {
              try {
                sourceBuffer.appendBuffer(chunk);
              } catch (e) {
                console.error("Error appending chunk:", e);
              }
            }
          }
        };

        sourceBuffer.addEventListener("updateend", appendNextChunk);

        const pump = () => {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                if (!sourceBuffer.updating && queue.length === 0) {
                  mediaSource.endOfStream();
                }
                return;
              }
              if (value) {
                queue.push(value);
              }
              if (!sourceBuffer.updating) {
                appendNextChunk();
              }
              pump();
            })
            .catch((err) => {
              console.error("Error reading stream:", err);
            });
        };

        pump();
      });

      audio.play();
      audio.onended = () => {
        setProcessingStage("Audio playback finished.");
        setTimeout(() => setProcessingStage(""), 2000);
      };
    } catch (error) {
      console.error("Error streaming from ElevenLabs:", error);
      setProcessingStage("Error in ElevenLabs TTS.");
    }
  };

  // **6️⃣ Enable Continuous Voice Recognition**
  // **6️⃣ Enable Continuous Voice Recognition**
const startListening = () => {
  if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
    alert("Your browser does not support speech recognition.");
    return;
  }

  if (recognitionRef.current) {
    return;
  }

  const SpeechRecognitionConstructor =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognitionConstructor();

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    setIsListening(true);
    setTranscription("Listening...");
  };

  recognition.onerror = (event: any) => {
    console.error("Speech recognition error:", event);
    recognition.stop();
  };

  recognition.onend = () => {
    setIsListening(false);
    recognitionRef.current = null;
    if (shouldListenRef.current) {
      setTimeout(() => {
        startListening();
      }, 500);
    }
  };

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interimTranscript = "";
    let finalTranscript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    // **Interrupt streaming audio as soon as any speech is detected**
    if (
      (interimTranscript && interimTranscript.trim() !== "") ||
      (finalTranscript && finalTranscript.trim() !== "")
    ) {
      cancelStreaming();
    }

    // Update transcription display
    if (interimTranscript && !finalTranscript) {
      setTranscription(interimTranscript);
    }
    if (finalTranscript) {
      setTranscription(finalTranscript);
      takeScreenshotAndSendToLLM(finalTranscript);
    }
  };

  recognition.start();
  recognitionRef.current = recognition;
};


  const stopListening = () => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white shadow-2xl rounded-xl overflow-hidden">
        {/* Header with Title and Options */}
        <header className="bg-indigo-700 text-white py-4 px-6">
          <h1 className="text-2xl font-bold">IT Support Agent</h1>
          <p className="text-md text-blue-200">Speak, capture, and interact with AI seamlessly</p>
        </header>

        <div className="flex flex-col md:flex-row">
          {/* Left Panel: Video Preview & Capture Controls */}
          <div className="md:w-1/3 border-r p-4">
            <video ref={videoRef} autoPlay className="w-full rounded-lg border" />
            <div className="mt-4 flex justify-around">
              <Button onClick={startCapture} variant="default">
                Start Capture
              </Button>
              <Button onClick={stopCapture} variant="destructive" disabled={!screenTrack}>
                Stop Capture
              </Button>
            </div>
            <div className="my-7 flex flex-col gap-4">
              <div className="w-full">
                <label className="block text-sm font-medium">LLM Model</label>
                <select
                  className="mt-1 p-2 block w-full rounded-md border border-gray-300 text-black"
                  value={selectedLLM}
                  onChange={(e) => setSelectedLLM(e.target.value)}
                >
                  <option value="openai">GPT-4o-mini - better answers</option>
                  <option value="groq">Llama by Groq - faster response</option>
                </select>
              </div>
              <div className="w-full">
                <label className="block text-sm font-medium">Voice Type</label>
                <select
                  className="mt-1 p-2 block w-full rounded-md border border-gray-300 text-black"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                >
                  <option value="iP95p4xoKVk53GoZ742B">Chris</option>
                  <option value="Xb7hH8MSUJpSbSDYk0k2">Alice</option>
                  <option value="9BWtsMINqrJLrRacOk9x">Aria</option>
                  <option value="pqHfZKP75CvOlQylNhV4">Bill</option>
                  <option value="nPczCjzI2devNBz1zQrb">Brian</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right Panel: Chat & Controls */}
          <div className="md:w-2/3 flex flex-col">
            {/* Chat History */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
              <div className="space-y-4">
                {chatHistory.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs p-3 rounded-lg shadow ${
                        msg.role === "user" ? "bg-blue-100 text-right" : "bg-gray-200 text-left"
                      }`}
                    >
                      <p className="text-sm">{msg.text}</p>
                      {msg.screenshot && (
                        <img src={msg.screenshot} alt="Screenshot" className="mt-2 rounded-lg" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer: Transcription, Status & Microphone Control */}
            <div className="p-4 bg-white border-t flex flex-col items-center">
              {transcription && <div className="mb-2 text-gray-700">{transcription}</div>}
              {processingStage && <div className="mb-2 text-sm text-blue-600">{processingStage}</div>}
              <Button onClick={startListening} variant="secondary">
                {isListening ? (
                  <>
                    <Mic className="mr-2 animate-pulse" /> Listening...
                  </>
                ) : (
                  <>
                    <Mic className="mr-2" /> Enable Microphone
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
