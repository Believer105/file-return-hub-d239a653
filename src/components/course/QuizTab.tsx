import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

interface Question {
  id: string;
  type: 'mcq' | 'short';
  question: string;
  options?: string[];
  correctAnswer?: number;
  expectedAnswer?: string;
  sourceChunkIndex: number;
}

interface Quiz {
  quizId: string;
  dbId?: string;
  questions: Question[];
}

interface QuizResult {
  questionId: string;
  score: number;
  feedback: string;
  correct?: boolean;
}

interface QuizTabProps {
  courseId: string;
}

export default function QuizTab({ courseId }: QuizTabProps) {
  const { toast } = useToast();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<QuizResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [difficulty, setDifficulty] = useState('medium');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const generateQuiz = async () => {
    setGenerating(true);
    setQuiz(null);
    setAnswers({});
    setResults([]);
    setCurrentQuestion(0);
    setSubmitted(false);

    try {
      const response = await supabase.functions.invoke('generate-quiz', {
        body: { courseId, difficulty }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setQuiz(response.data);
      toast({ title: 'Quiz Generated!', description: '5 questions ready. Good luck!' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate quiz';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const submitQuiz = async () => {
    if (!quiz) return;
    
    setSubmitting(true);
    const resultsArray: QuizResult[] = [];

    try {
      for (const question of quiz.questions) {
        const userAnswer = answers[question.id] || '';
        
        if (question.type === 'mcq') {
          const correct = parseInt(userAnswer) === question.correctAnswer;
          resultsArray.push({
            questionId: question.id,
            score: correct ? 10 : 0,
            feedback: correct ? 'Correct!' : `Incorrect. The correct answer was: ${question.options?.[question.correctAnswer || 0]}`,
            correct
          });
        } else {
          // Grade short answer via AI
          const response = await supabase.functions.invoke('grade-answer', {
            body: {
              courseId,
              question: question.question,
              userAnswer,
              sourceChunkIndex: question.sourceChunkIndex,
              expectedAnswer: question.expectedAnswer
            }
          });

          if (response.error) {
            resultsArray.push({
              questionId: question.id,
              score: 0,
              feedback: 'Failed to grade answer'
            });
          } else {
            resultsArray.push({
              questionId: question.id,
              score: response.data.score,
              feedback: response.data.feedback
            });
          }
        }
      }

      setResults(resultsArray);
      setSubmitted(true);
      
      const totalScore = resultsArray.reduce((sum, r) => sum + r.score, 0);
      const maxScore = quiz.questions.length * 10;
      toast({ 
        title: 'Quiz Completed!', 
        description: `You scored ${totalScore}/${maxScore}` 
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit quiz';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getResultForQuestion = (questionId: string) => {
    return results.find(r => r.questionId === questionId);
  };

  if (!quiz) {
    return (
      <Card className="glass-card max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <h3 className="text-xl font-display font-semibold mb-2">Generate a Quiz</h3>
            <p className="text-muted-foreground">
              Test your knowledge with AI-generated questions based on your course material
            </p>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <Label htmlFor="difficulty">Difficulty:</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={generateQuiz} disabled={generating} className="gradient-primary">
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Quiz
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const question = quiz.questions[currentQuestion];
  const result = getResultForQuestion(question.id);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Question {currentQuestion + 1} of {quiz.questions.length}
          </span>
          {submitted && (
            <span className="text-sm font-medium">
              Score: {results.reduce((sum, r) => sum + r.score, 0)}/{quiz.questions.length * 10}
            </span>
          )}
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full gradient-primary transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
          />
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium px-2 py-1 rounded ${
              question.type === 'mcq' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
            }`}>
              {question.type === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
            </span>
            {result && (
              <div className="flex items-center gap-2">
                {(result.correct || result.score >= 7) ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="font-medium">{result.score}/10</span>
              </div>
            )}
          </div>
          <CardTitle className="font-display text-lg mt-3">{question.question}</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {question.type === 'mcq' ? (
            <RadioGroup
              value={answers[question.id] || ''}
              onValueChange={(value) => setAnswers(prev => ({ ...prev, [question.id]: value }))}
              disabled={submitted}
            >
              {question.options?.map((option, i) => (
                <div key={i} className={`flex items-center space-x-3 p-3 rounded-lg border ${
                  submitted && i === question.correctAnswer 
                    ? 'border-green-500 bg-green-500/10' 
                    : submitted && answers[question.id] === i.toString() && i !== question.correctAnswer
                    ? 'border-destructive bg-destructive/10'
                    : 'border-border hover:border-primary/50'
                }`}>
                  <RadioGroupItem value={i.toString()} id={`${question.id}-${i}`} />
                  <Label htmlFor={`${question.id}-${i}`} className="cursor-pointer flex-1">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <Textarea
              value={answers[question.id] || ''}
              onChange={(e) => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
              placeholder="Type your answer here..."
              className="min-h-[120px]"
              disabled={submitted}
            />
          )}

          {/* Feedback */}
          {result && (
            <div className={`p-4 rounded-lg ${
              result.score >= 7 ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'
            }`}>
              <p className="text-sm">{result.feedback}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestion(prev => prev - 1)}
              disabled={currentQuestion === 0}
            >
              Previous
            </Button>
            
            {currentQuestion < quiz.questions.length - 1 ? (
              <Button onClick={() => setCurrentQuestion(prev => prev + 1)}>
                Next
              </Button>
            ) : !submitted ? (
              <Button 
                onClick={submitQuiz} 
                disabled={submitting}
                className="gradient-primary"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Grading...
                  </>
                ) : (
                  'Submit Quiz'
                )}
              </Button>
            ) : (
              <Button onClick={() => { setQuiz(null); }} variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                New Quiz
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Question Dots */}
      <div className="flex justify-center gap-2 mt-6">
        {quiz.questions.map((q, i) => {
          const qResult = getResultForQuestion(q.id);
          return (
            <button
              key={q.id}
              onClick={() => setCurrentQuestion(i)}
              className={`w-3 h-3 rounded-full transition-all ${
                i === currentQuestion 
                  ? 'bg-primary scale-125' 
                  : qResult 
                    ? qResult.score >= 7 ? 'bg-green-500' : 'bg-amber-500'
                    : answers[q.id] ? 'bg-muted-foreground' : 'bg-muted'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
