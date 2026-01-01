import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, MessageSquare, Brain, Layers, FileText, BookOpen, Sparkles } from 'lucide-react';
import ChatTab from '@/components/course/ChatTab';
import QuizTab from '@/components/course/QuizTab';
import FlashcardsTab from '@/components/course/FlashcardsTab';
import SummaryTab from '@/components/course/SummaryTab';

interface Course {
  id: string;
  name: string;
  raw_text: string;
  created_at: string;
}

const tabs = [
  { value: 'study', label: 'Study', icon: MessageSquare, description: 'Ask AI questions' },
  { value: 'quiz', label: 'Quiz', icon: Brain, description: 'Test your knowledge' },
  { value: 'flashcards', label: 'Flashcards', icon: Layers, description: 'Review cards' },
  { value: 'summary', label: 'Summary', icon: FileText, description: 'Key concepts' },
];

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('study');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchCourse();
    }
  }, [user, id]);

  const fetchCourse = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      toast({ title: 'Error', description: 'Course not found', variant: 'destructive' });
      navigate('/');
    } else {
      setCourse(data);
    }
    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background gradient-mesh">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="p-4 icon-box-primary rounded-2xl animate-pulse-glow">
            <BookOpen className="h-8 w-8" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <div className="h-6 w-px bg-border" />
            
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold flex items-center gap-2">
                  {course.name}
                  <Sparkles className="h-4 w-4 text-primary" />
                </h1>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(course.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Custom Tab Navigation */}
          <div className="mb-8">
            <TabsList className="inline-flex h-auto p-1.5 bg-muted/50 rounded-2xl gap-1">
              {tabs.map((tab) => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200"
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="font-medium">{tab.label}</span>
                  <span className="hidden sm:inline text-xs text-muted-foreground data-[state=active]:text-primary/70">
                    {tab.description}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          
          <TabsContent value="study" className="animate-fade-in mt-0">
            <ChatTab courseId={course.id} />
          </TabsContent>
          
          <TabsContent value="quiz" className="animate-fade-in mt-0">
            <QuizTab courseId={course.id} />
          </TabsContent>
          
          <TabsContent value="flashcards" className="animate-fade-in mt-0">
            <FlashcardsTab courseId={course.id} />
          </TabsContent>
          
          <TabsContent value="summary" className="animate-fade-in mt-0">
            <SummaryTab courseId={course.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
