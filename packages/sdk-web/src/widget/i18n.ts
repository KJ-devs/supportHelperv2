export type SdkLocale = 'en' | 'fr';

export interface WidgetTranslations {
  fab: {
    tooltip: string;
  };
  modal: {
    closeDialog: string;
  };
  open: {
    title: string;
    message: string;
    startRecording: string;
    takeScreenshot: string;
  };
  recording: {
    paused: string;
    recording: string;
    resume: string;
    pause: string;
    stop: string;
  };
  preview: {
    duration: string;
    size: string;
    recordAgain: string;
    useThisVideo: string;
    previewLabel: string;
  };
  editing: {
    titlePlaceholder: string;
    titleHint: string;
    descriptionPlaceholder: string;
    descriptionHint: string;
    sendReport: string;
    videoAttached: string;
    formLabel: string;
  };
  submitting: {
    sending: string;
  };
  success: {
    title: string;
    message: string;
    aiAnalysis: string;
    severity: string;
    viewTicket: string;
    close: string;
  };
  analyzing: {
    title: string;
    message: string;
    remaining: string;
    almostDone: string;
    timedOutMessage: string;
    closeBackground: string;
  };
  error: {
    title: string;
    tryAgain: string;
    close: string;
    unknownError: string;
  };
  cropping: {
    title: string;
    instructionVideo: string;
    instructionScreenshot: string;
    confirm: string;
    cancel: string;
  };
}

const en: WidgetTranslations = {
  fab: {
    tooltip: 'Report a bug',
  },
  modal: {
    closeDialog: 'Close dialog',
  },
  open: {
    title: 'Record your issue',
    message:
      "Share your screen to capture exactly what went wrong. We'll analyze the video to help resolve your issue faster.",
    startRecording: 'Start Recording',
    takeScreenshot: 'Take Screenshot',
  },
  recording: {
    paused: 'Recording paused',
    recording: 'Recording your screen...',
    resume: 'Resume',
    pause: 'Pause',
    stop: 'Stop',
  },
  preview: {
    duration: 'Duration:',
    size: 'Size:',
    recordAgain: 'Record again',
    useThisVideo: 'Use this video',
    previewLabel: 'Preview of recorded video',
  },
  editing: {
    titlePlaceholder: 'Brief title for your issue...',
    titleHint: 'Enter a brief title describing your issue',
    descriptionPlaceholder: 'Describe what happened...',
    descriptionHint: 'Describe what happened in detail',
    sendReport: 'Send Report',
    videoAttached: 'video attached',
    formLabel: 'Issue report form',
  },
  submitting: {
    sending: 'Sending your report...',
  },
  success: {
    title: 'Report Sent!',
    message:
      'Your issue has been submitted successfully. Our team will analyze it and get back to you.',
    aiAnalysis: 'AI Analysis',
    severity: 'severity',
    viewTicket: 'View ticket',
    close: 'Close',
  },
  analyzing: {
    title: 'Analyzing...',
    message: 'Our AI is reviewing your report. This usually takes less than a minute.',
    remaining: 'Up to {seconds}s remaining',
    almostDone: 'Almost done...',
    timedOutMessage: 'Analysis is in progress. Check your dashboard for results.',
    closeBackground: 'Close (analysis will continue in background)',
  },
  error: {
    title: 'Something went wrong',
    tryAgain: 'Try again',
    close: 'Close',
    unknownError: 'An unknown error occurred.',
  },
  cropping: {
    title: 'Select area',
    instructionVideo: 'Draw a rectangle to select the area you want to record.',
    instructionScreenshot: 'Draw a rectangle to select the area you want to capture.',
    confirm: 'Confirm selection',
    cancel: 'Cancel',
  },
};

const fr: WidgetTranslations = {
  fab: {
    tooltip: 'Signaler un bug',
  },
  modal: {
    closeDialog: 'Fermer la boite de dialogue',
  },
  open: {
    title: 'Enregistrez votre probleme',
    message:
      "Partagez votre ecran pour capturer exactement ce qui s'est passe. Nous analyserons la video pour resoudre votre probleme plus rapidement.",
    startRecording: "Demarrer l'enregistrement",
    takeScreenshot: "Capture d'ecran",
  },
  recording: {
    paused: 'Enregistrement en pause',
    recording: 'Enregistrement de votre ecran...',
    resume: 'Reprendre',
    pause: 'Pause',
    stop: 'Arreter',
  },
  preview: {
    duration: 'Duree :',
    size: 'Taille :',
    recordAgain: 'Reenregistrer',
    useThisVideo: 'Utiliser cette video',
    previewLabel: 'Apercu de la video enregistree',
  },
  editing: {
    titlePlaceholder: 'Titre bref de votre probleme...',
    titleHint: 'Entrez un titre bref decrivant votre probleme',
    descriptionPlaceholder: "Decrivez ce qui s'est passe...",
    descriptionHint: "Decrivez ce qui s'est passe en detail",
    sendReport: 'Envoyer le rapport',
    videoAttached: 'video jointe',
    formLabel: 'Formulaire de signalement de probleme',
  },
  submitting: {
    sending: 'Envoi de votre rapport...',
  },
  success: {
    title: 'Rapport envoye !',
    message:
      "Votre probleme a ete soumis avec succes. Notre equipe l'analysera et vous recontactera.",
    aiAnalysis: 'Analyse IA',
    severity: 'severite',
    viewTicket: 'Voir le ticket',
    close: 'Fermer',
  },
  analyzing: {
    title: 'Analyse en cours...',
    message: "Notre IA analyse votre rapport. Cela prend generalement moins d'une minute.",
    remaining: 'Encore {seconds}s environ',
    almostDone: 'Presque termine...',
    timedOutMessage: "L'analyse est en cours. Consultez votre tableau de bord pour les resultats.",
    closeBackground: "Fermer (l'analyse continue en arriere-plan)",
  },
  error: {
    title: 'Une erreur est survenue',
    tryAgain: 'Reessayer',
    close: 'Fermer',
    unknownError: 'Une erreur inconnue est survenue.',
  },
  cropping: {
    title: 'Selectionner une zone',
    instructionVideo: 'Dessinez un rectangle pour selectionner la zone a enregistrer.',
    instructionScreenshot: 'Dessinez un rectangle pour selectionner la zone a capturer.',
    confirm: 'Confirmer la selection',
    cancel: 'Annuler',
  },
};

const TRANSLATIONS: Record<SdkLocale, WidgetTranslations> = { en, fr };

/**
 * Detect locale from navigator.language.
 * Returns 'fr' if the browser language starts with 'fr', otherwise 'en'.
 */
export function detectLocale(): SdkLocale {
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('fr')) {
    return 'fr';
  }
  return 'en';
}

export function getWidgetTranslations(locale: SdkLocale): WidgetTranslations {
  return TRANSLATIONS[locale];
}
