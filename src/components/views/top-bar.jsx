import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { navigate } from '@/components/app-shell';

export default function TopBar({ quiz }) {
  return (
    <header className="h-14 border-b bg-background">
      <div className="mx-auto flex h-full max-w-[1200px] items-center gap-3 px-4">
        <button onClick={() => navigate('/')} className="text-[15px] font-semibold tracking-[-0.01em]">
          QuizPilot
        </button>
        {quiz && (
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1">
              <ChevronLeft className="size-4" aria-hidden="true" /> Quizzes
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="max-w-[40ch] truncate text-[15px]">{quiz.title}</span>
            <Badge variant={quiz.status === 'published' ? 'default' : 'secondary'}>
              {quiz.status === 'published' ? 'Published' : 'Draft'}
            </Badge>
          </>
        )}
        <div className="ml-auto">
          <Button variant="ghost" onClick={() => navigate('/play')}>
            Join a game
          </Button>
        </div>
      </div>
    </header>
  );
}
