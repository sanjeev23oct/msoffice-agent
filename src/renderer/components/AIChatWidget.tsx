import { useState, useRef, useEffect } from 'react';
import './AIChatWidget.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '👋 Hi! I can help you organize your inbox. Try asking:\n• "Show me urgent emails"\n• "What do I need to do today?"\n• "Summarize my emails"',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.response.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: "Sorry, I'm having trouble right now. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button className="ai-chat-button" onClick={() => setIsOpen(true)} title="AI Assistant">
          💬
        </button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div className="ai-chat-widget">
          <div className="ai-chat-header">
            <div>
              <span className="ai-chat-icon">🤖</span>
              <span className="ai-chat-title">AI Assistant</span>
            </div>
            <button className="ai-chat-close" onClick={() => setIsOpen(false)}>
              ✕
            </button>
          </div>

          <div className="ai-chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`ai-chat-message ai-chat-message-${msg.role}`}>
                <div className="ai-chat-message-content">{msg.content}</div>
                <div className="ai-chat-message-time">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="ai-chat-message ai-chat-message-assistant">
                <div className="ai-chat-message-content">
                  <span className="ai-chat-typing">●●●</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-chat-input-container">
            <input
              type="text"
              className="ai-chat-input"
              placeholder="Ask me anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            <button
              className="ai-chat-send"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
