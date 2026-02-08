'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, Maximize2 } from 'lucide-react';
import { useState } from 'react';

interface TicketVideoProps {
  ticketId: string;
}

export function TicketVideo({ ticketId }: TicketVideoProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  // Mock - would check if video exists
  const hasVideo = true;

  if (!hasVideo) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Session Recording</span>
          <span className="text-sm font-normal text-muted-foreground">Duration: 2:34</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          {/* Placeholder for video player */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <p className="text-white text-sm">Session recording preview</p>
          </div>

          {/* Video controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:text-white hover:bg-white/20"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>

              {/* Progress bar */}
              <div className="flex-1 h-1 bg-white/30 rounded-full">
                <div className="h-full w-1/3 bg-white rounded-full" />
              </div>

              <span className="text-xs text-white">0:45 / 2:34</span>

              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:text-white hover:bg-white/20"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          This recording shows the user&apos;s session leading up to the issue being reported. Click
          play to review the steps taken.
        </p>
      </CardContent>
    </Card>
  );
}
