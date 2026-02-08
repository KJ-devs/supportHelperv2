'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Play,
  Pause,
  Maximize2,
  Download,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Eye,
  MousePointer,
  AlertTriangle,
  Globe,
  Terminal,
  Type,
} from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import type { VideoRecording, VideoEvent } from '@/types/ticket';

interface VideoPlayerProps {
  video: VideoRecording;
  onEventClick?: (event: VideoEvent) => void;
}

const eventTypeIcons: Record<VideoEvent['type'], typeof MousePointer> = {
  click: MousePointer,
  scroll: Eye,
  input: Type,
  navigation: Globe,
  error: AlertTriangle,
  network: Globe,
  console: Terminal,
};

const eventTypeColors: Record<VideoEvent['type'], string> = {
  click: 'bg-blue-500',
  scroll: 'bg-gray-500',
  input: 'bg-green-500',
  navigation: 'bg-purple-500',
  error: 'bg-red-500',
  network: 'bg-yellow-500',
  console: 'bg-orange-500',
};

export function VideoPlayer({ video, onEventClick }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showOcr, setShowOcr] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredEvent, setHoveredEvent] = useState<VideoEvent | null>(null);

  // Handle video time update
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Handle playback rate changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Handle volume changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }, [isPlaying]);

  const seekTo = useCallback(
    (time: number) => {
      if (!videoRef.current) return;
      videoRef.current.currentTime = Math.max(0, Math.min(time, duration));
      setCurrentTime(videoRef.current.currentTime);
    },
    [duration]
  );

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      seekTo(percent * duration);
    },
    [duration, seekTo]
  );

  const handleEventClick = useCallback(
    (event: VideoEvent) => {
      seekTo(event.timestamp);
      onEventClick?.(event);
    },
    [seekTo, onEventClick]
  );

  const skipBackward = useCallback(() => {
    seekTo(currentTime - 10);
  }, [currentTime, seekTo]);

  const skipForward = useCallback(() => {
    seekTo(currentTime + 10);
  }, [currentTime, seekTo]);

  const toggleFullscreen = useCallback(() => {
    const container = videoRef.current?.parentElement?.parentElement;
    if (!container) return;

    if (!isFullscreen) {
      container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = video.url;
    link.download = `session-recording-${video.id}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [video.id, video.url]);

  // Get current OCR text
  const currentOcrText = showOcr
    ? video.ocrData?.find(ocr => Math.abs(ocr.timestamp - currentTime) < 0.5)?.text
    : null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>Session Recording</span>
            <Badge variant="outline">{formatDuration(duration)}</Badge>
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="ocr-toggle" checked={showOcr} onCheckedChange={setShowOcr} />
              <Label htmlFor="ocr-toggle" className="text-sm">
                Show OCR
              </Label>
            </div>
            <Select
              value={playbackRate.toString()}
              onValueChange={v => setPlaybackRate(parseFloat(v))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="1">1x</SelectItem>
                <SelectItem value="1.5">1.5x</SelectItem>
                <SelectItem value="2">2x</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Container */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            src={video.url}
            poster={video.thumbnailUrl || undefined}
          />

          {/* OCR Overlay */}
          {currentOcrText && (
            <div className="absolute bottom-16 left-4 right-4 p-3 bg-black/80 rounded-lg">
              <p className="text-white text-sm font-mono">{currentOcrText}</p>
            </div>
          )}

          {/* Video Controls Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-16 w-16 rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
            </Button>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:text-white hover:bg-white/20"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:text-white hover:bg-white/20"
                onClick={skipBackward}
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:text-white hover:bg-white/20"
                onClick={skipForward}
              >
                <SkipForward className="h-4 w-4" />
              </Button>

              <span className="text-xs text-white min-w-[80px]">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </span>

              <div className="flex-1" />

              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:text-white hover:bg-white/20"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:text-white hover:bg-white/20"
                onClick={toggleFullscreen}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Timeline with Events */}
        <div className="space-y-2">
          {/* Progress Bar */}
          <div
            ref={progressRef}
            className="relative h-2 bg-muted rounded-full cursor-pointer"
            onClick={handleProgressClick}
          >
            {/* Progress */}
            <div
              className="absolute h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />

            {/* Event Markers */}
            <TooltipProvider>
              {video.events.map(event => {
                const position = (event.timestamp / duration) * 100;
                const Icon = eventTypeIcons[event.type];
                return (
                  <Tooltip key={event.id}>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          'absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm cursor-pointer hover:scale-125 transition-transform z-10',
                          eventTypeColors[event.type]
                        )}
                        style={{ left: `${position}%` }}
                        onClick={e => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                        onMouseEnter={() => setHoveredEvent(event)}
                        onMouseLeave={() => setHoveredEvent(null)}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium capitalize">{event.type}</span>
                        <span className="text-muted-foreground">
                          {formatDuration(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{event.description}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>

          {/* Event Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            {(Object.keys(eventTypeColors) as VideoEvent['type'][]).map(type => {
              const Icon = eventTypeIcons[type];
              const count = video.events.filter(e => e.type === type).length;
              if (count === 0) return null;
              return (
                <div key={type} className="flex items-center gap-1 text-muted-foreground">
                  <div className={cn('w-2 h-2 rounded-full', eventTypeColors[type])} />
                  <Icon className="h-3 w-3" />
                  <span className="capitalize">{type}</span>
                  <span className="text-muted-foreground">({count})</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Events List */}
        {hoveredEvent && (
          <div className="p-3 bg-muted rounded-lg text-sm">
            <div className="flex items-center gap-2 font-medium">
              {(() => {
                const Icon = eventTypeIcons[hoveredEvent.type];
                return <Icon className="h-4 w-4" />;
              })()}
              <span className="capitalize">{hoveredEvent.type}</span>
              <span className="text-muted-foreground">
                at {formatDuration(hoveredEvent.timestamp)}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{hoveredEvent.description}</p>
            {hoveredEvent.metadata && (
              <pre className="mt-2 text-xs bg-background p-2 rounded overflow-x-auto">
                {JSON.stringify(hoveredEvent.metadata, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
