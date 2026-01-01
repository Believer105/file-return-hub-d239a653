import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Plus, LogOut, Sparkles, Clock, FileText, Loader2 } from 'lucide-react';

interface Course {
  id: string;
  name: string;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, session, signOut, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseContent, setNewCourseContent] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCourses();
    }
  }, [user]);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'Failed to load courses', variant: 'destructive' });
    } else {
      setCourses(data || []);
    }
    setLoading(false);
  };

  const handleCreateCourse = async () => {
    if (!newCourseName.trim() || !newCourseContent.trim()) {
      toast({ title: 'Missing Fields', description: 'Please provide both name and content', variant: 'destructive' });
      return;
    }

    setCreating(true);
    
    try {
      const response = await supabase.functions.invoke('create-course', {
        body: { name: newCourseName, content: newCourseContent }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({ title: 'Course Created!', description: `${newCourseName} is ready for studying.` });
      setCreateOpen(false);
      setNewCourseName('');
      setNewCourseContent('');
      fetchCourses();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create course';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 gradient-primary rounded-xl">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-display font-semibold">CourseWhiz</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-display font-bold">My Courses</h2>
            <p className="text-muted-foreground mt-1">Create and study from your uploaded materials</p>
          </div>
          
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary hover-lift">
                <Plus className="h-4 w-4 mr-2" />
                New Course
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-display">Create New Course</DialogTitle>
                <DialogDescription>
                  Paste your study material below. The AI will process it for quizzes, flashcards, and chat.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="course-name">Course Name</Label>
                  <Input
                    id="course-name"
                    placeholder="e.g., History 101, Physics Chapter 3"
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course-content">Study Material</Label>
                  <Textarea
                    id="course-content"
                    placeholder="Paste your notes, textbook content, or any study material here..."
                    className="min-h-[300px] font-mono text-sm"
                    value={newCourseContent}
                    onChange={(e) => setNewCourseContent(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: Paste clear, well-structured text for best results
                  </p>
                </div>
                <Button 
                  onClick={handleCreateCourse} 
                  disabled={creating} 
                  className="w-full gradient-primary"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Create Course
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Course Grid */}
        {courses.length === 0 ? (
          <Card className="glass-card text-center py-16">
            <CardContent className="space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No courses yet</h3>
                <p className="text-muted-foreground">Create your first course to start studying</p>
              </div>
              <Button onClick={() => setCreateOpen(true)} className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Course
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card 
                key={course.id} 
                className="glass-card hover-lift cursor-pointer group"
                onClick={() => navigate(`/course/${course.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-2 gradient-secondary rounded-lg">
                      <BookOpen className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <Sparkles className="h-4 w-4 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="font-display mt-4">{course.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(course.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" className="w-full">
                    Open Course
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
