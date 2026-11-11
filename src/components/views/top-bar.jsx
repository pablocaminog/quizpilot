import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { navigate } from '@/components/app-shell';

export default function TopBar({ quiz }) {
  return (
    <header className="h-14 border-b">
      <div className="mx-auto grid h-full max-w-[720px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-6">
        <div className="flex items-center gap-1">
          {quiz && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="All quizzes" className="-ml-3">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
          )}
          <button onClick={() => navigate('/')} className="text-[15px] font-semibold tracking-[-0.01em]">
            QuizPilot
          </button>
        </div>
        <div className="flex min-w-0 items-center justify-center gap-2.5">
          {quiz && (
            <>
              <span className="max-w-[280px] truncate text-[15px] font-medium">{quiz.title}</span>
              <Badge variant={quiz.status === 'published' ? 'default' : 'secondary'}>
                {quiz.status === 'published' ? 'Published' : 'Draft'}
              </Badge>
            </>
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" className="-mr-5" onClick={() => navigate('/play')}>
            Join a game
          </Button>
        </div>
      </div>
    </header>
  );
}
