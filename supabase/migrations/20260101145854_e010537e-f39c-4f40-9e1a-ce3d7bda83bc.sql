-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chunks table for storing text chunks
CREATE TABLE public.chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  token_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quizzes table
CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  quiz_json JSONB NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quiz_attempts table
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  score NUMERIC,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create flashcards table
CREATE TABLE public.flashcards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create summaries table
CREATE TABLE public.summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  summary_json JSONB NOT NULL,
  length TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Courses policies
CREATE POLICY "Users can view their own courses" ON public.courses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own courses" ON public.courses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own courses" ON public.courses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own courses" ON public.courses FOR DELETE USING (auth.uid() = user_id);

-- Chunks policies (accessible via course ownership)
CREATE POLICY "Users can view chunks of their courses" ON public.chunks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = chunks.course_id AND courses.user_id = auth.uid())
);
CREATE POLICY "Users can create chunks for their courses" ON public.chunks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = chunks.course_id AND courses.user_id = auth.uid())
);
CREATE POLICY "Users can delete chunks of their courses" ON public.chunks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = chunks.course_id AND courses.user_id = auth.uid())
);

-- Quizzes policies
CREATE POLICY "Users can view quizzes of their courses" ON public.quizzes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = quizzes.course_id AND courses.user_id = auth.uid())
);
CREATE POLICY "Users can create quizzes for their courses" ON public.quizzes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = quizzes.course_id AND courses.user_id = auth.uid())
);

-- Quiz attempts policies
CREATE POLICY "Users can view their own quiz attempts" ON public.quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own quiz attempts" ON public.quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Flashcards policies
CREATE POLICY "Users can view flashcards of their courses" ON public.flashcards FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = flashcards.course_id AND courses.user_id = auth.uid())
);
CREATE POLICY "Users can create flashcards for their courses" ON public.flashcards FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = flashcards.course_id AND courses.user_id = auth.uid())
);
CREATE POLICY "Users can delete flashcards of their courses" ON public.flashcards FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = flashcards.course_id AND courses.user_id = auth.uid())
);

-- Summaries policies
CREATE POLICY "Users can view summaries of their courses" ON public.summaries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = summaries.course_id AND courses.user_id = auth.uid())
);
CREATE POLICY "Users can create summaries for their courses" ON public.summaries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = summaries.course_id AND courses.user_id = auth.uid())
);

-- Create function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (new.id, new.raw_user_meta_data ->> 'name', new.email);
  RETURN new;
END;
$$;

-- Trigger for auto-creating profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_courses_user_id ON public.courses(user_id);
CREATE INDEX idx_chunks_course_id ON public.chunks(course_id);
CREATE INDEX idx_chunks_course_chunk ON public.chunks(course_id, chunk_index);
CREATE INDEX idx_quizzes_course_id ON public.quizzes(course_id);
CREATE INDEX idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX idx_flashcards_course_id ON public.flashcards(course_id);
CREATE INDEX idx_summaries_course_id ON public.summaries(course_id);