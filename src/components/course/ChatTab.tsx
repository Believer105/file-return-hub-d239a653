import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, MessageSquare, BookOpen } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ chunkIndex: number; excerpt: string }>;
}

interface ChatTabProps {
  courseId: string;
}

export default function ChatTab({ courseId }: ChatTabProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await supabase.functions.invoke('chat', {
        body: { courseId, question: userMessage }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.answer,
        sources: data.sources
      }]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to get response';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 gradient-secondary rounded-lg">
              <MessageSquare className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <h3 className="font-display font-semibold">Chat with Your Material</h3>
              <p className="text-sm text-muted-foreground">Ask questions about your uploaded content</p>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-4 mb-6 min-h-[400px] max-h-[500px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Start asking questions about your course material</p>
                <p className="text-sm mt-2">e.g., "What are the main concepts covered?"</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user' 
                        ? 'gradient-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/20">
                        <p className="text-xs font-medium mb-2 opacity-75">Sources:</p>
                        {msg.sources.map((source, j) => (
                          <p key={j} className="text-xs opacity-60 mb-1">
                            [Chunk {source.chunkIndex}]: {source.excerpt.substring(0, 100)}...
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask a question about your material..."
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={loading || !input.trim()} className="gradient-primary">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
