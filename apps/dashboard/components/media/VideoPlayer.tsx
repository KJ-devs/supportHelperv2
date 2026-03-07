/**
 * Video Player Component
 * Lecteur vidéo avec contrôles pour les médias
 */

'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  mimeType?: string;
  onError?: (error: Error) => void;
}

export function VideoPlayer({ src, poster, title, mimeType, onError }: VideoPlayerProps) {
  const t = useTranslations('video');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const handlePlayPause = async () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await videoRef.current.play();
        setIsPlaying(true);
        setError(null); // Clear any previous errors on successful play
      } catch (err) {
        console.error('Video playback failed:', err);
        setError(t('errorNotSupported'));
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const vol = parseFloat(e.target.value);
    videoRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;

    if (!isFullscreen) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const changePlaybackRate = () => {
    if (!videoRef.current) return;
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const newRate = rates[nextIndex] || 1;
    videoRef.current.playbackRate = newRate;
    setPlaybackRate(newRate);
  };

  const getExtension = (mime?: string) => {
    if (mime?.includes('mp4')) return '.mp4';
    if (mime?.includes('quicktime')) return '.mov';
    return '.webm';
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    const extension = getExtension(mimeType);
    a.download = title ? title.replace(/\.[^/.]+$/, '') + extension : `video${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const videoElement = e.currentTarget;
    const mediaError = videoElement.error;

    let errorMessage = t('errorUnknown');

    if (mediaError) {
      switch (mediaError.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = t('errorAborted');
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = t('errorNetwork');
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = t('errorDecode');
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = t('errorNotSupported');
          break;
        default:
          errorMessage = t('errorUnknown');
      }
    }

    setError(errorMessage);
    setIsPlaying(false);
    console.error(
      'Video error:',
      errorMessage,
      mediaError ? { code: mediaError.code, message: mediaError.message } : 'No media error details'
    );

    if (onError) {
      onError(new Error(errorMessage));
    }
  };

  return (
    <div className="bg-black rounded-lg overflow-hidden">
      {/* Video Element */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          poster={poster}
          className="w-full h-full"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={handleError}
          onLoadStart={() => setError(null)} // Clear errors when new video loads
        >
          <source src={src} type={mimeType || 'video/webm'} />
          Your browser does not support video playback.
        </video>

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
            <div className="text-center px-6 py-4 max-w-md">
              <svg
                className="w-12 h-12 text-red-500 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-white text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Play/Pause Overlay */}
        {!isPlaying && !error && (
          <button
            onClick={handlePlayPause}
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-40 transition-opacity"
          >
            <div className="w-20 h-20 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-black ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </div>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 text-white p-4 space-y-3">
        {/* Progress Bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100}%, #374151 ${(currentTime / duration) * 100}%, #374151 100%)`,
            }}
          />
          <span className="text-xs font-mono">{formatTime(duration)}</span>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              className="p-2 hover:bg-gray-800 rounded transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 4a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1zm8 0a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-2 hover:bg-gray-800 rounded transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Playback Rate */}
            <button
              onClick={changePlaybackRate}
              className="px-2 py-1 text-xs font-medium hover:bg-gray-800 rounded transition-colors"
              title="Vitesse de lecture"
            >
              {playbackRate}x
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Download */}
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-gray-800 rounded transition-colors"
              title={t('download')}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" />
              </svg>
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-gray-800 rounded transition-colors"
              title="Plein écran"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
