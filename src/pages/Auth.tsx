import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Sparkles, Brain, MessageSquare, Layers, Zap } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const nameSchema = z.string().min(2, 'Name must be at least 2 characters');

const features = [
  { icon: Brain, label: 'AI Quizzes', description: 'Auto-generated from your content' },
  { icon: MessageSquare, label: 'Smart Chat', description: 'Ask anything about your material' },
  { icon: Layers, label: 'Flashcards', description: 'Spaced repetition learning' },
  { icon: Zap, label: 'Summaries', description: 'Key concepts at a glance' },
];

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ title: 'Validation Error', description: err.errors[0].message, variant: 'destructive' });
        return;
      }
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast({ title: 'Sign In Failed', description: error.message, variant: 'destructive' });
    } else {
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      nameSchema.parse(name);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ title: 'Validation Error', description: err.errors[0].message, variant: 'destructive' });
        return;
      }
    }

    setLoading(true);
    const { error } = await signUp(email, password, name);
    setLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({ title: 'Account Exists', description: 'This email is already registered. Please sign in.', variant: 'destructive' });
      } else {
        toast({ title: 'Sign Up Failed', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Welcome!', description: 'Account created successfully.' });
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex bg-background overflow-hidden">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative gradient-mesh">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        
        {/* Floating decorations */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-32 right-20 w-64 h-64 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-primary/10 rounded-full blur-2xl animate-pulse-slow" />
        
        <div className="relative z-10 flex flex-col justify-center px-16 max-w-2xl">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-12 animate-fade-in">
            <div className="p-4 icon-box-primary rounded-2xl shadow-glow animate-pulse-glow">
              <BookOpen className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold text-foreground">
                Course<span className="text-gradient">Whiz</span>
              </h1>
              <p className="text-muted-foreground">AI-Powered Study Companion</p>
            </div>
          </div>

          {/* Tagline */}
          <div className="mb-12 animate-fade-in-up stagger-1">
            <h2 className="text-3xl font-display font-semibold text-foreground leading-tight mb-4">
              Transform your study materials into 
              <span className="text-gradient"> interactive learning experiences</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Upload any content and let AI create quizzes, flashcards, summaries, and answer your questions in real-time.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div 
                key={feature.label}
                className="glass-card rounded-xl p-4 animate-fade-in-up"
                style={{ animationDelay: `${0.2 + index * 0.1}s` }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{feature.label}</p>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
        {/* Mobile decorations */}
        <div className="absolute top-10 right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl lg:hidden" />
        <div className="absolute bottom-10 left-10 w-24 h-24 bg-accent/10 rounded-full blur-2xl lg:hidden" />
        
        <Card className="w-full max-w-md glass-card-elevated animate-scale-in relative z-10">
          <CardHeader className="text-center space-y-4 pb-2">
            {/* Mobile Logo */}
            <div className="flex justify-center lg:hidden">
              <div className="p-3 icon-box-primary rounded-2xl">
                <BookOpen className="h-8 w-8" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-display flex items-center justify-center gap-2">
                <span className="lg:hidden">CourseWhiz</span>
                <span className="hidden lg:inline">Welcome Back</span>
                <Sparkles className="h-5 w-5 text-primary" />
              </CardTitle>
              <CardDescription className="mt-2">
                Sign in to continue your learning journey
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="pt-4">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
                <TabsTrigger value="signin" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Sign Up
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="animate-fade-in">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 bg-background/50"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-sm font-medium">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 bg-background/50"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-11 gradient-primary text-primary-foreground font-medium shadow-soft hover:shadow-glow transition-all duration-300" 
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="animate-fade-in">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-sm font-medium">Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11 bg-background/50"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 bg-background/50"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 bg-background/50"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-11 gradient-primary text-primary-foreground font-medium shadow-soft hover:shadow-glow transition-all duration-300" 
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Creating account...
                      </span>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-border/50 text-center">
              <p className="text-xs text-muted-foreground">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
