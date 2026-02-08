import type { ReportPayload, ReportResponse } from './widget-types';

export async function submitReport(
  apiUrl: string,
  sdkKey: string,
  payload: ReportPayload,
  timeout = 60000,
): Promise<ReportResponse> {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('description', payload.description);
  formData.append('userContext', JSON.stringify(payload.userContext));

  if (payload.videoBlob) {
    const ext = payload.videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    formData.append('video', payload.videoBlob, `recording_${Date.now()}.${ext}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${apiUrl}/api/sdk/tickets/report`, {
      method: 'POST',
      headers: { 'x-sdk-key': sdkKey },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errText || response.statusText}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Report submission timed out');
    }
    throw error;
  }
}
