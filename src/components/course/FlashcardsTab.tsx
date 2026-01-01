import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RotateCcw, ChevronLeft, ChevronRight, Sparkles, FlipHorizontal } from 'lucide-react';

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

interface FlashcardsTabProps {
  courseId: string;
}

export default function FlashcardsTab({ courseId }: FlashcardsTabProps) {
  const { toast } = useToast();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    fetchFlashcards();
  }, [courseId]);

  const fetchFlashcards = async () => {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at');

    if (error) {
      toast({ title: 'Error', description: 'Failed to load flashcards', variant: 'destructive' });
    } else {
      setFlashcards(data || []);
    }
    setLoading(false);
  };

  const generateFlashcards = async () => {
    setGenerating(true);

    try {
      const response = await supabase.functions.invoke('generate-flashcards', {
        body: { courseId }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setFlashcards(response.data);
      setCurrentIndex(0);
      setFlipped(false);
      toast({ title: 'Flashcards Generated!', description: `${response.data.length} flashcards created.` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate flashcards';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const nextCard = () => {
    setFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % flashcards.length);
    }, 150);
  };

  const prevCard = () => {
    setFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <Card className="glass-card max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <h3 className="text-xl font-display font-semibold mb-2">Generate Flashcards</h3>
            <p className="text-muted-foreground">
              Create flashcards from key terms and concepts in your course material
            </p>
          </div>
          
          <Button onClick={generateFlashcards} disabled={generating} className="gradient-primary">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Flashcards
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentCard = flashcards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-muted-foreground">
          Card {currentIndex + 1} of {flashcards.length}
        </span>
        <Button variant="outline" size="sm" onClick={generateFlashcards} disabled={generating}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Regenerate
        </Button>
      </div>

      {/* Flashcard */}
      <div 
        className="relative h-[350px] cursor-pointer perspective-1000"
        onClick={() => setFlipped(!flipped)}
      >
        <div 
          className={`absolute inset-0 transition-all duration-500 transform-style-preserve-3d ${
            flipped ? 'rotate-y-180' : ''
          }`}
          style={{ 
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
        >
          {/* Front */}
          <Card 
            className="absolute inset-0 glass-card flex items-center justify-center p-8 backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <CardContent className="text-center">
              <div className="mb-4">
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                  Question
                </span>
              </div>
              <p className="text-xl font-display">{currentCard.front}</p>
              <p className="text-sm text-muted-foreground mt-6 flex items-center justify-center gap-2">
                <FlipHorizontal className="h-4 w-4" />
                Click to reveal answer
              </p>
            </CardContent>
          </Card>

          {/* Back */}
          <Card 
            className="absolute inset-0 glass-card flex items-center justify-center p-8 gradient-secondary"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <CardContent className="text-center">
              <div className="mb-4">
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-background/20 text-accent-foreground">
                  Answer
                </span>
              </div>
              <p className="text-xl font-display text-accent-foreground">{currentCard.back}</p>
              <p className="text-sm text-accent-foreground/70 mt-6 flex items-center justify-center gap-2">
                <FlipHorizontal className="h-4 w-4" />
                Click to see question
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <Button variant="outline" size="icon" onClick={prevCard}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex gap-2">
          {flashcards.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setFlipped(false);
                setCurrentIndex(i);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIndex ? 'bg-primary w-4' : 'bg-muted hover:bg-muted-foreground'
              }`}
            />
          ))}
        </div>
        
        <Button variant="outline" size="icon" onClick={nextCard}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
