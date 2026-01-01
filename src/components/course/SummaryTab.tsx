import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Lightbulb, ListChecks, BookOpen, RotateCcw } from 'lucide-react';

interface Summary {
  coreConcepts: string[];
  keyFacts: string[];
  actionSteps: string[];
}

interface SummaryTabProps {
  courseId: string;
}

export default function SummaryTab({ courseId }: SummaryTabProps) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [length, setLength] = useState('medium');

  useEffect(() => {
    fetchSummary();
  }, [courseId]);

  const fetchSummary = async () => {
    const { data, error } = await supabase
      .from('summaries')
      .select('summary_json')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.summary_json) {
      setSummary(data.summary_json as unknown as Summary);
    }
    setLoading(false);
  };

  const generateSummary = async () => {
    setGenerating(true);

    try {
      const response = await supabase.functions.invoke('generate-summary', {
        body: { courseId, length }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setSummary(response.data);
      toast({ title: 'Summary Generated!', description: 'Your cheat sheet is ready.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate summary';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!summary) {
    return (
      <Card className="glass-card max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <h3 className="text-xl font-display font-semibold mb-2">Generate Summary</h3>
            <p className="text-muted-foreground">
              Create a cheat sheet with core concepts, key facts, and action steps
            </p>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <Label htmlFor="length">Detail Level:</Label>
              <Select value={length} onValueChange={setLength}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Brief</SelectItem>
                  <SelectItem value="medium">Standard</SelectItem>
                  <SelectItem value="long">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={generateSummary} disabled={generating} className="gradient-primary">
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Summary
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-display font-semibold">Course Cheat Sheet</h3>
        <Button variant="outline" size="sm" onClick={generateSummary} disabled={generating}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Regenerate
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Core Concepts */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 gradient-primary rounded-lg">
                <BookOpen className="h-4 w-4 text-primary-foreground" />
              </div>
              <CardTitle className="text-base font-display">Core Concepts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {summary.coreConcepts.map((concept, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary font-bold text-sm mt-0.5">{i + 1}.</span>
                  <span className="text-sm">{concept}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Key Facts */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 gradient-secondary rounded-lg">
                <Lightbulb className="h-4 w-4 text-accent-foreground" />
              </div>
              <CardTitle className="text-base font-display">Key Facts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {summary.keyFacts.map((fact, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-accent font-bold text-sm mt-0.5">•</span>
                  <span className="text-sm">{fact}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Action Steps */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 gradient-accent rounded-lg">
                <ListChecks className="h-4 w-4 text-accent-foreground" />
              </div>
              <CardTitle className="text-base font-display">Action Steps</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {summary.actionSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-orange-500 font-bold text-sm mt-0.5">→</span>
                  <span className="text-sm">{step}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
