import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai';
import { Sparkles, User, Bot, Send, Image as ImageIcon, X, Loader2, Settings, Trash2, Moon, Sun, AlertCircle, Menu } from 'lucide-react';

// --- Constants & Types ---
const Role = {
  USER: 'user',
  MODEL: 'model'
};

// --- Service: Gemini API ---
const apiKey = window.process?.env?.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const streamGeminiResponse = async (prompt, images, history, config) => {
  // Select model based on content
  const modelName = images.length > 0 ? 'gemini-2.5-flash-image' : 'gemini-3-flash-preview';

  const parts = [];
  
  // Add images if any
  images.forEach(img => {
    // Basic base64 cleanup if header is present
    const base64Data = img.split(',')[1] || img;
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data
      }
    });
  });

  // Add text prompt
  parts.push({ text: prompt });

  try {
    if (images.length > 0) {
      // Single turn vision request
      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents: { parts },
        config: {
          systemInstruction: config.systemInstruction,
          temperature: config.temperature,
        }
      });
      return responseStream;
    } else {
      // Text-only chat
      const chat = ai.chats.create({
        model: modelName,
        config: {
          systemInstruction: config.systemInstruction,
          temperature: config.temperature,
        },
        history: history.map(h => ({
          role: h.role,
          parts: [{ text: h.text }]
        }))
      });

      const responseStream = await chat.sendMessageStream({ message: prompt });
      return responseStream;
    }

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

