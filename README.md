# IT Support Agent

IT Support Agent is a web application designed to help users—especially elders—resolve computer issues using voice commands and AI. The app captures your screen, listens to your spoken questions, and uses advanced language models to provide clear, concise, and step-by-step IT support guidance. It also converts the AI response into natural-sounding speech using a text-to-speech (TTS) service. 🚀

## Features 🌟
- **Voice Recognition**: Uses browser-based `SpeechRecognition` to listen for user commands.
- **Screen Capture**: Captures a screenshot of the user’s current screen for context.
- **Chat Interface**: Displays the conversation history with both user questions (including screenshots) and AI responses.
- **Dual LLM Support**: Offers the choice between OpenAI's GPT-4o-mini and Groq's Llama-vision model for generating IT support responses.
- **Text-to-Speech (TTS)**: Converts AI responses into audio using ElevenLabs TTS, with selectable voice types.
- **Modern UI**: Built with Tailwind CSS and shadcn UI components for a polished, responsive user experience.

## Technologies Used ⚙️
- **React**: Frontend library for building the user interface.
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development.
- **shadcn UI**: A set of beautifully styled, composable UI components (e.g., the custom `Select` component).
- **Axios**: HTTP client for making API requests.
- **Groq SDK**: For interacting with the Groq Vision API.
- **Browser Web APIs**:
  - `MediaDevices API`: For screen capture.
  - `SpeechRecognition API`: For voice recognition.
  - `MediaSource API`: For streaming audio from ElevenLabs.
- **OpenAI API**: (Optional) Used when selecting GPT-4o-mini as the language model.
- **ElevenLabs API**: For converting text responses into natural-sounding audio.

## Project Structure 📂
```
.
├── public/            # Static assets
├── src/
│   ├── components/    # Reusable UI components (e.g., Button, Select, Card)
│   ├── pages/         # Page components (e.g., Home.tsx)
│   ├── App.tsx        # Main application component
│   └── index.tsx      # Application entry point
├── package.json       # Project metadata and dependencies
└── README.md          # This file
```

## How It Works 🛠️

### 1. Screen Capture
The app uses the `MediaDevices API` to capture your screen and display it in a video element.

### 2. Voice Recognition & Command Processing
When you speak, the `SpeechRecognition API` transcribes your speech into text. The app then:
1. Captures a screenshot.
2. Sends both the transcribed question and the screenshot to the selected language model (either OpenAI’s GPT-4o-mini or Groq’s Llama-vision).
3. Displays the conversation history in a chat interface.

### 3. AI Response & TTS
The language model returns an IT support response, which is:
- Shown in the chat history.
- Passed to ElevenLabs TTS to generate audio, which is played back to the user.

## Settings & Customization ⚙️
Users can choose the language model and the voice type via shadcn’s styled `Select` components.

## Getting Started 🚀

### Prerequisites 📋
- Node.js (v14 or higher)
- npm or yarn

### Installation 📥

1. Clone the repository:
    ```bash
    git clone https://github.com/yourusername/it-support-agent.git
    cd it-support-agent
    ```

2. Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

3. Configure Environment Variables:
    - Create a `.env` file in the root of the project and add your API keys:
    ```env
    VITE_OPENAI_API_KEY=your_openai_api_key
    VITE_GROQ_API_KEY=your_groq_api_key
    VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key
    ```

4. Start the development server:
    ```bash
    npm start
    # or
    yarn start
    ```

   The app will be available at [http://localhost:3000](http://localhost:3000).

## Contributing 🤝
Contributions are welcome! Please open an issue or submit a pull request if you have suggestions or improvements.