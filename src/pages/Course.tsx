import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
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

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-display font-semibold">{course.name}</h1>
            <p className="text-sm text-muted-foreground">
              Created {new Date(course.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="study" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="study">Study</TabsTrigger>
            <TabsTrigger value="quiz">Quiz</TabsTrigger>
            <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          
          <TabsContent value="study" className="animate-fade-in">
            <ChatTab courseId={course.id} />
          </TabsContent>
          
          <TabsContent value="quiz" className="animate-fade-in">
            <QuizTab courseId={course.id} />
          </TabsContent>
          
          <TabsContent value="flashcards" className="animate-fade-in">
            <FlashcardsTab courseId={course.id} />
          </TabsContent>
          
          <TabsContent value="summary" className="animate-fade-in">
            <SummaryTab courseId={course.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
