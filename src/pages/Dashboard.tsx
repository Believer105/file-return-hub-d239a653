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
import { 
  BookOpen, Plus, LogOut, Sparkles, Clock, FileText, Loader2, 
  Brain, MessageSquare, Layers, TrendingUp, Search, MoreHorizontal 
} from 'lucide-react';

interface Course {
  id: string;
  name: string;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseContent, setNewCourseContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredCourses = courses.filter(course => 
    course.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = [
    { label: 'Total Courses', value: courses.length, icon: BookOpen, color: 'text-primary' },
    { label: 'Quizzes Taken', value: 0, icon: Brain, color: 'text-accent' },
    { label: 'Flashcards', value: 0, icon: Layers, color: 'text-warning' },
    { label: 'Study Hours', value: 0, icon: TrendingUp, color: 'text-success' },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background gradient-mesh">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="p-4 icon-box-primary rounded-2xl animate-pulse-glow">
            <BookOpen className="h-8 w-8" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 icon-box-primary rounded-xl shadow-soft">
              <BookOpen className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-display font-bold">
              Course<span className="text-gradient">Whiz</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-medium">
                {user?.email?.[0].toUpperCase()}
              </div>
              <span className="text-muted-foreground">{user?.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in">
          <h2 className="text-3xl font-display font-bold text-foreground">
            Welcome back! 👋
          </h2>
          <p className="text-muted-foreground mt-1">
            Ready to continue your learning journey?
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => (
            <Card 
              key={stat.label} 
              className="glass-card border-border/50 animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-muted/50 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Course Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-display font-semibold">My Courses</h3>
            <p className="text-sm text-muted-foreground">Create and study from your uploaded materials</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px] bg-background/50"
              />
            </div>

            {/* New Course Button */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-primary-foreground shadow-soft hover:shadow-glow transition-all duration-300">
                  <Plus className="h-4 w-4 mr-2" />
                  New Course
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl glass-card-elevated">
                <DialogHeader>
                  <DialogTitle className="font-display text-xl flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Create New Course
                  </DialogTitle>
                  <DialogDescription>
                    Paste your study material below. The AI will process it for quizzes, flashcards, and chat.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="course-name" className="font-medium">Course Name</Label>
                    <Input
                      id="course-name"
                      placeholder="e.g., History 101, Physics Chapter 3"
                      value={newCourseName}
                      onChange={(e) => setNewCourseName(e.target.value)}
                      className="h-11 bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="course-content" className="font-medium">Study Material</Label>
                    <Textarea
                      id="course-content"
                      placeholder="Paste your notes, textbook content, or any study material here..."
                      className="min-h-[280px] font-mono text-sm bg-background/50 resize-none"
                      value={newCourseContent}
                      onChange={(e) => setNewCourseContent(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Tip: Paste clear, well-structured text for best results
                    </p>
                  </div>
                  <Button 
                    onClick={handleCreateCourse} 
                    disabled={creating} 
                    className="w-full h-12 gradient-primary text-primary-foreground font-medium shadow-soft hover:shadow-glow transition-all duration-300"
                  >
                    {creating ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing with AI...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Create Course
                      </span>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Course Grid */}
        {filteredCourses.length === 0 ? (
          <Card className="glass-card text-center py-16 animate-fade-in">
            <CardContent className="space-y-6">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-display font-semibold">
                  {searchQuery ? 'No courses found' : 'No courses yet'}
                </h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  {searchQuery 
                    ? 'Try adjusting your search query' 
                    : 'Create your first course to start studying with AI-powered tools'}
                </p>
              </div>
              {!searchQuery && (
                <Button 
                  onClick={() => setCreateOpen(true)} 
                  className="gradient-primary text-primary-foreground shadow-soft hover:shadow-glow transition-all duration-300"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Course
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course, index) => (
              <Card 
                key={course.id} 
                className="glass-card hover-lift cursor-pointer group border-border/50 overflow-hidden animate-fade-in-up"
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => navigate(`/course/${course.id}`)}
              >
                {/* Gradient top border */}
                <div className="h-1 gradient-primary" />
                
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <CardTitle className="font-display text-lg mt-4 group-hover:text-primary transition-colors">
                    {course.name}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Clock className="h-3 w-3" />
                    Created {new Date(course.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Features Pills */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="stat-badge">
                      <Brain className="h-3 w-3" />
                      Quiz
                    </span>
                    <span className="stat-badge">
                      <MessageSquare className="h-3 w-3" />
                      Chat
                    </span>
                    <span className="stat-badge">
                      <Layers className="h-3 w-3" />
                      Cards
                    </span>
                  </div>

                  <Button 
                    variant="secondary" 
                    className="w-full bg-secondary/50 hover:bg-secondary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300"
                  >
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