// --- Component: MarkdownRenderer ---
const MarkdownRenderer = ({ content }) => {
  return (
    <div className="markdown-body text-sm md:text-base break-words">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};

// --- Component: ChatMessageItem ---
const ChatMessageItem = ({ message }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center ${
          isUser ? 'bg-indigo-600' : 'bg-gemini-600'
        } shadow-md`}>
          {isUser ? <User size={20} className="text-white" /> : <Bot size={20} className="text-white" />}
        </div>

        {/* Content Bubble */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`relative px-5 py-3.5 rounded-2xl shadow-sm ${
            isUser 
              ? 'bg-indigo-600 text-white rounded-tr-sm' 
              : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-sm'
          }`}>
             {/* Images Grid */}
             {message.images && message.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {message.images.map((img, idx) => (
                  <img 
                    key={idx} 
                    src={img} 
                    alt="Uploaded attachment" 
                    className="w-32 h-32 object-cover rounded-lg border border-white/20"
                  />
                ))}
              </div>
            )}

            {/* Text Content */}
            {message.isError ? (
              <div className="flex items-center text-red-200 gap-2">
                <AlertCircle size={16} />
                <span>{message.text}</span>
              </div>
            ) : (
              <div className={`${isUser ? '[&_*]:text-white' : ''}`}>
                 <MarkdownRenderer content={message.text} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Component: InputArea ---
const InputArea = ({ onSend, isLoading }) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setImages(prev => [...prev, reader.result]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    if ((!text.trim() && images.length === 0) || isLoading) return;
    onSend(text, images);
    setText('');
    setImages([]);
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const adjustHeight = (e) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      {/* Image Preview */}
      {images.length > 0 && (
        <div className="flex gap-3 mb-3 overflow-x-auto pb-2 px-1">
          {images.map((img, idx) => (
            <div key={idx} className="relative group shrink-0">
              <img src={img} alt="Preview" className="w-20 h-20 object-cover rounded-xl border border-gray-200 shadow-sm" />
              <button 
                onClick={() => removeImage(idx)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div className="relative flex items-end gap-2 bg-white dark:bg-gray-800 p-2 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700">
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="p-3 text-gray-500 hover:text-gemini-600 dark:text-gray-400 dark:hover:text-gemini-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Add image"
          disabled={isLoading}
        >
          <ImageIcon size={24} />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          multiple
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={adjustHeight}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={isLoading}
          rows={1}
          className="flex-1 max-h-[200px] py-3 px-2 bg-transparent border-none focus:ring-0 resize-none text-gray-800 dark:text-gray-100 placeholder-gray-400"
          style={{ minHeight: '48px' }}
        />

        <button 
          onClick={handleSend}
          disabled={(!text.trim() && images.length === 0) || isLoading}
          className={`p-3 rounded-full transition-all duration-200 flex items-center justify-center ${
            (!text.trim() && images.length === 0) || isLoading
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-gemini-600 hover:bg-gemini-700 text-white shadow-md'
          }`}
        >
          {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
        </button>
      </div>
      <div className="text-center mt-2 text-xs text-gray-400 dark:text-gray-500">
        Gemini can make mistakes. Please check important information.
      </div>
    </div>
  );
};

// --- Component: SettingsPanel ---
const SettingsPanel = ({ isOpen, onClose, config, setConfig }) => {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <Settings size={20} />
            Configuration
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto h-[calc(100vh-64px)]">
          
          {/* System Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              System Instruction
            </label>
            <textarea
              value={config.systemInstruction}
              onChange={(e) => setConfig(prev => ({ ...prev, systemInstruction: e.target.value }))}
              placeholder="e.g. You are a helpful coding assistant..."
              className="w-full h-32 p-3 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-gemini-500 outline-none resize-none"
            />
            <p className="mt-1 text-xs text-gray-500">
              Defines how the model should behave.
            </p>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Creativity (Temperature): {config.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.temperature}
              onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gemini-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Precise (0)</span>
              <span>Creative (2)</span>
            </div>
          </div>
          
          <div className="p-4 bg-gemini-50 dark:bg-gemini-900/20 rounded-lg border border-gemini-100 dark:border-gemini-900">
            <h3 className="text-sm font-semibold text-gemini-800 dark:text-gemini-200 mb-2">About Gemini Ultra Chat</h3>
            <p className="text-xs text-gemini-700 dark:text-gemini-300">
              Built with React, Tailwind, and the Gemini API. Supports image recognition and advanced reasoning models.
            </p>
          </div>

        </div>
      </div>
    </>
  );
};

// --- Main Component: App ---
const App = () => {
  // State
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [config, setConfig] = useState({
    systemInstruction: 'You are a helpful and knowledgeable AI assistant.',
    temperature: 0.7,
  });

  const scrollBottomRef = useRef(null);

  // Toggle Dark Mode
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Auto scroll
  useEffect(() => {
    if (scrollBottomRef.current) {
      scrollBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear the conversation?')) {
      setMessages([]);
    }
  };

  const handleSend = async (text, images) => {
    // 1. Add User Message
    const userMsg = {
      id: Date.now().toString(),
      role: Role.USER,
      text,
      images,
    };
    
    // Optimistic Update
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // 2. Prepare for Stream
    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      { id: botMsgId, role: Role.MODEL, text: '' } // Empty bot message placeholder
    ]);

    try {
      // Build history for context (excluding current message)
      const history = messages.map(m => ({
        role: m.role,
        text: m.text
      }));

      // 3. Call Service
      const stream = await streamGeminiResponse(text, images, history, config);

      // 4. Consume Stream
      let fullText = '';
      for await (const chunk of stream) {
        const chunkText = chunk.text || '';
        fullText += chunkText;
        
        setMessages(prev => prev.map(msg => 
          msg.id === botMsgId 
            ? { ...msg, text: fullText }
            : msg
        ));
      }

    } catch (error) {
      console.error("Streaming error:", error);
      setMessages(prev => prev.map(msg => 
        msg.id === botMsgId 
          ? { ...msg, text: "Sorry, something went wrong. Please try again. Make sure your API Key is set.", isError: true }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 transition-colors duration-200 font-sans">
      
      {/* Header */}
      <header className="flex-shrink-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 md:px-6 shadow-sm z-30">
        <div className="flex items-center gap-2 text-gemini-600 dark:text-gemini-400">
          <Sparkles className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-gemini-600 to-indigo-600 bg-clip-text text-transparent">
            Gemini Ultra
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleClearChat}
            className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            title="Clear Chat"
          >
            <Trash2 size={20} />
          </button>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-gray-500 hover:text-gemini-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center min-h-[50vh] text-center opacity-60">
                 <div className="w-24 h-24 bg-gradient-to-br from-gemini-100 to-indigo-100 dark:from-gemini-900 dark:to-indigo-900 rounded-full flex items-center justify-center mb-6">
                    <Sparkles className="w-12 h-12 text-gemini-500" />
                 </div>
                 <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Welcome to Gemini Ultra</h2>
                 <p className="text-gray-500 dark:text-gray-400 max-w-md">
                   Experience the power of Google's latest AI models. Upload images to ask questions about them, or just chat.
                 </p>
              </div>
            ) : (
              messages.map(msg => (
                <ChatMessageItem key={msg.id} message={msg} />
              ))
            )}
            {isLoading && messages[messages.length-1]?.role === Role.USER && (
               <div className="flex w-full mb-6 justify-start animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gemini-200 dark:bg-gemini-900"></div>
                    <div className="h-10 w-24 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
                  </div>
               </div>
            )}
            <div ref={scrollBottomRef} />
          </div>
        </div>

        {/* Input Area (Sticky Bottom) */}
        <div className="flex-shrink-0 bg-gradient-to-t from-white via-white to-transparent dark:from-gray-900 dark:via-gray-900 pt-10">
          <InputArea onSend={handleSend} isLoading={isLoading} />
        </div>

      </main>

      {/* Settings Sidebar */}
      <SettingsPanel 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        setConfig={setConfig}
      />

    </div>
  );
};

// --- Render ---
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);